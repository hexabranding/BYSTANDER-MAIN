import mongoose from 'mongoose';

const VALID_STATUSES = ['pending', 'under_review', 'verified', 'rejected'];

/**
 * Validates query parameters for listing caregiver verifications.
 */
export const validateVerificationQuery = (req, res, next) => {
  const { status, page, limit } = req.query;

  if (status && !VALID_STATUSES.includes(status.trim().toLowerCase())) {
    const err = new Error(`Verification status filter must be one of: ${VALID_STATUSES.join(', ')}`);
    err.statusCode = 400;
    err.name = 'ValidationError';
    return next(err);
  }

  if (page !== undefined) {
    const parsedPage = parseInt(page, 10);
    if (Number.isNaN(parsedPage) || parsedPage < 1) {
      const err = new Error('Page must be a positive integer greater than or equal to 1');
      err.statusCode = 400;
      err.name = 'ValidationError';
      return next(err);
    }
  }

  if (limit !== undefined) {
    const parsedLimit = parseInt(limit, 10);
    if (Number.isNaN(parsedLimit) || parsedLimit < 1) {
      const err = new Error('Limit must be a positive integer between 1 and 50');
      err.statusCode = 400;
      err.name = 'ValidationError';
      return next(err);
    }
  }

  next();
};

/**
 * Validates caregiver profile/verification ID parameter.
 */
export const validateCaregiverIdParam = (req, res, next) => {
  const { id } = req.params;

  if (!id || typeof id !== 'string' || !mongoose.Types.ObjectId.isValid(id.trim())) {
    const err = new Error('A valid caregiver identifier (ObjectId) is required');
    err.statusCode = 400;
    err.name = 'ValidationError';
    return next(err);
  }

  next();
};

/**
 * Validates document ID parameter.
 */
export const validateDocumentIdParam = (req, res, next) => {
  const { documentId } = req.params;

  if (!documentId || typeof documentId !== 'string' || !mongoose.Types.ObjectId.isValid(documentId.trim())) {
    const err = new Error('A valid document identifier (ObjectId) is required');
    err.statusCode = 400;
    err.name = 'ValidationError';
    return next(err);
  }

  next();
};

/**
 * Validates document status update payload.
 */
export const validateUpdateDocumentStatus = (req, res, next) => {
  const { status, notes } = req.body || {};

  if (!status || typeof status !== 'string') {
    const err = new Error(`A valid status is required: ${VALID_STATUSES.join(', ')}`);
    err.statusCode = 400;
    err.name = 'ValidationError';
    return next(err);
  }

  const normalizedStatus = status.trim().toLowerCase();
  if (!VALID_STATUSES.includes(normalizedStatus)) {
    const err = new Error(`Status must be one of: ${VALID_STATUSES.join(', ')}`);
    err.statusCode = 400;
    err.name = 'ValidationError';
    return next(err);
  }

  if (notes !== undefined && notes !== null) {
    if (typeof notes !== 'string') {
      const err = new Error('Reviewer notes must be a string');
      err.statusCode = 400;
      err.name = 'ValidationError';
      return next(err);
    }

    if (notes.trim().length > 1000) {
      const err = new Error('Reviewer notes cannot exceed 1000 characters');
      err.statusCode = 400;
      err.name = 'ValidationError';
      return next(err);
    }
  }

  req.body.status = normalizedStatus;
  if (notes) req.body.notes = notes.trim();

  next();
};

/**
 * Validates caregiver overall verification status update payload.
 */
export const validateUpdateCaregiverVerificationStatus = (req, res, next) => {
  const { status, reason, trustScore } = req.body || {};

  if (!status || typeof status !== 'string') {
    const err = new Error(`A valid verification status is required: ${VALID_STATUSES.join(', ')}`);
    err.statusCode = 400;
    err.name = 'ValidationError';
    return next(err);
  }

  const normalizedStatus = status.trim().toLowerCase();
  if (!VALID_STATUSES.includes(normalizedStatus)) {
    const err = new Error(`Verification status must be one of: ${VALID_STATUSES.join(', ')}`);
    err.statusCode = 400;
    err.name = 'ValidationError';
    return next(err);
  }

  if (reason !== undefined && reason !== null) {
    if (typeof reason !== 'string') {
      const err = new Error('Reason must be a string');
      err.statusCode = 400;
      err.name = 'ValidationError';
      return next(err);
    }

    if (reason.trim().length > 1000) {
      const err = new Error('Reason cannot exceed 1000 characters');
      err.statusCode = 400;
      err.name = 'ValidationError';
      return next(err);
    }
  }

  if (trustScore !== undefined && trustScore !== null) {
    const parsedScore = Number(trustScore);
    if (!Number.isFinite(parsedScore) || parsedScore < 0 || parsedScore > 100) {
      const err = new Error('Trust score must be a number between 0 and 100');
      err.statusCode = 400;
      err.name = 'ValidationError';
      return next(err);
    }
    req.body.trustScore = parsedScore;
  }

  req.body.status = normalizedStatus;
  if (reason) req.body.reason = reason.trim();

  next();
};
