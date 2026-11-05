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
        default: 'Kochi, KL',
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
    pricing: {
      serviceBaseRate: {
        type: Number,
        default: 199,
        min: [0, 'Service base rate cannot be negative'],
      },
      hourly: {
        initialRate: {
          type: Number,
          default: 200,
          min: [50, 'Initial rate must be at least ₹50/hr'],
        },
        maxCap: {
          type: Number,
          default: 500,
          min: [100, 'Max cap must be at least ₹100/hr'],
        },
        dynamicPricingEnabled: {
          type: Boolean,
          default: true,
        },
        tiers: {
          type: [
            {
              minReviews: { type: Number, required: true, min: 1 },
              minRating: { type: Number, required: true, min: 1, max: 5, default: 4.8 },
              rate: { type: Number, required: true, min: 50 },
              increment: { type: Number, default: 75 },
              label: { type: String, default: 'Milestone' },
            },
          ],
          default: [
            { minReviews: 30, minRating: 4.7, rate: 275, increment: 75, label: 'Silver' },
            { minReviews: 50, minRating: 4.8, rate: 350, increment: 75, label: 'Gold' },
            { minReviews: 70, minRating: 4.8, rate: 425, increment: 75, label: 'Diamond' },
            { minReviews: 90, minRating: 4.8, rate: 500, increment: 75, label: 'Platinum' },
          ],
        },
      },
      daily: {
        baseDailyRate: {
          type: Number,
          default: 1500,
          min: [500, 'Base daily rate must be at least ₹500/day'],
        },
        extraDayDiscount: {
          type: Number,
          default: 250,
          min: [0, 'Discount cannot be negative'],
        },
      },
      monthly: {
        useFormula: {
          type: Boolean,
          default: true,
        },
        fixedPackageRate: {
          type: Number,
          default: 37500,
          min: [5000, 'Monthly package rate must be at least ₹5,000'],
        },
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
