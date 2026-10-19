import test from 'node:test';
import assert from 'node:assert/strict';
import mongoose from 'mongoose';
import { authorizeRoles } from '../src/middleware/auth.js';
import {
  validateCreateReview,
  validateReplyReview,
  validateReportGeneration,
} from '../src/middleware/validateReview.js';
import * as reviewService from '../src/services/reviewService.js';
import * as adminAnalyticsService from '../src/services/adminAnalyticsService.js';
import { Review } from '../src/models/Review.js';
import { Booking } from '../src/models/Booking.js';
import { CaregiverProfile } from '../src/models/CaregiverProfile.js';
import { User } from '../src/models/User.js';
import { SosIncident } from '../src/models/SosIncident.js';
import { Service } from '../src/models/Service.js';
import { setupEphemeralReplicaSet } from './helpers/testReplicaSet.js';

// Helper to simulate Express req, res, next
const createMockReqRes = (options = {}) => {
  const req = {
    body: options.body || {},
    params: options.params || {},
    query: options.query || {},
    headers: options.headers || {},
    cookies: options.cookies || {},
    user: options.user || null,
  };

  const res = {
    statusCode: 200,
    status(code) {
      this.statusCode = code;
      return this;
    },
    jsonData: null,
    json(data) {
      this.jsonData = data;
      return this;
    },
  };

  let nextCalled = false;
  let nextError = null;
  const next = (err = null) => {
    nextCalled = true;
    nextError = err;
  };

  return { req, res, next, getNextCalled: () => nextCalled, getNextError: () => nextError };
};

// -----------------------------------------------------------------------------
// Test 1: Role-Based Authorization on Admin Analytics & Ratings Endpoints
// -----------------------------------------------------------------------------
test('Step 13E - 1: authorizeRoles enforces admin-only access on analytics & ratings', () => {
  const adminGuard = authorizeRoles('admin');

  // Customer rejected with 403
  const { req: custReq, res: custRes, next: custNext } = createMockReqRes({
    user: { _id: new mongoose.Types.ObjectId(), role: 'customer' },
  });
  adminGuard(custReq, custRes, custNext);
  assert.equal(custRes.statusCode, 403);
  assert.equal(custRes.jsonData.error, 'Forbidden');

  // Caregiver rejected with 403
  const { req: cgReq, res: cgRes, next: cgNext } = createMockReqRes({
    user: { _id: new mongoose.Types.ObjectId(), role: 'caregiver' },
  });
  adminGuard(cgReq, cgRes, cgNext);
  assert.equal(cgRes.statusCode, 403);

  // Admin allowed
  const { req: adminReq, res: adminRes, next: adminNext, getNextCalled } = createMockReqRes({
    user: { _id: new mongoose.Types.ObjectId(), role: 'admin' },
  });
  adminGuard(adminReq, adminRes, adminNext);
  assert.equal(getNextCalled(), true);
});

// -----------------------------------------------------------------------------
// Test 2: Input Validation for Review Submission
// -----------------------------------------------------------------------------
test('Step 13E - 2: validateCreateReview enforces valid booking ObjectId and rating bounds', () => {
  // A. Invalid bookingId
  const { req: badBookingReq, res: badBookingRes, next: badBookingNext } = createMockReqRes({
    body: { bookingId: 'invalid-id-xyz', rating: 5 },
  });
  validateCreateReview(badBookingReq, badBookingRes, badBookingNext);
  assert.equal(badBookingRes.statusCode, 400);
  assert.match(badBookingRes.jsonData.message, /valid booking identifier is required/i);

  // B. Rating out of bounds (< 1)
  const { req: lowRatingReq, res: lowRatingRes, next: lowRatingNext } = createMockReqRes({
    body: { bookingId: new mongoose.Types.ObjectId().toString(), rating: 0 },
  });
  validateCreateReview(lowRatingReq, lowRatingRes, lowRatingNext);
  assert.equal(lowRatingRes.statusCode, 400);
  assert.match(lowRatingRes.jsonData.message, /score between 1 and 5/i);

  // C. Rating out of bounds (> 5)
  const { req: highRatingReq, res: highRatingRes, next: highRatingNext } = createMockReqRes({
    body: { bookingId: new mongoose.Types.ObjectId().toString(), rating: 6 },
  });
  validateCreateReview(highRatingReq, highRatingRes, highRatingNext);
  assert.equal(highRatingRes.statusCode, 400);
  assert.match(highRatingRes.jsonData.message, /score between 1 and 5/i);

  // D. Valid review payload with criteria sanitizes and calls next()
  const validBookingId = new mongoose.Types.ObjectId().toString();
  const { req: validReq, res: validRes, next: validNext, getNextCalled } = createMockReqRes({
    body: {
      bookingId: validBookingId,
      criteria: { serviceQuality: 5, behaviour: 4, punctuality: 5, overall: 5 },
      comment: 'Very professional and attentive caretaker.',
    },
  });
  validateCreateReview(validReq, validRes, validNext);
  assert.equal(getNextCalled(), true);
  assert.equal(validReq.sanitizedReview.bookingId, validBookingId);
  assert.equal(validReq.sanitizedReview.rating, 4.8);
  assert.equal(validReq.sanitizedReview.comment, 'Very professional and attentive caretaker.');
});

