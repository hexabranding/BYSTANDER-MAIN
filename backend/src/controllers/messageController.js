import * as messageService from '../services/messageService.js';

/**
 * POST /api/messages
 * Authenticated customer or assigned caregiver sends a message for a booking.
 */
export const sendMessage = async (req, res, next) => {
  try {
    const message = await messageService.sendMessage(req.user, req.messageData);

    res.status(201).json({
      success: true,
      message: 'Message sent successfully',
      data: message,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/messages/booking/:bookingId (and /api/messages/:bookingId)
 * Retrieve paginated message history for a booking engagement.
 */
export const getMessages = async (req, res, next) => {
  try {
    const bookingId = req.validatedBookingId || req.params.bookingId || req.params.id;
    const result = await messageService.getMessages(req.user, bookingId, req.query);

    res.status(200).json({
      success: true,
      data: result.messages,
      pagination: result.pagination,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * PATCH /api/messages/booking/:bookingId/read (and /api/messages/:bookingId/read)
 * Mark all eligible unread incoming messages in a booking as read for the authenticated recipient.
 */
export const markMessagesAsRead = async (req, res, next) => {
  try {
    const bookingId = req.validatedBookingId || req.params.bookingId || req.params.id;
    const result = await messageService.markMessagesAsRead(req.user, bookingId);

    res.status(200).json({
      success: true,
      message: 'Messages marked as read successfully',
      data: result,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/messages/unread
 * Retrieve unread-message counts for the authenticated user across all bookings.
 */
export const getUnreadCounts = async (req, res, next) => {
  try {
    const result = await messageService.getUnreadCounts(req.user);

    res.status(200).json({
      success: true,
      data: result,
    });
  } catch (error) {
    next(error);
  }
};
