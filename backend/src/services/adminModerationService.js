import Message from '../models/Message.js';

/**
 * Retrieves paginated moderation queue of messages flagged by detection heuristics.
 * Strictly enforces { isFlagged: true } to guarantee privacy of normal unflagged communications.
 *
 * @param {Object} query - { page, limit, search, reason, bookingId }
 * @returns {Promise<{ messages: Array, pagination: Object, stats: Object }>}
 */
export const getFlaggedMessages = async (query = {}) => {
  const { page = 1, limit = 10, search, reason, bookingId } = query;

  const parsedPage = Math.max(1, parseInt(page, 10) || 1);
  const parsedLimit = Math.min(50, Math.max(1, parseInt(limit, 10) || 10));
  const skip = (parsedPage - 1) * parsedLimit;

  // Strict Privacy Safeguard: Unconditional filter for flagged messages only
  const filter = { isFlagged: true };

  if (bookingId) {
    filter.booking = bookingId;
  }

  if (reason && reason !== 'All' && reason.trim().length > 0) {
    filter.flaggedReasons = new RegExp(reason.trim(), 'i');
  }

  if (search && search.trim().length > 0) {
    filter.content = new RegExp(search.trim(), 'i');
  }

  const [messages, total, totalPhoneSignals, totalUpiSignals] = await Promise.all([
    Message.find(filter)
      .sort({ flaggedAt: -1, createdAt: -1 })
      .skip(skip)
      .limit(parsedLimit)
      .select('booking sender senderRole recipient recipientRole content isFlagged flaggedReasons flaggedAt createdAt')
      .populate('sender', 'fullName email role status')
      .populate('recipient', 'fullName email role status')
      .populate('booking', 'bookingNumber status serviceName totalAmount date'),
    Message.countDocuments(filter),
    Message.countDocuments({ isFlagged: true, flaggedReasons: /phone/i }),
    Message.countDocuments({ isFlagged: true, flaggedReasons: /upi/i }),
  ]);

  const sanitizedMessages = messages.map((m) => {
    const sender = m.sender || {};
    const recipient = m.recipient || {};
    const booking = m.booking || {};

    return {
      id: String(m._id),
      _id: String(m._id),
      bookingId: booking._id ? String(booking._id) : String(m.booking),
      bookingNumber: booking.bookingNumber || `BK-${String(booking._id || m.booking).slice(-4).toUpperCase()}`,
      bookingStatus: booking.status || 'unknown',
      senderId: sender._id ? String(sender._id) : String(m.sender),
      senderName: sender.fullName || 'User',
      senderRole: m.senderRole,
      senderStatus: sender.status || 'active',
      recipientId: recipient._id ? String(recipient._id) : String(m.recipient),
      recipientName: recipient.fullName || 'User',
      recipientRole: m.recipientRole,
      recipientStatus: recipient.status || 'active',
      content: m.content,
      isFlagged: m.isFlagged,
      flaggedReasons: m.flaggedReasons || [],
      flaggedAt: m.flaggedAt || m.createdAt,
      createdAt: m.createdAt,
    };
  });

  return {
    messages: sanitizedMessages,
    pagination: {
      total,
      page: parsedPage,
      limit: parsedLimit,
      totalPages: Math.ceil(total / parsedLimit) || 1,
    },
    stats: {
      totalFlagged: total,
      phoneSignals: totalPhoneSignals,
      upiSignals: totalUpiSignals,
    },
  };
};

export const adminModerationService = {
  getFlaggedMessages,
};

export default adminModerationService;
