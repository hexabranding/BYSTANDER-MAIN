import mongoose from 'mongoose';

/**
 * Notification Schema — Represents an in-app operational notification.
 * Contains validated recipient reference, notification type, title, message,
 * optional safe metadata, read-status tracking, and an idempotency key to prevent duplicates.
 *
 * NOTE ON RETENTION & CLEANUP:
 * As mandated, no automatic 90-day TTL index is applied here. Automatic purging is deferred
 * until product retention policies and medical/safety audit implications are formally reviewed.
 */
const notificationSchema = new mongoose.Schema(
  {
    recipient: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Recipient reference is required'],
      index: true,
    },
    type: {
      type: String,
      enum: {
        values: [
          'booking_created',
          'booking_accepted',
          'booking_cancelled',
          'booking_completed',
          'sos_raised',
          'sos_assigned',
          'sos_resolved',
          'message_received',
          'review_received',
          'complaint_update',
          'payment_received',
          'payment_refunded',
          'system',
        ],
        message: 'Invalid notification type: {VALUE}',
      },
      required: [true, 'Notification type is required'],
      index: true,
    },
    title: {
      type: String,
      required: [true, 'Notification title is required'],
      trim: true,
      minlength: [1, 'Title cannot be empty'],
      maxlength: [200, 'Title cannot exceed 200 characters'],
    },
    message: {
      type: String,
      required: [true, 'Notification message content is required'],
      trim: true,
      minlength: [1, 'Message cannot be empty'],
      maxlength: [1000, 'Message cannot exceed 1000 characters'],
    },
    metadata: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
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
    idempotencyKey: {
      type: String,
      trim: true,
      default: null,
    },
  },
  {
    timestamps: true,
  },
);

// Compound indexes for user feed retrieval and unread counters
notificationSchema.index({ recipient: 1, createdAt: -1 });
notificationSchema.index({ recipient: 1, read: 1, createdAt: -1 });

// Unique partial index for idempotency per recipient (only indexes documents with string key)
notificationSchema.index(
  { recipient: 1, idempotencyKey: 1 },
  {
    unique: true,
    partialFilterExpression: { idempotencyKey: { $type: 'string' } },
  },
);

export const Notification = mongoose.model('Notification', notificationSchema);
export default Notification;
