import mongoose from 'mongoose';
import crypto from 'crypto';

/**
 * Generates an immutable, human-readable complaint identifier: CP-YYYYMMDD-XXXXX
 * Uses CSPRNG uniform random integer for the 5-digit suffix.
 */
export const generateComplaintNumber = () => {
  const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  const randomSuffix = crypto.randomInt(10000, 100000).toString();
  return `CP-${dateStr}-${randomSuffix}`;
};

/**
 * Subdocument schema for administrative investigation internal notes.
 * Strictly shielded from customer and caregiver views.
 */
const internalNoteSchema = new mongoose.Schema(
  {
    note: {
      type: String,
      required: [true, 'Investigation note content is required'],
      trim: true,
      minlength: [3, 'Note must be at least 3 characters'],
      maxlength: [2000, 'Note cannot exceed 2000 characters'],
    },
    by: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    byName: {
      type: String,
      trim: true,
      default: 'Admin',
    },
    at: {
      type: Date,
      default: Date.now,
      required: true,
    },
  },
  { _id: true },
);

/**
 * Subdocument schema for immutable complaint lifecycle audit timeline.
 */
const complaintTimelineEventSchema = new mongoose.Schema(
  {
    at: {
      type: Date,
      default: Date.now,
      required: true,
    },
    action: {
      type: String,
      required: [true, 'Timeline action is required'],
      trim: true,
      maxlength: [200, 'Action description cannot exceed 200 characters'],
    },
    by: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    byRole: {
      type: String,
      enum: ['customer', 'caregiver', 'admin', 'system'],
      required: true,
    },
    notes: {
      type: String,
      trim: true,
      maxlength: [1000, 'Timeline notes cannot exceed 1000 characters'],
      default: null,
    },
  },
  { _id: true },
);

/**
 * Complaint Schema — Represents formal dispute or safety grievance raised
 * by an authenticated customer or caregiver.
 */
const complaintSchema = new mongoose.Schema(
  {
    complaintNumber: {
      type: String,
      required: [true, 'Complaint reference number is required'],
      unique: true,
      trim: true,
      uppercase: true,
      index: true,
    },
    booking: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Booking',
      default: null,
      index: true,
    },
    complainant: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Complainant user reference is required'],
      index: true,
    },
    complainantRole: {
      type: String,
      enum: {
        values: ['customer', 'caregiver'],
        message: 'Complainant role must be customer or caregiver',
      },
      required: true,
    },
    respondent: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
      index: true,
    },
    respondentRole: {
      type: String,
      enum: {
        values: ['customer', 'caregiver', 'platform', 'other'],
        message: 'Respondent role must be customer, caregiver, platform, or other',
      },
      default: 'caregiver',
    },
    category: {
      type: String,
      required: [true, 'Complaint category is required'],
      enum: {
        values: [
          'Misbehavior',
          'Theft',
          'Abuse',
          'Harassment',
          'Medical negligence',
          'No-show',
          'Late arrival',
          'Payment dispute',
          'Behaviour',
          'Billing',
          'Other',
        ],
        message: 'Invalid complaint category: {VALUE}',
      },
      trim: true,
      index: true,
    },
    priority: {
      type: String,
      enum: {
        values: ['Low', 'Medium', 'High', 'Critical'],
        message: 'Priority must be Low, Medium, High, or Critical',
      },
      default: 'Medium',
      required: true,
      index: true,
    },
    status: {
      type: String,
      enum: {
        values: ['submitted', 'under_review', 'action_taken', 'resolved', 'dismissed'],
        message: 'Status must be submitted, under_review, action_taken, resolved, or dismissed',
      },
      default: 'submitted',
      required: true,
      index: true,
    },
    subject: {
      type: String,
      required: [true, 'Complaint subject summary is required'],
      trim: true,
      minlength: [3, 'Subject must be at least 3 characters'],
      maxlength: [200, 'Subject cannot exceed 200 characters'],
    },
    description: {
      type: String,
      required: [true, 'Detailed complaint description is required'],
      trim: true,
      minlength: [5, 'Description must be at least 5 characters'],
      maxlength: [2000, 'Description cannot exceed 2000 characters'],
    },
    evidence: {
      type: [String],
      default: [],
    },
    internalNotes: {
      type: [internalNoteSchema],
      default: [],
    },
    resolution: {
      resolvedAt: {
        type: Date,
        default: null,
      },
      resolvedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        default: null,
      },
      resolutionDetails: {
        type: String,
        trim: true,
        maxlength: [2000, 'Resolution details cannot exceed 2000 characters'],
        default: null,
      },
    },
    timeline: [complaintTimelineEventSchema],
  },
  {
    timestamps: true,
  },
);

// Compound indexes for performant history, dispute lookups, and administrative triage
complaintSchema.index({ complainant: 1, createdAt: -1 });
complaintSchema.index({ respondent: 1, createdAt: -1 });
complaintSchema.index({ booking: 1, createdAt: -1 });
complaintSchema.index({ status: 1, priority: 1, createdAt: -1 });

export const Complaint = mongoose.model('Complaint', complaintSchema);
export default Complaint;
