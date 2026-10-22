import { reviewService } from '../services/reviewService.js';

export const createReview = async (req, res, next) => {
  try {
    const review = await reviewService.createReview(req.user, req.sanitizedReview);
    return res.status(201).json({
      success: true,
      message: 'Review submitted successfully',
      review,
    });
  } catch (error) {
    next(error);
  }
};

export const getCaregiverReviews = async (req, res, next) => {
  try {
    const result = await reviewService.getCaregiverReviews(req.params.caregiverId, req.query);
    return res.status(200).json({
      success: true,
      ...result,
    });
  } catch (error) {
    next(error);
  }
};

export const getMyReviews = async (req, res, next) => {
  try {
    const result = await reviewService.getMyCustomerReviews(req.user, req.query);
    return res.status(200).json({
      success: true,
      ...result,
    });
  } catch (error) {
    next(error);
  }
};

export const addCaregiverReply = async (req, res, next) => {
  try {
    const review = await reviewService.addCaregiverReply(req.user, req.params.id, req.sanitizedReply);
    return res.status(200).json({
      success: true,
      message: 'Reply recorded successfully',
      review,
    });
  } catch (error) {
    next(error);
  }
};

export const reviewController = {
  createReview,
  getCaregiverReviews,
  getMyReviews,
  addCaregiverReply,
};

export default reviewController;
