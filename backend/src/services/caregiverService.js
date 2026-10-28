import mongoose from 'mongoose';
import { CaregiverProfile, User, Service, Document } from '../models/index.js';

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

  if (
    sanitizedUpdates.street !== undefined ||
    sanitizedUpdates.area !== undefined ||
    sanitizedUpdates.city !== undefined ||
    sanitizedUpdates.district !== undefined ||
    sanitizedUpdates.state !== undefined ||
    sanitizedUpdates.pincode !== undefined ||
    sanitizedUpdates.address !== undefined
  ) {
    const rawAddr = sanitizedUpdates.address || {};
    profile.street = sanitizedUpdates.street !== undefined ? sanitizedUpdates.street : (rawAddr.street || profile.street || '');
    profile.area = sanitizedUpdates.area !== undefined ? sanitizedUpdates.area : (rawAddr.area || profile.area || '');
    profile.city = sanitizedUpdates.city !== undefined ? sanitizedUpdates.city : (rawAddr.city || profile.city || 'Kochi, KL');
    profile.district = sanitizedUpdates.district !== undefined ? sanitizedUpdates.district : (rawAddr.district || profile.district || 'Ernakulam');
    profile.state = sanitizedUpdates.state !== undefined ? sanitizedUpdates.state : (rawAddr.state || profile.state || 'Kerala');
    profile.pincode = sanitizedUpdates.pincode !== undefined ? sanitizedUpdates.pincode : (rawAddr.pincode || profile.pincode || '');

    profile.address = {
      street: profile.street,
      area: profile.area,
      city: profile.city,
      district: profile.district,
      state: profile.state,
      pincode: profile.pincode,
    };
  }

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
    verificationStatus: profile.verificationStatus || 'verified',
    verified: profile.verificationStatus === 'verified',
    createdAt: profile.createdAt,
  };
};

/**
 * Retrieve public showcase directory of eligible, verified caregivers with filtering and bounded pagination.
 *
 * Strict privacy rule:
 * - Must be verificationStatus === 'verified'
 * - User account must be status === 'active' (not pending, suspended, or blocked)
 * - Excludes private fields: phone, email, nursingRegNo, documents, exact GPS coordinates, emergency contacts
 */
