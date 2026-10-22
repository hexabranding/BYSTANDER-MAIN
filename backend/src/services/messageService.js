import mongoose from 'mongoose';
import { Message, Booking } from '../models/index.js';
import { safeDispatchNotification } from './notificationService.js';
import { getIO } from '../socket.js';

// Regex patterns for detecting potential off-platform payment or contact circumvention
// Flags the message for administrative review without hard-blocking the communication
const PHONE_PATTERN = /(?:\+?91[\s.-]?)?[6-9]\d{9}\b|\b\d{10}\b/;
const UPI_PATTERN = /[a-zA-Z0-9.\-_]{2,256}@[a-zA-Z]{2,64}/;

/**
 * Inspects message content for off-platform contact/payment circumvention.
 * Returns review flags without impeding message delivery.
 */
export const detectOffPlatformContent = (content) => {
  const flags = [];

  if (PHONE_PATTERN.test(content)) {
    flags.push('Potential off-platform phone number detected');
  }

  if (UPI_PATTERN.test(content)) {
    flags.push('Potential off-platform UPI / payment handle detected');
  }

  return {
    isFlagged: flags.length > 0,
    flaggedReasons: flags,
    flaggedAt: flags.length > 0 ? new Date() : null,
  };
};

/**
 * Send a message within the context of an authorized booking.
 * Strictly derives sender and recipient from authenticated user and booking records.
 */
export const sendMessage = async (user, messageData) => {
  const { bookingId, content } = messageData;

  if (!mongoose.Types.ObjectId.isValid(bookingId)) {
    const err = new Error('Invalid booking identifier');
    err.statusCode = 400;
    err.name = 'ValidationError';
    throw err;
  }

  // 1. Fetch booking to verify existence and participant links
  const booking = await Booking.findById(bookingId);
  if (!booking) {
    const err = new Error('Booking not found');
    err.statusCode = 404;
    err.name = 'NotFoundError';
    throw err;
  }

  // 2. Booking Lifecycle Precondition: Check permitted states for active messaging
  const permittedSendStatuses = ['pending', 'confirmed', 'in_progress'];
  if (!permittedSendStatuses.includes(booking.status)) {
    const err = new Error(
      `Cannot send messages for a booking in '${booking.status}' status. Messaging is only permitted during pending, confirmed, or in-progress care engagements.`,
    );
    err.statusCode = 400;
    err.name = 'ValidationError';
    throw err;
  }

  // 3. Object-level participant authorization
  const isCustomer = booking.customer.toString() === user._id.toString();
  const isCaregiver = booking.caregiverUser.toString() === user._id.toString();

  if (!isCustomer && !isCaregiver) {
    const err = new Error('You are not an authorized participant for this booking engagement');
    err.statusCode = 403;
    err.name = 'ForbiddenError';
    throw err;
  }

  // 4. Derive sender and recipient server-side (never trust request body)
  let sender;
  let senderRole;
  let recipient;
  let recipientRole;

  if (isCustomer) {
    sender = booking.customer;
    senderRole = 'customer';
    recipient = booking.caregiverUser;
    recipientRole = 'caregiver';
  } else {
    sender = booking.caregiverUser;
    senderRole = 'caregiver';
    recipient = booking.customer;
    recipientRole = 'customer';
  }

  // 5. Check for off-platform contact/payment signals (flagged for review, not hard-blocked)
  const { isFlagged, flaggedReasons, flaggedAt } = detectOffPlatformContent(content);

  // 6. Persist message record
  const message = await Message.create({
    booking: booking._id,
    sender,
    senderRole,
    recipient,
    recipientRole,
    content,
    isFlagged,
    flaggedReasons,
    flaggedAt,
  });

  // 7. Fail-safe in-app notification dispatch to recipient
  await safeDispatchNotification({
    recipient,
    type: 'message_received',
    title: 'New Message',
    message: `You received a new message regarding booking #${booking._id.toString().slice(-6)}`,
    metadata: {
      bookingId: booking._id,
      messageId: message._id,
      senderId: sender,
    },
    idempotencyKey: `msg:${message._id}:${recipient}`,
  });

  const populated = await message.populate([
    { path: 'sender', select: 'fullName email role' },
    { path: 'recipient', select: 'fullName email role' },
  ]);

  // Real-time event dispatch via Socket.IO
  try {
    const io = getIO();
    if (io) {
      const rawPayload = populated.toObject ? populated.toObject() : populated;
      io.to(`booking:${booking._id}`).emit('new_message', rawPayload);
      io.to(`user:${recipient}`).emit('new_message_notification', rawPayload);
    }
  } catch (socketErr) {
    console.error('[Socket Warning] Failed to emit real-time message:', socketErr.message);
  }

  return populated;
};

