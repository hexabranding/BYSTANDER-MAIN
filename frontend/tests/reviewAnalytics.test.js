import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import {
  submitReview,
  getCaregiverReviews,
  replyToReview,
} from '../src/services/reviewService.js';
import {
  getAdminMetrics,
  getAdminRatings,
  getAdminCaregiverReviews,
  generateAdminReport,
} from '../src/services/adminService.js';

describe('Step 13E — Reviews & Operational Analytics Frontend Services', () => {
  let mockFetchCalls = [];

  const MOCK_REVIEW_ID = '6711b1b2c3d4e5f6a7b8d901';
  const MOCK_BOOKING_ID = '6711b1b2c3d4e5f6a7b8d902';
  const MOCK_CAREGIVER_ID = '6711b1b2c3d4e5f6a7b8d903';

  beforeEach(() => {
    mockFetchCalls = [];
    globalThis.fetch = async (url, options = {}) => {
      const urlStr = String(url);
      const method = (options.method || 'GET').toUpperCase();
      const body = options.body ? JSON.parse(options.body) : null;
      mockFetchCalls.push({ url: urlStr, method, body, headers: options.headers });

      // 1. POST /api/reviews — Submit review
      if (urlStr.endsWith('/api/reviews') && method === 'POST') {
        if (body.bookingId === 'duplicate-conflict-booking') {
          return new Response(
            JSON.stringify({
              success: false,
              error: 'ConflictError',
              message: 'A review has already been submitted for this booking engagement',
            }),
            { status: 409, headers: { 'Content-Type': 'application/json' } },
          );
        }

        if (body.bookingId === 'uncompleted-booking') {
          return new Response(
            JSON.stringify({
              success: false,
              error: 'ValidationError',
              message: 'Cannot submit a review for a booking that is not completed',
            }),
            { status: 400, headers: { 'Content-Type': 'application/json' } },
          );
        }

        return new Response(
          JSON.stringify({
            success: true,
            data: {
              review: {
                _id: MOCK_REVIEW_ID,
                booking: body.bookingId,
                rating: body.rating,
                comment: body.comment,
                criteria: body.criteria,
              },
              caregiverProfile: {
                _id: MOCK_CAREGIVER_ID,
                rating: { average: 5, count: 1 },
              },
            },
          }),
          { status: 201, headers: { 'Content-Type': 'application/json' } },
        );
      }

      // 2. GET /api/reviews/caregiver/:id — Public caregiver reviews
      if (urlStr.includes('/api/reviews/caregiver/') && method === 'GET') {
        return new Response(
          JSON.stringify({
            success: true,
            data: {
              reviews: [
                {
                  _id: MOCK_REVIEW_ID,
                  rating: 5,
                  comment: 'Outstanding support and prompt care.',
                  authorName: 'Aarav Sharma',
                  createdAt: '2026-10-19T10:00:00.000Z',
                },
              ],
              pagination: { total: 1, page: 1, limit: 10, totalPages: 1 },
            },
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } },
        );
      }

      // 3. POST /api/reviews/:id/reply — Caregiver response
      if (urlStr.includes('/reply') && method === 'POST') {
        return new Response(
          JSON.stringify({
            success: true,
            data: {
              _id: MOCK_REVIEW_ID,
              reply: body.reply,
              replyAt: '2026-10-19T11:00:00.000Z',
            },
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } },
        );
      }

      // 4. GET /api/admin/metrics — Executive analytics
      if (urlStr.endsWith('/api/admin/metrics') && method === 'GET') {
        return new Response(
          JSON.stringify({
            success: true,
            data: {
              stats: {
                customers: 42,
                caregivers: 18,
                active: 7,
                completed: 25,
                cancelled: 2,
                gross: 125000,
                revenue: 15000,
                avgValue: 4630,
                completionRate: 93,
              },
              bookingActivity: [
                { month: 'Oct 2026', bookings: 27, completed: 25, cancelled: 2 },
              ],
              revenueSplit: [
                { month: 'Oct 2026', revenue: 125000, commission: 15000, payout: 110000 },
              ],
              serviceDistribution: [
                { name: 'Elder Care', value: 15, percentage: 55, fill: '#0F766E' },
              ],
              cityDistribution: [
                { city: 'Mumbai', bookings: 20 },
              ],
              recentBookings: [],
              recentRegistrations: [],
              activeSos: [],
            },
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } },
        );
      }

      // 5. GET /api/admin/ratings — Caregiver ratings directory
      if (urlStr.includes('/api/admin/ratings') && !urlStr.includes('/reviews') && method === 'GET') {
        return new Response(
          JSON.stringify({
            success: true,
            data: {
              rows: [
                {
                  id: 'CR-101',
                  caregiverProfileId: MOCK_CAREGIVER_ID,
                  name: 'Dr. Priya Desai',
                  city: 'Mumbai',
                  service: 'Elder Care',
                  rating: 4.9,
                  reviews: 24,
                  status: 'Exceeding SLA',
                  dist: { 5: 22, 4: 2, 3: 0, 2: 0, 1: 0 },
                },
              ],
              stats: {
                average: '4.90',
                totalReviews: 24,
                fiveShare: 92,
                attention: 0,
              },
              distribution: [
                { stars: '5 stars', count: 22 },
                { stars: '4 stars', count: 2 },
                { stars: '3 stars', count: 0 },
                { stars: '2 stars', count: 0 },
                { stars: '1 star', count: 0 },
              ],
              pagination: { total: 1, page: 1, limit: 10, totalPages: 1 },
            },
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } },
        );
      }

      // 6. GET /api/admin/ratings/:id/reviews — Caregiver review audit trail
      if (urlStr.includes('/api/admin/ratings/') && urlStr.includes('/reviews') && method === 'GET') {
        return new Response(
          JSON.stringify({
            success: true,
            data: {
              reviews: [
                {
                  id: MOCK_REVIEW_ID,
                  customer: 'Aarav Sharma',
                  rating: 5,
                  comment: 'Exceptional elder assistance.',
                  createdAt: '2026-10-19T09:30:00.000Z',
                },
              ],
            },
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } },
        );
      }

      // 7. POST /api/admin/reports/generate — CSV / PDF report generation
      if (urlStr.endsWith('/api/admin/reports/generate') && method === 'POST') {
        return new Response(
          JSON.stringify({
            success: true,
            data: {
              report: {
                id: 'RP-20261019-9901',
                title: body.type,
                period: body.period,
                generatedOn: '2026-10-19',
                rows: 42,
                size: '12.4 KB',
                status: 'Ready',
                format: body.format || 'CSV',
              },
              csvContent: '\"Report\",\"Monthly booking & revenue report\"\n\"ID\",\"RP-01\"\n',
            },
          }),
          { status: 201, headers: { 'Content-Type': 'application/json' } },
        );
      }

      return new Response(JSON.stringify({ success: false, message: 'Not found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' },
      });
    };
  });

  it('submitReview sends POST /api/reviews with required payload', async () => {
    const res = await submitReview({
      bookingId: MOCK_BOOKING_ID,
      rating: 5,
      comment: 'Excellent and punctual care.',
      criteria: { punctuality: 5, hygiene: 5, communication: 5, expertise: 5 },
    });

    assert.equal(mockFetchCalls.length, 1);
    assert.match(mockFetchCalls[0].url, /\/api\/reviews$/);
    assert.equal(mockFetchCalls[0].method, 'POST');
    assert.equal(mockFetchCalls[0].body.rating, 5);
    assert.equal(mockFetchCalls[0].body.bookingId, MOCK_BOOKING_ID);
    assert.equal(res.review.rating, 5);
    assert.equal(res.caregiverProfile.rating.count, 1);
  });

  it('getCaregiverReviews fetches public review directory', async () => {
    const res = await getCaregiverReviews(MOCK_CAREGIVER_ID, { page: 1, limit: 10 });

    assert.equal(mockFetchCalls.length, 1);
    assert.match(mockFetchCalls[0].url, new RegExp(`/api/reviews/caregiver/${MOCK_CAREGIVER_ID}`));
    assert.equal(mockFetchCalls[0].method, 'GET');
    assert.equal(res.reviews.length, 1);
    assert.equal(res.reviews[0].rating, 5);
    assert.equal(res.reviews[0].authorName, 'Aarav Sharma');
  });

  it('replyToReview submits caregiver reply', async () => {
    const res = await replyToReview(MOCK_REVIEW_ID, 'Thank you for your trust and kind words.');

    assert.equal(mockFetchCalls.length, 1);
    assert.match(mockFetchCalls[0].url, new RegExp(`/api/reviews/${MOCK_REVIEW_ID}/reply`));
    assert.equal(mockFetchCalls[0].method, 'POST');
    assert.equal(mockFetchCalls[0].body.reply, 'Thank you for your trust and kind words.');
    assert.ok(res.reply);
  });

  it('getAdminMetrics returns operational stats and aggregation datasets', async () => {
    const metrics = await getAdminMetrics();

    assert.equal(mockFetchCalls.length, 1);
    assert.match(mockFetchCalls[0].url, /\/api\/admin\/metrics$/);
    assert.equal(metrics.stats.customers, 42);
    assert.equal(metrics.stats.completionRate, 93);
    assert.equal(metrics.bookingActivity.length, 1);
    assert.equal(metrics.serviceDistribution[0].name, 'Elder Care');
  });

  it('getAdminRatings returns directory rows and distribution statistics', async () => {
    const data = await getAdminRatings({ page: 1 });

    assert.equal(mockFetchCalls.length, 1);
    assert.match(mockFetchCalls[0].url, /\/api\/admin\/ratings/);
    assert.equal(data.rows.length, 1);
    assert.equal(data.rows[0].caregiverProfileId, MOCK_CAREGIVER_ID);
    assert.equal(data.stats.average, '4.90');
    assert.equal(data.distribution.length, 5);
  });

  it('getAdminCaregiverReviews returns specific caregiver reviews', async () => {
    const reviews = await getAdminCaregiverReviews(MOCK_CAREGIVER_ID);

    assert.equal(mockFetchCalls.length, 1);
    assert.match(mockFetchCalls[0].url, new RegExp(`/api/admin/ratings/${MOCK_CAREGIVER_ID}/reviews`));
    assert.equal(reviews.length, 1);
    assert.equal(reviews[0].customer, 'Aarav Sharma');
  });

  it('generateAdminReport submits generation request and receives CSV payload', async () => {
    const res = await generateAdminReport({
      type: 'Monthly booking & revenue report',
      period: 'Oct 2026',
      format: 'CSV',
    });

    assert.equal(mockFetchCalls.length, 1);
    assert.match(mockFetchCalls[0].url, /\/api\/admin\/reports\/generate$/);
    assert.equal(mockFetchCalls[0].method, 'POST');
    assert.equal(res.report.title, 'Monthly booking & revenue report');
    assert.ok(res.csvContent.includes('Report'));
  });

  it('submitReview rejects client-side when bookingId is missing', async () => {
    await assert.rejects(
      async () => submitReview({ rating: 5, comment: 'Missing booking' }),
      /A booking identifier is required/,
    );
  });

  it('submitReview propagates 409 conflict on duplicate review submission without fake success', async () => {
    await assert.rejects(
      async () =>
        submitReview({
          bookingId: 'duplicate-conflict-booking',
          rating: 4,
          comment: 'Duplicate attempt',
        }),
      (err) => {
        assert.equal(err.status, 409);
        assert.match(err.message, /already been submitted/i);
        return true;
      },
    );
  });

  it('submitReview propagates 400 validation error when shift is not completed', async () => {
    await assert.rejects(
      async () =>
        submitReview({
          bookingId: 'uncompleted-booking',
          rating: 3,
          comment: 'Early review',
        }),
      (err) => {
        assert.equal(err.status, 400);
        assert.match(err.message, /not completed/i);
        return true;
      },
    );
  });
});