// -----------------------------------------------------------------------------
// Test 3: Review Submission Preconditions & Participant Authorization
// -----------------------------------------------------------------------------
test('Step 13E - 3: createReview enforces customer ownership and completed booking state', async () => {
  const customerId = new mongoose.Types.ObjectId();
  const strangerId = new mongoose.Types.ObjectId();
  const caregiverProfileId = new mongoose.Types.ObjectId();
  const caregiverUserId = new mongoose.Types.ObjectId();
  const bookingId = new mongoose.Types.ObjectId();

  const customerUser = { _id: customerId, role: 'customer', fullName: 'Priya Sharma' };
  const strangerUser = { _id: strangerId, role: 'customer', fullName: 'Stranger' };

  const originalBookingFindById = Booking.findById;
  const originalReviewFindOne = Review.findOne;
  const originalReviewCreate = Review.create;
  const originalReviewFind = Review.find;
  const originalProfileUpdate = CaregiverProfile.findByIdAndUpdate;

  try {
    // 1. Stranger filing review -> 403 Forbidden
    Booking.findById = () =>
      Promise.resolve({
        _id: bookingId,
        customer: customerId,
        caregiver: caregiverProfileId,
        caregiverUser: caregiverUserId,
        status: 'completed',
      });

    await assert.rejects(
      async () => {
        await reviewService.createReview(strangerUser, {
          bookingId: bookingId.toString(),
          rating: 5,
        });
      },
      (err) => {
        assert.equal(err.statusCode, 403);
        assert.match(err.message, /not authorized to submit a review/i);
        return true;
      },
    );

    // 2. Customer reviewing non-completed booking -> 400 Bad Request
    Booking.findById = () =>
      Promise.resolve({
        _id: bookingId,
        customer: customerId,
        caregiver: caregiverProfileId,
        caregiverUser: caregiverUserId,
        status: 'in_progress', // Not completed yet
      });

    await assert.rejects(
      async () => {
        await reviewService.createReview(customerUser, {
          bookingId: bookingId.toString(),
          rating: 5,
        });
      },
      (err) => {
        assert.equal(err.statusCode, 400);
        assert.match(err.message, /completed engagements/i);
        return true;
      },
    );

    // 3. Customer reviewing already-reviewed booking -> 400 Bad Request
    Booking.findById = () =>
      Promise.resolve({
        _id: bookingId,
        customer: customerId,
        caregiver: caregiverProfileId,
        caregiverUser: caregiverUserId,
        status: 'completed',
      });
    Review.findOne = () => Promise.resolve({ _id: new mongoose.Types.ObjectId() }); // existing review

    await assert.rejects(
      async () => {
        await reviewService.createReview(customerUser, {
          bookingId: bookingId.toString(),
          rating: 5,
        });
      },
      (err) => {
        assert.equal(err.statusCode, 400);
        assert.match(err.message, /already been submitted/i);
        return true;
      },
    );
  } finally {
    Booking.findById = originalBookingFindById;
    Review.findOne = originalReviewFindOne;
    Review.create = originalReviewCreate;
    Review.find = originalReviewFind;
    CaregiverProfile.findByIdAndUpdate = originalProfileUpdate;
  }
});

