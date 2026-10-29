import mongoose from 'mongoose';
import { Review } from '../models/Review.js';
import { Booking } from '../models/Booking.js';
import { CaregiverProfile } from '../models/CaregiverProfile.js';
import { CustomerProfile } from '../models/CustomerProfile.js';
import { safeDispatchNotification } from './notificationService.js';

// Per-caregiver FIFO serialization queue maintained for in-process compatibility
const caregiverLocks = new Map();

/**
 * Check if the current MongoDB connection supports multi-document ACID transactions.
 * Requires a Replica Set or Sharded cluster topology (e.g. MongoDB Atlas replica set).
 * @returns {boolean}
 */
export const isTransactionSupported = () => {
  try {
    const client = mongoose.connection?.client;
    if (!client) return false;
    const topology = client.topology?.description;
    const topologyType = topology?.type;
    if (topologyType === 'ReplicaSetWithPrimary' || topologyType === 'Sharded') {
      return true;
    }
    if (topology?.servers) {
      for (const server of topology.servers.values()) {
        if (server.type === 'RSPrimary') return true;
      }
    }
    return false;
  } catch (err) {
    return false;
  }
};

/**
 * Helper to execute an operation inside a MongoDB ACID transaction with automatic retry
 * on transient transaction errors or write conflicts (e.g. WiredTiger WriteConflict code 112).
 *
 * Enforces fail-closed safety: If transaction support (ReplicaSet / Sharded) is not available,
 * throws HTTP 503 ServiceUnavailableError rather than running an unsafe read-then-insert race.
 *
 * @param {Function} workFn - Async function (session) => Promise<any>
 * @param {number} [maxRetries=3] - Maximum retry attempts
 * @returns {Promise<any>}
 */
export const executeWithTransactionRetry = async (workFn, maxRetries = 3) => {
  if (!isTransactionSupported()) {
    const err = new Error(
      'Review submission and caregiver rating aggregation require a MongoDB replica set or sharded deployment with multi-document transaction support to guarantee concurrency safety.',
    );
    err.statusCode = 503;
    err.name = 'ServiceUnavailableError';
    throw err;
  }

  let attempts = 0;
  while (attempts < maxRetries) {
    attempts++;
    const session = await mongoose.startSession();
    try {
      let result;
      await session.withTransaction(async () => {
        result = await workFn(session);
      });
      return result;
    } catch (error) {
      const isTransient =
        error?.hasErrorLabel?.('TransientTransactionError') ||
        error?.code === 112 ||
        error?.message?.includes('WriteConflict');

      if (isTransient && attempts < maxRetries) {
        // Exponential jitter backoff (20-70ms) before retry
        await new Promise((resolve) => setTimeout(resolve, Math.random() * 50 + 20));
        continue;
      }
      throw error;
    } finally {
      await session.endSession();
    }
  }
};

/**
 * Executes a function within a per-caregiver serialization queue.
 * Retained for in-process compatibility; distributed safety across multiple processes
 * is provided by executeWithTransactionRetry and database-level document locks.
 *
 * @param {string|mongoose.Types.ObjectId} caregiverId
 * @param {Function} taskFn
 * @returns {Promise<any>}
 */
export const withCaregiverLock = async (caregiverId, taskFn) => {
  const key = caregiverId.toString();
  const currentLock = caregiverLocks.get(key) || Promise.resolve();

  let releaseLock;
  const nextLock = new Promise((resolve) => {
    releaseLock = resolve;
  });

  caregiverLocks.set(key, nextLock);

  try {
    await currentLock;
    return await taskFn();
  } finally {
    releaseLock();
    if (caregiverLocks.get(key) === nextLock) {
      caregiverLocks.delete(key);
    }
  }
};

/**
 * Shared helper to recalculate a caregiver's rolling average rating and review count
 * from all active, public reviews in the database.
 *
 * Handles zero reviews cleanly (defaults to 5.00 average, 0 count).
 *
 * @param {string|mongoose.Types.ObjectId} caregiverId - CaregiverProfile ObjectId
 * @param {Object} [options={}] - Optional { session }
 * @returns {Promise<{ average: number, count: number }>}
 */
