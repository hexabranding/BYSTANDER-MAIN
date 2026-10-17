import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';

const BCRYPT_SALT_ROUNDS = 12;
export const MIN_JWT_SECRET_LENGTH = 32;
export const DEV_TEST_JWT_SECRET = 'bystander-dev-jwt-secret-do-not-use-in-production-389472398472';

/**
 * Validates and retrieves the secret for signing and verifying JWT tokens.
 * In production (NODE_ENV=production):
 *   - Strictly forbids fallback defaults.
 *   - Requires JWT_ACCESS_SECRET with minimum length of 32 characters.
 *   - Throws fatal error on startup or execution if invalid or missing.
 * In development and test environments:
 *   - Prefers JWT_ACCESS_SECRET if configured (>= 32 chars).
 *   - Falls back to DEV_TEST_JWT_SECRET only when NODE_ENV !== 'production' to preserve test behavior.
 *
 * @returns {string} Validated JWT secret string
 */
export const getJwtSecret = () => {
  const secret = process.env.JWT_ACCESS_SECRET;
  const isProduction = process.env.NODE_ENV === 'production';

  if (isProduction) {
    if (!secret || typeof secret !== 'string' || secret.trim().length < MIN_JWT_SECRET_LENGTH) {
      throw new Error(
        `FATAL: A secure JWT_ACCESS_SECRET with a minimum length of ${MIN_JWT_SECRET_LENGTH} characters is required in production environments.`,
      );
    }
    return secret.trim();
  }

  // Non-production (development / test)
  if (secret && typeof secret === 'string' && secret.trim().length >= MIN_JWT_SECRET_LENGTH) {
    return secret.trim();
  }

  return DEV_TEST_JWT_SECRET;
};

/**
 * Asserts JWT access secret configuration is valid for application startup.
 * Called during server initialization to fail fast if production configuration is missing.
 */
export const assertValidJwtSecret = () => {
  getJwtSecret();
};

/**
 * Hash plaintext password using bcryptjs.
 * @param {string} password - Plaintext password.
 * @returns {Promise<string>} Password hash.
 */
export const hashPassword = async (password) => {
  if (!password || typeof password !== 'string') {
    throw new Error('Password must be a valid string');
  }
  return bcrypt.hash(password, BCRYPT_SALT_ROUNDS);
};

/**
 * Compare plaintext password with stored hash.
 * @param {string} password - Plaintext password.
 * @param {string} hash - Stored bcrypt hash.
 * @returns {Promise<boolean>} Match result.
 */
export const comparePassword = async (password, hash) => {
  if (!password || !hash) return false;
  return bcrypt.compare(password, hash);
};

/**
 * Generate a signed JWT access token.
 * @param {object} payload - Token payload (id, role, etc.).
 * @returns {string} Signed JWT.
 */
export const generateToken = (payload) => {
  const secret = getJwtSecret();
  const expiresIn = process.env.JWT_EXPIRES_IN || '7d';

  return jwt.sign(payload, secret, {
    expiresIn,
    issuer: 'bystander-api',
  });
};

/**
 * Verify a JWT access token.
 * @param {string} token - Signed JWT.
 * @returns {object} Decoded token payload.
 */
export const verifyToken = (token) => {
  const secret = getJwtSecret();
  return jwt.verify(token, secret, {
    issuer: 'bystander-api',
  });
};

/**
 * Standard cookie configuration for HTTP-only session cookies.
 * @returns {object} Cookie options.
 */
export const getCookieOptions = () => {
  const isProduction = process.env.NODE_ENV === 'production';
  return {
    httpOnly: true,
    secure: isProduction, // HTTPS required in production
    sameSite: isProduction ? 'none' : 'lax', // Lax for local dev across ports; none for cross-site prod
    maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days in milliseconds
    path: '/',
  };
};

/**
 * Format a sanitized user representation for responses.
 * @param {object} user - User document or object.
 * @returns {object} Safe user object.
 */
export const sanitizeUser = (user) => {
  const raw = user.toObject ? user.toObject() : { ...user };
  delete raw.passwordHash;
  delete raw.__v;
  return raw;
};
