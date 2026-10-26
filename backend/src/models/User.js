import mongoose from 'mongoose';

/**
 * Subdocument schema for administrative account status transition audit log.
 */
const userStatusAuditSchema = new mongoose.Schema(
  {
    previousStatus: {
      type: String,
      required: true,
      enum: ['active', 'pending_verification', 'suspended', 'blocked'],
    },
    newStatus: {
      type: String,
      required: true,
      enum: ['active', 'pending_verification', 'suspended', 'blocked'],
    },
    reason: {
      type: String,
      required: [true, 'A reason for status change is mandatory'],
      trim: true,
      minlength: [3, 'Reason must be at least 3 characters'],
      maxlength: [1000, 'Reason cannot exceed 1000 characters'],
    },
    changedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    changedAt: {
      type: Date,
      default: Date.now,
      required: true,
    },
  },
  { _id: true }
);

/**
 * User Schema — Core authentication & identity entity.
 * Supports roles: customer, caregiver, admin.
 * Password hash is hidden by default from queries and JSON serialization.
 */
const userSchema = new mongoose.Schema(
  {
    fullName: {
      type: String,
      required: [true, 'Full name is required'],
      trim: true,
      minlength: [2, 'Full name must be at least 2 characters'],
      maxlength: [100, 'Full name cannot exceed 100 characters'],
    },
    email: {
      type: String,
      trim: true,
      lowercase: true,
      match: [/^\S+@\S+\.\S+$/, 'Please enter a valid email address'],
      default: null,
    },
    phone: {
      type: String,
      trim: true,
      match: [/^\+?[1-9]\d{6,14}$/, 'Please enter a valid phone number'],
      default: null,
    },
    passwordHash: {
      type: String,
      required: [true, 'Password hash is required'],
      select: false, // Security: never returned by default in queries
    },
    role: {
      type: String,
      enum: {
        values: ['customer', 'caregiver', 'admin', 'ambulance'],
        message: 'Role must be customer, caregiver, admin, or ambulance',
      },
      default: 'customer',
      required: true,
    },
    status: {
      type: String,
      enum: {
        values: ['active', 'pending_verification', 'suspended', 'blocked'],
        message: 'Status must be active, pending_verification, suspended, or blocked',
      },
      default: 'active',
      required: true,
    },
    statusReason: {
      type: String,
      trim: true,
      maxlength: [1000, 'Status reason cannot exceed 1000 characters'],
      default: null,
    },
    statusReviewAfter: {
      type: String,
      trim: true,
      default: null,
    },
    statusUpdatedAt: {
      type: Date,
      default: null,
    },
    statusAuditTrail: {
      type: [userStatusAuditSchema],
      default: [],
    },
    isEmailVerified: {
      type: Boolean,
      default: false,
    }, 
    isPhoneVerified: {
      type: Boolean,
      default: false,
    },
    lastLoginAt: {
      type: Date,
      default: null,
    },
    adminRole: {
      type: String,
      default: 'Administrator',
      trim: true,
    },
  },
  {
    timestamps: true,
  },
);

// Partial unique indexes: prevents duplicate-empty-value conflicts
// Only documents where email or phone is an actual string are constrained to uniqueness.
userSchema.index(
  { email: 1 },
  {
    unique: true,
    partialFilterExpression: { email: { $type: 'string' } },
  },
);

userSchema.index(
  { phone: 1 },
  {
    unique: true,
    partialFilterExpression: { phone: { $type: 'string' } },
  },
);

// Common query optimization: filtering active users by role
userSchema.index({ role: 1, status: 1 });

// Ensure sensitive fields (passwordHash, __v) are stripped when serializing to JSON
userSchema.methods.toJSON = function () {
  const obj = this.toObject();
  delete obj.passwordHash;
  delete obj.__v;
  return obj;
};

export const User = mongoose.model('User', userSchema);
export default User;
