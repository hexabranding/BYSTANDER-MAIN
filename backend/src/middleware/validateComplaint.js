import mongoose from 'mongoose';

const VALID_CATEGORIES = [
  'Misbehavior',
  'Theft',
  'Abuse',
  'Harassment',
  'Medical negligence',
  'No-show',
  'Late arrival',
  'Payment dispute',
  'Behaviour',
  'Billing',
  'Other',
];

const VALID_PRIORITIES = ['Low', 'Medium', 'High', 'Critical'];

const VALID_STATUSES = ['submitted', 'under_review', 'action_taken', 'resolved', 'dismissed'];

/**
 * Validates complaint submission payload from authenticated customer or caregiver.
 * Strictly ignores and strips client-supplied complainant, status, internal notes, or resolution fields.
 */
export const validateSubmitComplaint = (req, res, next) => {
  const { bookingId, category, priority, subject, description, evidence } = req.body;

  // 1. Validate Subject
  if (!subject || typeof subject !== 'string' || subject.trim().length < 3) {
    return res.status(400).json({
      success: false,
      error: 'ValidationError',
      message: 'Complaint subject is required and must be at least 3 characters long',
    });
  }

  if (subject.trim().length > 200) {
    return res.status(400).json({
      success: false,
      error: 'ValidationError',
      message: 'Complaint subject cannot exceed 200 characters',
    });
  }

  // 2. Validate Description
  if (!description || typeof description !== 'string' || description.trim().length < 5) {
    return res.status(400).json({
      success: false,
      error: 'ValidationError',
      message: 'Complaint description is required and must be at least 5 characters long',
    });
  }

  if (description.trim().length > 2000) {
    return res.status(400).json({
      success: false,
      error: 'ValidationError',
      message: 'Complaint description cannot exceed 2000 characters',
    });
  }

  // 3. Validate Category
  if (!category || typeof category !== 'string' || !VALID_CATEGORIES.includes(category.trim())) {
    return res.status(400).json({
      success: false,
      error: 'ValidationError',
      message: `Category must be one of: ${VALID_CATEGORIES.join(', ')}`,
    });
  }

  // 4. Validate Priority
  let validatedPriority = 'Medium';
  if (priority !== undefined) {
    if (!VALID_PRIORITIES.includes(priority)) {
      return res.status(400).json({
        success: false,
        error: 'ValidationError',
        message: `Priority must be one of: ${VALID_PRIORITIES.join(', ')}`,
      });
    }
    validatedPriority = priority;
  }

  // 5. Validate Booking ID (optional, but if provided must be a valid 24-character hex ObjectId)
  let validatedBookingId = null;
  if (bookingId) {
    if (!mongoose.Types.ObjectId.isValid(bookingId)) {
      return res.status(400).json({
        success: false,
        error: 'ValidationError',
        message: 'Invalid booking identifier format. Expected 24-character hexadecimal ObjectId.',
      });
    }
    validatedBookingId = bookingId;
  }

  // 6. Validate Evidence file references (optional array of strings)
  let validatedEvidence = [];
  if (evidence !== undefined) {
    if (!Array.isArray(evidence)) {
      return res.status(400).json({
        success: false,
        error: 'ValidationError',
        message: 'Evidence must be provided as an array of filename references',
      });
    }

    if (evidence.length > 10) {
      return res.status(400).json({
        success: false,
        error: 'ValidationError',
        message: 'A maximum of 10 evidence attachments can be submitted per complaint',
      });
    }

    for (const item of evidence) {
      if (typeof item !== 'string' || item.trim().length === 0 || item.length > 200) {
        return res.status(400).json({
          success: false,
          error: 'ValidationError',
          message: 'Each evidence attachment reference must be a valid string under 200 characters',
        });
      }
    }
    validatedEvidence = evidence.map((e) => e.trim());
  }

  // Attach sanitized submission payload
  req.sanitizedComplaint = {
    bookingId: validatedBookingId,
    category: category.trim(),
    priority: validatedPriority,
    subject: subject.trim(),
    description: description.trim(),
    evidence: validatedEvidence,
  };

  next();
};

