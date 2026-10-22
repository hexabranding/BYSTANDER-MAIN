import mongoose from 'mongoose';

/**
 * Subdocument schema for a structured daily time slot interval.
 * Uses 24-hour format HH:mm (e.g. 08:00 to 16:00).
 */
const timeSlotSchema = new mongoose.Schema(
  {
    start: {
      type: String,
      required: true,
      match: [/^([01]\d|2[0-3]):([0-5]\d)$/, 'Start time must be HH:mm (24-hour format)'],
    },
    end: {
      type: String,
      required: true,
      match: [/^([01]\d|2[0-3]):([0-5]\d)$/, 'End time must be HH:mm (24-hour format)'],
    },
  },
  { _id: false },
);

/**
 * Subdocument schema for recurring weekday availability.
 */
const weeklyScheduleSchema = new mongoose.Schema(
  {
    day: {
      type: String,
      enum: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
      required: true,
    },
    isAvailable: {
      type: Boolean,
      default: true,
    },
    slots: {
      type: [timeSlotSchema],
      default: [],
    },
  },
  { _id: false },
);

/**
 * Subdocument schema for calendar date-specific exceptions (leaves, overtime shifts).
 */
const dateExceptionSchema = new mongoose.Schema(
  {
    date: {
      type: String,
      required: true,
      match: [/^\d{4}-\d{2}-\d{2}$/, 'Date must be in YYYY-MM-DD format'],
    },
    isAvailable: {
      type: Boolean,
      default: false,
    },
    reason: {
      type: String,
      trim: true,
      maxlength: 200,
      default: '',
    },
    slots: {
      type: [timeSlotSchema],
      default: [],
    },
  },
  { _id: false },
);

const defaultWeeklySchedule = () => [
  { day: 'Mon', isAvailable: true, slots: [{ start: '08:00', end: '16:00' }] },
  { day: 'Tue', isAvailable: true, slots: [{ start: '08:00', end: '16:00' }] },
  { day: 'Wed', isAvailable: true, slots: [{ start: '08:00', end: '16:00' }] },
  { day: 'Thu', isAvailable: true, slots: [{ start: '08:00', end: '16:00' }] },
  { day: 'Fri', isAvailable: true, slots: [{ start: '08:00', end: '16:00' }] },
  { day: 'Sat', isAvailable: true, slots: [{ start: '09:00', end: '15:00' }] },
  { day: 'Sun', isAvailable: false, slots: [] },
];

/**
 * CaregiverProfile Schema — Professional caretaker, nurse, and student records.
 */
const caregiverProfileSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'User reference is required'],
      unique: true,
      index: true,
    },
    avatar: {
      type: String,
      trim: true,
      default: '',
    },
    qualification: {
      type: String,
      enum: {
        values: [
          'GNM',
          'BSc Nursing',
          'nursing_student',
          'ANM',
          'MBBS',
          'Physiotherapy Assistant',
          'Certified Elder Care Giver',
          'Paramedic',
          'other',
        ],
        message: '{VALUE} is not an approved qualification',
      },
      required: [true, 'Qualification is required'],
      index: true,
    },
    nursingRegNo: {
      type: String,
      trim: true,
      default: null,
    },
    experienceYears: {
      type: Number,
      min: [0, 'Experience years cannot be negative'],
      max: [50, 'Experience years cannot exceed 50'],
      default: 0,
    },
    bio: {
      type: String,
      trim: true,
      maxlength: [2000, 'Bio cannot exceed 2000 characters'],
      default: '',
    },
    languages: {
      type: [String],
      default: ['English'],
    },
    city: {
      type: String,
      trim: true,
      required: [true, 'City is required'],
      default: 'Mumbai, MH',
      index: true,
    },
    area: {
      type: String,
      trim: true,
      default: '',
    },
    maxDistanceKm: {
      type: Number,
      min: 1,
      max: 100,
      default: 15,
    },
    hourlyRate: {
      type: Number,
      min: [0, 'Hourly rate cannot be negative'],
      max: [50000, 'Hourly rate cannot exceed ₹50,000'],
      required: [true, 'Hourly rate is required'],
      default: 499,
    },
    // Canonical reference to active Service catalog documents
    servicesOffered: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Service',
      },
    ],
    // Retained for backward compatibility with legacy string descriptors
    services: {
      type: [String],
      default: [],
    },
    careSettings: {
      type: [String],
      enum: {
        values: ['Home Care', 'Hospital Care', 'Home', 'Hospital'],
        message: '{VALUE} is not a valid care setting',
      },
      set: (settings) => {
        if (!Array.isArray(settings)) return settings;
        const mapping = { Home: 'Home Care', Hospital: 'Hospital Care' };
        return settings.map((s) => mapping[s] || s);
      },
      default: ['Home Care'],
    },
    availabilityStatus: {
      type: String,
      enum: ['Available Now', 'Busy', 'On Leave', 'Unavailable'],
      default: 'Available Now',
    },
    timezone: {
      type: String,
      trim: true,
      default: 'Asia/Kolkata', // Default IANA timezone for Bystander domain
    },
    weeklySchedule: {
      type: [weeklyScheduleSchema],
      default: defaultWeeklySchedule,
    },
    dateExceptions: {
      type: [dateExceptionSchema],
      default: [],
    },
    verificationStatus: {
      type: String,
      enum: {
        values: ['pending', 'under_review', 'verified', 'rejected'],
        message: 'Verification status must be pending, under_review, verified, or rejected',
      },
      default: 'pending',
      required: true,
      index: true,
    },
    rating: {
      average: {
        type: Number,
        min: 0,
        max: 5,
        default: 5.0,
      },
      count: {
        type: Number,
        min: 0,
        default: 0,
      },
    },
    trustScore: {
      type: Number,
      min: 0,
      max: 100,
      default: 50,
    },
    completedJobs: {
      type: Number,
      min: 0,
      default: 0,
    },
    badges: {
      type: [String],
      default: [],
    },
    // Dedicated version counter mutated in transactions to serialize concurrent booking reservations
    bookingLockVersion: {
      type: Number,
      default: 0,
    },
    // Dedicated version counter mutated in transactions to serialize concurrent rating recalculations across processes
    ratingLockVersion: {
      type: Number,
      default: 0,
    },
    // Dedicated version counter mutated in transactions to serialize concurrent payout requests across processes
    payoutLockVersion: {
      type: Number,
      default: 0,
    },
  },
  {
    timestamps: true,
  },
);

// Search and filter optimization for marketplace discovery
caregiverProfileSchema.index({ city: 1, verificationStatus: 1, availabilityStatus: 1 });
caregiverProfileSchema.index({ hourlyRate: 1 });
caregiverProfileSchema.index({ 'rating.average': -1 });

// Partial unique index for nursing council registration number
caregiverProfileSchema.index(
  { nursingRegNo: 1 },
  {
    unique: true,
    sparse: true,
    partialFilterExpression: { nursingRegNo: { $type: 'string' } },
  },
);

export const CaregiverProfile = mongoose.model('CaregiverProfile', caregiverProfileSchema);
export default CaregiverProfile;
