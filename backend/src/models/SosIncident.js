import mongoose from 'mongoose';
import crypto from 'crypto';

/**
 * Generates a standard incident number: SOS-YYYYMMDD-XXXXX
 * Uses CSPRNG uniform random integer for the 5-digit suffix.
 */
export const generateIncidentNumber = () => {
  const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  const randomSuffix = crypto.randomInt(10000, 100000).toString();
  return `SOS-${dateStr}-${randomSuffix}`;
};

/**
 * Subdocument schema for immutable operational timeline events.
 */
const timelineEventSchema = new mongoose.Schema(
  {
    at: {
      type: Date,
      default: Date.now,
      required: true,
    },
    action: {
      type: String,
      required: [true, 'Timeline action description is required'],
      trim: true,
      maxlength: [200, 'Action cannot exceed 200 characters'],
    },
    by: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Actor reference is required'],
    },
    byRole: {
      type: String,
      enum: ['customer', 'caregiver', 'admin', 'system'],
      required: [true, 'Actor role is required'],
    },
    notes: {
      type: String,
      trim: true,
      maxlength: [1000, 'Notes cannot exceed 1000 characters'],
      default: null,
    },
  },
  { _id: true },
);

/**
 * SOS Incident Schema — Represents an emergency safety event raised during an engagement.
 * Contains validated participant links, optional coordinates, emergency contact status,
 * append-only timeline events, and administrative triage audit fields.
 */
const sosIncidentSchema = new mongoose.Schema(
  {
    incidentNumber: {
      type: String,
      required: [true, 'Incident number is required'],
      unique: true,
      trim: true,
      uppercase: true,
      index: true,
    },
    booking: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Booking',
      required: [true, 'Booking reference is required'],
      index: true,
    },
    raisedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Reporter reference is required'],
      index: true,
    },
    raisedByRole: {
      type: String,
      enum: ['customer', 'caregiver', 'admin'],
      required: true,
    },
    // Denormalized participant references for direct index lookups without multi-hop joins
    customer: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Customer reference is required'],
      index: true,
    },
    caregiver: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'CaregiverProfile',
      required: [true, 'Caregiver profile reference is required'],
      index: true,
    },
    caregiverUser: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Caregiver user account reference is required'],
      index: true,
    },
    priority: {
      type: String,
      enum: {
        values: ['Critical', 'High', 'Medium', 'Low'],
        message: 'Invalid priority: {VALUE}',
      },
      default: 'Critical',
      required: true,
      index: true,
    },
    status: {
      type: String,
      enum: {
        values: ['Open', 'Under Investigation', 'Resolved', 'False Alarm'],
        message: 'Invalid incident status: {VALUE}',
      },
      default: 'Open',
      required: true,
      index: true,
    },
    // Location subdocument — Never stores default or fabricated coordinates
    location: {
      isAvailable: {
        type: Boolean,
        default: false,
      },
      label: {
        type: String,
        trim: true,
        maxlength: [200, 'Location label cannot exceed 200 characters'],
        default: null,
      },
      latitude: {
        type: Number,
        min: [-90, 'Latitude must be between -90 and 90'],
        max: [90, 'Latitude must be between -90 and 90'],
        default: null,
      },
      longitude: {
        type: Number,
        min: [-180, 'Longitude must be between -180 and 180'],
        max: [180, 'Longitude must be between -180 and 180'],
        default: null,
      },
      accuracy: {
        type: Number,
        min: [0, 'Accuracy radius cannot be negative'],
        default: null,
      },
    },
    summary: {
      type: String,
      required: [true, 'Emergency summary description is required'],
      trim: true,
      minlength: [5, 'Summary must be at least 5 characters'],
      maxlength: [1000, 'Summary cannot exceed 1000 characters'],
    },
    assignedTo: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
      index: true,
    },
    assignedAt: {
      type: Date,
      default: null,
    },
    // Emergency contact dispatch tracking — Clearly records when integration is unconfigured
    emergencyContactNotification: {
      status: {
        type: String,
        enum: ['not_configured', 'pending', 'sent', 'delivered', 'failed'],
        default: 'not_configured',
        required: true,
      },
      attempted: {
        type: Boolean,
        default: false,
      },
      attemptedAt: {
        type: Date,
        default: null,
      },
      contactName: {
        type: String,
        trim: true,
        default: null,
      },
      contactRelation: {
        type: String,
        trim: true,
        default: null,
      },
      notes: {
        type: String,
        trim: true,
        default: 'Automated SMS/Telephony emergency dispatch provider is not configured.',
      },
    },
    timeline: [timelineEventSchema],
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
      resolutionNotes: {
        type: String,
        trim: true,
        maxlength: [1000, 'Resolution notes cannot exceed 1000 characters'],
        default: null,
      },
      rootCause: {
        type: String,
        trim: true,
        maxlength: [200, 'Root cause cannot exceed 200 characters'],
        default: null,
      },
    },
  },
  {
    timestamps: true,
  },
);

// Indexes for high-priority operational triage and participant queries
sosIncidentSchema.index({ status: 1, priority: 1, createdAt: -1 });
sosIncidentSchema.index({ booking: 1, createdAt: -1 });
sosIncidentSchema.index({ customer: 1, status: 1, createdAt: -1 });
sosIncidentSchema.index({ caregiverUser: 1, status: 1, createdAt: -1 });

export const SosIncident = mongoose.model('SosIncident', sosIncidentSchema);
export default SosIncident;
