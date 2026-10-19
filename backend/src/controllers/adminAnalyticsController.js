import { adminAnalyticsService } from '../services/adminAnalyticsService.js';
import { reviewService } from '../services/reviewService.js';

export const getMetrics = async (req, res, next) => {
  try {
    const data = await adminAnalyticsService.getAdminMetrics();
    return res.status(200).json({
      success: true,
      ...data,
    });
  } catch (error) {
    next(error);
  }
};

export const getRatings = async (req, res, next) => {
  try {
    const data = await reviewService.getAdminRatings(req.query);
    return res.status(200).json({
      success: true,
      ...data,
    });
  } catch (error) {
    next(error);
  }
};

export const getCaregiverReviewsAdmin = async (req, res, next) => {
  try {
    const reviews = await reviewService.getAdminCaregiverReviews(req.params.caregiverId);
    return res.status(200).json({
      success: true,
      reviews,
    });
  } catch (error) {
    next(error);
  }
};

export const generateReport = async (req, res, next) => {
  try {
    const report = await adminAnalyticsService.generateAdminReport(req.sanitizedReportQuery || req.body);
    return res.status(200).json({
      success: true,
      message: 'Report generated successfully',
      report,
    });
  } catch (error) {
    next(error);
  }
};

export const adminAnalyticsController = {
  getMetrics,
  getRatings,
  getCaregiverReviewsAdmin,
  generateReport,
};

export default adminAnalyticsController;
