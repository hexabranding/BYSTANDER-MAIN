import mongoose from 'mongoose';

/**
 * Transaction Schema — Database-backed financial audit ledger record.
 * Tracks escrow holdings, caregiver payouts, platform commission splits,
 * and refunds with immutable price snapshots.
 *
 * NOTE: For audit and ledger purposes. No real monetary transactions or bank transfers.
 */
const transactionSchema = new mongoose.Schema(
  {
    transactionNumber: {
      type: String,
      required: true,
      unique: true,
      index: true,
      trim: true,
    },
    booking: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Booking',
      required: [true, 'Booking reference is required'],
      index: true,
    },
    customer: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Customer reference is required'],
      index: true,
    },
    caregiver: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'CaregiverProfile',
      required: false,
      default: null,
      index: true,
    },
    caregiverUser: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: false,
      default: null,
      index: true,
    },
    serviceName: {
      type: String,
      required: true,
      trim: true,
    },
    amount: {
      type: Number,
      required: [true, 'Transaction amount is required'],
      min: [0, 'Amount cannot be negative'],
    },
    currency: {
      type: String,
      default: 'INR',
      trim: true,
    },
    breakdown: {
      baseAmount: {
        type: Number,
        required: true,
        min: 0,
      },
      platformFee: {
        type: Number,
        default: 49,
        min: 0,
      },
      tax: {
        type: Number,
        default: 0,
        min: 0,
      },
      commission: {
        type: Number,
        default: 0,
        min: 0,
      },
      caregiverPayout: {
        type: Number,
        default: 0,
        min: 0,
      },
    },
    paymentMethod: {
      type: String,
      default: 'UPI · HDFC',
      trim: true,
    },
    status: {
      type: String,
      enum: ['escrow_held', 'released', 'refunded', 'disputed'],
      default: 'escrow_held',
      required: true,
      index: true,
    },
    type: {
      type: String,
      enum: ['booking_payment', 'refund', 'adjustment'],
      default: 'booking_payment',
      required: true,
    },
    escrowHeldAt: {
      type: Date,
      default: Date.now,
    },
    releasedAt: {
      type: Date,
      default: null,
    },
    refundedAt: {
      type: Date,
      default: null,
    },
    payout: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Payout',
      default: null,
      index: true,
    },
    payoutAllocatedAt: {
      type: Date,
      default: null,
    },
    gateway: {
      type: String,
      enum: ['razorpay', 'stripe', 'simulated'],
      default: 'razorpay',
      index: true,
    },
    gatewayOrderId: {
      type: String,
      trim: true,
      default: null,
      index: true,
    },
    gatewayPaymentId: {
      type: String,
      trim: true,
      default: null,
      index: true,
    },
    gatewaySignature: {
      type: String,
      trim: true,
      default: null,
    },
    gatewayRefundId: {
      type: String,
      trim: true,
      default: null,
    },
    isSimulated: {
      type: Boolean,
      default: false,
    },
    auditDisclaimer: {
      type: String,
      default: 'FINANCIAL AUDIT LEDGER',
    },
  },
  {
    timestamps: true,
  },
);

transactionSchema.index({ customer: 1, createdAt: -1 });
transactionSchema.index({ caregiverUser: 1, createdAt: -1 });
transactionSchema.index({ status: 1, createdAt: -1 });
transactionSchema.index({ caregiverUser: 1, status: 1, payout: 1 });

export const Transaction = mongoose.model('Transaction', transactionSchema);
export default Transaction;
