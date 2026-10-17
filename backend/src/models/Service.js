import mongoose from 'mongoose';
import { slugify } from '../utils/slugify.js';

/**
 * Service Schema — Caregiver & Hospital Bystander Service Catalog.
 * Defines standard hourly rates, clinical/non-clinical categories, and service features.
 */
const serviceSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Service name is required'],
      trim: true,
      minlength: [2, 'Service name must be at least 2 characters'],
      maxlength: [100, 'Service name cannot exceed 100 characters'],
    },
    slug: {
      type: String,
      required: [true, 'Service slug is required'],
      unique: true,
      trim: true,
      lowercase: true,
      default: function () {
        return slugify(this.name);
      },
      set: (val) => (val ? slugify(val) : val),
    },
    description: {
      type: String,
      required: [true, 'Service description is required'],
      trim: true,
      minlength: [10, 'Description must be at least 10 characters long'],
      maxlength: [2000, 'Description cannot exceed 2000 characters'],
    },
    category: {
      type: String,
      required: [true, 'Service category is required'],
      trim: true,
      index: true,
    },
    features: {
      type: [String],
      default: [],
    },
    baseHourlyRate: {
      type: Number,
      required: [true, 'Base hourly rate is required'],
      min: [0, 'Base hourly rate must be a non-negative number'],
    },
    minimumDurationHours: {
      type: Number,
      default: 1,
      min: [1, 'Minimum duration must be at least 1 hour'],
    },
    isActive: {
      type: Boolean,
      default: true,
      index: true,
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    updatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
  },
  {
    timestamps: true,
  },
);

// Pre-validate hook: ensures slug is normalized
serviceSchema.pre('validate', function () {
  if (!this.slug && this.name) {
    this.slug = slugify(this.name);
  } else if (this.slug) {
    this.slug = slugify(this.slug);
  }
});

// Indexes for common public filtering, sorting, and text searches
serviceSchema.index({ isActive: 1, category: 1, baseHourlyRate: 1 });
serviceSchema.index(
  { name: 'text', description: 'text', category: 'text' },
  { weights: { name: 10, category: 5, description: 1 } },
);

export const Service = mongoose.model('Service', serviceSchema);
export default Service;
