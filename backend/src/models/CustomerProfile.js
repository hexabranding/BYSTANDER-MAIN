import mongoose from 'mongoose';

/**
 * Subdocument schema for family members/patients requiring bedside or home care.
 */
const patientSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Patient name is required'],
      trim: true,
    },
    age: {
      type: Number,
      min: [0, 'Age cannot be negative'],
      max: [130, 'Age cannot exceed 130'],
      default: null,
    },
    gender: {
      type: String,
      enum: ['Male', 'Female', 'Other'],
      default: 'Other',
    },
    relation: {
      type: String,
      trim: true,
      default: 'Self',
    },
    condition: {
      type: String,
      trim: true,
      default: '',
    },
    medicalNotes: {
      type: String,
      trim: true,
      default: '',
    },
  },
  { _id: true },
);

/**
 * CustomerProfile Schema — Specific metadata for family members/customers booking care.
 */
const customerProfileSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'User reference is required'],
      unique: true,
      index: true,
    },
    emergencyContact: {
      name: { type: String, trim: true, default: '' },
      phone: { type: String, trim: true, default: '' },
      relation: { type: String, trim: true, default: '' },
    },
    defaultAddress: {
      street: { type: String, trim: true, default: '' },
      addressLine: { type: String, trim: true, default: '' },
      area: { type: String, trim: true, default: '' },
      city: { type: String, trim: true, default: 'Kochi, KL' },
      district: { type: String, trim: true, default: 'Ernakulam' },
      state: { type: String, trim: true, default: 'Kerala' },
      pincode: { type: String, trim: true, default: '' },
      coordinates: {
        lat: { type: Number, default: null },
        lng: { type: Number, default: null },
      },
    },
    patients: [patientSchema],
    careNotes: {
      type: String,
      trim: true,
      default: '',
    },
    totalBookings: {
      type: Number,
      default: 0,
      min: 0,
    },
    totalSpent: {
      type: Number,
      default: 0,
      min: 0,
    },
    rating: {
      average: {
        type: Number,
        default: 5.0,
        min: 1,
        max: 5,
      },
      count: {
        type: Number,
        default: 0,
        min: 0,
      },
    },
  },
  {
    timestamps: true,
  },
);

customerProfileSchema.index({ 'defaultAddress.city': 1 });

export const CustomerProfile = mongoose.model('CustomerProfile', customerProfileSchema);
export default CustomerProfile;
