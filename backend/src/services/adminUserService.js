import mongoose from 'mongoose';
import User from '../models/User.js';
import CustomerProfile from '../models/CustomerProfile.js';
import CaregiverProfile from '../models/CaregiverProfile.js';
import Booking from '../models/Booking.js';

/**
 * Sanitizes user entity for administrative views.
 * Ensures zero credential hashes or internal implementation flags are exposed.
 */
const sanitizeUserRecord = (user) => {
  if (!user) return null;
  const obj = user.toObject ? user.toObject() : { ...user };
  delete obj.passwordHash;
  delete obj.__v;
  return obj;
};

/**
 * Retrieves paginated list of registered customers with profile and live booking summary.
 *
 * @param {Object} query - { page, limit, status, city, search }
 * @returns {Promise<{ customers: Array, pagination: Object, stats: Object }>}
 */
export const getCustomers = async (query = {}) => {
  const { page = 1, limit = 10, status, city, search } = query;

  const parsedPage = Math.max(1, parseInt(page, 10) || 1);
  const parsedLimit = Math.min(100, Math.max(1, parseInt(limit, 10) || 10));
  const skip = (parsedPage - 1) * parsedLimit;

  // Build query filter for User collection
  const userFilter = { role: 'customer' };

  if (status && status !== 'All' && status !== '') {
    userFilter.status = status.trim().toLowerCase();
  }

  // Handle city filter via CustomerProfile
  let userIdsMatchingCity = null;
  if (city && city !== 'All' && city.trim().length > 0) {
    const profilesInCity = await CustomerProfile.find({
      'defaultAddress.city': new RegExp(city.trim(), 'i'),
    }).select('user');
    userIdsMatchingCity = profilesInCity.map((p) => p.user);
    userFilter._id = { $in: userIdsMatchingCity };
  }

  // Handle search filter across name, email, phone, or city
  if (search && search.trim().length > 0) {
    const searchRegex = new RegExp(search.trim(), 'i');

    const matchingProfiles = await CustomerProfile.find({
      $or: [
        { 'defaultAddress.city': searchRegex },
        { 'defaultAddress.area': searchRegex },
      ],
    }).select('user');

    const profileUserIds = matchingProfiles.map((p) => p.user);

    const searchCondition = [
      { fullName: searchRegex },
      { email: searchRegex },
      { phone: searchRegex },
      { _id: { $in: profileUserIds } },
    ];

    if (userFilter._id) {
      userFilter.$and = [
        { _id: userFilter._id },
        { $or: searchCondition },
      ];
      delete userFilter._id;
    } else {
      userFilter.$or = searchCondition;
    }
  }

  // Execute paginated User query
  const [users, total] = await Promise.all([
    User.find(userFilter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parsedLimit)
      .select('fullName email phone role status statusReason statusUpdatedAt lastLoginAt createdAt updatedAt'),
    User.countDocuments(userFilter),
  ]);

  const userIds = users.map((u) => u._id);

  // Retrieve customer profiles and live booking totals in parallel
  const [profiles, bookingAggregates] = await Promise.all([
    CustomerProfile.find({ user: { $in: userIds } }),
    Booking.aggregate([
      { $match: { customer: { $in: userIds } } },
      {
        $group: {
          _id: '$customer',
          totalBookings: { $sum: 1 },
          totalSpent: {
            $sum: {
              $cond: [{ $ne: ['$status', 'cancelled'] }, '$totalAmount', 0],
            },
          },
        },
      },
    ]),
  ]);

  const profileMap = new Map(profiles.map((p) => [String(p.user), p]));
  const bookingMap = new Map(bookingAggregates.map((b) => [String(b._id), b]));

  // Aggregate stats across all customers in DB for top-level stats cards
  const [totalCustomers, activeCustomers, suspendedCustomers, blockedCustomers] = await Promise.all([
    User.countDocuments({ role: 'customer' }),
    User.countDocuments({ role: 'customer', status: 'active' }),
    User.countDocuments({ role: 'customer', status: 'suspended' }),
    User.countDocuments({ role: 'customer', status: 'blocked' }),
  ]);

  const customers = users.map((user) => {
    const p = profileMap.get(String(user._id));
    const b = bookingMap.get(String(user._id));

    return {
      id: String(user._id),
      _id: String(user._id),
      name: user.fullName,
      email: user.email || '',
      phone: user.phone || '',
      role: user.role,
      status: user.status,
      statusReason: user.statusReason || null,
      statusUpdatedAt: user.statusUpdatedAt || null,
      lastLoginAt: user.lastLoginAt || null,
      createdAt: user.createdAt,
      city: p?.defaultAddress?.city || '—',
      area: p?.defaultAddress?.area || '',
      defaultAddress: p?.defaultAddress || null,
      patientsCount: p?.patients?.length || 0,
      emergencyContact: p?.emergencyContact ? {
        name: p.emergencyContact.name,
        phone: p.emergencyContact.phone,
        relation: p.emergencyContact.relation,
      } : null,
      totalBookings: b?.totalBookings ?? p?.totalBookings ?? 0,
      totalSpent: b?.totalSpent ?? p?.totalSpent ?? 0,
    };
  });

  return {
    customers,
    pagination: {
      total,
      page: parsedPage,
      limit: parsedLimit,
      totalPages: Math.ceil(total / parsedLimit) || 1,
    },
    stats: {
      total: totalCustomers,
      active: activeCustomers,
      suspended: suspendedCustomers,
      blocked: blockedCustomers,
    },
  };
};