export const getPublicCaregivers = async (query = {}) => {
  const page = Math.max(1, parseInt(query.page, 10) || 1);
  const limit = Math.min(50, Math.max(1, parseInt(query.limit, 10) || 12));
  const skip = (page - 1) * limit;

  // 1. Find all active user IDs with role 'caregiver'
  const activeCaregiverUsers = await User.find({
    role: 'caregiver',
    status: 'active',
  }).select('_id');

  const activeUserIds = activeCaregiverUsers.map((u) => u._id);

  // 2. Build CaregiverProfile query
  const filter = {
    verificationStatus: 'verified',
    user: { $in: activeUserIds },
  };

  // Filter: City (case-insensitive substring or match)
  if (query.city && typeof query.city === 'string' && query.city.trim()) {
    const sanitizedCity = query.city.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    filter.city = { $regex: new RegExp(sanitizedCity, 'i') };
  }

  // Filter: Qualification
  if (query.qualification && typeof query.qualification === 'string' && query.qualification.trim()) {
    filter.qualification = query.qualification.trim();
  }

  // Filter: Availability Status
  if (query.availabilityStatus && typeof query.availabilityStatus === 'string' && query.availabilityStatus.trim()) {
    filter.availabilityStatus = query.availabilityStatus.trim();
  }

  // Filter: Max Rate
  if (query.maxRate !== undefined && !isNaN(Number(query.maxRate))) {
    filter.hourlyRate = { $lte: Number(query.maxRate) };
  }

  // Filter: Min Rating
  if (query.minRating !== undefined && !isNaN(Number(query.minRating))) {
    filter['rating.average'] = { $gte: Number(query.minRating) };
  }

  // Filter: Service (by Service ObjectId, slug, or service name)
  if (query.service && typeof query.service === 'string' && query.service.trim()) {
    const serviceTerm = query.service.trim();
    if (mongoose.Types.ObjectId.isValid(serviceTerm)) {
      filter.$or = [
        { servicesOffered: new mongoose.Types.ObjectId(serviceTerm) },
        { services: serviceTerm },
      ];
    } else {
      // Look up service in Service catalog by slug or name
      const foundCatalogService = await Service.findOne({
        $or: [
          { slug: serviceTerm.toLowerCase() },
          { name: { $regex: new RegExp(`^${serviceTerm.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i') } },
        ],
      }).select('_id name');

      if (foundCatalogService) {
        filter.$or = [
          { servicesOffered: foundCatalogService._id },
          { services: foundCatalogService.name },
          { services: { $regex: new RegExp(serviceTerm.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i') } },
        ];
      } else {
        filter.services = { $regex: new RegExp(serviceTerm.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i') };
      }
    }
  }

  // 3. Query profiles and count
  const [profiles, total] = await Promise.all([
    CaregiverProfile.find(filter)
      .sort({ 'rating.average': -1, completedJobs: -1, createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .populate('user', 'fullName status avatar')
      .populate('servicesOffered', 'name slug category baseHourlyRate minimumDurationHours isActive'),
    CaregiverProfile.countDocuments(filter),
  ]);

  // 4. Sanitize public representation (never expose email, phone, nursingRegNo, documents)
  const sanitizedList = profiles
    .filter((p) => p.user && p.user.status === 'active')
    .map((p) => ({
      _id: p._id,
      fullName: p.user.fullName,
      avatar: p.avatar || p.user.avatar || '',
      qualification: p.qualification,
      experienceYears: p.experienceYears,
      bio: p.bio,
      languages: p.languages,
      city: p.city,
      area: p.area,
      maxDistanceKm: p.maxDistanceKm,
      hourlyRate: p.hourlyRate,
      servicesOffered: p.servicesOffered || [],
      services: p.services || [],
      careSettings: p.careSettings,
      availabilityStatus: p.availabilityStatus,
      timezone: p.timezone,
      weeklySchedule: p.weeklySchedule,
      rating: p.rating,
      trustScore: p.trustScore,
      completedJobs: p.completedJobs,
      badges: p.badges,
      verificationStatus: p.verificationStatus || 'verified',
      verified: p.verificationStatus === 'verified',
      createdAt: p.createdAt,
    }));

  return {
    caregivers: sanitizedList,
    pagination: {
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit) || 1,
    },
  };
};

/**
 * Retrieve authenticated caregiver's truthful verification status, completion rate,
 * required document slots, and audit trail.
 */
export const getMyDocuments = async (userId) => {
  const profile = await CaregiverProfile.findOne({ user: userId });
  if (!profile) {
    const err = new Error('Caregiver profile not found');
    err.statusCode = 404;
    err.name = 'NotFoundError';
    throw err;
  }

  const user = await User.findById(userId).select('fullName email phone createdAt');

  // Determine required document types based on caregiver's qualification
  const isStudent =
    profile.qualification === 'nursing_student' ||
    profile.qualification === 'Nursing Student (Final Year)' ||
    profile.qualification === 'Nursing Student';

  const requiredTypes = [
    {
      type: 'identity',
      label: 'Identity Verification',
      hint: 'Government-issued photo ID (Aadhaar / Passport / Voter ID)',
    },
    isStudent
      ? {
          type: 'college_id',
          label: 'Nursing Student College ID',
          hint: 'Valid nursing college identity card with current academic year',
        }
      : {
          type: 'nursing_registration',
          label: 'Nursing Registration Certificate',
          hint: 'State Nursing Council registration certificate or degree proof',
        },
    {
      type: 'address_proof',
      label: 'Address Verification',
      hint: 'Recent utility bill, rent agreement, or bank passbook address page',
    },
    {
      type: 'police_clearance',
      label: 'Police Clearance Certificate',
      hint: 'Police clearance certificate issued within the last 12 months',
    },
    {
      type: 'bank_verification',
      label: 'Bank Verification',
      hint: 'Cancelled cheque or bank passbook showing account number and IFSC',
    },
  ];

  const docs = await Document.find({
    $or: [
      { user: userId },
      { caregiverProfile: profile._id },
    ],
  })
    .sort({ createdAt: -1 })
    .populate('reviewedBy', 'fullName email');

  // Map latest document per documentType
  const docsByType = new Map();
  for (const doc of docs) {
    if (!docsByType.has(doc.documentType)) {
      docsByType.set(doc.documentType, doc);
    }
  }

  const items = requiredTypes.map((reqDef) => {
    const existing = docsByType.get(reqDef.type);
    if (existing) {
      let statusLabel = 'Pending';
      if (existing.verificationStatus === 'verified') statusLabel = 'Verified';
      else if (existing.verificationStatus === 'rejected') statusLabel = 'Rejected';
      else if (existing.verificationStatus === 'under_review') statusLabel = 'Under Review';

      return {
        id: String(existing._id),
        type: reqDef.label,
        documentType: reqDef.type,
        file: existing.fileName || `${reqDef.type}.pdf`,
        fileName: existing.fileName,
        fileSize: existing.fileSize,
        mimeType: existing.mimeType,
        fileUrl: existing.fileKey?.startsWith('data:') ? existing.fileKey : null,
        status: statusLabel,
        verificationStatus: existing.verificationStatus,
        feedback: existing.reviewerNotes || '',
        reviewerNotes: existing.reviewerNotes || '',
        reviewedBy: existing.reviewedBy?.fullName || null,
        reviewedAt: existing.reviewedAt || null,
        uploadedOn: existing.createdAt ? existing.createdAt.toISOString().slice(0, 10) : null,
        required: true,
        hint: reqDef.hint,
      };
    }
    return {
      id: `missing-${reqDef.type}`,
      type: reqDef.label,
      documentType: reqDef.type,
      file: '',
      fileName: '',
      fileSize: 0,
      mimeType: '',
      fileUrl: null,
      status: 'Not uploaded',
      verificationStatus: 'not_uploaded',
      feedback: '',
      reviewerNotes: '',
      reviewedBy: null,
      reviewedAt: null,
      uploadedOn: null,
      required: true,
      hint: reqDef.hint,
    };
  });

  const verifiedCount = items.filter((d) => d.status === 'Verified').length;
  const uploadedCount = items.filter((d) => d.status !== 'Not uploaded').length;
  const totalRequired = requiredTypes.length;
  const completionPct = Math.round((verifiedCount / totalRequired) * 100);

  // Construct truthful chronological audit history
  const history = [
    {
      at: user?.createdAt ? user.createdAt.toISOString() : profile.createdAt.toISOString(),
      action: 'Application submitted',
      by: user?.fullName || 'Caretaker',
    },
  ];

  for (const doc of docs) {
    if (doc.createdAt) {
      const typeLabel = requiredTypes.find((r) => r.type === doc.documentType)?.label || doc.documentType;
      history.push({
        at: doc.createdAt.toISOString(),
        action: `${typeLabel} uploaded`,
        by: user?.fullName || 'Caretaker',
      });
    }
    if (doc.reviewedAt) {
      const typeLabel = requiredTypes.find((r) => r.type === doc.documentType)?.label || doc.documentType;
      const statusTitle = doc.verificationStatus === 'verified' ? 'Verified' : 'Rejected';
      history.push({
        at: doc.reviewedAt.toISOString(),
        action: `${typeLabel} marked ${statusTitle}${doc.reviewerNotes ? `: ${doc.reviewerNotes}` : ''}`,
        by: doc.reviewedBy?.fullName || 'Operations Desk',
      });
    }
  }

  if (profile.verificationStatus === 'verified') {
    history.push({
      at: profile.updatedAt ? profile.updatedAt.toISOString() : new Date().toISOString(),
      action: 'Application approved — profile marked Verified',
      by: 'Operations Desk',
    });
  } else if (profile.verificationStatus === 'rejected') {
    history.push({
      at: profile.updatedAt ? profile.updatedAt.toISOString() : new Date().toISOString(),
      action: 'Application rejected by compliance team',
      by: 'Operations Desk',
    });
  }

  // Sort history chronologically
  history.sort((a, b) => new Date(a.at) - new Date(b.at));

  let overallStatus = 'Pending';
  if (profile.verificationStatus === 'verified') overallStatus = 'Verified';
  else if (profile.verificationStatus === 'rejected') overallStatus = 'Rejected';
  else if (profile.verificationStatus === 'under_review') overallStatus = 'Under Review';

  return {
    id: `VR-${String(profile._id).toUpperCase()}`,
    caregiverId: String(profile._id),
    userId: String(userId),
    name: user?.fullName || 'Caretaker',
    regNo: profile.nursingRegNo || '',
    qualification: profile.qualification || '',
    submittedOn: user?.createdAt || profile.createdAt,
    status: overallStatus,
    verificationStatus: profile.verificationStatus,
    verified: profile.verificationStatus === 'verified',
    completionPct,
    verifiedCount,
    uploadedCount,
    totalRequired,
    documents: items,
    history,
  };
};

/**
 * Upload or re-upload an individual verification document.
 * Safely upserts document record in Document collection and updates CaregiverProfile status.
 */
export const uploadCaregiverDocument = async (userId, docData) => {
  const profile = await CaregiverProfile.findOne({ user: userId });
  if (!profile) {
    const err = new Error('Caregiver profile not found');
    err.statusCode = 404;
    err.name = 'NotFoundError';
    throw err;
  }

  const { documentType, fileName, fileSize, mimeType, fileKey } = docData;

  let doc = await Document.findOne({
    user: userId,
    documentType,
  });

  if (doc) {
    doc.fileName = fileName;
    doc.fileSize = fileSize;
    doc.mimeType = mimeType;
    doc.fileKey = fileKey;
    doc.verificationStatus = 'under_review';
    doc.reviewerNotes = '';
    doc.reviewedBy = null;
    doc.reviewedAt = null;
    await doc.save();
  } else {
    doc = await Document.create({
      user: userId,
      caregiverProfile: profile._id,
      documentType,
      fileName,
      fileSize,
      mimeType,
      fileKey,
      verificationStatus: 'under_review',
    });
  }

  // If caregiver profile was pending or rejected, transition it to under_review
  if (profile.verificationStatus === 'pending' || profile.verificationStatus === 'rejected') {
    profile.verificationStatus = 'under_review';
    await profile.save();
  }

  return doc;
};