/**
 * Validates complaint identifier param (:id).
 */
export const validateComplaintIdParam = (req, res, next) => {
  const { id } = req.params;

  const isObjectId = Boolean(id && mongoose.Types.ObjectId.isValid(id));
  const isComplaintNumber = Boolean(id && typeof id === 'string' && /^CP-\d{8}-\d{5}$/i.test(id.trim()));

  if (!isObjectId && !isComplaintNumber) {
    return res.status(400).json({
      success: false,
      error: 'ValidationError',
      message: 'Invalid complaint identifier format. Expected 24-character hexadecimal ObjectId or complaint reference format (CP-YYYYMMDD-XXXXX).',
    });
  }

  next();
};

/**
 * Validates query parameters for complaint listing.
 */
export const validateComplaintQuery = (req, res, next) => {
  const { page, limit, status, priority, category, search } = req.query;

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

  if (status !== undefined && status !== 'All' && status !== '') {
    const normalized = String(status).trim().toLowerCase().replace(/\s+/g, '_');
    if (!VALID_STATUSES.includes(normalized)) {
      return res.status(400).json({
        success: false,
        error: 'ValidationError',
        message: `Invalid status filter. Allowed values: ${VALID_STATUSES.join(', ')}`,
      });
    }
  }

  if (priority !== undefined && priority !== 'All' && priority !== '') {
    if (!VALID_PRIORITIES.includes(priority)) {
      return res.status(400).json({
        success: false,
        error: 'ValidationError',
        message: `Invalid priority filter. Allowed values: ${VALID_PRIORITIES.join(', ')}`,
      });
    }
  }

  if (category !== undefined && category !== 'All' && category !== '') {
    if (!VALID_CATEGORIES.includes(category)) {
      return res.status(400).json({
        success: false,
        error: 'ValidationError',
        message: `Invalid category filter. Allowed values: ${VALID_CATEGORIES.join(', ')}`,
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

  next();
};

/**
 * Validates administrative complaint status transition payload.
 */
export const validateUpdateComplaintStatus = (req, res, next) => {
  const { status, resolutionDetails, resolution, notes } = req.body;

  if (!status) {
    return res.status(400).json({
      success: false,
      error: 'ValidationError',
      message: 'Status is required for updating complaint progress',
    });
  }

  const normalizedStatus = String(status).trim().toLowerCase().replace(/\s+/g, '_');
  if (!VALID_STATUSES.includes(normalizedStatus)) {
    return res.status(400).json({
      success: false,
      error: 'ValidationError',
      message: `Invalid status '${status}'. Must be one of: ${VALID_STATUSES.join(', ')}`,
    });
  }

  const details = resolutionDetails || resolution;
  if (['resolved', 'dismissed'].includes(normalizedStatus)) {
    if (!details || typeof details !== 'string' || details.trim().length < 3) {
      return res.status(400).json({
        success: false,
        error: 'ValidationError',
        message: 'Resolution details of at least 3 characters are required when resolving or dismissing a complaint.',
      });
    }
    if (details.trim().length > 2000) {
      return res.status(400).json({
        success: false,
        error: 'ValidationError',
        message: 'Resolution details cannot exceed 2000 characters',
      });
    }
  }

  req.sanitizedComplaintUpdate = {
    status: normalizedStatus,
    resolutionDetails: details ? details.trim() : null,
    notes: notes && typeof notes === 'string' ? notes.trim() : null,
  };

  next();
};

/**
 * Validates administrative internal investigation note payload.
 */
export const validateAddComplaintNote = (req, res, next) => {
  const { note } = req.body;

  if (!note || typeof note !== 'string' || note.trim().length < 3) {
    return res.status(400).json({
      success: false,
      error: 'ValidationError',
      message: 'Internal investigation note must be at least 3 characters long',
    });
  }

  if (note.trim().length > 2000) {
    return res.status(400).json({
      success: false,
      error: 'ValidationError',
      message: 'Internal investigation note cannot exceed 2000 characters',
    });
  }

  req.sanitizedNote = note.trim();
  next();
};
