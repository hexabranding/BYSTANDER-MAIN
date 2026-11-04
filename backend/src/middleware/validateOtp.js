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
  // Allow high-resolution base64 data URLs for live selfie verification (up to 5MB) or standard image URLs (up to 2048 chars)
  const cleanSelfieUrl = typeof selfieUrl === 'string'
    ? (selfieUrl.trim().startsWith('data:image/') ? selfieUrl.trim().slice(0, 5000000) : selfieUrl.trim().slice(0, 2048))
    : null;

  req.otpData = {
    otp: otp.trim(),
    selfieUrl: cleanSelfieUrl,
    location: typeof location === 'string' ? location.trim().slice(0, 300) : null,
    notes: typeof notes === 'string' ? notes.trim().slice(0, 500) : null,
  };

  next();
};
