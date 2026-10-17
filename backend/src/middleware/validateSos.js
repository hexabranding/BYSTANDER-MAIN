import mongoose from 'mongoose';

/**
 * Validates payload for raising an SOS emergency incident.
 */
export const validateRaiseSos = (req, res, next) => {
  const { bookingId, summary, priority, location } = req.body || {};

  // 1. Validate bookingId
  if (!bookingId || typeof bookingId !== 'string' || !mongoose.Types.ObjectId.isValid(bookingId.trim())) {
    const err = new Error('A valid booking identifier (ObjectId) is required');
    err.statusCode = 400;
    err.name = 'ValidationError';
    return next(err);
  }

  // 2. Validate summary
  if (!summary || typeof summary !== 'string' || summary.trim().length < 5 || summary.trim().length > 1000) {
    const err = new Error('Emergency summary must be a string between 5 and 1000 characters');
    err.statusCode = 400;
    err.name = 'ValidationError';
    return next(err);
  }

  // 3. Validate priority
  const allowedPriorities = ['Critical', 'High', 'Medium', 'Low'];
  const normalizedPriority = priority ? priority.trim() : 'Critical';
  if (!allowedPriorities.includes(normalizedPriority)) {
    const err = new Error(`Priority must be one of: ${allowedPriorities.join(', ')}`);
    err.statusCode = 400;
    err.name = 'ValidationError';
    return next(err);
  }

  // 4. Validate location (optional, client-provided only)
  let validatedLocation = {
    isAvailable: false,
    label: null,
    latitude: null,
    longitude: null,
    accuracy: null,
  };

  if (location && typeof location === 'object') {
    const lat = location.latitude !== undefined ? location.latitude : location.lat;
    const lng = location.longitude !== undefined ? location.longitude : location.lng;

    // Check if coordinates were supplied
    if (lat !== undefined || lng !== undefined) {
      const parsedLat = Number(lat);
      const parsedLng = Number(lng);

      if (!Number.isFinite(parsedLat) || parsedLat < -90 || parsedLat > 90) {
        const err = new Error('Latitude must be a valid number between -90 and 90 degrees');
        err.statusCode = 400;
        err.name = 'ValidationError';
        return next(err);
      }

      if (!Number.isFinite(parsedLng) || parsedLng < -180 || parsedLng > 180) {
        const err = new Error('Longitude must be a valid number between -180 and 180 degrees');
        err.statusCode = 400;
        err.name = 'ValidationError';
        return next(err);
      }

      const parsedAccuracy = location.accuracy !== undefined ? Number(location.accuracy) : null;
      if (parsedAccuracy !== null && (!Number.isFinite(parsedAccuracy) || parsedAccuracy < 0)) {
        const err = new Error('Accuracy must be a non-negative number');
        err.statusCode = 400;
        err.name = 'ValidationError';
        return next(err);
      }

      validatedLocation = {
        isAvailable: true,
        label: typeof location.label === 'string' ? location.label.trim().slice(0, 200) : null,
        latitude: parsedLat,
        longitude: parsedLng,
        accuracy: parsedAccuracy,
      };
    } else if (location.label && typeof location.label === 'string') {
      validatedLocation = {
        isAvailable: false,
        label: location.label.trim().slice(0, 200),
        latitude: null,
        longitude: null,
        accuracy: null,
      };
    }
  }

  req.sosData = {
    bookingId: bookingId.trim(),
    summary: summary.trim(),
    priority: normalizedPriority,
    location: validatedLocation,
  };

  next();
};

/**
 * Validates payload for admin assignment of an incident.
 */
export const validateAssignSos = (req, res, next) => {
  const { assignedTo, notes } = req.body || {};

  if (!assignedTo || typeof assignedTo !== 'string' || !mongoose.Types.ObjectId.isValid(assignedTo.trim())) {
    const err = new Error('A valid assignedTo user identifier (ObjectId) is required');
    err.statusCode = 400;
    err.name = 'ValidationError';
    return next(err);
  }

  req.assignData = {
    assignedTo: assignedTo.trim(),
    notes: typeof notes === 'string' ? notes.trim().slice(0, 500) : null,
  };

  next();
};

/**
 * Validates operational timeline note addition.
 */
export const validateAddTimelineNote = (req, res, next) => {
  const { action, notes } = req.body || {};

  if (!notes || typeof notes !== 'string' || notes.trim().length < 2 || notes.trim().length > 1000) {
    const err = new Error('Timeline note must be a string between 2 and 1000 characters');
    err.statusCode = 400;
    err.name = 'ValidationError';
    return next(err);
  }

  req.timelineData = {
    action: typeof action === 'string' && action.trim().length > 0 ? action.trim().slice(0, 200) : 'Operational Note Added',
    notes: notes.trim(),
  };

  next();
};

/**
 * Validates resolution or false-alarm payload.
 */
export const validateResolveSos = (req, res, next) => {
  const { status, resolutionNotes, rootCause } = req.body || {};

  const allowedStatuses = ['Resolved', 'False Alarm'];
  if (!status || !allowedStatuses.includes(status)) {
    const err = new Error(`Resolution status must be one of: ${allowedStatuses.join(', ')}`);
    err.statusCode = 400;
    err.name = 'ValidationError';
    return next(err);
  }

  if (
    !resolutionNotes ||
    typeof resolutionNotes !== 'string' ||
    resolutionNotes.trim().length < 5 ||
    resolutionNotes.trim().length > 1000
  ) {
    const err = new Error('Resolution notes must be a string between 5 and 1000 characters');
    err.statusCode = 400;
    err.name = 'ValidationError';
    return next(err);
  }

  req.resolveData = {
    status,
    resolutionNotes: resolutionNotes.trim(),
    rootCause: typeof rootCause === 'string' ? rootCause.trim().slice(0, 200) : null,
  };

  next();
};
