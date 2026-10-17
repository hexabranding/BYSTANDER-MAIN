/**
 * Input validation middleware for Service Catalog endpoints.
 */

/**
 * Validate service creation payload.
 */
export const validateCreateService = (req, res, next) => {
  const { name, description, category, baseHourlyRate, minimumDurationHours, features } = req.body;
  const errors = [];

  if (!name || typeof name !== 'string' || name.trim().length < 2) {
    errors.push('Service name is required and must be at least 2 characters');
  }

  if (!description || typeof description !== 'string' || description.trim().length < 10) {
    errors.push('Service description is required and must be at least 10 characters long');
  }

  if (!category || typeof category !== 'string' || !category.trim()) {
    errors.push('Service category is required');
  }

  if (baseHourlyRate === undefined || isNaN(baseHourlyRate) || Number(baseHourlyRate) < 0) {
    errors.push('Base hourly rate is required and must be a non-negative number');
  }

  if (
    minimumDurationHours !== undefined &&
    (isNaN(minimumDurationHours) || Number(minimumDurationHours) < 1)
  ) {
    errors.push('Minimum duration hours must be at least 1');
  }

  if (features !== undefined && !Array.isArray(features)) {
    errors.push('Features must be an array of strings');
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
 * Validate service update payload.
 */
export const validateUpdateService = (req, res, next) => {
  const { name, description, category, baseHourlyRate, minimumDurationHours, features } = req.body;
  const errors = [];

  if (name !== undefined && (typeof name !== 'string' || name.trim().length < 2)) {
    errors.push('Service name must be at least 2 characters');
  }

  if (description !== undefined && (typeof description !== 'string' || description.trim().length < 10)) {
    errors.push('Service description must be at least 10 characters long');
  }

  if (category !== undefined && (typeof category !== 'string' || !category.trim())) {
    errors.push('Service category cannot be empty');
  }

  if (baseHourlyRate !== undefined && (isNaN(baseHourlyRate) || Number(baseHourlyRate) < 0)) {
    errors.push('Base hourly rate must be a non-negative number');
  }

  if (
    minimumDurationHours !== undefined &&
    (isNaN(minimumDurationHours) || Number(minimumDurationHours) < 1)
  ) {
    errors.push('Minimum duration hours must be at least 1');
  }

  if (features !== undefined && !Array.isArray(features)) {
    errors.push('Features must be an array of strings');
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
 * Validate service status toggle payload.
 */
export const validateUpdateServiceStatus = (req, res, next) => {
  const { isActive } = req.body;

  if (typeof isActive !== 'boolean') {
    return res.status(400).json({
      success: false,
      error: 'ValidationError',
      message: "Field 'isActive' is required and must be a boolean",
    });
  }

  next();
};
