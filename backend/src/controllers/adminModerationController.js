import * as adminModerationService from '../services/adminModerationService.js';

/**
 * Controller: List flagged messages for administrative moderation review.
 */
export const getFlaggedMessages = async (req, res, next) => {
  try {
    const result = await adminModerationService.getFlaggedMessages(req.query);
    res.status(200).json({
      success: true,
      data: result.messages,
      pagination: result.pagination,
      stats: result.stats,
    });
  } catch (error) {
    next(error);
  }
};
