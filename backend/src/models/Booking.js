import mongoose from 'mongoose';

/**
 * Booking Schema — Represents a bedside/home care engagement requested by a customer.
 * Contains immutable service & pricing snapshots, UTC scheduling bounds,
 * minimal necessary patient care details, and strict lifecycle status tracking.
 */
const bookingSchema = new mongoose.Schema(
  {
    // Participant references
    customer: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Customer user reference is required'],
      index: true,
    },
    caregiver: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'CaregiverProfile',
      required: false,
      default: null,
      index: true,
    },
    caregiverUser: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: false,
      default: null,
      index: true,
    },
    declinedByCaregivers: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
      },
    ],
    // Preferred Caretaker Gender: 'Any', 'Female', 'Male'
    preferredGender: {
      type: String,
      enum: ['Any', 'Female', 'Male'],
      default: 'Any',
      index: true,
    },
    isUrgent: {
      type: Boolean,
      default: false,
      index: true,
    },
    // Multi-Caregiver Acceptance / Bidding: list of caretakers who accepted this broadcast
    applicants: [
      {
        caregiver: {
          type: mongoose.Schema.Types.ObjectId,
          ref: 'CaregiverProfile',
          required: true,
        },
        caregiverUser: {
          type: mongoose.Schema.Types.ObjectId,
          ref: 'User',
          required: true,
        },
        hourlyRate: {
          type: Number,
          required: true,
        },
        totalAmount: {
          type: Number,
          required: true,
        },
        appliedAt: {
          type: Date,
          default: Date.now,
        },
        status: {
          type: String,
          enum: ['applied', 'selected', 'rejected'],
          default: 'applied',
        },
      },
    ],

    // Service reference & immutable snapshot
    service: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Service',
      required: [true, 'Service reference is required'],
      index: true,
    },
    serviceName: {
      type: String,
      required: [true, 'Service name snapshot is required'],
      trim: true,
    },
    serviceCategory: {
      type: String,
      required: [true, 'Service category snapshot is required'],
      trim: true,
    },

    // Financial snapshot (calculated server-side, never trusted from client)
    hourlyRate: {
      type: Number,
      required: [true, 'Hourly rate snapshot is required'],
      min: [0, 'Hourly rate cannot be negative'],
    },
    totalHours: {
      type: Number,
      required: [true, 'Total hours duration is required'],
      min: [0.5, 'Total duration must be at least 30 minutes'],
    },
    totalAmount: {
      type: Number,
      required: [true, 'Total amount snapshot is required'],
      min: [0, 'Total amount cannot be negative'],
    },
    currency: {
      type: String,
      default: 'INR',
      trim: true,
    },

    // Scheduling timestamps stored strictly in UTC
    startDateTime: {
      type: Date,
      required: [true, 'Scheduled start timestamp (UTC) is required'],
      index: true,
    },
    endDateTime: {
      type: Date,
      required: [true, 'Scheduled end timestamp (UTC) is required'],
      index: true,
    },

    // Contextual timezone used for interpreting customer input and caregiver shifts
    timezone: {
      type: String,
      required: [true, 'Timezone identifier is required'],
      trim: true,
      default: 'Asia/Kolkata',
    },

    // Care service location
    location: {
      street: {
        type: String,
        trim: true,
        default: '',
        maxlength: [200, 'Street cannot exceed 200 characters'],
      },
      addressLine: {
        type: String,
        required: [true, 'Address line is required'],
        trim: true,
        maxlength: [200, 'Address cannot exceed 200 characters'],
      },
      city: {
        type: String,
        required: [true, 'City is required'],
        trim: true,
        maxlength: [100, 'City cannot exceed 100 characters'],
      },
      area: {
        type: String,
        trim: true,
        default: '',
        maxlength: [100, 'Area cannot exceed 100 characters'],
      },
      district: {
        type: String,
        trim: true,
        default: 'Ernakulam',
        maxlength: [100, 'District cannot exceed 100 characters'],
      },
      state: {
        type: String,
        trim: true,
        default: 'Kerala',
        maxlength: [100, 'State cannot exceed 100 characters'],
      },
      pincode: {
        type: String,
        trim: true,
        default: '',
        maxlength: [20, 'Pincode cannot exceed 20 characters'],
      },
      careSetting: {
        type: String,
        enum: ['Home Care', 'Hospital Care', 'Home', 'Hospital'],
        set: (v) => {
          if (v === 'Home') return 'Home Care';
          if (v === 'Hospital') return 'Hospital Care';
          return v;
        },
        default: 'Home Care',
        required: true,
      },
    },

    // Minimum necessary patient details (sensitive EHR/diagnoses excluded)
    patientDetails: {
      name: {
        type: String,
        required: [true, 'Patient name is required'],
        trim: true,
        maxlength: [100, 'Patient name cannot exceed 100 characters'],
      },
      age: {
        type: Number,
        required: [true, 'Patient age is required'],
        min: [0, 'Age cannot be negative'],
        max: [130, 'Age cannot exceed 130'],
      },
      gender: {
        type: String,
        enum: ['Male', 'Female', 'Other'],
        default: 'Other',
      },
      specialInstructions: {
        type: String,
        trim: true,
        default: '',
        maxlength: [1000, 'Special instructions cannot exceed 1000 characters'],
      },
    },

    // Explicit lifecycle state machine
    status: {
      type: String,
      enum: {
        values: ['pending', 'confirmed', 'in_progress', 'cancelled', 'rejected', 'completed'],
        message: 'Invalid booking status: {VALUE}',
      },
      default: 'pending',
      required: true,
      index: true,
    },

    // Payment Gateway Tracking (Razorpay Escrow)
    paymentStatus: {
      type: String,
      enum: ['unpaid', 'pending', 'escrow_held', 'released', 'settled', 'refunded'],
      default: 'unpaid',
      index: true,
    },
    gatewayOrderId: {
      type: String,
      trim: true,
      default: null,
      index: true,
    },
    gatewayPaymentId: {
      type: String,
      trim: true,
      default: null,
    },
    paidAt: {
      type: Date,
      default: null,
    },

    // Lifecycle transition audit timestamps & actor tracking
    acceptedAt: {
      type: Date,
      default: null,
    },
    rejectedAt: {
      type: Date,
      default: null,
    },
    cancelledAt: {
      type: Date,
      default: null,
    },
    cancelledBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    cancelledByRole: {
      type: String,
      enum: ['customer', 'caregiver', 'admin', null],
      default: null,
    },
    cancellationReason: {
      type: String,
      trim: true,
      default: '',
      maxlength: [500, 'Cancellation reason cannot exceed 500 characters'],
    },

    // Step 9: Shift Check-in OTP verification (customer grants to caregiver upon arrival)
    checkInOtp: {
      otpHash: {
        type: String,
        select: false,
        default: null,
      },
      expiresAt: {
        type: Date,
        default: null,
      },
      attempts: {
        type: Number,
        default: 0,
      },
      maxAttempts: {
        type: Number,
        default: 5,
      },
      consumedAt: {
        type: Date,
        default: null,
      },
      lastRequestedAt: {
        type: Date,
        default: null,
      },
    },
    checkIn: {
      at: {
        type: Date,
        default: null,
      },
      verifiedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        default: null,
      },
      selfieUrl: {
        type: String,
        trim: true,
        default: null,
      },
      location: {
        type: String,
        trim: true,
        default: null,
      },
      notes: {
        type: String,
        trim: true,
        maxlength: [500, 'Check-in notes cannot exceed 500 characters'],
        default: null,
      },
    },

    // Step 9: Shift Check-out OTP verification (customer grants to caregiver upon completion)
    checkOutOtp: {
      otpHash: {
        type: String,
        select: false,
        default: null,
      },
      expiresAt: {
        type: Date,
        default: null,
      },
      attempts: {
        type: Number,
        default: 0,
      },
      maxAttempts: {
        type: Number,
        default: 5,
      },
      consumedAt: {
        type: Date,
        default: null,
      },
      lastRequestedAt: {
        type: Date,
        default: null,
      },
    },
    checkOut: {
      at: {
        type: Date,
        default: null,
      },
      verifiedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        default: null,
      },
      selfieUrl: {
        type: String,
        trim: true,
        default: null,
      },
      location: {
        type: String,
        trim: true,
        default: null,
      },
      notes: {
        type: String,
        trim: true,
        maxlength: [500, 'Check-out notes cannot exceed 500 characters'],
        default: null,
      },
    },
    customerRating: {
      type: mongoose.Schema.Types.Mixed,
      default: null,
    },
    caregiverRating: {
      type: mongoose.Schema.Types.Mixed,
      default: null,
    },
  },
  {
    timestamps: true,
  },
);

// Indexes for participant dashboards & conflict checks
bookingSchema.index({ customer: 1, status: 1, createdAt: -1 });
bookingSchema.index({ caregiverUser: 1, status: 1, startDateTime: 1 });
bookingSchema.index({ caregiver: 1, startDateTime: 1, endDateTime: 1 });
bookingSchema.index({ status: 1, startDateTime: 1 });

export const Booking = mongoose.model('Booking', bookingSchema);
export default Booking;