/**
 * Retrieves paginated list of registered caregivers with verification and account status.
 *
 * @param {Object} query - { page, limit, status, verificationStatus, city, qualification, sort, search }
 * @returns {Promise<{ caregivers: Array, pagination: Object, stats: Object }>}
 */
export const getCaregivers = async (query = {}) => {
  const {
    page = 1,
    limit = 10,
    status,
    verificationStatus,
    city,
    qualification,
    sort = 'rating',
    search,
  } = query;

  const parsedPage = Math.max(1, parseInt(page, 10) || 1);
  const parsedLimit = Math.min(100, Math.max(1, parseInt(limit, 10) || 10));
  const skip = (parsedPage - 1) * parsedLimit;

  const profileFilter = {};

  if (verificationStatus && verificationStatus !== 'All' && verificationStatus !== '') {
    profileFilter.verificationStatus = verificationStatus.trim().toLowerCase();
  }

  if (city && city !== 'All' && city.trim().length > 0) {
    profileFilter.city = new RegExp(city.trim(), 'i');
  }

  if (qualification && qualification !== 'All' && qualification.trim().length > 0) {
    profileFilter.qualification = qualification.trim();
  }

  // Handle user account status filter
  let userIdsMatchingStatus = null;
  if (status && status !== 'All' && status !== '') {
    const matchingUsers = await User.find({
      role: 'caregiver',
      status: status.trim().toLowerCase(),
    }).select('_id');
    userIdsMatchingStatus = matchingUsers.map((u) => u._id);
    profileFilter.user = { $in: userIdsMatchingStatus };
  }

  // Handle search filter across name, phone, email, qualification, regNo, city, or services
  if (search && search.trim().length > 0) {
    const searchRegex = new RegExp(search.trim(), 'i');
    const matchingUsers = await User.find({
      role: 'caregiver',
      $or: [
        { fullName: searchRegex },
        { email: searchRegex },
        { phone: searchRegex },
      ],
    }).select('_id');

    const searchUserIds = matchingUsers.map((u) => u._id);

    const orClauses = [
      { user: { $in: searchUserIds } },
      { qualification: searchRegex },
      { nursingRegNo: searchRegex },
      { city: searchRegex },
      { area: searchRegex },
      { services: searchRegex },
    ];

    if (profileFilter.user) {
      profileFilter.$and = [
        { user: profileFilter.user },
        { $or: orClauses },
      ];
      delete profileFilter.user;
    } else {
      profileFilter.$or = orClauses;
    }
  }

  // Build sort criteria
  let sortCriteria = { 'rating.average': -1 };
  if (sort === 'experience') {
    sortCriteria = { experienceYears: -1 };
  } else if (sort === 'rate') {
    sortCriteria = { hourlyRate: -1 };
  } else if (sort === 'newest' || sort === 'createdAt') {
    sortCriteria = { createdAt: -1 };
  }

  const [profiles, total] = await Promise.all([
    CaregiverProfile.find(profileFilter)
      .sort(sortCriteria)
      .skip(skip)
      .limit(parsedLimit)
      .populate('user', 'fullName email phone status statusReason statusUpdatedAt lastLoginAt createdAt'),
    CaregiverProfile.countDocuments(profileFilter),
  ]);

  // Aggregate stats across caregivers
  const [totalCaregivers, verifiedCount, pendingCount, rejectedCount] = await Promise.all([
    CaregiverProfile.countDocuments(),
    CaregiverProfile.countDocuments({ verificationStatus: 'verified' }),
    CaregiverProfile.countDocuments({ verificationStatus: { $in: ['pending', 'under_review'] } }),
    CaregiverProfile.countDocuments({ verificationStatus: 'rejected' }),
  ]);

  const caregivers = profiles.map((p) => {
    const user = p.user || {};
    const isSuspended = user.status === 'suspended';
    const isBlocked = user.status === 'blocked';

    return {
      id: String(p._id),
      _id: String(p._id),
      userId: user._id ? String(user._id) : '',
      name: user.fullName || 'Caregiver',
      email: user.email || '',
      phone: user.phone || '',
      photo: p.avatar || '',
      qualification: p.qualification,
      regNo: p.nursingRegNo || '—',
      experienceYears: p.experienceYears || 0,
      hourlyRate: p.hourlyRate || 0,
      city: p.city,
      area: p.area || '',
      services: p.services || [],
      careSettings: p.careSettings || ['Home Care'],
      availabilityStatus: p.availabilityStatus || 'Available Now',
      verificationStatus: p.verificationStatus,
      rating: p.rating?.average || 5.0,
      ratingCount: p.rating?.count || 0,
      trustScore: p.trustScore || 50,
      completedJobs: p.completedJobs || 0,
      badges: p.badges || [],
      status: user.status || 'active',
      isSuspended,
      isBlocked,
      statusReason: user.statusReason || null,
      statusUpdatedAt: user.statusUpdatedAt || null,
      createdAt: p.createdAt,
      lastLoginAt: user.lastLoginAt || null,
    };
  });

  return {
    caregivers,
    pagination: {
      total,
      page: parsedPage,
      limit: parsedLimit,
      totalPages: Math.ceil(total / parsedLimit) || 1,
    },
    stats: {
      total: totalCaregivers,
      verified: verifiedCount,
      pending: pendingCount,
      rejected: rejectedCount,
    },
  };
};