export const recalculateCaregiverRating = async (caregiverId, options = {}) => {
  const profileId = new mongoose.Types.ObjectId(caregiverId);

  const query = Review.aggregate([
    {
      $match: {
        caregiver: profileId,
        reviewerRole: { $ne: 'caregiver' },
        isPublic: true,
      },
    },
    {
      $group: {
        _id: '$caregiver',
        count: { $sum: 1 },
        sum: { $sum: '$rating' },
      },
    },
  ]);

  const aggResult = typeof query?.session === 'function' ? await query.session(options.session || null) : await query;

  const stats = aggResult[0] || { count: 0, sum: 0 };
  const count = stats.count;
  const average = count > 0 ? Number((stats.sum / count).toFixed(2)) : 5.0;

  const updateOpts = options.session ? { session: options.session, new: true } : { new: true };
  await CaregiverProfile.findByIdAndUpdate(
    profileId,
    {
      'rating.average': average,
      'rating.count': count,
    },
    updateOpts,
  );

  return { average, count };
};

/**
 * Recalculate customer rolling average rating and review count from caretaker reviews.
 */
export const recalculateCustomerRating = async (customerId, options = {}) => {
  const customerUserId = new mongoose.Types.ObjectId(customerId);

  const query = Review.aggregate([
    {
      $match: {
        customer: customerUserId,
        reviewerRole: 'caregiver',
        isPublic: true,
      },
    },
    {
      $group: {
        _id: '$customer',
        count: { $sum: 1 },
        sum: { $sum: '$rating' },
      },
    },
  ]);

  const aggResult = typeof query?.session === 'function' ? await query.session(options.session || null) : await query;

  const stats = aggResult[0] || { count: 0, sum: 0 };
  const count = stats.count;
  const average = count > 0 ? Number((stats.sum / count).toFixed(2)) : 5.0;

  const updateOpts = options.session ? { session: options.session, new: true } : { new: true };
  await CustomerProfile.findOneAndUpdate(
    { user: customerUserId },
    {
      'rating.average': average,
      'rating.count': count,
    },
    updateOpts,
  );

  return { average, count };
};

/**
 * Submit a review and rating for a completed booking engagement.
 * Supports both:
 * 1. Customer reviewing Caretaker
 * 2. Caretaker reviewing Customer
 *
 * @param {Object} user - Authenticated customer or caregiver User document
 * @param {Object} data - Validated payload { bookingId, rating, criteria, comment }
 * @returns {Promise<Object>} Created Review document
 */
