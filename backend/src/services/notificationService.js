import mongoose from 'mongoose';
import { Notification } from '../models/index.js';
import { getIO } from '../socket.js';

/**
 * Structured External Provider Interfaces for future integrations.
 * Explicitly declares all external channels as 'not_configured' with delivered: false,
 * preventing any false claims of SMS/Email/Push delivery.
 */
export const externalProviders = {
  sms: {
    name: 'SMS Dispatcher',
    status: 'not_configured',
    send: async ({ to, text }) => ({
      delivered: false,
      status: 'not_configured',
      message: 'External SMS provider (e.g., Twilio/Exotel) is not configured in Step 10C.',
    }),
  },
  email: {
    name: 'Email Dispatcher',
    status: 'not_configured',
    send: async ({ to, subject, body }) => ({
      delivered: false,
      status: 'not_configured',
      message: 'External Email provider (e.g., SendGrid/SES) is not configured in Step 10C.',
    }),
  },
  push: {
    name: 'Push Notification Dispatcher',
    status: 'not_configured',
    send: async ({ to, title, body, data }) => ({
      delivered: false,
      status: 'not_configured',
      message: 'External Push notification provider (e.g., FCM/APNS) is not configured in Step 10C.',
    }),
  },
};

/**
 * Idempotently creates an in-app notification record.
 * If an idempotencyKey is supplied and a notification already exists for that recipient,
 * it returns the existing document without creating duplicates.
 */
export const createNotification = async ({
  recipient,
  type,
  title,
  message,
  metadata = {},
  idempotencyKey = null,
}) => {
  if (!recipient || !mongoose.Types.ObjectId.isValid(recipient)) {
    const err = new Error('A valid recipient User ObjectId is required');
    err.statusCode = 400;
    err.name = 'ValidationError';
    throw err;
  }

  // 1. Idempotency pre-check
  if (idempotencyKey && typeof idempotencyKey === 'string') {
    const existing = await Notification.findOne({
      recipient,
      idempotencyKey: idempotencyKey.trim(),
    });
    if (existing) {
      return existing;
    }
  }

  // 2. Persist notification with duplicate race protection
  try {
    const doc = await Notification.create({
      recipient,
      type,
      title: title.trim(),
      message: message.trim(),
      metadata,
      idempotencyKey: idempotencyKey ? idempotencyKey.trim() : null,
    });
    return doc;
  } catch (err) {
    // If a duplicate key race occurs on the compound (recipient, idempotencyKey) index
    if (err.code === 11000 && idempotencyKey) {
      const existing = await Notification.findOne({
        recipient,
        idempotencyKey: idempotencyKey.trim(),
      });
      if (existing) {
        return existing;
      }
    }
    throw err;
  }
};

/**
 * Fail-safe event dispatcher for application workflows.
 * Wraps notification creation so that downstream notification issues cannot
 * disrupt or falsely reverse primary business operations (bookings, messages, SOS).
 */
export const safeDispatchNotification = async (firstArg, secondArg, thirdArg) => {
  try {
    let notificationData;
    if (firstArg && typeof firstArg === 'object' && !Array.isArray(firstArg) && (firstArg.recipient || firstArg.type)) {
      notificationData = {
        ...firstArg,
        message: firstArg.message || firstArg.body,
        metadata: firstArg.metadata || firstArg.data || {},
      };
    } else if (firstArg && secondArg) {
      const payload = thirdArg && typeof thirdArg === 'object' ? thirdArg : {};
      const normType =
        secondArg === 'booking_requested'
          ? 'booking_created'
          : secondArg === 'booking_confirmed'
            ? 'booking_accepted'
            : secondArg;

      notificationData = {
        recipient: firstArg?._id || firstArg,
        type: normType,
        title:
          payload.title ||
          (normType === 'booking_created'
            ? 'New Booking Request'
            : normType === 'booking_accepted'
              ? 'Booking Confirmed'
              : 'Notification Update'),
        message:
          payload.message ||
          payload.body ||
          `Update regarding booking ${payload.bookingId ? '#' + String(payload.bookingId).slice(-6) : ''}`.trim(),
        metadata: payload,
      };
    } else {
      notificationData = firstArg;
    }

    // In disconnected unit test executions where models are unmocked, skip to prevent 10s Mongoose buffering
    if (
      process.env.NODE_ENV === 'test' &&
      mongoose.connection.readyState === 0 &&
      Notification.create === mongoose.Model.create
    ) {
      return null;
    }
    const doc = await createNotification(notificationData);
    if (doc) {
      try {
        const io = getIO();
        if (io) {
          const raw = doc.toObject ? doc.toObject() : doc;
          io.to(`user:${raw.recipient}`).emit('new_notification', raw);
        }
      } catch (socketErr) {
        // Safe socket emission failure
      }
    }
    return doc;
  } catch (err) {
    console.error(`[Notification Warning] Failed to dispatch in-app notification: ${err.message}`);
    return null;
  }
};

