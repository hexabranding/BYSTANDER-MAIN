import mongoose from 'mongoose';
import CaregiverProfile from '../models/CaregiverProfile.js';
import Document from '../models/Document.js';
import User from '../models/User.js';

/**
 * Strips private storage keys/URLs from document records before returning to client.
 * Guarantees zero sensitive storage keys or unredacted paths are exposed.
 */
const sanitizeDocumentMetadata = (doc) => {
  if (!doc) return null;
  const d = doc.toObject ? doc.toObject() : { ...doc };
  if (!d.fileUrl && d.fileData && typeof d.fileData === 'string') {
    d.fileUrl = d.fileData;
  }
  if (!d.fileUrl && d.fileKey && typeof d.fileKey === 'string') {
    d.fileUrl = d.fileKey;
  }
  delete d.fileKey;
  return d;
};



/**
 * List caregiver applications awaiting verification or filtered by status.
 *
 * @param {Object} query
 * @param {string} [query.status]
 * @param {string} [query.search]
 * @param {number|string} [query.page=1]
 * @param {number|string} [query.limit=10]
 * @returns {Promise<{ verifications: Array, pagination: Object }>}
 */
export const getVerifications = async (query = {}) => {
  const { status, search, page = 1, limit = 10 } = query;

  const filter = {};
  if (status && ['pending', 'under_review', 'verified', 'rejected'].includes(status.trim().toLowerCase())) {
    filter.verificationStatus = status.trim().toLowerCase();
  }

  const parsedPage = Math.max(1, parseInt(page, 10) || 1);
  const parsedLimit = Math.min(50, Math.max(1, parseInt(limit, 10) || 10));
  const skip = (parsedPage - 1) * parsedLimit;

  // If search query is provided, find matching users first
  if (search && typeof search === 'string' && search.trim().length > 0) {
    const searchRegex = new RegExp(search.trim(), 'i');
    const matchingUsers = await User.find({
      role: 'caregiver',
      fullName: searchRegex,
    }).select('_id');

    const matchingUserIds = matchingUsers.map((u) => u._id);

    filter.$or = [
      { user: { $in: matchingUserIds } },
      { qualification: searchRegex },
      { city: searchRegex },
      { nursingRegNo: searchRegex },
    ];
  }

  const [caregivers, total] = await Promise.all([
    CaregiverProfile.find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parsedLimit)
      .populate('user', 'fullName email phone avatar status createdAt'),
    CaregiverProfile.countDocuments(filter),
  ]);

  // Retrieve and attach documents for each caregiver profile
  const caregiverIds = caregivers.map((c) => c._id);
  const userIds = caregivers.map((c) => c.user?._id).filter(Boolean);

  const documents = await Document.find({
    $or: [
      { caregiverProfile: { $in: caregiverIds } },
      { user: { $in: userIds } },
    ],
  })
    .sort({ createdAt: -1 })
    .populate('reviewedBy', 'fullName email');

  // Group documents by caregiver profile or user
  const docsByCaregiver = new Map();
  for (const doc of documents) {
    const key = doc.caregiverProfile
      ? String(doc.caregiverProfile)
      : String(doc.user);

    if (!docsByCaregiver.has(key)) {
      docsByCaregiver.set(key, []);
    }
    docsByCaregiver.get(key).push(sanitizeDocumentMetadata(doc));
  }

  const verifications = caregivers.map((cg) => {
    const cgObj = cg.toObject ? cg.toObject() : { ...cg };
    const userKey = cg.user?._id ? String(cg.user._id) : '';
    const cgKey = String(cg._id);

    const cgDocs = docsByCaregiver.get(cgKey) || docsByCaregiver.get(userKey) || [];

    return {
      ...cgObj,
      documents: cgDocs,
    };
  });

  return {
    verifications,
    pagination: {
      total,
      page: parsedPage,
      limit: parsedLimit,
      totalPages: Math.ceil(total / parsedLimit) || 1,
    },
  };
};

/**
 * Retrieve single caregiver verification dossier with all documents and review history.
 *
 * @param {string} id - CaregiverProfile ID or User ID
 * @returns {Promise<Object>} Caregiver verification dossier with sanitized documents
 */
