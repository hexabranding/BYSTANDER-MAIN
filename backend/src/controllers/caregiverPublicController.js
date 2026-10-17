import * as caregiverService from '../services/caregiverService.js';

/**
 * GET /api/caregivers
 * Public searchable directory of verified, eligible caregivers.
 */
export const getPublicCaregivers = async (req, res, next) => {
  try {
    const result = await caregiverService.getPublicCaregivers(req.query);

    res.status(200).json({
      success: true,
      data: result.caregivers,
      pagination: result.pagination,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/caregivers/:id
 * Public detail view for an eligible, verified caregiver.
 */
export const getPublicProfile = async (req, res, next) => {
  try {
    const profile = await caregiverService.getPublicCaregiverProfileById(req.params.id);

    res.status(200).json({
      success: true,
      data: profile,
    });
  } catch (error) {
    next(error);
  }
};
