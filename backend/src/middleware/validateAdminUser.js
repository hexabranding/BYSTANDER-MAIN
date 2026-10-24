import mongoose from 'mongoose';

const VALID_STATUSES = ['active', 'pending_verification', 'suspended', 'blocked'];
const VALID_TARGET_STATUSES = ['active', 'suspended', 'blocked'];
const VALID_VERIFICATION_STATUSES = ['pending', 'under_review', 'verified', 'rejected'];
const VALID_SORTS = ['rating', 'experience', 'rate', 'newest', 'createdAt'];

/**
 * Validates query parameters for customer directory listing.
 */
export const validateUserQuery = (req, res, next) => {
  const { page, limit, status, search, city } = req.query;

  if (page !== undefined) {
    const parsedPage = Number(page);
    if (!Number.isInteger(parsedPage) || parsedPage < 1) {
      return res.status(400).json({
        success: false,
        error: 'ValidationError',
        message: 'Page parameter must be a positive integer greater than or equal to 1',
      });
    }
  }

  if (limit !== undefined) {
    const parsedLimit = Number(limit);
    if (!Number.isInteger(parsedLimit) || parsedLimit < 1 || parsedLimit > 100) {
      return res.status(400).json({
        success: false,
        error: 'ValidationError',
        message: 'Limit parameter must be an integer between 1 and 100',
      });
    }
  }

  if (status !== undefined && status !== 'All' && status !== '') {
    const normalized = String(status).trim().toLowerCase();
    if (!VALID_STATUSES.includes(normalized)) {
      return res.status(400).json({
        success: false,
        error: 'ValidationError',
        message: `Invalid status filter. Allowed values: ${VALID_STATUSES.join(', ')}`,
      });
    }
  }

  if (search !== undefined && typeof search === 'string' && search.length > 100) {
    return res.status(400).json({
      success: false,
      error: 'ValidationError',
      message: 'Search query cannot exceed 100 characters',
    });
  }

  if (city !== undefined && typeof city === 'string' && city.length > 100) {
    return res.status(400).json({
      success: false,
      error: 'ValidationError',
      message: 'City filter cannot exceed 100 characters',
    });
  }

  next();
};

/**
 * Validates query parameters for caregiver directory listing.
 */
export const validateCaregiverUserQuery = (req, res, next) => {
  const { page, limit, status, verificationStatus, search, city, qualification, sort } = req.query;

  if (page !== undefined) {
    const parsedPage = Number(page);
    if (!Number.isInteger(parsedPage) || parsedPage < 1) {
      return res.status(400).json({
        success: false,
        error: 'ValidationError',
        message: 'Page parameter must be a positive integer greater than or equal to 1',
      });
    }
  }

  if (limit !== undefined) {
    const parsedLimit = Number(limit);
    if (!Number.isInteger(parsedLimit) || parsedLimit < 1 || parsedLimit > 100) {
      return res.status(400).json({
        success: false,
        error: 'ValidationError',
        message: 'Limit parameter must be an integer between 1 and 100',
      });
    }
  }

  if (status !== undefined && status !== 'All' && status !== '') {
    const normalized = String(status).trim().toLowerCase();
    if (!VALID_STATUSES.includes(normalized)) {
      return res.status(400).json({
        success: false,
        error: 'ValidationError',
        message: `Invalid status filter. Allowed values: ${VALID_STATUSES.join(', ')}`,
      });
    }
  }

  if (verificationStatus !== undefined && verificationStatus !== 'All' && verificationStatus !== '') {
    const normalized = String(verificationStatus).trim().toLowerCase();
    if (!VALID_VERIFICATION_STATUSES.includes(normalized)) {
      return res.status(400).json({
        success: false,
        error: 'ValidationError',
        message: `Invalid verification status filter. Allowed values: ${VALID_VERIFICATION_STATUSES.join(', ')}`,
      });
    }
  }

  if (sort !== undefined && !VALID_SORTS.includes(sort)) {
    return res.status(400).json({
      success: false,
      error: 'ValidationError',
      message: `Invalid sort field. Allowed values: ${VALID_SORTS.join(', ')}`,
    });
  }

  if (search !== undefined && typeof search === 'string' && search.length > 100) {
    return res.status(400).json({
      success: false,
      error: 'ValidationError',
      message: 'Search query cannot exceed 100 characters',
    });
  }

  if (city !== undefined && typeof city === 'string' && city.length > 100) {
    return res.status(400).json({
      success: false,
      error: 'ValidationError',
      message: 'City filter cannot exceed 100 characters',
    });
  }

  if (qualification !== undefined && typeof qualification === 'string' && qualification.length > 100) {
    return res.status(400).json({
      success: false,
      error: 'ValidationError',
      message: 'Qualification filter cannot exceed 100 characters',
    });
  }

  next();
};

