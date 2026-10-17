/**
 * JSON 404 handler for unmatched routes
 */
export const notFoundHandler = (req, res, next) => {
  res.status(404).json({
    success: false,
    error: 'Not Found',
    message: `Cannot ${req.method} ${req.originalUrl}`,
  });
};

/**
 * Centralized error-handling middleware.
 * Ensures consistent JSON responses and transforms database errors cleanly.
 */
export const errorHandler = (err, req, res, next) => {
  let statusCode = err.status || err.statusCode || 500;
  let errorName = err.name || 'InternalServerError';
  let errorMessage = err.message || 'An unexpected server error occurred';

  // Handle Mongoose duplicate key error (E11000)
  if (err.code === 11000) {
    statusCode = 409;
    errorName = 'ConflictError';
    const field = Object.keys(err.keyValue || {})[0] || 'field';
    const val = err.keyValue ? err.keyValue[field] : '';
    errorMessage = `A record with ${field} '${val}' already exists`;
  }

  // Handle Mongoose invalid ObjectId error
  if (err.name === 'CastError') {
    statusCode = 400;
    errorName = 'ValidationError';
    errorMessage = `Invalid identifier: ${err.value}`;
  }

  // Handle Mongoose schema validation error
  if (err.name === 'ValidationError' && err.errors) {
    statusCode = 400;
    const details = Object.values(err.errors).map((e) => e.message);
    errorMessage = details.join(', ');
  }

  const isProduction = process.env.NODE_ENV === 'production';
  console.error(`[Server Error] [${errorName}] ${errorMessage}`);

  res.status(statusCode).json({
    success: false,
    error: errorName,
    message: errorMessage,
    ...(isProduction ? {} : { stack: err.stack }),
  });
};
