import * as notificationService from '../services/notificationService.js';

/**
 * GET /api/notifications
 * Retrieve paginated notifications for the authenticated user.
 */
export const getNotifications = async (req, res, next) => {
  try {
    const result = await notificationService.getNotifications(req.user, req.query);

    res.status(200).json({
      success: true,
      data: result.notifications,
      pagination: result.pagination,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/notifications/unread
 * Retrieve unread notification count for the authenticated user.
 */
export const getUnreadCount = async (req, res, next) => {
  try {
    const result = await notificationService.getUnreadCount(req.user);

    res.status(200).json({
      success: true,
      data: result,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * PATCH /api/notifications/:id/read
 * Mark a single notification as read (scoped to recipient).
 */
export const markOneAsRead = async (req, res, next) => {
  try {
    const notificationId = req.validatedNotificationId || req.params.id;
    const notification = await notificationService.markOneAsRead(req.user, notificationId);

    res.status(200).json({
      success: true,
      message: 'Notification marked as read',
      data: notification,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * PATCH /api/notifications/read-all
 * Mark all unread notifications as read for the authenticated user.
 */
export const markAllAsRead = async (req, res, next) => {
  try {
    const result = await notificationService.markAllAsRead(req.user);

    res.status(200).json({
      success: true,
      message: 'Notifications marked as read',
      data: result,
    });
  } catch (error) {
    next(error);
  }
};
