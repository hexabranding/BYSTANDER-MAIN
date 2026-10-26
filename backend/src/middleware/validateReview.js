import mongoose from 'mongoose';

/**
 * Validates review submission payload.
 */
export const validateCreateReview = (req, res, next) => {
  const { bookingId, rating, criteria, comment } = req.body;

  if (!bookingId || typeof bookingId !== 'string' || !mongoose.Types.ObjectId.isValid(bookingId.trim())) {
    return res.status(400).json({
      error: 'ValidationError',
      message: 'A valid booking identifier is required',
    });
  }

  let finalRating = null;

  if (rating !== undefined && rating !== null) {
    const num = Number(rating);
    if (isNaN(num) || num < 1 || num > 5) {
      return res.status(400).json({
        error: 'ValidationError',
        message: 'Rating must be a numeric score between 1 and 5',
      });
    }
    finalRating = Number(num.toFixed(1));
  }

  let sanitizedCriteria = null;
  if (criteria && typeof criteria === 'object') {
    sanitizedCriteria = {};
    for (const [key, val] of Object.entries(criteria)) {
      if (val !== undefined && val !== null) {
        const score = Number(val);
        if (isNaN(score) || score < 1 || score > 5) {
          return res.status(400).json({
            error: 'ValidationError',
            message: `Rating criterion '${key}' must be a score between 1 and 5`,
          });
        }
        sanitizedCriteria[key] = Math.round(score);
      }
    }

    if (!finalRating) {
      const vals = Object.values(sanitizedCriteria);
      finalRating = vals.length ? Number((vals.reduce((a, b) => a + b, 0) / vals.length).toFixed(1)) : 5.0;
    }
  }

  if (!finalRating) {
    return res.status(400).json({
      error: 'ValidationError',
      message: 'A rating score or star feedback criteria is required',
    });
  }

  let sanitizedComment = '';
  if (comment !== undefined && comment !== null) {
    if (typeof comment !== 'string') {
      return res.status(400).json({
        error: 'ValidationError',
        message: 'Comment must be a text string',
      });
    }
    if (comment.length > 2000) {
      return res.status(400).json({
        error: 'ValidationError',
        message: 'Comment cannot exceed 2000 characters',
      });
    }
    sanitizedComment = comment.trim();
  }

  req.sanitizedReview = {
    bookingId: bookingId.trim(),
    rating: finalRating,
    criteria: sanitizedCriteria || { serviceQuality: 5, behaviour: 5, punctuality: 5, overall: 5 },
    comment: sanitizedComment,
  };

  next();
};

/**
 * Validates caregiver response to a customer review.
 */
export const validateReplyReview = (req, res, next) => {
  const { reply } = req.body;

  if (!reply || typeof reply !== 'string' || reply.trim().length < 2) {
    return res.status(400).json({
      error: 'ValidationError',
      message: 'Reply text of at least 2 characters is required',
    });
  }

  if (reply.trim().length > 2000) {
    return res.status(400).json({
      error: 'ValidationError',
      message: 'Reply cannot exceed 2000 characters',
    });
  }

  req.sanitizedReply = reply.trim();
  next();
};

/**
 * Validates report generation request parameters.
 */
export const validateReportGeneration = (req, res, next) => {
  const { type, period, format } = req.body;

  const validTypes = [
    'Monthly booking & revenue report',
    'Caretaker verification audit',
    'Complaint resolution SLA report',
    'SOS incident audit trail',
    'Caretaker payout reconciliation',
    'Service distribution by city',
  ];

  if (type && !validTypes.includes(type.trim())) {
    return res.status(400).json({
      error: 'ValidationError',
      message: `Invalid report type. Allowed types: ${validTypes.join(', ')}`,
    });
  }

  if (format && !['CSV', 'PDF'].includes(format.toUpperCase())) {
    return res.status(400).json({
      error: 'ValidationError',
      message: 'Report format must be CSV or PDF',
    });
  }

  req.sanitizedReportQuery = {
    type: type ? type.trim() : validTypes[0],
    period: period ? String(period).trim() : 'Current Period',
    format: format ? format.toUpperCase() : 'CSV',
  };

  next();
};
