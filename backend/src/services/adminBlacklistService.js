import mongoose from 'mongoose';
import Blacklist from '../models/Blacklist.js';
import User from '../models/User.js';

/**
 * Blacklist Service
 * Handles purely real blacklist records and synchronization with User account statuses in MongoDB.
 */


/**
 * Formats a Blacklist record for API response matching frontend contracts.
 */
const formatBlacklistEntry = (doc) => {
  const obj = doc.toObject ? doc.toObject() : doc;
  return {
    id: obj.entryId || String(obj._id),
    _id: String(obj._id),
    name: obj.name,
    type: obj.type,
    reason: obj.reason,
    user: obj.user ? (obj.user._id ? String(obj.user._id) : String(obj.user)) : null,
    phone: obj.phone || (obj.user?.phone || null),
    email: obj.email || (obj.user?.email || null),
    addedOn: obj.addedOn ? new Date(obj.addedOn).toISOString().slice(0, 10) : new Date().toISOString().slice(0, 10),
    addedBy: obj.addedBy || 'Operations Administrator',
    reviewAfter: obj.reviewAfter || 'Permanent',
    status: obj.status || 'active',
    createdAt: obj.createdAt,
    updatedAt: obj.updatedAt,
  };
};

/**
 * Retrieves all active blacklist entries from MongoDB with search, type filter, and live stats.
 *
 * @param {Object} query - { search, type, page, limit }
 * @returns {Promise<{ entries: Array, stats: Object, pagination: Object }>}
 */
export const getBlacklistEntries = async (query = {}) => {
  // Sync any User who was blocked from customer/caregiver directory into Blacklist if missing
  const blockedUsers = await User.find({
    status: { $in: ['blocked', 'suspended'] },
    role: { $in: ['customer', 'caregiver'] },
  });

  for (const u of blockedUsers) {
    const exists = await Blacklist.findOne({
      status: 'active',
      $or: [{ user: u._id }, { name: new RegExp(`^${u.fullName.trim()}$`, 'i') }],
    });

    if (!exists) {
      const latest = await Blacklist.findOne({}, {}, { sort: { createdAt: -1 } });
      let nextNum = 101;
      if (latest && latest.entryId && latest.entryId.startsWith('BL-')) {
        const p = parseInt(latest.entryId.replace('BL-', ''), 10);
        if (!Number.isNaN(p)) nextNum = p + 1;
      }
      await Blacklist.create({
        entryId: `BL-${nextNum}`,
        name: u.fullName,
        type: u.role === 'customer' ? 'Customer' : 'Caretaker',
        reason: (u.statusReason && u.statusReason.trim().length >= 3)
          ? u.statusReason.trim()
          : 'Account suspended/blocked by operations admin in user directory',
        user: u._id,
        phone: u.phone,
        email: u.email,
        addedOn: u.statusUpdatedAt || u.updatedAt || new Date(),
        addedBy: 'Operations Administrator',
        reviewAfter: (u.statusReviewAfter && u.statusReviewAfter !== 'Temporary') ? u.statusReviewAfter : 'Permanent',
        status: 'active',
      });
    } else if (!exists.user) {
      exists.user = u._id;
      if (!exists.phone) exists.phone = u.phone;
      if (!exists.email) exists.email = u.email;
      await exists.save();
    }
  }

  const { search, type, page = 1, limit = 50 } = query;
  const parsedPage = Math.max(1, parseInt(page, 10) || 1);
  const parsedLimit = Math.min(100, Math.max(1, parseInt(limit, 10) || 50));
  const skip = (parsedPage - 1) * parsedLimit;

  // Build filter
  const filter = { status: 'active' };

  if (type && type !== 'All') {
    if (type === 'Caregivers' || type === 'Caretakers' || type === 'Caretaker') {
      filter.type = 'Caretaker';
    } else if (type === 'Customers' || type === 'Customer') {
      filter.type = 'Customer';
    }
  }

  if (search && search.trim().length > 0) {
    const q = search.trim();
    const regex = new RegExp(q, 'i');
    filter.$or = [
      { name: regex },
      { reason: regex },
      { entryId: regex },
      { addedBy: regex },
      { phone: regex },
      { email: regex },
    ];
  }

  // Query database
  const [docs, totalFiltered, allActiveDocs] = await Promise.all([
    Blacklist.find(filter)
      .populate('user', 'fullName email phone status role')
      .sort({ addedOn: -1, createdAt: -1 })
      .skip(skip)
      .limit(parsedLimit),
    Blacklist.countDocuments(filter),
    Blacklist.find({ status: 'active' }),
  ]);

  const entries = docs.map(formatBlacklistEntry);

  // Authoritative live stats across all active entries in MongoDB
  const total = allActiveDocs.length;
  const caregivers = allActiveDocs.filter((b) => b.type === 'Caretaker').length;
  const customers = allActiveDocs.filter((b) => b.type === 'Customer').length;
  const permanent = allActiveDocs.filter((b) => String(b.reviewAfter).toLowerCase() === 'permanent').length;

  return {
    entries,
    stats: {
      total,
      caregivers,
      customers,
      permanent,
    },
    pagination: {
      total: totalFiltered,
      page: parsedPage,
      limit: parsedLimit,
      totalPages: Math.ceil(totalFiltered / parsedLimit) || 1,
    },
  };
};