/**
 * Validates MongoDB ObjectId param (:id).
 */
export const validateUserIdParam = (req, res, next) => {
  const { id } = req.params;

  if (!id || !mongoose.Types.ObjectId.isValid(id)) {
    return res.status(400).json({
      success: false,
      error: 'ValidationError',
      message: 'Invalid user or profile identifier format. Expected 24-character hex string.',
    });
  }

  next();
};

/**
 * Validates account status mutation payload.
 * Requires allowed target status ('active', 'suspended', 'blocked')
 * and mandatory non-empty reason (3 to 1000 characters).
 */
export const validateUpdateUserStatus = (req, res, next) => {
  const status = req.body.status || req.body.newStatus;
  const reason = req.body.reason;

  if (!status) {
    return res.status(400).json({
      success: false,
      error: 'ValidationError',
      message: 'Account status is required. Allowed values: active, suspended, blocked.',
    });
  }

  const normalizedStatus = String(status).trim().toLowerCase();
  if (!VALID_TARGET_STATUSES.includes(normalizedStatus)) {
    return res.status(400).json({
      success: false,
      error: 'ValidationError',
      message: `Invalid account status '${status}'. Status must be one of: ${VALID_TARGET_STATUSES.join(', ')}.`,
    });
  }

  if (!reason || typeof reason !== 'string' || reason.trim().length < 3) {
    return res.status(400).json({
      success: false,
      error: 'ValidationError',
      message: 'A mandatory reason of at least 3 characters is required for account status changes.',
    });
  }

  if (reason.trim().length > 1000) {
    return res.status(400).json({
      success: false,
      error: 'ValidationError',
      message: 'Reason for account status change cannot exceed 1000 characters.',
    });
  }

  // Attach sanitized fields to req
  req.sanitizedStatusUpdate = {
    status: normalizedStatus,
    reason: reason.trim(),
    reviewAfter: req.body.reviewAfter ? String(req.body.reviewAfter).trim() : undefined,
  };

  next();
};

/**
 * Validates query parameters for flagged message moderation queue.
 */
export const validateModerationQuery = (req, res, next) => {
  const { page, limit, search, reason } = req.query;

  if (page !== undefined) {
    const parsedPage = Number(page);
    if (!Number.isInteger(parsedPage) || parsedPage < 1) {
      return res.status(400).json({
        success: false,
        error: 'ValidationError',
        message: 'Page parameter must be a positive integer greater than or equal to 1',
      });
    }
  }

  if (limit !== undefined) {
    const parsedLimit = Number(limit);
    if (!Number.isInteger(parsedLimit) || parsedLimit < 1 || parsedLimit > 50) {
      return res.status(400).json({
        success: false,
        error: 'ValidationError',
        message: 'Limit parameter must be an integer between 1 and 50',
      });
    }
  }

  if (search !== undefined && typeof search === 'string' && search.length > 100) {
    return res.status(400).json({
      success: false,
      error: 'ValidationError',
      message: 'Search query cannot exceed 100 characters',
    });
  }

  if (reason !== undefined && typeof reason === 'string' && reason.length > 100) {
    return res.status(400).json({
      success: false,
      error: 'ValidationError',
      message: 'Reason filter cannot exceed 100 characters',
    });
  }

  next();
};
