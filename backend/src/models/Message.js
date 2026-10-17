import mongoose from 'mongoose';

/**
 * Message Schema — Represents a secure, booking-scoped communication exchange
 * between the customer and assigned caregiver.
 * Contains validated participant links, content bounds, read-status tracking,
 * and review flags for off-platform payment/contact detection without hard-blocking.
 */
const messageSchema = new mongoose.Schema(
  {
    booking: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Booking',
      required: [true, 'Booking reference is required'],
      index: true,
    },
    sender: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Sender reference is required'],
      index: true,
    },
    senderRole: {
      type: String,
      enum: {
        values: ['customer', 'caregiver'],
        message: 'Sender role must be customer or caregiver',
      },
      required: [true, 'Sender role is required'],
    },
    recipient: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Recipient reference is required'],
      index: true,
    },
    recipientRole: {
      type: String,
      enum: {
        values: ['customer', 'caregiver'],
        message: 'Recipient role must be customer or caregiver',
      },
      required: [true, 'Recipient role is required'],
    },
    content: {
      type: String,
      required: [true, 'Message content is required'],
      trim: true,
      minlength: [1, 'Message content cannot be empty'],
      maxlength: [2000, 'Message cannot exceed 2000 characters'],
    },
    read: {
      type: Boolean,
      default: false,
      index: true,
    },
    readAt: {
      type: Date,
      default: null,
    },
    // Off-platform contact & payment circumvention detection (flagged for review, not hard-blocked)
    isFlagged: {
      type: Boolean,
      default: false,
      index: true,
    },
    flaggedReasons: {
      type: [String],
      default: [],
    },
    flaggedAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
  },
);

// Compound indexes for performant history retrieval and unread counters
messageSchema.index({ booking: 1, createdAt: 1 });
messageSchema.index({ booking: 1, createdAt: -1 });
messageSchema.index({ recipient: 1, read: 1, createdAt: -1 });
messageSchema.index({ booking: 1, recipient: 1, read: 1 });

export const Message = mongoose.model('Message', messageSchema);
export default Message;
