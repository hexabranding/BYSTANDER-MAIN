import mongoose from 'mongoose';

/**
 * Ambulance Schema — Represents registered ambulance drivers, emergency vehicle specs,
 * operating city/hospital, and live on-call availability.
 */
const ambulanceSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      unique: true,
      index: true,
    },
    driverName: {
      type: String,
      required: [true, 'Driver name is required'],
      trim: true,
      minlength: [2, 'Driver name must be at least 2 characters'],
      maxlength: [100, 'Driver name cannot exceed 100 characters'],
    },
    phone: {
      type: String,
      required: [true, 'Primary contact phone number is required'],
      trim: true,
      match: [/^\+?[1-9]\d{6,14}$/, 'Please enter a valid phone number'],
    },
    alternatePhone: {
      type: String,
      trim: true,
      default: '',
    },
    vehicleNumber: {
      type: String,
      required: [true, 'Vehicle registration plate number is required'],
      trim: true,
      uppercase: true,
    },
    ambulanceType: {
      type: String,
      enum: {
        values: [
          'Basic Life Support (BLS)',
          'Advanced Life Support (ALS)',
          'ICU on Wheels',
          'Patient Transport',
        ],
        message: 'Invalid ambulance category',
      },
      default: 'Basic Life Support (BLS)',
      required: true,
    },
    baseHospital: {
      type: String,
      trim: true,
      default: 'Local Hospital & Trauma Network',
    },
    city: {
      type: String,
      required: [true, 'Operational city is required'],
      trim: true,
      index: true,
    },
    area: {
      type: String,
      trim: true,
      default: '',
    },
    isAvailable: {
      type: Boolean,
      default: false,
      index: true,
    },
    verificationStatus: {
      type: String,
      enum: ['pending', 'verified', 'rejected', 'suspended'],
      default: 'pending',
      index: true,
    },
    oxygenFitted: {
      type: Boolean,
      default: true,
    },
    ventilatorFitted: {
      type: Boolean,
      default: false,
    },
    stretcherAvailable: {
      type: Boolean,
      default: true,
    },
    emergencyCallCount: {
      type: Number,
      default: 0,
      min: 0,
    },
    location: {
      type: {
        type: String,
        enum: ['Point'],
        default: 'Point',
      },
      coordinates: {
        type: [Number],
        default: [75.7804, 11.2588],
      },
      latitude: {
        type: Number,
        default: 11.2588,
      },
      longitude: {
        type: Number,
        default: 75.7804,
      },
      lastPingAt: {
        type: Date,
        default: null,
      },
    },
    notes: {
      type: String,
      trim: true,
      default: '',
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

ambulanceSchema.index({ city: 1, isAvailable: 1, verificationStatus: 1 });
ambulanceSchema.index({ 'location.coordinates': '2dsphere' });

export const Ambulance = mongoose.model('Ambulance', ambulanceSchema);
export default Ambulance;
