import mongoose from 'mongoose';

/**
 * Validates request parameters for retrieving paginated notifications.
 */
export const validateGetNotifications = (req, res, next) => {
  if (req.query.page !== undefined) {
    const page = parseInt(req.query.page, 10);
    if (isNaN(page) || page < 1) {
      const err = new Error('Page must be a positive integer');
      err.statusCode = 400;
      err.name = 'ValidationError';
      return next(err);
    }
  }

  if (req.query.limit !== undefined) {
    const limit = parseInt(req.query.limit, 10);
    if (isNaN(limit) || limit < 1) {
      const err = new Error('Limit must be a positive integer');
      err.statusCode = 400;
      err.name = 'ValidationError';
      return next(err);
    }
  }

  next();
};

/**
 * Validates notificationId URL parameter.
 */
export const validateNotificationId = (req, res, next) => {
  const { id } = req.params;

  if (!id || typeof id !== 'string' || !mongoose.Types.ObjectId.isValid(id.trim())) {
    const err = new Error('A valid notification identifier (ObjectId) is required');
    err.statusCode = 400;
    err.name = 'ValidationError';
    return next(err);
  }

  req.validatedNotificationId = id.trim();
  next();
};
