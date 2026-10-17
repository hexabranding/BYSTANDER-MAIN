import mongoose from 'mongoose';
import { CaregiverProfile, User, Service } from '../models/index.js';

/**
 * Validate that every submitted service ID is a valid ObjectId and references an existing active Service.
 * @param {Array<string|mongoose.Types.ObjectId>} serviceIds
 * @returns {Promise<Array<mongoose.Types.ObjectId>>} Validated ObjectId instances
 */
export const validateServicesExistAndActive = async (serviceIds) => {
  if (!Array.isArray(serviceIds)) {
    const err = new Error('servicesOffered must be an array of service ObjectIds');
    err.statusCode = 400;
    err.name = 'ValidationError';
    throw err;
  }

  if (serviceIds.length === 0) {
    return [];
  }

  // 1. Validate ObjectId format for all entries
  for (const id of serviceIds) {
    if (!id || !mongoose.Types.ObjectId.isValid(String(id))) {
      const err = new Error(`Invalid service identifier: '${id}' is not a valid ObjectId`);
      err.statusCode = 400;
      err.name = 'ValidationError';
      throw err;
    }
  }

  // 2. Deduplicate IDs
  const uniqueStringIds = [...new Set(serviceIds.map((id) => String(id)))];

  // 3. Query Service collection
  const foundServices = await Service.find({
    _id: { $in: uniqueStringIds },
  }).select('_id name isActive');

  const foundMap = new Map(foundServices.map((s) => [String(s._id), s]));

  // 4. Verify existence and active status
  for (const id of uniqueStringIds) {
    const service = foundMap.get(id);
    if (!service) {
      const err = new Error(`Service '${id}' does not exist in the service catalog`);
      err.statusCode = 400;
      err.name = 'ValidationError';
      throw err;
    }

    if (!service.isActive) {
      const err = new Error(`Service '${service.name}' (${id}) is inactive and cannot be selected`);
      err.statusCode = 400;
      err.name = 'ValidationError';
      throw err;
    }
  }

  return uniqueStringIds.map((id) => new mongoose.Types.ObjectId(id));
};

/**
 * Retrieve authenticated caregiver's private profile.
 */
export const getMyCaregiverProfile = async (userId) => {
  const profile = await CaregiverProfile.findOne({ user: userId })
    .populate(
      'user',
      'fullName email phone status avatar isEmailVerified isPhoneVerified createdAt',
    )
    .populate('servicesOffered', 'name slug category baseHourlyRate minimumDurationHours isActive');

  if (!profile) {
    const err = new Error('Caregiver profile not found');
    err.statusCode = 404;
    err.name = 'NotFoundError';
    throw err;
  }

  return profile;
};

/**
 * Update permitted professional fields on the caregiver's own profile.
 */
export const updateMyCaregiverProfile = async (userId, sanitizedUpdates) => {
  const profile = await CaregiverProfile.findOne({ user: userId });

  if (!profile) {
    const err = new Error('Caregiver profile not found');
    err.statusCode = 404;
    err.name = 'NotFoundError';
    throw err;
  }

  // If servicesOffered is provided, validate against catalog
  if (sanitizedUpdates.servicesOffered !== undefined) {
    const validatedIds = await validateServicesExistAndActive(sanitizedUpdates.servicesOffered);
    profile.servicesOffered = validatedIds;
    delete sanitizedUpdates.servicesOffered;
  }

  // Apply permitted updates only
  Object.keys(sanitizedUpdates).forEach((key) => {
    profile[key] = sanitizedUpdates[key];
  });

  await profile.save();

  return profile.populate([
    {
      path: 'user',
      select: 'fullName email phone status avatar isEmailVerified isPhoneVerified createdAt',
    },
    {
      path: 'servicesOffered',
      select: 'name slug category baseHourlyRate minimumDurationHours isActive',
    },
  ]);
};

/**
 * Retrieve authenticated caregiver's availability configuration.
 */
