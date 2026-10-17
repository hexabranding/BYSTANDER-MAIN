import crypto from 'crypto';

export const MIN_OTP_SECRET_LENGTH = 32;
export const DEV_TEST_FALLBACK_SECRET = 'bystander_otp_hmac_secret_fallback_key';

/**
 * Validates and retrieves the HMAC secret for OTP hashing.
 * In production (NODE_ENV=production):
 *   - Strictly forbids fallback defaults.
 *   - Requires OTP_HMAC_SECRET (or JWT_ACCESS_SECRET) with minimum length of 32 characters.
 *   - Throws fatal error on startup or execution if invalid or missing.
 * In development and test environments:
 *   - Prefers OTP_HMAC_SECRET or JWT_ACCESS_SECRET if configured (>= 32 chars).
 *   - Falls back to DEV_TEST_FALLBACK_SECRET only when NODE_ENV !== 'production' to preserve test behavior.
 *
 * @returns {string} Validated HMAC secret string
 */
export const getOtpSecret = () => {
  const secret = process.env.OTP_HMAC_SECRET || process.env.JWT_ACCESS_SECRET;
  const isProduction = process.env.NODE_ENV === 'production';

  if (isProduction) {
    if (!secret || typeof secret !== 'string' || secret.trim().length < MIN_OTP_SECRET_LENGTH) {
      throw new Error(
        `FATAL: A secure OTP_HMAC_SECRET (or JWT_ACCESS_SECRET) with a minimum length of ${MIN_OTP_SECRET_LENGTH} characters is required in production environments.`,
      );
    }
    return secret.trim();
  }

  // Non-production (development / test)
  if (secret && typeof secret === 'string' && secret.trim().length >= MIN_OTP_SECRET_LENGTH) {
    return secret.trim();
  }

  return DEV_TEST_FALLBACK_SECRET;
};

/**
 * Asserts OTP HMAC secret configuration is valid for application startup.
 * Called during server initialization to fail fast if production configuration is missing.
 */
export const assertValidOtpSecret = () => {
  getOtpSecret();
};

/**
 * Generates a cryptographically secure 6-digit numeric OTP string.
 * Uses uniform integer distribution (crypto.randomInt) across 100000 - 999999.
 * @returns {string} 6-digit OTP
 */
export const generateNumericOtp = () => {
  return crypto.randomInt(100000, 1000000).toString();
};

/**
 * Computes an HMAC-SHA256 hash of the plaintext OTP.
 * Bound to a context salt (e.g. bookingId + customerId).
 * @param {string} otp - 6-digit OTP string
 * @param {string} salt - Contextual salt
 * @returns {string} Hex-encoded HMAC-SHA256 digest
 */
export const hashOtp = (otp, salt = '') => {
  const secret = getOtpSecret();
  return crypto
    .createHmac('sha256', secret)
    .update(`${otp}:${salt}`)
    .digest('hex');
};

/**
 * Constant-time verification of an OTP against its stored HMAC hash.
 * Protects against timing side-channel attacks.
 * @param {string} submittedOtp - Plaintext OTP submitted by user
 * @param {string} storedHash - Hex digest stored in database
 * @param {string} salt - Contextual salt
 * @returns {boolean} True if matching, false otherwise
 */
export const verifyOtpHash = (submittedOtp, storedHash, salt = '') => {
  if (!submittedOtp || !storedHash || typeof submittedOtp !== 'string') {
    return false;
  }

  const computedHash = hashOtp(submittedOtp.trim(), salt);
  const bufA = Buffer.from(computedHash, 'hex');
  const bufB = Buffer.from(storedHash, 'hex');

  if (bufA.length !== bufB.length) {
    return false;
  }

  return crypto.timingSafeEqual(bufA, bufB);
};
