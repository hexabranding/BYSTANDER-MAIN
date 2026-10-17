import * as caregiverService from '../services/caregiverService.js';

/**
 * GET /api/caregiver/profile
 * Authenticated caregiver retrieves their own private profile.
 */
export const getMyProfile = async (req, res, next) => {
  try {
    const profile = await caregiverService.getMyCaregiverProfile(req.user._id);

    res.status(200).json({
      success: true,
      data: profile,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * PATCH /api/caregiver/profile
 * Authenticated caregiver updates permitted professional fields.
 */
export const updateMyProfile = async (req, res, next) => {
  try {
    const profile = await caregiverService.updateMyCaregiverProfile(
      req.user._id,
      req.sanitizedUpdates,
    );

    res.status(200).json({
      success: true,
      message: 'Caregiver profile updated successfully',
      data: profile,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/caregiver/availability
 * Authenticated caregiver retrieves recurring weekly schedule and date exceptions.
 */
export const getMyAvailability = async (req, res, next) => {
  try {
    const availability = await caregiverService.getMyAvailability(req.user._id);

    res.status(200).json({
      success: true,
      data: availability,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * PUT /api/caregiver/availability
 * Authenticated caregiver configures weekly recurring schedule and date exceptions.
 */
export const updateMyAvailability = async (req, res, next) => {
  try {
    const updated = await caregiverService.updateMyAvailability(req.user._id, req.body);

    res.status(200).json({
      success: true,
      message: 'Caregiver availability updated successfully',
      data: updated,
    });
  } catch (error) {
    next(error);
  }
};
