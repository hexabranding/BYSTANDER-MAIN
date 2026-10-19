import mongoose from 'mongoose';

/**
 * Payout Schema — Tracks batch caregiver earnings disbursal lifecycle
 * (Pending -> Processing -> Settled / Failed).
 *
 * NOTE: For audit and ledger purposes. No real banking operations or disbursals.
 */
const payoutSchema = new mongoose.Schema(
  {
    payoutNumber: {
      type: String,
      required: true,
      unique: true,
      index: true,
      trim: true,
    },
    caregiver: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'CaregiverProfile',
      required: [true, 'Caregiver profile reference is required'],
      index: true,
    },
    caregiverUser: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Caregiver user reference is required'],
    },
    transactions: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Transaction',
      },
    ],
    period: {
      type: String,
      required: true,
      trim: true,
    },
    jobsCount: {
      type: Number,
      required: true,
      min: 1,
      default: 1,
    },
    gross: {
      type: Number,
      required: true,
      min: 0,
    },
    commission: {
      type: Number,
      required: true,
      min: 0,
    },
    net: {
      type: Number,
      required: true,
      min: 0,
    },
    currency: {
      type: String,
      default: 'INR',
      trim: true,
    },
    disbursalMethod: {
      type: String,
      default: 'HDFC •••• 4412',
      trim: true,
    },
    status: {
      type: String,
      enum: ['pending', 'processing', 'settled', 'failed'],
      default: 'pending',
      required: true,
      index: true,
    },
    requestedOn: {
      type: Date,
      default: Date.now,
    },
    settledAt: {
      type: Date,
      default: null,
    },
    processedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    notes: {
      type: String,
      trim: true,
      default: '',
      maxlength: 500,
    },
    isSimulated: {
      type: Boolean,
      default: true,
      immutable: true,
    },
    auditDisclaimer: {
      type: String,
      default: 'SIMULATED PAYOUT AUDIT RECORD — NO REAL BANK DISBURSAL',
      immutable: true,
    },
  },
  {
    timestamps: true,
  },
);

payoutSchema.index({ caregiverUser: 1, createdAt: -1 });
payoutSchema.index({ status: 1, createdAt: -1 });

// Partial unique index preventing multiple concurrent/active payouts for the same caregiver
payoutSchema.index(
  { caregiverUser: 1 },
  {
    unique: true,
    name: 'unique_active_payout_per_caregiver',
    partialFilterExpression: { status: { $in: ['pending', 'processing'] } },
  },
);

export const Payout = mongoose.model('Payout', payoutSchema);
export default Payout;