/**
 * Adds an account to the blacklist in MongoDB.
 * If linked to a registered User, updates the User account status to 'blocked' platform-wide.
 *
 * @param {Object} payload - { name, type, reason, reviewAfter, userId, phone, email }
 * @param {Object} actingAdmin - Authenticated admin User document
 * @returns {Promise<Object>} Created blacklist entry
 */
export const addBlacklistEntry = async (payload, actingAdmin = {}) => {
  const { name, type = 'Caretaker', reason, reviewAfter, userId, phone, email } = payload;

  if (!name || name.trim().length < 2) {
    const err = new Error('Full account name is required (at least 2 characters)');
    err.statusCode = 400;
    throw err;
  }

  if (!reason || reason.trim().length < 3) {
    const err = new Error('A reason for the ban is mandatory (at least 3 characters)');
    err.statusCode = 400;
    throw err;
  }

  // Generate next entry ID
  const latestEntry = await Blacklist.findOne({}, {}, { sort: { createdAt: -1 } });
  let nextNumber = 115;
  if (latestEntry && latestEntry.entryId && latestEntry.entryId.startsWith('BL-')) {
    const parsedNum = parseInt(latestEntry.entryId.replace('BL-', ''), 10);
    if (!Number.isNaN(parsedNum)) {
      nextNumber = parsedNum + 1;
    }
  }
  const entryId = `BL-${nextNumber}`;

  // Check if a registered User should be blocked
  let targetUser = null;
  if (userId && mongoose.Types.ObjectId.isValid(userId)) {
    targetUser = await User.findById(userId);
  } else if (email) {
    targetUser = await User.findOne({ email: email.trim().toLowerCase() });
  } else if (phone) {
    targetUser = await User.findOne({ phone: phone.trim() });
  } else if (name) {
    targetUser = await User.findOne({ fullName: new RegExp(`^${name.trim()}$`, 'i') });
  }

  // Duplicate prevention guard: Check if user or identifier is already actively blacklisted
  const duplicateConditions = [];
  if (targetUser) {
    duplicateConditions.push({ user: targetUser._id });
  }
  if (email && email.trim()) {
    duplicateConditions.push({ email: email.trim().toLowerCase() });
  }
  if (phone && phone.trim()) {
    duplicateConditions.push({ phone: phone.trim() });
  }
  if (name && name.trim()) {
    duplicateConditions.push({
      name: new RegExp(`^${name.trim()}$`, 'i'),
      type: type === 'Customer' ? 'Customer' : 'Caretaker',
    });
  }

  if (duplicateConditions.length > 0) {
    const existing = await Blacklist.findOne({
      status: 'active',
      $or: duplicateConditions,
    });

    if (existing) {
      const err = new Error(
        `"${name.trim()}" is already on the blacklist (${existing.entryId}). Duplicate bans are not allowed.`
      );
      err.statusCode = 409;
      err.name = 'ConflictError';
      throw err;
    }
  }

  // Resolve acting admin ObjectId for audit trail
  let adminId = actingAdmin?._id;
  if (!adminId || !mongoose.Types.ObjectId.isValid(adminId)) {
    const defaultAdmin = await User.findOne({ role: 'admin' });
    adminId = defaultAdmin?._id;
  }

  // Prevent admin self-ban or banning other admins
  if (targetUser) {
    if (adminId && String(targetUser._id) === String(adminId)) {
      const err = new Error('Security policy violation: Administrators cannot blacklist their own account');
      err.statusCode = 403;
      throw err;
    }
    if (targetUser.role === 'admin') {
      const err = new Error('Security policy violation: Administrator accounts cannot be blacklisted');
      err.statusCode = 403;
      throw err;
    }

    // Atomically set user status to blocked and append audit log
    const prevStatus = targetUser.status || 'active';
    const effectiveReviewAfter = reviewAfter && reviewAfter.trim() !== 'Temporary' ? reviewAfter.trim() : 'Permanent';
    targetUser.status = 'blocked';
    targetUser.statusReason = reason.trim();
    targetUser.statusReviewAfter = effectiveReviewAfter;
    targetUser.statusUpdatedAt = new Date();
    targetUser.statusAuditTrail.push({
      previousStatus: prevStatus,
      newStatus: 'blocked',
      reason: reason.trim(),
      changedBy: adminId,
      changedAt: new Date(),
    });
    await targetUser.save();
  }

  // Create new Blacklist entry in MongoDB
  const newEntry = new Blacklist({
    entryId,
    name: name.trim(),
    type: type === 'Customer' ? 'Customer' : 'Caretaker',
    reason: reason.trim(),
    reviewAfter: reviewAfter ? reviewAfter.trim() : 'Permanent',
    user: targetUser ? targetUser._id : null,
    phone: phone ? phone.trim() : (targetUser?.phone || null),
    email: email ? email.trim().toLowerCase() : (targetUser?.email || null),
    addedOn: new Date(),
    addedBy: actingAdmin.fullName || 'Operations Administrator',
    addedByAdmin: actingAdmin._id || null,
    status: 'active',
  });

  await newEntry.save();
  return formatBlacklistEntry(newEntry);
};