// -----------------------------------------------------------------------------
// Test 4: Rolling Rating Recalculation on CaregiverProfile
// -----------------------------------------------------------------------------
test('Step 13E - 4: createReview recalculates caregiver rolling average rating and review count', async () => {
  const customerId = new mongoose.Types.ObjectId();
  const caregiverProfileId = new mongoose.Types.ObjectId();
  const caregiverUserId = new mongoose.Types.ObjectId();
  const bookingId = new mongoose.Types.ObjectId();

  const customerUser = { _id: customerId, role: 'customer', fullName: 'Priya Sharma' };

  const originalClient = mongoose.connection.client;
  const originalStartSession = mongoose.startSession;
  const originalBookingFindById = Booking.findById;
  const originalReviewFindOne = Review.findOne;
  const originalReviewCreate = Review.create;
  const originalReviewAggregate = Review.aggregate;
  const originalProfileUpdate = CaregiverProfile.findByIdAndUpdate;
  const originalProfileUpdateOne = CaregiverProfile.updateOne;

  try {
    mongoose.connection.client = {
      topology: { description: { type: 'ReplicaSetWithPrimary' } },
    };
    mongoose.startSession = async () => ({
      withTransaction: async (cb) => cb(),
      endSession: async () => {},
    });
    CaregiverProfile.updateOne = () => Promise.resolve({ modifiedCount: 1 });

    Booking.findById = () =>
      Promise.resolve({
        _id: bookingId,
        customer: customerId,
        caregiver: caregiverProfileId,
        caregiverUser: caregiverUserId,
        status: 'completed',
      });

    Review.findOne = () => Promise.resolve(null); // No prior review

    let createdReviewDoc = null;
    Review.create = (docs) => {
      const doc = Array.isArray(docs) ? docs[0] : docs;
      createdReviewDoc = {
        ...doc,
        _id: new mongoose.Types.ObjectId(),
        populate: () => Promise.resolve({ ...doc, _id: new mongoose.Types.ObjectId() }),
      };
      return Promise.resolve(Array.isArray(docs) ? [createdReviewDoc] : createdReviewDoc);
    };

    // Simulate 2 reviews in DB for caregiver: 5.0 and 4.0 -> average should become 4.5
    Review.aggregate = () => ({
      session: () => Promise.resolve([{ _id: caregiverProfileId, count: 2, sum: 9 }]),
    });

    let updatedProfileChanges = null;
    CaregiverProfile.findByIdAndUpdate = (id, changes) => {
      updatedProfileChanges = changes;
      return Promise.resolve({ _id: id, ...changes });
    };

    const review = await reviewService.createReview(customerUser, {
      bookingId: bookingId.toString(),
      rating: 4,
      comment: 'Very polite caretaker.',
    });

    assert.ok(review);
    assert.equal(createdReviewDoc.rating, 4);
    assert.equal(createdReviewDoc.comment, 'Very polite caretaker.');

    // Assert CaregiverProfile rating was recalculated
    assert.ok(updatedProfileChanges);
    assert.equal(updatedProfileChanges['rating.count'], 2);
    assert.equal(updatedProfileChanges['rating.average'], 4.5);
  } finally {
    mongoose.connection.client = originalClient;
    mongoose.startSession = originalStartSession;
    Booking.findById = originalBookingFindById;
    Review.findOne = originalReviewFindOne;
    Review.create = originalReviewCreate;
    Review.aggregate = originalReviewAggregate;
    CaregiverProfile.findByIdAndUpdate = originalProfileUpdate;
    CaregiverProfile.updateOne = originalProfileUpdateOne;
  }
});

