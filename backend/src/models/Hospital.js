import mongoose from 'mongoose';

/**
 * Hospital Schema — Institutional Partner Hospitals & Medical Referral Tie-ups in Kerala
 */
const hospitalSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Hospital name is required'],
      trim: true,
      minlength: [2, 'Hospital name must be at least 2 characters'],
      maxlength: [150, 'Hospital name cannot exceed 150 characters'],
      index: true,
    },
    code: {
      type: String,
      trim: true,
      uppercase: true,
      unique: true,
      sparse: true,
    },
    city: {
      type: String,
      required: [true, 'City or locality is required'],
      trim: true,
      index: true,
    },
    district: {
      type: String,
      required: [true, 'District is required'],
      trim: true,
      default: 'Kozhikode',
      index: true,
    },
    state: {
      type: String,
      trim: true,
      default: 'Kerala',
    },
    address: {
      type: String,
      trim: true,
      default: '',
    },
    contactPerson: {
      type: String,
      trim: true,
      default: '',
    },
    phone: {
      type: String,
      required: [true, 'Contact phone number is required'],
      trim: true,
    },
    email: {
      type: String,
      trim: true,
      lowercase: true,
      default: '',
    },
    bedPartners: {
      type: Number,
      min: [0, 'Bed count cannot be negative'],
      default: 0,
    },
    activeBookings: {
      type: Number,
      min: [0, 'Active bookings cannot be negative'],
      default: 0,
    },
    icuSupport: {
      type: Boolean,
      default: false,
    },
    contractStatus: {
      type: String,
      enum: ['Active', 'On Hold', 'Terminated'],
      default: 'Active',
      index: true,
    },
    notes: {
      type: String,
      trim: true,
      default: '',
    },
  },
  {
    timestamps: true,
  }
);

// Auto-generate hospital reference code if not provided (e.g. HS-106)
hospitalSchema.pre('save', async function () {
  if (!this.code) {
    const last = await mongoose.model('Hospital').findOne().sort({ code: -1 }).select('code');
    let nextNum = 101;
    if (last && last.code && last.code.startsWith('HS-')) {
      const parsed = parseInt(last.code.replace('HS-', ''), 10);
      if (!isNaN(parsed)) {
        nextNum = parsed + 1;
      }
    }
    this.code = `HS-${nextNum}`;
  }
});

const Hospital = mongoose.model('Hospital', hospitalSchema);
export default Hospital;

