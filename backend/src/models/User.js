import mongoose from 'mongoose';

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
        values: ['customer', 'caregiver', 'admin'],
        message: 'Role must be customer, caregiver, or admin',
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