// -----------------------------------------------------------------------------
// Test 5: Caregiver Reply to Review
// -----------------------------------------------------------------------------
test('Step 13E - 5: addCaregiverReply authorizes assigned caregiver and saves reply', async () => {
  const reviewId = new mongoose.Types.ObjectId();
  const caregiverUserId = new mongoose.Types.ObjectId();
  const strangerUserId = new mongoose.Types.ObjectId();

  const caregiverUser = { _id: caregiverUserId, role: 'caregiver' };
  const strangerUser = { _id: strangerUserId, role: 'caregiver' };

  const originalFindById = Review.findById;

  try {
    const mockReview = {
      _id: reviewId,
      caregiverUser: caregiverUserId,
      reply: null,
      replyAt: null,
      save() {
        return Promise.resolve(this);
      },
      populate() {
        return Promise.resolve(this);
      },
    };

    Review.findById = () => Promise.resolve(mockReview);

    // 1. Stranger caregiver cannot reply -> 403
    await assert.rejects(
      async () => {
        await reviewService.addCaregiverReply(strangerUser, reviewId.toString(), 'Thank you!');
      },
      (err) => {
        assert.equal(err.statusCode, 403);
        assert.match(err.message, /not authorized to reply/i);
        return true;
      },
    );

    // 2. Assigned caregiver can reply
    const result = await reviewService.addCaregiverReply(
      caregiverUser,
      reviewId.toString(),
      'Thank you for the kind feedback, it was a pleasure assisting your mother.',
    );

    assert.equal(result.reply, 'Thank you for the kind feedback, it was a pleasure assisting your mother.');
    assert.ok(result.replyAt);
  } finally {
    Review.findById = originalFindById;
  }
});

// -----------------------------------------------------------------------------
// Test 6: Admin Metrics Aggregation Pipeline
// -----------------------------------------------------------------------------
test('Step 13E - 6: getAdminMetrics aggregates authoritative KPI counts, gross value, and time-series', async () => {
  const originalUserCount = User.countDocuments;
  const originalProfileCount = CaregiverProfile.countDocuments;
  const originalBookingCount = Booking.countDocuments;
  const originalSosCount = SosIncident.countDocuments;
  const originalBookingAggregate = Booking.aggregate;
  const originalBookingFind = Booking.find;
  const originalUserFind = User.find;
  const originalProfileFind = CaregiverProfile.find;
  const originalSosFind = SosIncident.find;

  try {
    User.countDocuments = () => Promise.resolve(42);
    CaregiverProfile.countDocuments = (filter) => {
      if (filter && filter.verificationStatus) return Promise.resolve(7);
      return Promise.resolve(18);
    };
    Booking.countDocuments = (filter) => {
      if (filter?.status === 'completed') return Promise.resolve(50);
      if (filter?.status === 'cancelled') return Promise.resolve(10);
      return Promise.resolve(5); // active
    };
    SosIncident.countDocuments = () => Promise.resolve(2);

    Booking.aggregate = (pipeline) => {
      // Financial group pipeline
      if (pipeline[0]?.$match) {
        return Promise.resolve([{ _id: null, gross: 250000, count: 55 }]);
      }
      // Monthly activity pipeline
      return Promise.resolve([
        { _id: '2026-09', bookings: 25, completed: 20, cancelled: 3, gross: 120000 },
        { _id: '2026-10', bookings: 30, completed: 22, cancelled: 4, gross: 130000 },
      ]);
    };

    Booking.find = () => ({
      sort: () => ({
        limit: () => ({
          populate: () => ({
            populate: () => Promise.resolve([]),
          }),
        }),
      }),
    });
    User.find = () => ({
      sort: () => ({
        limit: () => Promise.resolve([]),
      }),
    });
    CaregiverProfile.find = () => ({
      sort: () => ({
        limit: () => ({
          populate: () => Promise.resolve([]),
        }),
      }),
    });
    SosIncident.find = () => ({
      sort: () => ({
        limit: () => Promise.resolve([]),
      }),
    });

    const metrics = await adminAnalyticsService.getAdminMetrics();

    assert.ok(metrics.stats);
    assert.equal(metrics.stats.customers, 42);
    assert.equal(metrics.stats.caregivers, 18);
    assert.equal(metrics.stats.pendingVerificationsCount, 7);
    assert.equal(metrics.stats.completed, 50);
    assert.equal(metrics.stats.cancelled, 10);
    assert.equal(metrics.stats.activeSosCount, 2);
    assert.equal(metrics.stats.gross, 250000);
    // Platform revenue (12% of gross)
    assert.equal(metrics.stats.revenue, 30000);
    // Completion rate: 50 / (50 + 10) = 83%
    assert.equal(metrics.stats.completionRate, 83);
    assert.ok(metrics.bookingActivity);
    assert.ok(metrics.revenueSplit);
  } finally {
    User.countDocuments = originalUserCount;
    CaregiverProfile.countDocuments = originalProfileCount;
    Booking.countDocuments = originalBookingCount;
    SosIncident.countDocuments = originalSosCount;
    Booking.aggregate = originalBookingAggregate;
    Booking.find = originalBookingFind;
    User.find = originalUserFind;
    CaregiverProfile.find = originalProfileFind;
    SosIncident.find = originalSosFind;
  }
});

