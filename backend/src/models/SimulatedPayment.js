import mongoose from 'mongoose';

/**
 * SimulatedPayment Schema — FOR TEST & DEVELOPMENT ENVIRONMENTS ONLY.
 *
 * Explicitly isolated from production booking and financial systems.
 * Does NOT represent real captured monetary funds, escrow balances, or real payouts.
 * Production readiness for real payments is deferred to Step 8 pending client approval.
 */
const simulatedPaymentSchema = new mongoose.Schema(
  {
    booking: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Booking',
      required: [true, 'Booking reference is required for simulated payment'],
      unique: true,
      index: true,
    },
    customer: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    amount: {
      type: Number,
      required: [true, 'Simulated amount is required'],
      min: [0, 'Amount cannot be negative'],
    },
    currency: {
      type: String,
      default: 'INR',
    },
    status: {
      type: String,
      enum: [
        'SIMULATED_ESCROW_PENDING',
        'SIMULATED_ESCROW_HELD',
        'SIMULATED_RELEASED_TO_CAREGIVER',
        'SIMULATED_REFUNDED',
      ],
      default: 'SIMULATED_ESCROW_HELD',
      required: true,
    },
    isSimulated: {
      type: Boolean,
      default: true,
      immutable: true,
      required: true,
    },
    provider: {
      type: String,
      default: 'SIMULATED_TEST_HARNESS',
      immutable: true,
    },
    simulatedAt: {
      type: Date,
      default: Date.now,
    },
    auditDisclaimer: {
      type: String,
      default: 'SIMULATED TEST TRANSACTION — NO REAL MONETARY FUNDS OR ESCROW HELD',
      immutable: true,
    },
  },
  {
    timestamps: true,
  },
);

export const SimulatedPayment = mongoose.model('SimulatedPayment', simulatedPaymentSchema);
export default SimulatedPayment;
