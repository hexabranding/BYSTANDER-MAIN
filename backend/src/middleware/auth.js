import mongoose from 'mongoose';
import { verifyToken, formatAccountStatusMessage } from '../utils/auth.js';
import { User } from '../models/User.js';
import { Blacklist } from '../models/Blacklist.js';

/**
 * Authentication Middleware:
 * Extracts JWT from HTTP-only cookie or Authorization header,
 * verifies validity, loads the user record, and checks account status.
 */
export const authenticate = async (req, res, next) => {
  try {
    let token = null;

    // 1. Try to read from HTTP-only cookie
    if (req.cookies && req.cookies.token) {
      token = req.cookies.token;
    }
    // 2. Fall back to Authorization: Bearer <token> header
    else if (req.headers.authorization && req.headers.authorization.startsWith('Bearer ')) {
      token = req.headers.authorization.split(' ')[1];
    }

    if (!token) {
      return res.status(401).json({
        success: false,
        error: 'Unauthorized',
        message: 'Authentication required. Please log in to continue.',
      });
    }

    // Verify token signature and expiration
    let decoded;
    try {
      decoded = verifyToken(token);
    } catch (err) {
      const message =
        err.name === 'TokenExpiredError'
          ? 'Authentication token has expired. Please log in again.'
          : 'Invalid authentication token.';
      return res.status(401).json({
        success: false,
        error: 'Unauthorized',
        message,
      });
    }

    // Fetch user from database
    const user = await User.findById(decoded.id);
    if (!user) {
      return res.status(401).json({
        success: false,
        error: 'Unauthorized',
        message: 'The account associated with this token no longer exists.',
      });
    }

    // Check account status
    if (user.status === 'blocked' || user.status === 'suspended') {
      let activeBlacklist = null;
      if (!user.statusReviewAfter && mongoose.connection?.readyState === 1) {
        try {
          activeBlacklist = await Blacklist.findOne({
            user: user._id,
            status: 'active',
          });
        } catch {
          activeBlacklist = null;
        }
      }
      const message = formatAccountStatusMessage(user, activeBlacklist);
      return res.status(403).json({
        success: false,
        error: 'Forbidden',
        message,
      });
    }

    // Attach user to request context
    req.user = user;
    next();
  } catch (error) {
    next(error);
  }
};

/**
 * Role-based authorization middleware.
 * @param  {...string} roles - Permitted roles ('customer', 'caregiver', 'admin').
 */
export const authorizeRoles = (...roles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: 'Unauthorized',
        message: 'Authentication required before checking permissions.',
      });
    }

    if (!roles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        error: 'Forbidden',
        message: `Access denied. Role '${req.user.role}' is not authorized to access this resource.`,
      });
    }

    next();
  };
};