// -----------------------------------------------------------------------------
// Test 7: Admin Ratings Directory & Distribution Aggregation
// -----------------------------------------------------------------------------
test('Step 13E - 7: getAdminRatings compiles caregiver rating table and star distributions', async () => {
  const originalProfileFind = CaregiverProfile.find;
  const originalReviewFind = Review.find;

  try {
    const cg1Id = new mongoose.Types.ObjectId();
    const cg2Id = new mongoose.Types.ObjectId();

    CaregiverProfile.find = () => ({
      populate: () => ({
        sort: () =>
          Promise.resolve([
            {
              _id: cg1Id,
              user: { fullName: 'Ananya Deshmukh', email: 'ananya@example.com' },
              city: 'Mumbai, MH',
              qualification: 'BSc Nursing',
              rating: { average: 4.9, count: 24 },
            },
            {
              _id: cg2Id,
              user: { fullName: 'Ritu Bansal', email: 'ritu@example.com' },
              city: 'Delhi, DL',
              qualification: 'GNM',
              rating: { average: 4.2, count: 8 },
            },
          ]),
      }),
    });

    Review.find = () =>
      Promise.resolve([
        { caregiver: cg1Id, rating: 5, isPublic: true },
        { caregiver: cg1Id, rating: 5, isPublic: true },
        { caregiver: cg2Id, rating: 4, isPublic: true },
      ]);

    const result = await reviewService.getAdminRatings();

    assert.ok(result.stats);
    assert.equal(result.stats.totalReviews, 3);
    assert.equal(result.stats.attention, 1, 'Caretakers under 4.5 marked as needs attention');
    assert.equal(result.rows.length, 2);
    assert.equal(result.rows[0].caregiverName, 'Ananya Deshmukh');
    assert.equal(result.rows[0].status, 'Good');
    assert.equal(result.rows[1].caregiverName, 'Ritu Bansal');
    assert.equal(result.rows[1].status, 'Needs attention');
    assert.equal(result.distribution.length, 5);
  } finally {
    CaregiverProfile.find = originalProfileFind;
    Review.find = originalReviewFind;
  }
});

// -----------------------------------------------------------------------------
// Test 8: Operational Report Generation with Valid CSV Representation
// -----------------------------------------------------------------------------
test('Step 13E - 8: generateAdminReport creates structured metadata and downloadable CSV dataset', async () => {
  const originalBookingFind = Booking.find;

  try {
    Booking.find = () => ({
      limit: () => ({
        populate: () => ({
          populate: () =>
            Promise.resolve([
              {
                _id: new mongoose.Types.ObjectId('507f191e810c19729de860ea'),
                serviceName: 'Post-Op Bedside Care',
                customer: { fullName: 'Priya Sharma' },
                caregiverUser: { fullName: 'Ananya Deshmukh' },
                startDateTime: new Date('2026-10-15T09:00:00Z'),
                status: 'completed',
                totalAmount: 3499,
              },
            ]),
        }),
      }),
    });

    const report = await adminAnalyticsService.generateAdminReport({
      type: 'Monthly booking & revenue report',
      period: 'Oct 2026',
      format: 'CSV',
    });

    assert.ok(report);
    assert.equal(report.title, 'Monthly booking & revenue report');
    assert.equal(report.format, 'CSV');
    assert.equal(report.status, 'Ready');
    assert.equal(report.rows, 1);
    assert.ok(report.csvContent.includes('"Booking ID","Service","Customer","Caregiver"'));
    assert.ok(report.csvContent.includes('"Post-Op Bedside Care","Priya Sharma","Ananya Deshmukh"'));
  } finally {
    Booking.find = originalBookingFind;
  }
});

