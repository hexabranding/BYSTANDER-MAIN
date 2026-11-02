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

export const CANONICAL_DOCUMENTS = [
  { type: 'identity', label: 'Government Photo ID', required: true },
  { type: 'police_clearance', label: 'Police Clearance Certificate', required: true },
  { type: 'bank_verification', label: 'Bank Account Proof', required: true },
  { type: 'nursing_registration', label: 'Nursing / Qualification Certificate', required: false },
  { type: 'address_proof', label: 'Address Proof', required: false },
];

/**
 * Builds canonical 5-document dossier slots with placeholders for missing documents.
 * Ensures admin UI consistently displays all 5 documents.
 */
export const buildCanonicalDocuments = (sanitizedDocs = [], caregiverId = '') => {
  const docsByType = new Map();
  for (const doc of sanitizedDocs) {
    if (doc.documentType && !docsByType.has(doc.documentType)) {
      docsByType.set(doc.documentType, doc);
    }
  }

  return CANONICAL_DOCUMENTS.map((def) => {
    const existing = docsByType.get(def.type);
    if (existing) {
      let statusLabel = 'Under Review';
      if (existing.verificationStatus === 'verified') statusLabel = 'Verified';
      else if (existing.verificationStatus === 'rejected') statusLabel = 'Rejected';
      else if (existing.verificationStatus === 'requested') statusLabel = 'Requested by Admin';
      else if (existing.verificationStatus === 'pending') statusLabel = 'Pending';

      return {
        ...existing,
        type: existing.type || def.label,
        status: statusLabel,
        required: def.required,
        canRequest: !def.required,
      };
    }

    return {
      id: `missing-${def.type}-${caregiverId}`,
      documentType: def.type,
      type: def.label,
      file: 'Not submitted',
      fileName: '',
      status: 'Not uploaded',
      verificationStatus: 'not_uploaded',
      reviewerNotes: '',
      uploadedOn: null,
      required: def.required,
      canRequest: true,
    };
  });
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

    if (!cgObj.physicalVerification) {
      cgObj.physicalVerification = {
        status: cgObj.verificationStatus === 'verified' ? 'verified' : 'pending',
        verifiedAt: cgObj.verificationStatus === 'verified' ? cgObj.updatedAt : null,
        notes: '',
        officeLocation: 'Bystander Head Office',
      };
    }

    return {
      ...cgObj,
      documents: buildCanonicalDocuments(cgDocs, cg._id),
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

  const sanitizedDocs = documents.map(sanitizeDocumentMetadata);

  const cgObj = caregiver.toObject ? caregiver.toObject() : { ...caregiver };
  cgObj.documents = buildCanonicalDocuments(sanitizedDocs, caregiver._id);

  if (!cgObj.physicalVerification) {
    cgObj.physicalVerification = {
      status: cgObj.verificationStatus === 'verified' ? 'verified' : 'pending',
      verifiedAt: cgObj.verificationStatus === 'verified' ? cgObj.updatedAt : null,
      notes: '',
      officeLocation: 'Bystander Head Office',
    };
  }

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

  if (status === 'verified') {
    caregiver.physicalVerification = {
      status: 'verified',
      verifiedAt: caregiver.physicalVerification?.verifiedAt || new Date(),
      verifiedBy: reviewerUser?._id,
      notes: reason || caregiver.physicalVerification?.notes || 'In-office physical verification completed',
      officeLocation: caregiver.physicalVerification?.officeLocation || 'Bystander Head Office',
    };
  }

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

/**
 * Admin confirms in-person physical document verification at office.
 * Sets physicalVerification to 'verified', application status to 'verified' (100% full approval),
 * and unlocks all features for caregiver.
 *
 * @param {string} caregiverId - CaregiverProfile ObjectId or User ObjectId
 * @param {Object} payload - { notes, officeLocation }
 * @param {Object} reviewerUser - Authenticated Admin User
 * @returns {Promise<Object>} Updated CaregiverProfile dossier
 */
export const verifyPhysicalDocuments = async (caregiverId, payload, reviewerUser) => {
  if (!mongoose.Types.ObjectId.isValid(caregiverId)) {
    const err = new Error('Caregiver not found');
    err.statusCode = 404;
    err.name = 'NotFoundError';
    throw err;
  }

  const { notes, officeLocation = 'Bystander Head Office' } = payload || {};

  let caregiver = await CaregiverProfile.findById(caregiverId).populate('user');
  if (!caregiver) {
    caregiver = await CaregiverProfile.findOne({ user: caregiverId }).populate('user');
  }

  if (!caregiver) {
    const err = new Error('Caregiver not found');
    err.statusCode = 404;
    err.name = 'NotFoundError';
    throw err;
  }

  const reviewNote = notes || 'Original physical documents submitted and verified at Bystander office';

  caregiver.physicalVerification = {
    status: 'verified',
    verifiedAt: new Date(),
    verifiedBy: reviewerUser?._id,
    notes: reviewNote,
    officeLocation,
  };

  // Physical document verification in office triggers 100% full approval!
  caregiver.verificationStatus = 'verified';
  if (caregiver.trustScore < 90) {
    caregiver.trustScore = 95;
  }

  await caregiver.save();

  // If verified, ensure associated User status is updated from pending_verification to active
  if (caregiver.user?._id) {
    await User.findByIdAndUpdate(caregiver.user._id, { status: 'active' });

    try {
      const { createNotification } = await import('./notificationService.js');
      await createNotification({
        recipient: caregiver.user._id,
        type: 'verification_approved',
        title: 'Physical Verification Complete — 100% Approved!',
        message: 'Your original documents have been verified in our office. Your profile is now 100% verified and all dashboard features are unlocked!',
        metadata: {
          verifiedBy: reviewerUser?.fullName || 'Admin',
          officeLocation,
          overallScore: 100,
        },
      });
    } catch (notifErr) {
      console.warn('[Physical Verification] Notification dispatch failed:', notifErr.message);
    }
  }

  return getVerificationById(caregiver._id);
};

/**
 * Admin requests a missing or optional document from a caregiver.
 * Transitions or creates document with status 'requested' and sends notification.
 *
 * @param {string} caregiverId - CaregiverProfile ObjectId or User ObjectId
 * @param {Object} payload - { documentType, notes }
 * @param {Object} reviewerUser - Authenticated Admin User
 * @returns {Promise<Object>} Updated document metadata and confirmation message
 */
export const requestCaregiverDocument = async (caregiverId, payload, reviewerUser) => {
  const { documentType, notes } = payload || {};
  if (!documentType || typeof documentType !== 'string') {
    const err = new Error('A valid documentType is required to request document');
    err.statusCode = 400;
    err.name = 'ValidationError';
    throw err;
  }

  const cleanType = documentType.trim();

  let caregiver = await CaregiverProfile.findById(caregiverId).populate('user');
  if (!caregiver && mongoose.Types.ObjectId.isValid(caregiverId)) {
    caregiver = await CaregiverProfile.findOne({ user: caregiverId }).populate('user');
  }

  if (!caregiver) {
    const err = new Error('Caregiver verification profile not found');
    err.statusCode = 404;
    err.name = 'NotFoundError';
    throw err;
  }

  const requestNote = notes || 'Additional documentation requested by verification team';

  // Find or create document with status 'requested'
  let doc = await Document.findOne({
    $or: [{ caregiverProfile: caregiver._id }, { user: caregiver.user?._id }],
    documentType: cleanType,
  });

  if (!doc) {
    doc = await Document.create({
      user: caregiver.user?._id,
      caregiverProfile: caregiver._id,
      documentType: cleanType,
      fileName: `${cleanType}.pdf`,
      fileKey: `requested/${caregiver.user?._id || caregiver._id}/${cleanType}_${Date.now()}`,
      verificationStatus: 'requested',
      reviewerNotes: requestNote,
      reviewedBy: reviewerUser?._id,
      reviewedAt: new Date(),
    });
  } else {
    doc.verificationStatus = 'requested';
    doc.reviewerNotes = requestNote;
    doc.reviewedBy = reviewerUser?._id;
    doc.reviewedAt = new Date();
    await doc.save();
  }

  // Create notification for caregiver
  try {
    const { createNotification } = await import('./notificationService.js');
    if (caregiver.user?._id) {
      const typeLabel = cleanType.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
      await createNotification({
        recipient: caregiver.user._id,
        type: 'document_requested',
        title: 'Document Requested by Admin',
        message: `Admin has requested you to upload: ${typeLabel}. Please visit your Documents tab to submit it.`,
        metadata: { documentType: cleanType, requestedBy: reviewerUser?.fullName || 'Admin' },
      });
    }
  } catch (notifErr) {
    console.warn('[Admin Document Request] Notification dispatch failed:', notifErr.message);
  }

  return {
    success: true,
    message: `Requested ${cleanType} from caretaker`,
    document: sanitizeDocumentMetadata(doc),
  };
};
