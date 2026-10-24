import mongoose from 'mongoose';

/**
 * Blacklist Schema
 * 
 * Tracks accounts permanently or temporarily barred from booking or providing care on Bystander.
 * Integrates with User account status so blacklisted users are blocked platform-wide.
 */
const blacklistSchema = new mongoose.Schema(
  {
    entryId: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      index: true,
    },
    name: {
      type: String,
      required: [true, 'Account name is required'],
      trim: true,
      minlength: [2, 'Name must be at least 2 characters'],
      maxlength: [100, 'Name cannot exceed 100 characters'],
    },
    type: {
      type: String,
      required: true,
      enum: ['Caretaker', 'Customer'],
      default: 'Caretaker',
    },
    reason: {
      type: String,
      required: [true, 'Reason for ban is mandatory'],
      trim: true,
      minlength: [3, 'Reason must be at least 3 characters'],
      maxlength: [1000, 'Reason cannot exceed 1000 characters'],
    },
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
      index: true,
    },
    phone: {
      type: String,
      trim: true,
      default: null,
    },
    email: {
      type: String,
      trim: true,
      lowercase: true,
      default: null,
    },
    addedOn: {
      type: Date,
      default: Date.now,
    },
    addedBy: {
      type: String,
      default: 'Operations Administrator',
      trim: true,
    },
    addedByAdmin: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    reviewAfter: {
      type: String,
      default: 'Permanent',
      trim: true,
    },
    status: {
      type: String,
      enum: ['active', 'removed'],
      default: 'active',
      index: true,
    },
    removedAt: {
      type: Date,
      default: null,
    },
    removedBy: {
      type: String,
      default: null,
    },
    removedByAdmin: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    removalReason: {
      type: String,
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

blacklistSchema.index({ name: 'text', reason: 'text' });

export const Blacklist = mongoose.model('Blacklist', blacklistSchema);
export default Blacklist;