// -----------------------------------------------------------------------------
// Test 9: CSV Formula Injection Neutralization (CWE-1236) & RFC 4180 Escaping
// -----------------------------------------------------------------------------
test('Step 13E - 9: sanitizeCsvCell neutralizes formula injection triggers and escapes quotes and newlines', () => {
  const { sanitizeCsvCell } = adminAnalyticsService;

  // 1. Formula triggers neutralized with prepended single quote (')
  assert.equal(sanitizeCsvCell('=1+1'), '"\'=1+1"');
  assert.equal(sanitizeCsvCell('=cmd|\' /C calc\'!A0'), '"\'=cmd|\' /C calc\'!A0"');
  assert.equal(sanitizeCsvCell('+1234567890'), '"\'+1234567890"');
  assert.equal(sanitizeCsvCell('-2+3*cmd'), '"\'-2+3*cmd"');
  assert.equal(sanitizeCsvCell('@SUM(1,2)'), '"\'@SUM(1,2)"');
  assert.equal(sanitizeCsvCell('\t=cmd'), '"\'\t=cmd"');
  assert.equal(sanitizeCsvCell('\r=calc'), '"\'\r=calc"');

  // 2. Dangerous triggers preceded by leading spaces or control characters
  assert.equal(sanitizeCsvCell('   =1+2'), '"\'   =1+2"');
  assert.equal(sanitizeCsvCell(' \t @malicious'), '"\' \t @malicious"');

  // 3. Legitimate numbers and decimals output as-is without single quote corruption
  assert.equal(sanitizeCsvCell(3499), '3499');
  assert.equal(sanitizeCsvCell(4.9), '4.9');
  assert.equal(sanitizeCsvCell('12500'), '12500');
  assert.equal(sanitizeCsvCell('-50'), '-50');

  // 4. Ordinary strings and dates quoted safely
  assert.equal(sanitizeCsvCell('Elder Care'), '"Elder Care"');
  assert.equal(sanitizeCsvCell('2026-10-19'), '"2026-10-19"');

  // 5. Quotes escaped by doubling (" -> "") and newlines preserved inside quotes
  assert.equal(sanitizeCsvCell('Dr. Smith, "MD"'), '"Dr. Smith, ""MD"""');
  assert.equal(sanitizeCsvCell('Line 1\nLine 2'), '"Line 1\nLine 2"');

  // 6. Null and undefined output as empty quoted cell
  assert.equal(sanitizeCsvCell(null), '""');
  assert.equal(sanitizeCsvCell(undefined), '""');
});

// -----------------------------------------------------------------------------
// Test 10: Caregiver Rating Recalculation & Zero-Review Handling
// -----------------------------------------------------------------------------
test('Step 13E - 10: recalculateCaregiverRating computes accurate rolling average and handles zero reviews', async () => {
  const originalAggregate = Review.aggregate;
  const originalFindByIdAndUpdate = CaregiverProfile.findByIdAndUpdate;

  try {
    const cgId = new mongoose.Types.ObjectId();
    let updatedPayload = null;

    CaregiverProfile.findByIdAndUpdate = (id, update) => {
      updatedPayload = update;
      return Promise.resolve({ _id: id, ...update });
    };

    // Scenario A: Caregiver has active reviews (4 and 5 stars)
    Review.aggregate = () => ({
      session: () => Promise.resolve([{ _id: cgId, count: 2, sum: 9 }]),
    });

    const resA = await reviewService.recalculateCaregiverRating(cgId);
    assert.equal(resA.count, 2);
    assert.equal(resA.average, 4.5);
    assert.equal(updatedPayload['rating.average'], 4.5);
    assert.equal(updatedPayload['rating.count'], 2);

    // Scenario B: Caregiver has 0 reviews (e.g. all non-public or none submitted)
    Review.aggregate = () => ({
      session: () => Promise.resolve([]),
    });

    const resB = await reviewService.recalculateCaregiverRating(cgId);
    assert.equal(resB.count, 0);
    assert.equal(resB.average, 5.0, 'Zero reviews default to baseline 5.0 rating');
    assert.equal(updatedPayload['rating.average'], 5.0);
    assert.equal(updatedPayload['rating.count'], 0);
  } finally {
    Review.aggregate = originalAggregate;
    CaregiverProfile.findByIdAndUpdate = originalFindByIdAndUpdate;
  }
});

