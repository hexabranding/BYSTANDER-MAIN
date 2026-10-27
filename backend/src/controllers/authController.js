import * as authService from '../services/authService.js';
import { getCookieOptions } from '../utils/auth.js';

const COOKIE_NAME = process.env.COOKIE_NAME || 'token';

/**
 * POST /api/auth/register/customer
 */
export const registerCustomer = async (req, res, next) => {
  try {
    const { user, profile, token } = await authService.registerCustomer(req.body);

    // Set secure HTTP-only cookie
    res.cookie(COOKIE_NAME, token, getCookieOptions());

    res.status(201).json({
      success: true,
      message: 'Customer registered successfully',
      data: {
        user,
        profile,
        token,
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/auth/register/caregiver
 */
export const registerCaregiver = async (req, res, next) => {
  try {
    const { user, profile, token } = await authService.registerCaregiver(req.body);

    // Set secure HTTP-only cookie
    res.cookie(COOKIE_NAME, token, getCookieOptions());

    res.status(201).json({
      success: true,
      message: 'Caregiver application registered successfully and is pending verification',
      data: {
        user,
        profile,
        token,
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/auth/login
 */
export const login = async (req, res, next) => {
  try {
    const { identifier, password } = req.body;
    const { user, profile, token } = await authService.login(identifier, password);

    // Set secure HTTP-only cookie
    res.cookie(COOKIE_NAME, token, getCookieOptions());

    res.status(200).json({
      success: true,
      message: 'Logged in successfully',
      data: {
        user,
        profile,
        token,
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/auth/me
 */
export const getMe = async (req, res, next) => {
  try {
    const { user, profile } = await authService.getCurrentUser(req.user._id);

    res.status(200).json({
      success: true,
      data: {
        user,
        profile,
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/auth/logout
 */
export const logout = async (req, res, next) => {
  try {
    // Clear HTTP-only session cookie
    res.clearCookie(COOKIE_NAME, getCookieOptions());

    res.status(200).json({
      success: true,
      message: 'Logged out successfully',
    });
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/auth/guest/request-otp
 */
export const requestGuestOtp = async (req, res, next) => {
  try {
    const { email, mode } = req.body;
    const result = await authService.requestGuestOtp(email, mode);
    return res.status(200).json({
      success: true,
      message: result.message,
      data: result,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/auth/guest/validate-otp
 */
export const validateGuestOtp = async (req, res, next) => {
  try {
    const { email, otp } = req.body;
    const result = await authService.validateGuestOtp(email, otp);
    return res.status(200).json({
      success: true,
      message: result.message,
      data: result,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/auth/guest/verify-otp
 */
export const verifyGuestOtp = async (req, res, next) => {
  try {
    const { email, otp, password, mode } = req.body;
    const { user, profile, token, isGuest, isProfileComplete } = await authService.verifyGuestOtp(
      email,
      otp,
      password,
      mode
    );

    // Set secure HTTP-only cookie
    res.cookie(COOKIE_NAME, token, getCookieOptions());

    return res.status(200).json({
      success: true,
      message: 'Guest login successful',
      data: {
        user,
        profile,
        token,
        isGuest,
        isProfileComplete,
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/auth/set-password
 */
export const setPassword = async (req, res, next) => {
  try {
    const { password } = req.body;
    const result = await authService.setPassword(req.user._id, password);
    return res.status(200).json({
      success: true,
      message: result.message,
    });
  } catch (error) {
    next(error);
  }
};