/**
 * Retrieves single user details with profile information and complete status change audit trail.
 *
 * @param {string} id - User._id or CaregiverProfile._id
 * @returns {Promise<Object>}
 */
export const getUserById = async (id) => {
  if (!mongoose.Types.ObjectId.isValid(id)) {
    const err = new Error('Invalid user or profile identifier format');
    err.statusCode = 400;
    err.name = 'ValidationError';
    throw err;
  }

  // Resolve user: attempt direct User lookup, then fallback to CaregiverProfile.user
  let user = await User.findById(id)
    .select('+statusAuditTrail')
    .populate('statusAuditTrail.changedBy', 'fullName email');

  let profile = null;

  if (!user) {
    const cg = await CaregiverProfile.findById(id);
    if (cg && cg.user) {
      user = await User.findById(cg.user)
        .select('+statusAuditTrail')
        .populate('statusAuditTrail.changedBy', 'fullName email');
      profile = cg;
    }
  }

  if (!user) {
    const err = new Error('User account not found');
    err.statusCode = 404;
    err.name = 'NotFoundError';
    throw err;
  }

  if (!profile) {
    if (user.role === 'customer') {
      profile = await CustomerProfile.findOne({ user: user._id });
    } else if (user.role === 'caregiver') {
      profile = await CaregiverProfile.findOne({ user: user._id });
    }
  }

  const sanitized = sanitizeUserRecord(user);

  return {
    ...sanitized,
    profile: profile ? (profile.toObject ? profile.toObject() : profile) : null,
  };
};

