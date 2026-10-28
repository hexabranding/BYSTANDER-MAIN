/**
 * Input validation and sanitization middleware for Caregiver Profile and Availability.
 */
import mongoose from 'mongoose';

const TIME_REGEX = /^([01]\d|2[0-3]):([0-5]\d)$/;
const DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;
const REQUIRED_WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

const ALLOWED_AVAILABILITY_STATUSES = ['Available Now', 'Busy', 'On Leave', 'Unavailable'];
const ALLOWED_CARE_SETTINGS = ['Home Care', 'Hospital Care'];

// Explicit allowlist of fields caregivers are permitted to update on their profile
export const PERMITTED_CAREGIVER_UPDATE_FIELDS = [
  'bio',
  'experienceYears',
  'languages',
  'gender',
  'street',
  'area',
  'city',
  'district',
  'state',
  'pincode',
  'address',
  'maxDistanceKm',
  'hourlyRate',
  'servicesOffered',
  'services',
  'careSettings',
  'availabilityStatus',
  'avatar',
];

/**
 * Validate that a date string is a real calendar date (handles month bounds & leap years).
 * @param {string} dateStr
 * @returns {boolean}
 */
export const isValidCalendarDate = (dateStr) => {
  const match = String(dateStr).match(/^(\d{4})-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/);
  if (!match) return false;
  const [, y, m, d] = match.map(Number);
  const date = new Date(Date.UTC(y, m - 1, d));
  return date.getUTCFullYear() === y && date.getUTCMonth() === m - 1 && date.getUTCDate() === d;
};

/**
 * Return today's date formatted as YYYY-MM-DD in the specified IANA timezone.
 * @param {string} tz - IANA timezone identifier
 * @returns {string} YYYY-MM-DD
 */
export const getTodayInTimezone = (tz = 'Asia/Kolkata') => {
  try {
    const formatter = new Intl.DateTimeFormat('en-CA', {
      timeZone: tz,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    });
    return formatter.format(new Date());
  } catch (e) {
    return new Date().toISOString().slice(0, 10);
  }
};

/**
 * Validate Caregiver Profile updates.
 * Discards all unauthorized/protected fields and validates allowed fields.
 */