export const getMyAvailability = async (userId) => {
  const profile = await CaregiverProfile.findOne({ user: userId }).select(
    'timezone availabilityStatus weeklySchedule dateExceptions',
  );

  if (!profile) {
    const err = new Error('Caregiver profile not found');
    err.statusCode = 404;
    err.name = 'NotFoundError';
    throw err;
  }

  return {
    timezone: profile.timezone || 'Asia/Kolkata',
    availabilityStatus: profile.availabilityStatus,
    weeklySchedule: profile.weeklySchedule || [],
    dateExceptions: profile.dateExceptions || [],
  };
};

/**
 * Update authenticated caregiver's availability (recurring schedule & date exceptions).
 */
export const updateMyAvailability = async (userId, availabilityData) => {
  const profile = await CaregiverProfile.findOne({ user: userId });

  if (!profile) {
    const err = new Error('Caregiver profile not found');
    err.statusCode = 404;
    err.name = 'NotFoundError';
    throw err;
  }

  if (availabilityData.timezone) {
    profile.timezone = availabilityData.timezone.trim();
  }

  if (availabilityData.availabilityStatus) {
    profile.availabilityStatus = availabilityData.availabilityStatus;
  }

  if (availabilityData.weeklySchedule && Array.isArray(availabilityData.weeklySchedule)) {
    profile.weeklySchedule = availabilityData.weeklySchedule;
  }

  if (availabilityData.dateExceptions && Array.isArray(availabilityData.dateExceptions)) {
    profile.dateExceptions = availabilityData.dateExceptions;
  }

  await profile.save();

  return {
    timezone: profile.timezone,
    availabilityStatus: profile.availabilityStatus,
    weeklySchedule: profile.weeklySchedule,
    dateExceptions: profile.dateExceptions,
  };
};

/**
 * Retrieve public showcase profile for an eligible caregiver.
 * Strict privacy rule:
 * - Must be verificationStatus === 'verified'
 * - User account must be status === 'active' (not pending, suspended, or blocked)
 * - Excludes private fields: phone, email, nursingRegNo, documents
 */
export const getPublicCaregiverProfileById = async (caregiverId) => {
  if (!mongoose.Types.ObjectId.isValid(caregiverId)) {
    const err = new Error('Caregiver not found or is currently ineligible for public listing');
    err.statusCode = 404;
    err.name = 'NotFoundError';
    throw err;
  }

  // 1. Fetch profile and verify verificationStatus is verified
  const profile = await CaregiverProfile.findOne({
    _id: caregiverId,
    verificationStatus: 'verified',
  })
    .populate('user', 'fullName status avatar')
    .populate('servicesOffered', 'name slug category baseHourlyRate minimumDurationHours isActive');

  // 2. Reject if profile missing or user is not active (suspended/blocked/pending)
  if (!profile || !profile.user || profile.user.status !== 'active') {
    const err = new Error('Caregiver not found or is currently ineligible for public listing');
    err.statusCode = 404;
    err.name = 'NotFoundError';
    throw err;
  }

  // 3. Format strictly sanitized public presentation
  return {
    _id: profile._id,
    fullName: profile.user.fullName,
    avatar: profile.avatar || profile.user.avatar || '',
    qualification: profile.qualification,
    experienceYears: profile.experienceYears,
    bio: profile.bio,
    languages: profile.languages,
    city: profile.city,
    area: profile.area,
    maxDistanceKm: profile.maxDistanceKm,
    hourlyRate: profile.hourlyRate,
    servicesOffered: profile.servicesOffered || [],
    services: profile.services || [],
    careSettings: profile.careSettings,
    availabilityStatus: profile.availabilityStatus,
    timezone: profile.timezone,
    weeklySchedule: profile.weeklySchedule,
    rating: profile.rating,
    trustScore: profile.trustScore,
    completedJobs: profile.completedJobs,
    badges: profile.badges,
    createdAt: profile.createdAt,
  };
};