// -----------------------------------------------------------------------------
// Test 11: Caregiver Lock Serializes Concurrent Operations
// -----------------------------------------------------------------------------
test('Step 13E - 11: withCaregiverLock serializes concurrent review operations for the same caregiver', async () => {
  const cgId = new mongoose.Types.ObjectId();
  const executionOrder = [];

  const task1 = reviewService.withCaregiverLock(cgId, async () => {
    executionOrder.push('task1_start');
    await new Promise((r) => setTimeout(r, 25));
    executionOrder.push('task1_end');
    return 'result1';
  });

  const task2 = reviewService.withCaregiverLock(cgId, async () => {
    executionOrder.push('task2_start');
    await new Promise((r) => setTimeout(r, 10));
    executionOrder.push('task2_end');
    return 'result2';
  });

  const [res1, res2] = await Promise.all([task1, task2]);

  assert.equal(res1, 'result1');
  assert.equal(res2, 'result2');
  assert.deepEqual(
    executionOrder,
    ['task1_start', 'task1_end', 'task2_start', 'task2_end'],
    'Concurrent tasks for same caregiver must strictly serialize',
  );
});

// -----------------------------------------------------------------------------
// Test 12: Fail-Closed Protection When Transactions Are Not Supported
// -----------------------------------------------------------------------------
test('Step 13E - 12: createReview fails closed with 503 if database does not support transactions', async () => {
  const originalClient = mongoose.connection.client;
  const originalBookingFindById = Booking.findById;
  const originalReviewFindOne = Review.findOne;

  try {
    // Simulate standalone MongoDB deployment (no replica set / sharding)
    mongoose.connection.client = {
      topology: { description: { type: 'Single' } },
    };

    const customerUser = { _id: new mongoose.Types.ObjectId(), role: 'customer', fullName: 'Test Customer' };
    const bookingId = new mongoose.Types.ObjectId();

    Booking.findById = () =>
      Promise.resolve({
        _id: bookingId,
        customer: customerUser._id,
        caregiver: new mongoose.Types.ObjectId(),
        caregiverUser: new mongoose.Types.ObjectId(),
        status: 'completed',
      });
    Review.findOne = () => Promise.resolve(null);

    await assert.rejects(
      async () => {
        await reviewService.createReview(customerUser, {
          bookingId: bookingId.toString(),
          rating: 5,
        });
      },
      (err) => {
        assert.equal(err.statusCode, 503);
        assert.match(err.message, /replica set/i);
        return true;
      },
      'Unsupported topology must fail closed with 503 without performing unsafe writes',
    );
  } finally {
    mongoose.connection.client = originalClient;
    Booking.findById = originalBookingFindById;
    Review.findOne = originalReviewFindOne;
  }
});

// -----------------------------------------------------------------------------
// Test 13: Automatic Retry on Transient Write Conflicts
// -----------------------------------------------------------------------------
test('Step 13E - 13: executeWithTransactionRetry automatically retries on transient write conflicts', async () => {
  const originalClient = mongoose.connection.client;
  const originalStartSession = mongoose.startSession;

  try {
    mongoose.connection.client = {
      topology: { description: { type: 'ReplicaSetWithPrimary' } },
    };

    let attempts = 0;
    mongoose.startSession = async () => ({
      withTransaction: async (cb) => {
        attempts++;
        if (attempts < 3) {
          const err = new Error('WriteConflict error: parallel transaction modified document');
          err.code = 112;
          throw err;
        }
        return cb();
      },
      endSession: async () => {},
    });

    let workExecuted = false;
    const result = await reviewService.executeWithTransactionRetry(async () => {
      workExecuted = true;
      return 'transaction_committed';
    });

    assert.equal(result, 'transaction_committed');
    assert.equal(workExecuted, true);
    assert.equal(attempts, 3, 'Should retry through 2 transient write conflicts and succeed on attempt 3');
  } finally {
    mongoose.connection.client = originalClient;
    mongoose.startSession = originalStartSession;
  }
});