export const validateUpdateCaregiverProfile = (req, res, next) => {
  const errors = [];
  const payload = req.body;

  if (!payload || typeof payload !== 'object') {
    return res.status(400).json({
      success: false,
      error: 'ValidationError',
      message: 'Request body must be a valid JSON object',
    });
  }

  // Filter to only permitted fields
  const sanitizedUpdates = {};
  for (const field of PERMITTED_CAREGIVER_UPDATE_FIELDS) {
    if (payload[field] !== undefined) {
      sanitizedUpdates[field] = payload[field];
    }
  }

  // 1. Validation checks on permitted fields
  if (sanitizedUpdates.experienceYears !== undefined) {
    const exp = Number(sanitizedUpdates.experienceYears);
    if (isNaN(exp) || exp < 0 || exp > 50) {
      errors.push('Experience years must be a number between 0 and 50');
    } else {
      sanitizedUpdates.experienceYears = exp;
    }
  }

  if (sanitizedUpdates.hourlyRate !== undefined) {
    const rate = Number(sanitizedUpdates.hourlyRate);
    if (isNaN(rate) || rate < 0 || rate > 50000) {
      errors.push('Hourly rate must be a non-negative number and cannot exceed ₹50,000');
    } else {
      sanitizedUpdates.hourlyRate = rate;
    }
  }

  if (sanitizedUpdates.maxDistanceKm !== undefined) {
    const dist = Number(sanitizedUpdates.maxDistanceKm);
    if (isNaN(dist) || dist < 1 || dist > 100) {
      errors.push('Maximum distance must be between 1 and 100 kilometers');
    } else {
      sanitizedUpdates.maxDistanceKm = dist;
    }
  }

  if (sanitizedUpdates.bio !== undefined) {
    if (typeof sanitizedUpdates.bio !== 'string') {
      errors.push('Bio must be a string');
    } else if (sanitizedUpdates.bio.length > 2000) {
      errors.push('Bio cannot exceed 2000 characters');
    } else {
      sanitizedUpdates.bio = sanitizedUpdates.bio.trim();
    }
  }

  if (sanitizedUpdates.availabilityStatus !== undefined) {
    if (!ALLOWED_AVAILABILITY_STATUSES.includes(sanitizedUpdates.availabilityStatus)) {
      errors.push(
        `Availability status must be one of: ${ALLOWED_AVAILABILITY_STATUSES.join(', ')}`,
      );
    }
  }

  if (sanitizedUpdates.gender !== undefined) {
    if (!['Male', 'Female', 'Other'].includes(sanitizedUpdates.gender)) {
      errors.push('Gender must be one of: Male, Female, Other');
    }
  }

  if (sanitizedUpdates.pincode !== undefined) {
    sanitizedUpdates.pincode = String(sanitizedUpdates.pincode).trim();
    if (sanitizedUpdates.pincode && !/^[1-9][0-9]{5}$/.test(sanitizedUpdates.pincode)) {
      errors.push('Please enter a valid 6-digit Indian PIN code');
    }
  }

  if (sanitizedUpdates.street !== undefined) {
    sanitizedUpdates.street = String(sanitizedUpdates.street).trim();
  }
  if (sanitizedUpdates.area !== undefined) {
    sanitizedUpdates.area = String(sanitizedUpdates.area).trim();
  }
  if (sanitizedUpdates.city !== undefined) {
    sanitizedUpdates.city = String(sanitizedUpdates.city).trim();
  }
  if (sanitizedUpdates.district !== undefined) {
    sanitizedUpdates.district = String(sanitizedUpdates.district).trim();
  }
  if (sanitizedUpdates.state !== undefined) {
    sanitizedUpdates.state = String(sanitizedUpdates.state).trim();
  }

  if (sanitizedUpdates.careSettings !== undefined) {
    if (!Array.isArray(sanitizedUpdates.careSettings)) {
      errors.push('Care settings must be an array');
    } else {
      const mapping = { Home: 'Home Care', Hospital: 'Hospital Care' };
      sanitizedUpdates.careSettings = Array.from(
        new Set(sanitizedUpdates.careSettings.map((s) => mapping[s] || s)),
      );
      const invalid = sanitizedUpdates.careSettings.some((s) => !ALLOWED_CARE_SETTINGS.includes(s));
      if (invalid) {
        errors.push(`Care settings can only contain: ${ALLOWED_CARE_SETTINGS.join(', ')}`);
      }
    }
  }

  if (sanitizedUpdates.languages !== undefined) {
    if (!Array.isArray(sanitizedUpdates.languages)) {
      errors.push('Languages must be an array of strings');
    } else {
      sanitizedUpdates.languages = sanitizedUpdates.languages
        .map((l) => String(l).trim())
        .filter(Boolean);
    }
  }

  // Canonical servicesOffered field (array of Service ObjectIds)
  if (sanitizedUpdates.servicesOffered !== undefined) {
    if (!Array.isArray(sanitizedUpdates.servicesOffered)) {
      errors.push('servicesOffered must be an array of service ObjectIds');
    } else {
      for (const id of sanitizedUpdates.servicesOffered) {
        if (!id || typeof id !== 'string' || !mongoose.Types.ObjectId.isValid(id)) {
          errors.push(`Invalid service identifier: '${id}' must be a valid 24-character hexadecimal ObjectId`);
        }
      }
    }
  }

  // Backward compatibility: alias legacy services to servicesOffered if servicesOffered is omitted
  if (sanitizedUpdates.services !== undefined && sanitizedUpdates.servicesOffered === undefined) {
    if (Array.isArray(sanitizedUpdates.services)) {
      const allObjectIds = sanitizedUpdates.services.every(
        (id) => typeof id === 'string' && mongoose.Types.ObjectId.isValid(id),
      );
      if (allObjectIds) {
        sanitizedUpdates.servicesOffered = sanitizedUpdates.services;
      }
    }
  }

  if (errors.length > 0) {
    return res.status(400).json({
      success: false,
      error: 'ValidationError',
      message: errors.join(', '),
      errors,
    });
  }

  // Overwrite request body with cleanly sanitized permitted updates only
  req.sanitizedUpdates = sanitizedUpdates;
  next();
};

/**
 * Validate and check intervals for non-overlapping time order.
 * @param {Array} slots - Array of { start: 'HH:mm', end: 'HH:mm' }
 * @param {string} contextName - Label for error messages (e.g. 'Monday' or '2026-11-05')
 * @returns {Array} List of validation error strings
 */
