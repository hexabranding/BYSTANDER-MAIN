/**
 * Validation middleware for OTP verification payloads.
 */
export const validateVerifyOtp = (req, res, next) => {
  const { otp, selfieUrl, location, notes } = req.body || {};

  if (!otp || typeof otp !== 'string' || !/^\d{6}$/.test(otp.trim())) {
    const err = new Error('A valid 6-digit numeric OTP is required');
    err.statusCode = 400;
    err.name = 'ValidationError';
    return next(err);
  }

  // Sanitize and attach validated payload to req
  req.otpData = {
    otp: otp.trim(),
    selfieUrl: typeof selfieUrl === 'string' ? selfieUrl.trim().slice(0, 500) : null,
    location: typeof location === 'string' ? location.trim().slice(0, 300) : null,
    notes: typeof notes === 'string' ? notes.trim().slice(0, 500) : null,
  };

  next();
};
