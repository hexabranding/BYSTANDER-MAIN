import mongoose from 'mongoose';
import { isValidCalendarDate } from './validateCaregiver.js';
import { parseLocalDateTimeToUTC } from '../utils/bookingDateUtils.js';

const TIME_REGEX = /^([01]\d|2[0-3]):([0-5]\d)$/;
const ALLOWED_CARE_SETTINGS = ['Home Care', 'Hospital Care'];
const ALLOWED_GENDERS = ['Male', 'Female', 'Other'];

/**
 * Validate customer booking request creation payload.
 * Normalizes input to explicit UTC Date objects and enforces strict input bounds.
 */
export const validateCreateBooking = (req, res, next) => {
  const {
    caregiverId,
    serviceId,
    startDateTime,
    endDateTime,
    startDate,
    startTime,
    endDate,
    endTime,
    timezone,
    location,
    patientDetails,
  } = req.body || {};

  const errors = [];

  // 1. Validate Caregiver Reference (Optional for broadcast bookings, validated if provided)
  if (caregiverId !== undefined && caregiverId !== null && caregiverId !== '') {
    if (!mongoose.Types.ObjectId.isValid(String(caregiverId))) {
      errors.push('caregiverId must be a valid 24-character hexadecimal ObjectId');
    }
  }

  // 2. Validate Service Reference
  if (!serviceId || !mongoose.Types.ObjectId.isValid(String(serviceId))) {
    errors.push('serviceId is required and must be a valid 24-character hexadecimal ObjectId');
  }

  // 3. Timezone Validation
  let effectiveTimezone = 'Asia/Kolkata';
  if (timezone !== undefined) {
    if (!timezone || typeof timezone !== 'string') {
      errors.push('timezone must be a valid string identifier');
    } else {
      try {
        Intl.DateTimeFormat(undefined, { timeZone: timezone.trim() });
        effectiveTimezone = timezone.trim();
      } catch (tzErr) {
        errors.push(`Invalid IANA timezone identifier: '${timezone}'`);
      }
    }
  }

  // 4. Scheduling Timestamps (supports direct ISO strings or local date/time parts)
  let parsedStart = null;
  let parsedEnd = null;

  if (startDateTime && endDateTime) {
    parsedStart = new Date(startDateTime);
    parsedEnd = new Date(endDateTime);

    if (isNaN(parsedStart.getTime())) {
      errors.push('startDateTime must be a valid ISO 8601 date string');
    }
    if (isNaN(parsedEnd.getTime())) {
      errors.push('endDateTime must be a valid ISO 8601 date string');
    }
  } else if (startDate && startTime && (endDate || startDate) && (endTime || startTime)) {
    const sDate = startDate;
    const sTime = startTime;
    const eDate = endDate || startDate;
    const eTime = endTime;

    if (!isValidCalendarDate(sDate)) {
      errors.push(`startDate '${sDate}' is invalid. Must be a real calendar date in YYYY-MM-DD format`);
    }
    if (!TIME_REGEX.test(sTime)) {
      errors.push(`startTime '${sTime}' is invalid. Must be in 24-hour HH:mm format`);
    }
    if (!isValidCalendarDate(eDate)) {
      errors.push(`endDate '${eDate}' is invalid. Must be a real calendar date in YYYY-MM-DD format`);
    }
    if (!TIME_REGEX.test(eTime)) {
      errors.push(`endTime '${eTime}' is invalid. Must be in 24-hour HH:mm format`);
    }

    if (isValidCalendarDate(sDate) && TIME_REGEX.test(sTime) && isValidCalendarDate(eDate) && TIME_REGEX.test(eTime)) {
      try {
        parsedStart = parseLocalDateTimeToUTC(sDate, sTime, effectiveTimezone);
        parsedEnd = parseLocalDateTimeToUTC(eDate, eTime, effectiveTimezone);
      } catch (convErr) {
        errors.push(`Failed to convert local scheduling input to UTC: ${convErr.message}`);
      }
    }
  } else {
    errors.push(
      'Scheduling requires either (startDateTime, endDateTime) or (startDate, startTime, endDate, endTime)',
    );
  }

  // Temporal ordering and future-start validation
  if (parsedStart && parsedEnd && !isNaN(parsedStart.getTime()) && !isNaN(parsedEnd.getTime())) {
    if (parsedStart.getTime() <= Date.now()) {
      errors.push('Scheduled start time must be in the future');
    }
    if (parsedEnd.getTime() <= parsedStart.getTime()) {
      errors.push('Scheduled end time must be strictly after the start time');
    }

    const durationHours = (parsedEnd.getTime() - parsedStart.getTime()) / (1000 * 60 * 60);
    if (durationHours > 24) {
      errors.push('A single booking engagement duration cannot exceed 24 hours');
    }
  }

  // 5. Location Validation
  if (!location || typeof location !== 'object') {
    errors.push('location object is required');
  } else {
    if (!location.addressLine || typeof location.addressLine !== 'string' || location.addressLine.trim().length < 3) {
      errors.push('location.addressLine is required (minimum 3 characters)');
    }
    if (!location.city || typeof location.city !== 'string' || location.city.trim().length < 2) {
      errors.push('location.city is required');
    }
    if (location.careSetting) {
      if (location.careSetting === 'Home') location.careSetting = 'Home Care';
      if (location.careSetting === 'Hospital') location.careSetting = 'Hospital Care';
      if (!ALLOWED_CARE_SETTINGS.includes(location.careSetting)) {
        errors.push(`location.careSetting must be one of: ${ALLOWED_CARE_SETTINGS.join(', ')}`);
      }
    }
  }

  // 6. Patient Details Validation (minimal necessary info)
  if (!patientDetails || typeof patientDetails !== 'object') {
    errors.push('patientDetails object is required');
  } else {
    if (!patientDetails.name || typeof patientDetails.name !== 'string' || patientDetails.name.trim().length < 2) {
      errors.push('patientDetails.name is required (minimum 2 characters)');
    }
    if (patientDetails.age === undefined || isNaN(patientDetails.age) || Number(patientDetails.age) < 0 || Number(patientDetails.age) > 130) {
      errors.push('patientDetails.age must be a valid number between 0 and 130');
    }
    if (patientDetails.gender && !ALLOWED_GENDERS.includes(patientDetails.gender)) {
      errors.push(`patientDetails.gender must be one of: ${ALLOWED_GENDERS.join(', ')}`);
    }
    if (patientDetails.specialInstructions && patientDetails.specialInstructions.length > 1000) {
      errors.push('patientDetails.specialInstructions cannot exceed 1000 characters');
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

  // Attach sanitized, typed booking request payload to request context
  req.bookingData = {
    caregiverId: String(caregiverId),
    serviceId: String(serviceId),
    startDateTime: parsedStart,
    endDateTime: parsedEnd,
    timezone: effectiveTimezone,
    location: {
      addressLine: location.addressLine.trim(),
      city: location.city.trim(),
      area: location.area ? String(location.area).trim() : '',
      pincode: location.pincode ? String(location.pincode).trim() : '',
      careSetting: location.careSetting || 'Home Care',
    },
    patientDetails: {
      name: patientDetails.name.trim(),
      age: Number(patientDetails.age),
      gender: patientDetails.gender || 'Other',
      specialInstructions: patientDetails.specialInstructions ? String(patientDetails.specialInstructions).trim() : '',
    },
  };

  next();
};

/**
 * Validate booking cancellation payload.
 */
export const validateCancelBooking = (req, res, next) => {
  const { reason } = req.body || {};

  if (reason !== undefined) {
    if (typeof reason !== 'string') {
      return res.status(400).json({
        success: false,
        error: 'ValidationError',
        message: 'cancellation reason must be a string',
      });
    }
    if (reason.length > 500) {
      return res.status(400).json({
        success: false,
        error: 'ValidationError',
        message: 'cancellation reason cannot exceed 500 characters',
      });
    }
  }

  req.cancellationReason = reason ? reason.trim() : 'Cancelled by participant';
  next();
};

/**
 * Validate booking rejection payload.
 */
export const validateRejectBooking = (req, res, next) => {
  const { reason } = req.body || {};

  if (reason !== undefined) {
    if (typeof reason !== 'string') {
      return res.status(400).json({
        success: false,
        error: 'ValidationError',
        message: 'Rejection reason must be a string',
      });
    }
    if (reason.length > 500) {
      return res.status(400).json({
        success: false,
        error: 'ValidationError',
        message: 'Rejection reason cannot exceed 500 characters',
      });
    }
  }

  req.rejectionReason = reason ? reason.trim() : 'Declined by caregiver';
  next();
};
