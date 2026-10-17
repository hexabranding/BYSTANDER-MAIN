/**
 * Input validation and sanitization middleware for authentication routes.
 */

const EMAIL_REGEX = /^\S+@\S+\.\S+$/;
const PHONE_REGEX = /^\+?[1-9]\d{6,14}$/;

const APPROVED_QUALIFICATIONS = [
  'GNM',
  'BSc Nursing',
  'nursing_student',
  'ANM',
  'MBBS',
  'Physiotherapy Assistant',
  'Certified Elder Care Giver',
  'Paramedic',
  'other',
];

/**
 * Validate customer registration payload.
 */
export const validateCustomerRegistration = (req, res, next) => {
  const { fullName, email, phone, password } = req.body;
  const errors = [];

  if (!fullName || typeof fullName !== 'string' || fullName.trim().length < 2) {
    errors.push('Full name is required and must be at least 2 characters');
  }

  if (!email && !phone) {
    errors.push('At least one of email or phone number is required');
  }

  if (email && (typeof email !== 'string' || !EMAIL_REGEX.test(email.trim()))) {
    errors.push('Please provide a valid email address');
  }

  if (phone && (typeof phone !== 'string' || !PHONE_REGEX.test(phone.trim().replace(/[\s-]/g, '')))) {
    errors.push('Please provide a valid phone number (e.g. +919876543210)');
  }

  if (!password || typeof password !== 'string' || password.length < 8) {
    errors.push('Password must be at least 8 characters long');
  }

  if (errors.length > 0) {
    return res.status(400).json({
      success: false,
      error: 'ValidationError',
      message: errors.join(', '),
      errors,
    });
  }

  // Normalize inputs
  req.body.fullName = fullName.trim();
  if (email) req.body.email = email.trim().toLowerCase();
  if (phone) req.body.phone = phone.trim().replace(/[\s-]/g, '');

  next();
};

/**
 * Validate caregiver registration payload.
 */
export const validateCaregiverRegistration = (req, res, next) => {
  const { fullName, email, phone, password, qualification, hourlyRate } = req.body;
  const errors = [];

  if (!fullName || typeof fullName !== 'string' || fullName.trim().length < 2) {
    errors.push('Full name is required and must be at least 2 characters');
  }

  if (!email && !phone) {
    errors.push('At least one of email or phone number is required');
  }

  if (email && (typeof email !== 'string' || !EMAIL_REGEX.test(email.trim()))) {
    errors.push('Please provide a valid email address');
  }

  if (phone && (typeof phone !== 'string' || !PHONE_REGEX.test(phone.trim().replace(/[\s-]/g, '')))) {
    errors.push('Please provide a valid phone number (e.g. +919876543210)');
  }

  if (!password || typeof password !== 'string' || password.length < 8) {
    errors.push('Password must be at least 8 characters long');
  }

  if (!qualification || !APPROVED_QUALIFICATIONS.includes(qualification)) {
    errors.push(
      `Qualification is required and must be one of: ${APPROVED_QUALIFICATIONS.join(', ')}`,
    );
  }

  if (hourlyRate !== undefined && (isNaN(hourlyRate) || Number(hourlyRate) < 0)) {
    errors.push('Hourly rate must be a valid positive number');
  }

  if (errors.length > 0) {
    return res.status(400).json({
      success: false,
      error: 'ValidationError',
      message: errors.join(', '),
      errors,
    });
  }

  // Normalize inputs
  req.body.fullName = fullName.trim();
  if (email) req.body.email = email.trim().toLowerCase();
  if (phone) req.body.phone = phone.trim().replace(/[\s-]/g, '');
  if (hourlyRate !== undefined) req.body.hourlyRate = Number(hourlyRate);

  next();
};

/**
 * Validate login credentials.
 */
export const validateLogin = (req, res, next) => {
  const { email, phone, identifier, password } = req.body;
  const id = identifier || email || phone;

  if (!id || typeof id !== 'string' || !id.trim()) {
    return res.status(400).json({
      success: false,
      error: 'ValidationError',
      message: 'Email or phone number is required',
    });
  }

  if (!password || typeof password !== 'string') {
    return res.status(400).json({
      success: false,
      error: 'ValidationError',
      message: 'Password is required',
    });
  }

  req.body.identifier = id.trim();
  next();
};
