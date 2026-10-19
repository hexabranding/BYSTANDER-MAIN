import mongoose from 'mongoose';

/**
 * Subdocument schema for multi-criteria star rating feedback.
 */
const ratingCriteriaSchema = new mongoose.Schema(
  {
    serviceQuality: {
      type: Number,
      min: [1, 'Rating must be at least 1'],
      max: [5, 'Rating cannot exceed 5'],
      default: 5,
    },
    behaviour: {
      type: Number,
      min: [1, 'Rating must be at least 1'],
      max: [5, 'Rating cannot exceed 5'],
      default: 5,
    },
    punctuality: {
      type: Number,
      min: [1, 'Rating must be at least 1'],
      max: [5, 'Rating cannot exceed 5'],
      default: 5,
    },
    overall: {
      type: Number,
      min: [1, 'Rating must be at least 1'],
      max: [5, 'Rating cannot exceed 5'],
      default: 5,
    },
  },
  { _id: false },
);

/**
 * Review Schema — Represents formal feedback left by an authenticated customer
 * following a completed booking engagement.
 */
const reviewSchema = new mongoose.Schema(
  {
    booking: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Booking',
      required: [true, 'Booking reference is required'],
      unique: true,
      index: true,
    },
    customer: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Customer user reference is required'],
      index: true,
    },
    caregiver: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'CaregiverProfile',
      required: [true, 'Caregiver profile reference is required'],
      index: true,
    },
    caregiverUser: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Caregiver user account reference is required'],
      index: true,
    },
    rating: {
      type: Number,
      required: [true, 'Rating value is required'],
      min: [1, 'Rating must be at least 1'],
      max: [5, 'Rating cannot exceed 5'],
      index: true,
    },
    criteria: {
      type: ratingCriteriaSchema,
      default: () => ({ serviceQuality: 5, behaviour: 5, punctuality: 5, overall: 5 }),
    },
    comment: {
      type: String,
      trim: true,
      maxlength: [2000, 'Comment cannot exceed 2000 characters'],
      default: '',
    },
    reply: {
      type: String,
      trim: true,
      maxlength: [2000, 'Reply cannot exceed 2000 characters'],
      default: null,
    },
    replyAt: {
      type: Date,
      default: null,
    },
    isPublic: {
      type: Boolean,
      default: true,
      index: true,
    },
  },
  {
    timestamps: true,
  },
);

// Indexes for caregiver discovery and profile performance
reviewSchema.index({ caregiver: 1, isPublic: 1, createdAt: -1 });
reviewSchema.index({ caregiverUser: 1, createdAt: -1 });
reviewSchema.index({ customer: 1, createdAt: -1 });

export const Review = mongoose.model('Review', reviewSchema);
export default Review;
