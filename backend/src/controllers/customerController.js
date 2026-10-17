import * as customerService from '../services/customerService.js';

/**
 * GET /api/customer/profile
 * Retrieve authenticated customer's profile details.
 */
export const getMyProfile = async (req, res, next) => {
  try {
    const profile = await customerService.getMyCustomerProfile(req.user._id);

    res.status(200).json({
      success: true,
      data: profile,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * PATCH /api/customer/profile
 * Update authenticated customer's emergency contact, default address, and patient list.
 */
export const updateMyProfile = async (req, res, next) => {
  try {
    const profile = await customerService.updateMyCustomerProfile(
      req.user._id,
      req.sanitizedCustomerUpdates,
    );

    res.status(200).json({
      success: true,
      message: 'Customer profile updated successfully',
      data: profile,
    });
  } catch (error) {
    next(error);
  }
};