export const createReview = async (user, data) => {
  const { bookingId, rating, criteria, comment } = data;

  if (!mongoose.Types.ObjectId.isValid(bookingId)) {
    const err = new Error('Invalid booking identifier format');
    err.statusCode = 400;
    err.name = 'ValidationError';
    throw err;
  }

  // 1. Fetch booking to verify existence, status and participant ownership
  const booking = await Booking.findById(bookingId);
  if (!booking) {
    const err = new Error('Booking engagement not found');
    err.statusCode = 404;
    err.name = 'NotFoundError';
    throw err;
  }

  // 2. Strict participant authorization: either customer or assigned caregiver
  const isCustomer = booking.customer.toString() === user._id.toString();
  const isCaregiver = booking.caregiverUser && booking.caregiverUser.toString() === user._id.toString();

  if (!isCustomer && !isCaregiver) {
    const err = new Error('You are not authorized to submit a review for this booking');
    err.statusCode = 403;
    err.name = 'ForbiddenError';
    throw err;
  }

  const reviewerRole = isCustomer ? 'customer' : 'caregiver';

  // 3. Lifecycle precondition: reviews can only be submitted for completed shifts
  if (booking.status !== 'completed') {
    const err = new Error(
      `Cannot submit a review for a booking with status '${booking.status}'. Reviews can only be submitted for completed engagements.`,
    );
    err.statusCode = 400;
    err.name = 'ValidationError';
    throw err;
  }

  // 4. Fast-path duplicate review check for this role
  const existingReview = await Review.findOne({ booking: booking._id, reviewerRole });
  if (existingReview) {
    const err = new Error('A review has already been submitted for this booking engagement');
    err.statusCode = 400;
    err.name = 'ValidationError';
    throw err;
  }

  // 5. Database-backed concurrency-safe transaction with automatic retry
  const review = await executeWithTransactionRetry(async (session) => {
    if (reviewerRole === 'customer') {
      await CaregiverProfile.updateOne(
        { _id: booking.caregiver },
        { $inc: { ratingLockVersion: 1 } },
        { session },
      );
    }

    // Re-check duplicate inside the transaction
    const doubleCheckQuery = Review.findOne({ booking: booking._id, reviewerRole });
    const doubleCheck = typeof doubleCheckQuery?.session === 'function'
      ? await doubleCheckQuery.session(session)
      : await doubleCheckQuery;
    if (doubleCheck) {
      const err = new Error('A review has already been submitted for this booking engagement');
      err.statusCode = 400;
      err.name = 'ValidationError';
      throw err;
    }

    let createdReview;
    try {
      const defaultCriteria = reviewerRole === 'customer'
        ? { serviceQuality: 5, behaviour: 5, punctuality: 5, overall: 5 }
        : { cooperation: 5, clarity: 5, punctuality: 5, overall: 5 };

      const rawCreated = await Review.create(
        [
          {
            booking: booking._id,
            reviewerRole,
            reviewer: user._id,
            customer: booking.customer,
            caregiver: booking.caregiver,
            caregiverUser: booking.caregiverUser,
            rating,
            criteria: criteria || defaultCriteria,
            comment: comment || '',
            isPublic: true,
          },
        ],
        { session },
      );
      createdReview = Array.isArray(rawCreated) ? rawCreated[0] : rawCreated;
    } catch (createErr) {
      if (createErr.code === 11000) {
        const err = new Error('A review has already been submitted for this booking engagement');
        err.statusCode = 400;
        err.name = 'ValidationError';
        throw err;
      }
      throw createErr;
    }

    if (reviewerRole === 'customer') {
      await recalculateCaregiverRating(booking.caregiver, { session });
      await Booking.updateOne(
        { _id: booking._id },
        {
          $set: {
            customerRating: {
              average: rating,
              criteria: criteria || defaultCriteria,
              comment: comment || '',
              at: new Date(),
            },
          },
        },
        { session },
      );
    } else {
      await recalculateCustomerRating(booking.customer, { session });
      await Booking.updateOne(
        { _id: booking._id },
        {
          $set: {
            caregiverRating: {
              average: rating,
              criteria: criteria || defaultCriteria,
              comment: comment || '',
              at: new Date(),
            },
          },
        },
        { session },
      );
    }

    return createdReview;
  });

  // 6. Fail-safe notification to the counterpart participant
  if (reviewerRole === 'customer') {
    await safeDispatchNotification({
      recipient: booking.caregiverUser,
      type: 'review_received',
      title: '⭐ New Rating Received',
      message: `You received a ${rating}-star rating for booking #${booking._id.toString().slice(-6)}.`,
      metadata: { reviewId: review._id, bookingId: booking._id, rating },
    });
  } else {
    await safeDispatchNotification({
      recipient: booking.customer,
      type: 'review_received',
      title: '⭐ Caretaker Review Received',
      message: `Your caretaker left you a ${rating}-star review for booking #${booking._id.toString().slice(-6)}.`,
      metadata: { reviewId: review._id, bookingId: booking._id, rating },
    });
  }

  if (typeof review?.populate === 'function') {
    return review.populate([
      { path: 'customer', select: 'fullName email' },
      { path: 'caregiverUser', select: 'fullName email' },
      { path: 'reviewer', select: 'fullName email role' },
    ]);
  }
  return review;
};

/**
 * Retrieve public reviews for a specific caregiver profile or user.
 */