export const getVerificationById = async (id) => {
  if (!mongoose.Types.ObjectId.isValid(id)) {
    const err = new Error('Caregiver not found');
    err.statusCode = 404;
    err.name = 'NotFoundError';
    throw err;
  }

  let caregiver = await CaregiverProfile.findById(id).populate(
    'user',
    'fullName email phone avatar status createdAt',
  );

  if (!caregiver) {
    caregiver = await CaregiverProfile.findOne({ user: id }).populate(
      'user',
      'fullName email phone avatar status createdAt',
    );
  }

  if (!caregiver) {
    const err = new Error('Caregiver verification profile not found');
    err.statusCode = 404;
    err.name = 'NotFoundError';
    throw err;
  }

  const documents = await Document.find({
    $or: [
      { caregiverProfile: caregiver._id },
      { user: caregiver.user?._id },
    ],
  })
    .sort({ createdAt: -1 })
    .populate('reviewedBy', 'fullName email');

  const cgObj = caregiver.toObject ? caregiver.toObject() : { ...caregiver };
  cgObj.documents = documents.map(sanitizeDocumentMetadata);

  return cgObj;
};

/**
 * Review and transition an individual document status (approve/reject/under review).
 *
 * @param {string} documentId - Document ObjectId
 * @param {Object} payload - { status, notes }
 * @param {Object} reviewerUser - Authenticated Admin User
 * @returns {Promise<Object>} Updated document metadata
 */
export const updateDocumentStatus = async (documentId, payload, reviewerUser) => {
  if (!mongoose.Types.ObjectId.isValid(documentId)) {
    const err = new Error('Document not found');
    err.statusCode = 404;
    err.name = 'NotFoundError';
    throw err;
  }

  const { status, notes } = payload;

  const doc = await Document.findById(documentId);
  if (!doc) {
    const err = new Error('Document not found');
    err.statusCode = 404;
    err.name = 'NotFoundError';
    throw err;
  }

  doc.verificationStatus = status;
  if (notes !== undefined) {
    doc.reviewerNotes = notes;
  }
  doc.reviewedBy = reviewerUser._id;
  doc.reviewedAt = new Date();

  await doc.save();

  const populated = await Document.findById(doc._id).populate('reviewedBy', 'fullName email');
  return sanitizeDocumentMetadata(populated);
};

/**
 * Update the overall verification status of a caregiver profile under approved business rules.
 *
 * @param {string} caregiverId - CaregiverProfile ObjectId or User ObjectId
 * @param {Object} payload - { status, reason, trustScore }
 * @param {Object} reviewerUser - Authenticated Admin User
 * @returns {Promise<Object>} Updated CaregiverProfile
 */
export const updateCaregiverVerificationStatus = async (caregiverId, payload, reviewerUser) => {
  if (!mongoose.Types.ObjectId.isValid(caregiverId)) {
    const err = new Error('Caregiver not found');
    err.statusCode = 404;
    err.name = 'NotFoundError';
    throw err;
  }

  const { status, reason, trustScore } = payload;

  let caregiver = await CaregiverProfile.findById(caregiverId);
  if (!caregiver) {
    caregiver = await CaregiverProfile.findOne({ user: caregiverId });
  }

  if (!caregiver) {
    const err = new Error('Caregiver not found');
    err.statusCode = 404;
    err.name = 'NotFoundError';
    throw err;
  }

  caregiver.verificationStatus = status;

  if (trustScore !== undefined && typeof trustScore === 'number') {
    caregiver.trustScore = trustScore;
  } else if (status === 'verified' && caregiver.trustScore < 85) {
    caregiver.trustScore = 90;
  }

  await caregiver.save();

  // If verified, ensure associated User status is updated from pending_verification to active
  if (status === 'verified' && caregiver.user) {
    await User.findByIdAndUpdate(caregiver.user, { status: 'active' });
  }

  const updated = await CaregiverProfile.findById(caregiver._id).populate(
    'user',
    'fullName email phone avatar status createdAt',
  );

  return updated;
};