// -----------------------------------------------------------------------------
// Test 14: Multi-Process / Distributed Safety on MongoDB Replica Set
// Demonstrates that concurrent review submissions across independent workers
// guarantee rating aggregate consistency and prevent stale updates.
// -----------------------------------------------------------------------------
test('Step 13E - 14: concurrent reviews across independent workers guarantee rating aggregate consistency on replica set', async () => {
  const replSet = await setupEphemeralReplicaSet();
  if (!replSet.supported) {
    console.log(`[SKIPPED] Ephemeral replica set not supported: ${replSet.reason}`);
    return;
  }

  // Connect to the isolated ephemeral replica set
  await mongoose.connect(replSet.uri);

  try {
    // 1. Seed verified caregiver user and profile
    const caregiverUser = await User.create({
      fullName: 'Ananya Roy',
      email: 'ananya.review.rs@test.com',
      passwordHash: 'dummyhash',
      role: 'caregiver',
      status: 'active',
    });

    const service = await Service.create({
      name: 'Elderly Bedside Care',
      slug: 'elderly-care-rs-test',
      description: 'Bedside monitoring',
      category: 'elderly_care',
      baseHourlyRate: 600,
      minimumDurationHours: 1,
      isActive: true,
    });

    const caregiverProfile = await CaregiverProfile.create({
      user: caregiverUser._id,
      qualification: 'BSc Nursing',
      city: 'Mumbai, MH',
      hourlyRate: 600,
      verificationStatus: 'verified',
      servicesOffered: [service._id],
      rating: { average: 5.0, count: 0 },
    });

    // 2. Seed 3 distinct customers and completed bookings for the same caregiver
    const customers = await Promise.all([
      User.create({ fullName: 'Customer One', email: 'c1.rs@test.com', passwordHash: 'dummyhash', role: 'customer', status: 'active' }),
      User.create({ fullName: 'Customer Two', email: 'c2.rs@test.com', passwordHash: 'dummyhash', role: 'customer', status: 'active' }),
      User.create({ fullName: 'Customer Three', email: 'c3.rs@test.com', passwordHash: 'dummyhash', role: 'customer', status: 'active' }),
    ]);

    const bookings = await Promise.all(
      customers.map((c, i) =>
        Booking.create({
          customer: c._id,
          caregiver: caregiverProfile._id,
          caregiverUser: caregiverUser._id,
          service: service._id,
          serviceName: service.name,
          serviceCategory: service.category,
          hourlyRate: 600,
          totalHours: 4,
          totalAmount: 2400,
          status: 'completed',
          startDateTime: new Date(`2026-10-0${i + 1}T10:00:00Z`),
          endDateTime: new Date(`2026-10-0${i + 1}T14:00:00Z`),
          location: { addressLine: '123 Marine Drive', city: 'Mumbai', careSetting: 'Home Care' },
          patientDetails: { name: `Patient ${i + 1}`, age: 70 },
        }),
      ),
    );

    // 3. Fire 3 concurrent review submissions simultaneously across independent worker invocations
    // Ratings: 5, 4, 3 -> Expected count: 3, average: (5 + 4 + 3) / 3 = 4.00
    const ratingsToSubmit = [5, 4, 3];

    const results = await Promise.all([
      reviewService.createReview(customers[0], {
        bookingId: bookings[0]._id.toString(),
        rating: ratingsToSubmit[0],
        comment: 'Excellent care!',
      }),
      reviewService.createReview(customers[1], {
        bookingId: bookings[1]._id.toString(),
        rating: ratingsToSubmit[1],
        comment: 'Very good assistance.',
      }),
      reviewService.createReview(customers[2], {
        bookingId: bookings[2]._id.toString(),
        rating: ratingsToSubmit[2],
        comment: 'Good overall.',
      }),
    ]);

    assert.equal(results.length, 3);

    // 4. Verify all 3 reviews were persisted in MongoDB
    const persistedReviews = await Review.find({ caregiver: caregiverProfile._id });
    assert.equal(persistedReviews.length, 3);

    // 5. Verify CaregiverProfile aggregate rating is exact and NOT stale
    const updatedProfile = await CaregiverProfile.findById(caregiverProfile._id);
    assert.equal(updatedProfile.rating.count, 3, 'All 3 reviews must be counted');
    assert.equal(updatedProfile.rating.average, 4.0, 'Average must strictly equal 4.0');
    assert.ok(
      updatedProfile.ratingLockVersion >= 3,
      'ratingLockVersion must have been incremented for each transaction',
    );
  } finally {
    await replSet.stop();
  }
});
