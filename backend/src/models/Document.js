import mongoose from 'mongoose';

/**
 * Document Schema — Identity, Council Certificates, and Background Proofs.
 * Securely references private storage keys or URLs; never embeds raw binary files.
 */
const documentSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'User reference is required'],
      index: true,
    },
    caregiverProfile: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'CaregiverProfile',
      default: null,
      index: true,
    },
    documentType: {
      type: String,
      enum: {
        values: [
          'identity',
          'address_proof',
          'nursing_registration',
          'college_id',
          'police_clearance',
          'bank_verification',
          'other',
        ],
        message: '{VALUE} is not a valid document type',
      },
      required: [true, 'Document type is required'],
      index: true,
    },
    fileKey: {
      type: String,
      required: [true, 'Private storage key or URL is required'],
      trim: true,
    },
    fileName: {
      type: String,
      trim: true,
      default: '',
    },
    fileSize: {
      type: Number,
      min: 0,
      default: 0,
    },
    mimeType: {
      type: String,
      trim: true,
      default: 'application/pdf',
    },
    verificationStatus: {
      type: String,
      enum: {
        values: ['pending', 'under_review', 'verified', 'rejected'],
        message: 'Status must be pending, under_review, verified, or rejected',
      },
      default: 'pending',
      required: true,
      index: true,
    },
    reviewerNotes: {
      type: String,
      trim: true,
      maxlength: [1000, 'Reviewer notes cannot exceed 1000 characters'],
      default: '',
    },
    reviewedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    reviewedAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
  },
);

// Compound indexes for administrative verifications and user document lookup
documentSchema.index({ user: 1, documentType: 1 });
documentSchema.index({ verificationStatus: 1, createdAt: -1 });

export const Document = mongoose.model('Document', documentSchema);
export default Document;