/**
 * Atomically updates user account status with mandatory reason, audit trail,
 * self-suspension guard, and last-admin lockout prevention.
 *
 * @param {string} targetId - User._id or CaregiverProfile._id
 * @param {Object} payload - { status: 'active' | 'suspended' | 'blocked', reason: string }
 * @param {Object} actingAdmin - Authenticated admin User document
 * @returns {Promise<Object>} Updated user record
 */
export const updateUserStatus = async (targetId, payload, actingAdmin) => {
  const { status: newStatus, reason } = payload;

  if (!mongoose.Types.ObjectId.isValid(targetId)) {
    const err = new Error('Invalid user identifier format');
    err.statusCode = 400;
    err.name = 'ValidationError';
    throw err;
  }

  // 1. Resolve target User document
  let targetUser = await User.findById(targetId);
  if (!targetUser) {
    // Check if targetId is a CaregiverProfile id
    const cgProfile = await CaregiverProfile.findById(targetId);
    if (cgProfile && cgProfile.user) {
      targetUser = await User.findById(cgProfile.user);
    }
  }

  if (!targetUser) {
    const err = new Error('User account not found');
    err.statusCode = 404;
    err.name = 'NotFoundError';
    throw err;
  }

  const previousStatus = targetUser.status;

  // 2. Validate status transition
  if (previousStatus === newStatus) {
    const err = new Error(`Account is already in '${newStatus}' status.`);
    err.statusCode = 400;
    err.name = 'ValidationError';
    throw err;
  }

  // 3. Security Guard: Prevent administrators from suspending or blocking their own account
  if (
    actingAdmin._id.toString() === targetUser._id.toString() &&
    ['suspended', 'blocked'].includes(newStatus)
  ) {
    const err = new Error('Administrators cannot suspend or block their own account.');
    err.statusCode = 400;
    err.name = 'ValidationError';
    throw err;
  }

  // 4. Security Guard: Prevent lockout of the platform's last usable administrator
  if (targetUser.role === 'admin' && ['suspended', 'blocked'].includes(newStatus)) {
    const activeAdminCount = await User.countDocuments({
      role: 'admin',
      status: 'active',
    });

    if (activeAdminCount <= 1) {
      const err = new Error(
        "Cannot suspend or block the platform's last active administrator. At least one active admin account must remain."
      );
      err.statusCode = 400;
      err.name = 'ValidationError';
      throw err;
    }
  }

  // 5. Atomic CAS Status Update & Audit Trail Append
  const auditEntry = {
    previousStatus,
    newStatus,
    reason: reason.trim(),
    changedBy: actingAdmin._id,
    changedAt: new Date(),
  };

  const updatedUser = await User.findOneAndUpdate(
    { _id: targetUser._id, status: previousStatus },
    {
      $set: {
        status: newStatus,
        statusReason: reason.trim(),
        statusUpdatedAt: auditEntry.changedAt,
      },
      $push: {
        statusAuditTrail: auditEntry,
      },
    },
    { new: true, runValidators: true }
  );

  if (!updatedUser) {
    const err = new Error('Concurrent modification detected. Please refresh and retry.');
    err.statusCode = 409;
    err.name = 'ConflictError';
    throw err;
  }

  const sanitized = sanitizeUserRecord(updatedUser);

  return {
    ...sanitized,
    latestAudit: {
      ...auditEntry,
      changedByName: actingAdmin.fullName,
    },
  };
};

export const adminUserService = {
  getCustomers,
  getCaregivers,
  getUserById,
  updateUserStatus,
};

export default adminUserService;