const validateTimeSlots = (slots, contextName) => {
  const errors = [];
  if (!Array.isArray(slots)) {
    return [`Slots for ${contextName} must be an array`];
  }

  if (slots.length > 6) {
    return [`Too many slots for ${contextName} (maximum 6 slots per day allowed)`];
  }

  const parsedIntervals = [];

  for (let i = 0; i < slots.length; i++) {
    const slot = slots[i];
    if (!slot || typeof slot !== 'object') {
      errors.push(`Slot ${i + 1} on ${contextName} must be a valid object`);
      continue;
    }

    const { start, end } = slot;
    if (!start || !TIME_REGEX.test(start)) {
      errors.push(`Start time '${start}' on ${contextName} must be in 24-hour HH:mm format`);
    }
    if (!end || !TIME_REGEX.test(end)) {
      errors.push(`End time '${end}' on ${contextName} must be in 24-hour HH:mm format`);
    }

    if (start && end && TIME_REGEX.test(start) && TIME_REGEX.test(end)) {
      if (start >= end) {
        errors.push(
          `Start time '${start}' must be strictly before end time '${end}' on ${contextName}`,
        );
      } else {
        parsedIntervals.push({ start, end, originalIndex: i });
      }
    }
  }

  // Check for duplicate or overlapping intervals
  parsedIntervals.sort((a, b) => a.start.localeCompare(b.start));
  for (let i = 0; i < parsedIntervals.length - 1; i++) {
    const current = parsedIntervals[i];
    const next = parsedIntervals[i + 1];

    if (current.end > next.start) {
      errors.push(
        `Overlapping intervals detected on ${contextName}: [${current.start} – ${current.end}] conflicts with [${next.start} – ${next.end}]`,
      );
    }
  }

  return errors;
};

/**
 * Validate weekly schedule and date-specific availability exceptions.
 */
export const validateCaregiverAvailability = (req, res, next) => {
  const { timezone, weeklySchedule, dateExceptions } = req.body;
  const errors = [];

  // 1. Validate timezone
  let effectiveTimezone = 'Asia/Kolkata';
  if (timezone !== undefined) {
    if (!timezone || typeof timezone !== 'string') {
      errors.push('Timezone must be a valid string identifier');
    } else {
      try {
        Intl.DateTimeFormat(undefined, { timeZone: timezone.trim() });
        effectiveTimezone = timezone.trim();
      } catch (tzErr) {
        errors.push(`Invalid IANA timezone identifier: '${timezone}'`);
      }
    }
  }

  // 2. Validate weeklySchedule (Complete 7-day schedule replacement)
  if (weeklySchedule !== undefined) {
    if (!Array.isArray(weeklySchedule)) {
      errors.push('Weekly schedule must be an array of 7 weekday availability objects');
    } else {
      const presentDays = new Set();
      for (const item of weeklySchedule) {
        if (!item || !REQUIRED_WEEKDAYS.includes(item.day)) {
          errors.push(
            `Weekday '${item?.day}' is invalid. Must be one of: ${REQUIRED_WEEKDAYS.join(', ')}`,
          );
          continue;
        }

        if (presentDays.has(item.day)) {
          errors.push(`Duplicate weekday entry for '${item.day}'`);
        }
        presentDays.add(item.day);

        if (typeof item.isAvailable !== 'boolean') {
          errors.push(`'isAvailable' for ${item.day} must be a boolean`);
        }

        if (item.isAvailable) {
          if (!item.slots || !Array.isArray(item.slots) || item.slots.length === 0) {
            errors.push(
              `Weekday '${item.day}' marked as available must include at least one valid time slot`,
            );
          } else {
            const slotErrors = validateTimeSlots(item.slots, item.day);
            errors.push(...slotErrors);
          }
        } else {
          if (item.slots && Array.isArray(item.slots) && item.slots.length > 0) {
            errors.push(`Weekday '${item.day}' marked as unavailable must not have active time slots`);
          }
        }
      }

      // Check for missing weekdays to prevent accidental partial schedule overwriting
      const missingDays = REQUIRED_WEEKDAYS.filter((d) => !presentDays.has(d));
      if (missingDays.length > 0) {
        errors.push(
          `Weekly schedule is incomplete. Missing weekdays: ${missingDays.join(', ')}. All 7 weekdays (Mon-Sun) are required.`,
        );
      }
    }
  }

  // 3. Validate dateExceptions (if provided)
  if (dateExceptions !== undefined) {
    if (!Array.isArray(dateExceptions)) {
      errors.push('Date exceptions must be an array');
    } else if (dateExceptions.length > 60) {
      errors.push('Maximum 60 date exceptions can be configured at a time');
    } else {
      const todayInTz = getTodayInTimezone(effectiveTimezone);
      const datesSeen = new Set();

      for (const item of dateExceptions) {
        if (!item || !item.date || !isValidCalendarDate(item.date)) {
          errors.push(
            `Date '${item?.date}' is invalid. Must be a real calendar date in YYYY-MM-DD format`,
          );
          continue;
        }

        if (item.date < todayInTz) {
          errors.push(
            `Date exception '${item.date}' cannot be in the past. Must be on or after ${todayInTz} in timezone '${effectiveTimezone}'`,
          );
        }

        if (datesSeen.has(item.date)) {
          errors.push(`Duplicate date exception for '${item.date}'`);
        }
        datesSeen.add(item.date);

        if (typeof item.isAvailable !== 'boolean') {
          errors.push(`'isAvailable' for date ${item.date} must be a boolean`);
        }

        if (item.reason && item.reason.length > 200) {
          errors.push(`Reason for date ${item.date} cannot exceed 200 characters`);
        }

        if (item.isAvailable) {
          if (!item.slots || !Array.isArray(item.slots) || item.slots.length === 0) {
            errors.push(
              `Date exception '${item.date}' marked as available must include at least one valid time slot`,
            );
          } else {
            const slotErrors = validateTimeSlots(item.slots, item.date);
            errors.push(...slotErrors);
          }
        } else {
          if (item.slots && Array.isArray(item.slots) && item.slots.length > 0) {
            errors.push(`Date exception '${item.date}' marked as unavailable must not have active time slots`);
          }
        }
      }
    }
  }

  if (errors.length > 0) {
    return res.status(400).json({
      success: false,
      error: 'ValidationError',
      message: errors.join(', '),
      errors,
    });
  }

  next();
};