/**
 * Retrieve paginated message history for a booking engagement.
 * Accessible to booking participants and platform admins across all booking lifecycle states.
 */
export const getMessages = async (user, bookingId, query = {}) => {
  if (!mongoose.Types.ObjectId.isValid(bookingId)) {
    const err = new Error('Invalid booking identifier');
    err.statusCode = 400;
    err.name = 'ValidationError';
    throw err;
  }

  const booking = await Booking.findById(bookingId);
  if (!booking) {
    const err = new Error('Booking not found');
    err.statusCode = 404;
    err.name = 'NotFoundError';
    throw err;
  }

  // Participant or Admin authorization
  const isCustomer = booking.customer.toString() === user._id.toString();
  const isCaregiver = booking.caregiverUser.toString() === user._id.toString();
  const isAdmin = user.role === 'admin';

  if (!isCustomer && !isCaregiver && !isAdmin) {
    const err = new Error('You are not authorized to view messages for this booking');
    err.statusCode = 403;
    err.name = 'ForbiddenError';
    throw err;
  }

  // Bounded pagination
  const page = Math.max(1, parseInt(query.page, 10) || 1);
  const limit = Math.min(50, Math.max(1, parseInt(query.limit, 10) || 20));
  const skip = (page - 1) * limit;

  const filter = { booking: booking._id };

  const [messages, total] = await Promise.all([
    Message.find(filter)
      .sort({ createdAt: 1 }) // Chronological order
      .skip(skip)
      .limit(limit)
      .populate('sender', 'fullName email role')
      .populate('recipient', 'fullName email role'),
    Message.countDocuments(filter),
  ]);

  return {
    messages,
    pagination: {
      total,
      page,
      limit,
      pages: Math.ceil(total / limit) || 1,
    },
  };
};

/**
 * Mark all unread incoming messages in a booking as read.
 * Scoped strictly to the authenticated recipient. Senders cannot mark their own messages as read.
 */
export const markMessagesAsRead = async (user, bookingId) => {
  if (!mongoose.Types.ObjectId.isValid(bookingId)) {
    const err = new Error('Invalid booking identifier');
    err.statusCode = 400;
    err.name = 'ValidationError';
    throw err;
  }

  const booking = await Booking.findById(bookingId);
  if (!booking) {
    const err = new Error('Booking not found');
    err.statusCode = 404;
    err.name = 'NotFoundError';
    throw err;
  }

  const isCustomer = booking.customer.toString() === user._id.toString();
  const isCaregiver = booking.caregiverUser.toString() === user._id.toString();
  const isAdmin = user.role === 'admin';

  if (!isCustomer && !isCaregiver && !isAdmin) {
    const err = new Error('You are not authorized to update messages for this booking');
    err.statusCode = 403;
    err.name = 'ForbiddenError';
    throw err;
  }

  // Atomic update: strictly mark messages where the authenticated user is the RECIPIENT
  const filter = {
    booking: booking._id,
    recipient: user._id,
    read: false,
  };

  const result = await Message.updateMany(filter, {
    $set: {
      read: true,
      readAt: new Date(),
    },
  });

  if (result.modifiedCount > 0) {
    try {
      const io = getIO();
      if (io) {
        io.to(`booking:${booking._id}`).emit('messages_read', {
          bookingId: booking._id.toString(),
          readBy: user._id.toString(),
          readAt: new Date().toISOString(),
        });
      }
    } catch (socketErr) {
      console.error('[Socket Warning] Failed to emit messages_read:', socketErr.message);
    }
  }

  return {
    modifiedCount: result.modifiedCount || 0,
  };
};

/**
 * Retrieve unread-message counts for the authenticated user across all bookings.
 */
export const getUnreadCounts = async (user) => {
  const [totalUnread, unreadByBooking] = await Promise.all([
    Message.countDocuments({ recipient: user._id, read: false }),
    Message.aggregate([
      { $match: { recipient: new mongoose.Types.ObjectId(user._id), read: false } },
      { $group: { _id: '$booking', count: { $sum: 1 } } },
    ]),
  ]);

  return {
    totalUnread,
    unreadByBooking: unreadByBooking.map((group) => ({
      bookingId: group._id,
      unreadCount: group.count,
    })),
  };
};