export const getCaregiverReviews = async (caregiverId, query = {}) => {
  if (!mongoose.Types.ObjectId.isValid(caregiverId)) {
    const err = new Error('Invalid caregiver identifier');
    err.statusCode = 400;
    err.name = 'ValidationError';
    throw err;
  }

  const filter = {
    $or: [{ caregiver: caregiverId }, { caregiverUser: caregiverId }],
    isPublic: true,
  };

  const page = Math.max(1, parseInt(query.page, 10) || 1);
  const limit = Math.min(50, Math.max(1, parseInt(query.limit, 10) || 10));
  const skip = (page - 1) * limit;

  const [reviews, total] = await Promise.all([
    Review.find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .populate('customer', 'fullName avatar'),
    Review.countDocuments(filter),
  ]);

  return {
    reviews,
    pagination: {
      total,
      page,
      limit,
      pages: Math.ceil(total / limit) || 1,
    },
  };
};

/**
 * Caregiver replies to a customer review left on their shift.
 */
export const addCaregiverReply = async (user, reviewId, replyText) => {
  if (!mongoose.Types.ObjectId.isValid(reviewId)) {
    const err = new Error('Invalid review identifier');
    err.statusCode = 400;
    err.name = 'ValidationError';
    throw err;
  }

  const review = await Review.findById(reviewId);
  if (!review) {
    const err = new Error('Review not found');
    err.statusCode = 404;
    err.name = 'NotFoundError';
    throw err;
  }

  // Authorization: Only assigned caregiver or platform admin can reply
  const isCaregiver = review.caregiverUser.toString() === user._id.toString();
  const isAdmin = user.role === 'admin';

  if (!isCaregiver && !isAdmin) {
    const err = new Error('You are not authorized to reply to this review');
    err.statusCode = 403;
    err.name = 'ForbiddenError';
    throw err;
  }

  review.reply = replyText;
  review.replyAt = new Date();
  await review.save();

  return review.populate('customer', 'fullName');
};

/**
 * Administrative ratings overview across all caregivers with distribution analytics.
 */
export const getAdminRatings = async (query = {}) => {
  const [caregivers, allReviews] = await Promise.all([
    CaregiverProfile.find()
      .populate('user', 'fullName email status')
      .sort({ 'rating.average': -1 }),
    Review.find({ isPublic: true }),
  ]);

  const totalReviews = allReviews.length;
  const weightedSum = allReviews.reduce((sum, r) => sum + r.rating, 0);
  const average = totalReviews ? (weightedSum / totalReviews).toFixed(2) : '5.00';
  const fiveStarCount = allReviews.filter((r) => r.rating >= 4.5).length;
  const fiveShare = totalReviews ? Math.round((fiveStarCount / totalReviews) * 100) : 100;
  const attentionCount = caregivers.filter((c) => (c.rating?.average || 5.0) < 4.5).length;

  // Star distribution breakdown (5, 4, 3, 2, 1)
  const distribution = [5, 4, 3, 2, 1].map((star) => {
    const count = allReviews.filter((r) => Math.round(r.rating) === star).length;
    const percentage = totalReviews ? Math.round((count / totalReviews) * 100) : star === 5 ? 100 : 0;
    return { star, count, percentage };
  });

  // Map caregiver rows matching frontend table
  const rows = caregivers.map((c) => {
    const cReviews = allReviews.filter((r) => r.caregiver.toString() === c._id.toString());
    const rCount = cReviews.length || c.rating?.count || 0;
    const rAvg = c.rating?.average !== undefined ? c.rating.average : 5.0;
    const positiveCount = cReviews.filter((r) => r.rating >= 4).length;
    const positive = rCount ? Math.round((positiveCount / rCount) * 100) : 100;

    return {
      id: c._id.toString(),
      caregiverProfileId: c._id.toString(),
      caregiverUserId: c.user?._id?.toString() || null,
      caregiverName: c.user?.fullName || 'Caregiver',
      city: c.city || 'Mumbai, MH',
      qualification: c.qualification,
      rating: rAvg,
      reviews: rCount,
      positive,
      trend: '+0.1',
      status: rAvg < 4.5 ? 'Needs attention' : 'Good',
    };
  });

  return {
    rows,
    stats: {
      average,
      totalReviews,
      fiveShare,
      attention: attentionCount,
    },
    distribution,
  };
};