/**
 * Removes an entry from the blacklist in MongoDB.
 * If linked to a registered User, restores the User status to 'active'.
 *
 * @param {string} idOrEntryId - _id or BL-XXX entryId
 * @param {Object} payload - { reason }
 * @param {Object} actingAdmin - Authenticated admin User document
 * @returns {Promise<Object>} Result confirmation
 */
export const removeBlacklistEntry = async (idOrEntryId, payload = {}, actingAdmin = {}) => {
  let doc = null;
  if (mongoose.Types.ObjectId.isValid(idOrEntryId)) {
    doc = await Blacklist.findById(idOrEntryId);
  }
  if (!doc) {
    doc = await Blacklist.findOne({ entryId: idOrEntryId });
  }

  if (!doc) {
    const err = new Error(`Blacklist entry "${idOrEntryId}" not found in database`);
    err.statusCode = 404;
    throw err;
  }

  let adminId = actingAdmin?._id;
  if (!adminId || !mongoose.Types.ObjectId.isValid(adminId)) {
    const defaultAdmin = await User.findOne({ role: 'admin' });
    adminId = defaultAdmin?._id;
  }

  // Mark entry as removed in MongoDB
  doc.status = 'removed';
  doc.removedAt = new Date();
  doc.removedBy = actingAdmin.fullName || 'Operations Administrator';
  doc.removedByAdmin = adminId || null;
  doc.removalReason = payload?.reason || 'Unblocked by operations administrator';
  await doc.save();

  // If linked to a User, unblock the user account
  let targetUser = null;
  if (doc.user) {
    targetUser = await User.findById(doc.user);
  }
  if (!targetUser && doc.phone) {
    targetUser = await User.findOne({ phone: doc.phone });
  }
  if (!targetUser && doc.email) {
    targetUser = await User.findOne({ email: doc.email.toLowerCase() });
  }
  if (!targetUser && doc.name) {
    targetUser = await User.findOne({ fullName: new RegExp(`^${doc.name.trim()}$`, 'i') });
  }

  if (targetUser && ['blocked', 'suspended'].includes(targetUser.status)) {
    const prevStatus = targetUser.status;
    targetUser.status = 'active';
    targetUser.statusReason = null;
    targetUser.statusReviewAfter = null;
    targetUser.statusUpdatedAt = new Date();
    targetUser.statusAuditTrail.push({
      previousStatus: prevStatus,
      newStatus: 'active',
      reason: doc.removalReason,
      changedBy: adminId,
      changedAt: new Date(),
    });
    await targetUser.save();
  }

  // Ensure ALL active blacklist entries for this user / contact are also cleanly removed
  const orConditions = [
    ...(doc.user ? [{ user: doc.user }] : []),
    ...(targetUser ? [{ user: targetUser._id }] : []),
    ...(doc.phone ? [{ phone: doc.phone }] : []),
    ...(doc.email ? [{ email: doc.email.toLowerCase() }] : []),
    ...(doc.name ? [{ name: new RegExp(`^${doc.name.trim()}$`, 'i') }] : []),
  ];

  if (orConditions.length > 0) {
    await Blacklist.updateMany(
      {
        _id: { $ne: doc._id },
        status: 'active',
        $or: orConditions,
      },
      {
        $set: {
          status: 'removed',
          removedAt: new Date(),
          removedBy: actingAdmin.fullName || 'Operations Administrator',
          removedByAdmin: adminId || null,
          removalReason: doc.removalReason,
        },
      }
    );
  }

  return {
    success: true,
    message: `${doc.name} removed from blacklist and account unblocked`,
    id: doc.entryId,
  };
};