/**
 * Retrieve paginated notifications for the authenticated user.
 * Strictly scopes queries to recipient: user._id and orders chronologically descending.
 */
export const getNotifications = async (user, query = {}) => {
  const filter = { recipient: user._id };

  if (query.unreadOnly === 'true' || query.unreadOnly === true) {
    filter.read = false;
  }

  const page = Math.max(1, parseInt(query.page, 10) || 1);
  const limit = Math.min(50, Math.max(1, parseInt(query.limit, 10) || 20));
  const skip = (page - 1) * limit;

  const [notifications, total] = await Promise.all([
    Notification.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit),
    Notification.countDocuments(filter),
  ]);

  return {
    notifications,
    pagination: {
      total,
      page,
      limit,
      pages: Math.ceil(total / limit) || 1,
    },
  };
};

/**
 * Retrieve unread notification count for the authenticated user.
 */
export const getUnreadCount = async (user) => {
  const count = await Notification.countDocuments({
    recipient: user._id,
    read: false,
  });

  return { unreadCount: count };
};

/**
 * Mark a single notification as read.
 * Enforces strict recipient-level authorization.
 */
export const markOneAsRead = async (user, notificationId) => {
  if (!mongoose.Types.ObjectId.isValid(notificationId)) {
    const err = new Error('Invalid notification identifier');
    err.statusCode = 400;
    err.name = 'ValidationError';
    throw err;
  }

  const notification = await Notification.findById(notificationId);
  if (!notification) {
    const err = new Error('Notification not found');
    err.statusCode = 404;
    err.name = 'NotFoundError';
    throw err;
  }

  // Recipient isolation: User cannot mark another user's notification as read
  if (notification.recipient.toString() !== user._id.toString()) {
    const err = new Error('You are not authorized to update this notification');
    err.statusCode = 403;
    err.name = 'ForbiddenError';
    throw err;
  }

  if (!notification.read) {
    notification.read = true;
    notification.readAt = new Date();
    await notification.save();
  }

  return notification;
};

/**
 * Mark all unread notifications as read for the authenticated user.
 * Atomic updateMany scoped to recipient: user._id.
 */
export const markAllAsRead = async (user) => {
  const result = await Notification.updateMany(
    { recipient: user._id, read: false },
    { $set: { read: true, readAt: new Date() } },
  );

  return {
    modifiedCount: result.modifiedCount || 0,
  };
};

/**
 * Delete all notifications for the authenticated user.
 * Atomic deleteMany scoped to recipient: user._id.
 */
export const clearAllNotifications = async (user) => {
  const result = await Notification.deleteMany({ recipient: user._id });

  return {
    deletedCount: result.deletedCount || 0,
  };
};

/**
 * Delete a single notification scoped to recipient user.
 */
export const deleteOneNotification = async (user, notificationId) => {
  if (!notificationId || !mongoose.Types.ObjectId.isValid(notificationId)) {
    const err = new Error('Invalid notification identifier');
    err.statusCode = 400;
    err.name = 'ValidationError';
    throw err;
  }

  const notification = await Notification.findOneAndDelete({
    _id: notificationId,
    recipient: user._id,
  });

  if (!notification) {
    const err = new Error('Notification not found or access denied');
    err.statusCode = 404;
    err.name = 'NotFoundError';
    throw err;
  }

  return notification;
};