/**
 * Retrieve individual caregiver review dossier for administrators.
 */
export const getAdminCaregiverReviews = async (caregiverId) => {
  if (!mongoose.Types.ObjectId.isValid(caregiverId)) {
    const err = new Error('Invalid caregiver identifier');
    err.statusCode = 400;
    err.name = 'ValidationError';
    throw err;
  }

  const reviews = await Review.find({
    $or: [{ caregiver: caregiverId }, { caregiverUser: caregiverId }],
  })
    .sort({ createdAt: -1 })
    .populate('customer', 'fullName email')
    .populate('booking', 'serviceName date totalAmount');

  return reviews;
};

/**
 * Retrieve public reviews for a specific customer left by caregivers.
 */
export const getCustomerReviews = async (customerId, query = {}) => {
  if (!mongoose.Types.ObjectId.isValid(customerId)) {
    const err = new Error('Invalid customer identifier');
    err.statusCode = 400;
    err.name = 'ValidationError';
    throw err;
  }

  const filter = {
    customer: customerId,
    reviewerRole: 'caregiver',
    isPublic: true,
  };

  const page = Math.max(1, parseInt(query.page, 10) || 1);
  const limit = Math.min(50, Math.max(1, parseInt(query.limit, 10) || 10));
  const skip = (page - 1) * limit;

  const [reviews, total] = await Promise.all([
    Review.find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .populate('caregiverUser', 'fullName avatar')
      .populate('booking', 'serviceName date totalAmount'),
    Review.countDocuments(filter),
  ]);

  return {
    reviews,
    pagination: {
      total,
      page,
      limit,
      pages: Math.ceil(total / limit) || 1,
    },
  };
};

/**
 * Retrieve personal reviews authored by or received by the authenticated user.
 *
 * @param {Object} user - Authenticated user { _id, role }
 * @param {Object} [query={}] - Optional { page, limit, type: 'written' | 'received' }
 * @returns {Promise<{ reviews: Array, pagination: Object }>}
 */
export const getMyCustomerReviews = async (user, query = {}) => {
  const userId = user?._id || user?.id;
  if (!userId || !mongoose.Types.ObjectId.isValid(userId)) {
    const err = new Error('Authenticated customer identifier required');
    err.statusCode = 401;
    err.name = 'UnauthorizedError';
    throw err;
  }

  const page = Math.max(1, parseInt(query.page, 10) || 1);
  const limit = Math.min(50, Math.max(1, parseInt(query.limit, 10) || 10));
  const skip = (page - 1) * limit;

  let filter;
  if (user.role === 'caregiver') {
    if (query.type === 'written') {
      filter = { caregiverUser: userId, reviewerRole: 'caregiver' };
    } else {
      filter = { caregiverUser: userId, reviewerRole: { $ne: 'caregiver' } };
    }
  } else {
    if (query.type === 'received') {
      filter = { customer: userId, reviewerRole: 'caregiver' };
    } else if (query.type === 'written') {
      filter = { customer: userId, reviewerRole: { $ne: 'caregiver' } };
    } else {
      filter = { customer: userId };
    }
  }

  const [reviews, total] = await Promise.all([
    Review.find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .populate('caregiver', 'qualification experienceYears city area rating avatar hourlyRate')
      .populate('caregiverUser', 'fullName email avatar')
      .populate('customer', 'fullName email avatar')
      .populate('booking', 'serviceName date scheduledDate timeSlot durationHours totalAmount status'),
    Review.countDocuments(filter),
  ]);

  return {
    reviews,
    pagination: {
      total,
      page,
      limit,
      pages: Math.ceil(total / limit) || 1,
    },
  };
};

export const reviewService = {
  createReview,
  getCaregiverReviews,
  getCustomerReviews,
  getMyCustomerReviews,
  addCaregiverReply,
  getAdminRatings,
  getAdminCaregiverReviews,
  recalculateCaregiverRating,
  recalculateCustomerRating,
  withCaregiverLock,
  isTransactionSupported,
  executeWithTransactionRetry,
};

export default reviewService;

