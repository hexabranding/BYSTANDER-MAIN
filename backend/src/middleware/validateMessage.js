import mongoose from 'mongoose';

/**
 * Validates payload for sending a message in a booking.
 * Extracts bookingId from body or route params, validates content string,
 * enforces length bounds (1-2000 chars), and isolates sanitized input onto req.messageData.
 */
export const validateSendMessage = (req, res, next) => {
  const bookingId = req.params.bookingId || req.params.id || req.body?.bookingId;
  const { content } = req.body || {};

  // 1. Validate bookingId
  if (!bookingId || typeof bookingId !== 'string' || !mongoose.Types.ObjectId.isValid(bookingId.trim())) {
    const err = new Error('A valid booking identifier (ObjectId) is required');
    err.statusCode = 400;
    err.name = 'ValidationError';
    return next(err);
  }

  // 2. Validate message content
  if (!content || typeof content !== 'string' || content.trim().length === 0) {
    const err = new Error('Message content cannot be empty');
    err.statusCode = 400;
    err.name = 'ValidationError';
    return next(err);
  }

  const trimmedContent = content.trim();
  if (trimmedContent.length > 2000) {
    const err = new Error('Message content cannot exceed 2000 characters');
    err.statusCode = 400;
    err.name = 'ValidationError';
    return next(err);
  }

  // Sanitize and isolate on req; client-supplied sender/recipient/role are deliberately ignored
  req.messageData = {
    bookingId: bookingId.trim(),
    content: trimmedContent,
  };

  next();
};

/**
 * Validates params and query filters for retrieving message history of a booking.
 */
export const validateGetMessages = (req, res, next) => {
  const bookingId = req.params.bookingId || req.params.id;

  if (!bookingId || typeof bookingId !== 'string' || !mongoose.Types.ObjectId.isValid(bookingId.trim())) {
    const err = new Error('A valid booking identifier (ObjectId) is required');
    err.statusCode = 400;
    err.name = 'ValidationError';
    return next(err);
  }

  req.validatedBookingId = bookingId.trim();
  next();
};

/**
 * Validates params for marking messages as read in a booking.
 */
export const validateMarkRead = (req, res, next) => {
  const bookingId = req.params.bookingId || req.params.id;

  if (!bookingId || typeof bookingId !== 'string' || !mongoose.Types.ObjectId.isValid(bookingId.trim())) {
    const err = new Error('A valid booking identifier (ObjectId) is required');
    err.statusCode = 400;
    err.name = 'ValidationError';
    return next(err);
  }

  req.validatedBookingId = bookingId.trim();
  next();
};
