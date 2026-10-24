import mongoose from 'mongoose';

/**
 * PlatformSettings Schema — Authoritative administrative configuration model.
 * Persists general identity, commission & fees, notification preferences,
 * and caretaker onboarding policies in MongoDB.
 */
const platformSettingsSchema = new mongoose.Schema(
  {
    general: {
      platformName: {
        type: String,
        default: 'Bystander',
        trim: true,
        maxlength: [100, 'Platform name cannot exceed 100 characters'],
      },
      supportEmail: {
        type: String,
        default: 'support@bystander.care',
        trim: true,
        lowercase: true,
        match: [/^\S+@\S+\.\S+$/, 'Please enter a valid support email address'],
      },
      supportPhone: {
        type: String,
        default: '+91 22 4890 1122',
        trim: true,
      },
      defaultCity: {
        type: String,
        default: 'Mumbai, MH',
        trim: true,
      },
      timezone: {
        type: String,
        default: 'IST · UTC+05:30',
        trim: true,
      },
    },
    fees: {
      commission: {
        type: Number,
        default: 12,
        min: [0, 'Commission cannot be negative'],
        max: [100, 'Commission cannot exceed 100%'],
      },
      platformFee: {
        type: Number,
        default: 49,
        min: [0, 'Platform fee cannot be negative'],
      },
      gst: {
        type: Number,
        default: 18,
        min: [0, 'GST rate cannot be negative'],
        max: [100, 'GST rate cannot exceed 100%'],
      },
    },
    notifications: {
      booking: { type: Boolean, default: true },
      verification: { type: Boolean, default: true },
      sos: { type: Boolean, default: true },
      complaint: { type: Boolean, default: true },
      digest: { type: Boolean, default: false },
      payout: { type: Boolean, default: true },
    },
    policy: {
      police: { type: Boolean, default: true },
      bank: { type: Boolean, default: true },
      autoFace: { type: Boolean, default: false },
      students: { type: Boolean, default: true },
      validity: {
        type: String,
        default: '12 months',
        enum: ['6 months', '12 months', '18 months', '24 months'],
      },
    },
    updatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

export const PlatformSettings = mongoose.model('PlatformSettings', platformSettingsSchema);
export default PlatformSettings;