/**
 * Validate query parameters for public caregiver directory search.
 */
export const validateGetCaregivers = (req, res, next) => {
  const { page, limit, city, service, qualification, minRating, maxRate } = req.query;
  const errors = [];

  if (page !== undefined) {
    const p = parseInt(page, 10);
    if (isNaN(p) || p < 1) {
      errors.push('page must be a positive integer greater than or equal to 1');
    }
  }

  if (limit !== undefined) {
    const l = parseInt(limit, 10);
    if (isNaN(l) || l < 1) {
      errors.push('limit must be a positive integer');
    }
  }

  if (qualification !== undefined && qualification.trim()) {
    const qual = qualification.trim();
    if (qual.length > 50) {
      errors.push('qualification cannot exceed 50 characters');
    }
  }

  if (city !== undefined && city.trim()) {
    if (city.trim().length > 100) {
      errors.push('city filter cannot exceed 100 characters');
    }
  }

  if (service !== undefined && service.trim()) {
    if (service.trim().length > 100) {
      errors.push('service filter cannot exceed 100 characters');
    }
  }

  if (minRating !== undefined) {
    const r = Number(minRating);
    if (isNaN(r) || r < 0 || r > 5) {
      errors.push('minRating must be a number between 0 and 5');
    }
  }

  if (maxRate !== undefined) {
    const rate = Number(maxRate);
    if (isNaN(rate) || rate < 0) {
      errors.push('maxRate must be a positive number');
    }
  }

  if (errors.length > 0) {
    return res.status(400).json({
      success: false,
      error: 'ValidationError',
      message: errors.join(', '),
      errors,
    });
  }

  next();
};

/**
 * Validate Caregiver document upload payload.
 * Enforces valid documentType, bounded fileName and fileSize, and safe mimeTypes.
 */
export const validateCaregiverDocumentUpload = (req, res, next) => {
  const { documentType, fileName, fileSize, mimeType, fileData, fileKey } = req.body || {};

  const ALLOWED_DOC_TYPES = [
    'identity',
    'address_proof',
    'nursing_registration',
    'college_id',
    'police_clearance',
    'bank_verification',
    'other',
  ];

  if (!documentType || typeof documentType !== 'string' || !ALLOWED_DOC_TYPES.includes(documentType.trim())) {
    return res.status(400).json({
      success: false,
      error: 'ValidationError',
      message: `documentType is required and must be one of: ${ALLOWED_DOC_TYPES.join(', ')}`,
    });
  }

  const cleanFileName = String(fileName || `${documentType}.pdf`).trim();
  if (cleanFileName.length > 255) {
    return res.status(400).json({
      success: false,
      error: 'ValidationError',
      message: 'fileName cannot exceed 255 characters',
    });
  }

  if (fileSize !== undefined) {
    const size = Number(fileSize);
    if (isNaN(size) || size < 0 || size > 10 * 1024 * 1024) {
      return res.status(400).json({
        success: false,
        error: 'ValidationError',
        message: 'fileSize must be a positive number under 10MB',
      });
    }
  }

  const cleanMime = String(mimeType || 'application/pdf').trim().toLowerCase();
  const ALLOWED_MIMES = [
    'application/pdf',
    'image/jpeg',
    'image/jpg',
    'image/png',
    'image/webp',
  ];
  if (!ALLOWED_MIMES.includes(cleanMime)) {
    return res.status(400).json({
      success: false,
      error: 'ValidationError',
      message: 'mimeType must be one of: application/pdf, image/jpeg, image/png, image/webp',
    });
  }

  req.sanitizedDocument = {
    documentType: documentType.trim(),
    fileName: cleanFileName,
    fileSize: Number(fileSize) || 1024,
    mimeType: cleanMime,
    fileKey: fileKey || (typeof fileData === 'string' && fileData.startsWith('data:') ? fileData : `docs/${req.user._id}/${documentType.trim()}_${Date.now()}`),
  };

  next();
};

