import * as adminUserService from '../services/adminUserService.js';

/**
 * Controller: List registered customers with pagination, search, and live booking summary.
 */
export const getCustomers = async (req, res, next) => {
  try {
    const result = await adminUserService.getCustomers(req.query);
    res.status(200).json({
      success: true,
      data: result.customers,
      pagination: result.pagination,
      stats: result.stats,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Controller: List registered caregivers with pagination, search, sorting, and verification status.
 */
export const getCaregivers = async (req, res, next) => {
  try {
    const result = await adminUserService.getCaregivers(req.query);
    res.status(200).json({
      success: true,
      data: result.caregivers,
      pagination: result.pagination,
      stats: result.stats,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Controller: Get full details and status audit history of a user.
 */
export const getUserById = async (req, res, next) => {
  try {
    const user = await adminUserService.getUserById(req.params.id);
    res.status(200).json({
      success: true,
      data: user,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Controller: Admin update user account status with mandatory reason and atomic audit logging.
 */
export const updateUserStatus = async (req, res, next) => {
  try {
    const payload = req.sanitizedStatusUpdate || req.body;
    const updated = await adminUserService.updateUserStatus(req.params.id, payload, req.user);

    res.status(200).json({
      success: true,
      message: `Account status updated to '${updated.status}' successfully.`,
      data: updated,
    });
  } catch (error) {
    next(error);
  }
};