/**
 * Searches registered users (Customers and Caregivers) to populate the blacklist target selection.
 *
 * @param {string} search - Query text
 * @returns {Promise<Array>} List of user candidates
 */
export const searchRegisteredCandidates = async (search = '') => {
  const q = (search || '').trim();

  // 1. Get all users who are already active on the blacklist
  const activeEntries = await Blacklist.find({ status: 'active' }).select('user phone email name');
  const blacklistedUserIds = activeEntries.map((b) => b.user).filter(Boolean);
  const blacklistedPhones = activeEntries.map((b) => b.phone).filter(Boolean);
  const blacklistedEmails = activeEntries.map((b) => b.email).filter(Boolean);
  const blacklistedNames = activeEntries.map((b) => b.name).filter(Boolean);

  // 2. Query only active, non-blocked accounts that are not already on the blacklist
  const filter = {
    role: { $in: ['customer', 'caregiver'] },
    status: { $nin: ['blocked', 'suspended'] },
    _id: { $nin: blacklistedUserIds },
  };

  if (blacklistedPhones.length > 0) {
    filter.phone = { $nin: blacklistedPhones };
  }
  if (blacklistedEmails.length > 0) {
    filter.email = { $nin: blacklistedEmails };
  }
  if (blacklistedNames.length > 0) {
    filter.fullName = { $nin: blacklistedNames };
  }

  if (q.length > 0) {
    const regex = new RegExp(q, 'i');
    filter.$or = [{ fullName: regex }, { email: regex }, { phone: regex }];
  }

  const users = await User.find(filter)
    .sort({ createdAt: -1 })
    .limit(20)
    .select('fullName email phone role status');

  return users.map((u) => ({
    id: String(u._id),
    name: u.fullName,
    email: u.email || '',
    phone: u.phone || '',
    type: u.role === 'customer' ? 'Customer' : 'Caretaker',
    status: u.status,
  }));
};
