import { adminSettingsService } from '../services/adminSettingsService.js';

/**
 * Admin Settings Controller
 * Handles HTTP requests for platform configuration, admin team roster, and security indicators.
 */
export const adminSettingsController = {
  /**
   * GET /api/admin/settings
   * Retrieve platform settings, administrative team roster, and platform security indicators.
   */
  getSettings: async (req, res, next) => {
    try {
      const data = await adminSettingsService.getSettingsBundle();
      res.status(200).json({
        success: true,
        data,
      });
    } catch (error) {
      next(error);
    }
  },

  /**
   * PATCH /api/admin/settings
   * Update general, fees, notifications, or verification policies in MongoDB.
   */
  updateSettings: async (req, res, next) => {
    try {
      const updated = await adminSettingsService.updatePlatformSettings(req.body, req.user?._id);
      res.status(200).json({
        success: true,
        message: 'Platform settings updated successfully',
        data: updated,
      });
    } catch (error) {
      next(error);
    }
  },

  /**
   * POST /api/admin/settings/team/invite
   * Invite / register a new administrator account in MongoDB.
   */
  inviteAdmin: async (req, res, next) => {
    try {
      const result = await adminSettingsService.inviteAdminMember(req.body);
      res.status(201).json({
        success: true,
        message: `Invitation processed for ${req.body.name}`,
        data: result,
      });
    } catch (error) {
      next(error);
    }
  },
};

export default adminSettingsController;
