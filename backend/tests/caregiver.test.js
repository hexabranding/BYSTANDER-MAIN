import test from 'node:test';
import assert from 'node:assert/strict';
import mongoose from 'mongoose';
import {
  validateUpdateCaregiverProfile,
  validateCaregiverAvailability,
  isValidCalendarDate,
  getTodayInTimezone,
  PERMITTED_CAREGIVER_UPDATE_FIELDS,
} from '../src/middleware/validateCaregiver.js';
import { authorizeRoles } from '../src/middleware/auth.js';
import * as caregiverService from '../src/services/caregiverService.js';
import { CaregiverProfile, User, Service } from '../src/models/index.js';

// Helper to simulate Express req, res, next
const createMockReqRes = (options = {}) => {
  const req = {
    body: options.body || {},
    params: options.params || {},
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
  const next = (err) => {
    nextCalled = true;
    nextError = err;
  };

  return { req, res, next, getNextCalled: () => nextCalled, getNextError: () => nextError };
};

// -----------------------------------------------------------------------------
// Test 1: Protected-Field Injection Prevention
// -----------------------------------------------------------------------------
test('Step 6 - 1: validateUpdateCaregiverProfile strips all protected fields', () => {
  const maliciousPayload = {
    bio: 'Experienced trauma nurse.',
    hourlyRate: 650,
    // Attempted field injections:
    verificationStatus: 'verified',
    role: 'admin',
    user: '507f1f77bcf86cd799439099',
    userId: '507f1f77bcf86cd799439099',
    trustScore: 100,
    completedJobs: 999,
    rating: { average: 5.0, count: 500 },
    nursingRegNo: 'HACKED-REG-NO',
    status: 'active',
    badges: ['Top Rated'],
    _id: '507f1f77bcf86cd799439099',
  };

  const { req, res, next, getNextCalled } = createMockReqRes({ body: maliciousPayload });
  validateUpdateCaregiverProfile(req, res, next);

  assert.equal(getNextCalled(), true);
  const updates = req.sanitizedUpdates;

  // Permitted fields must exist
  assert.equal(updates.bio, 'Experienced trauma nurse.');
  assert.equal(updates.hourlyRate, 650);

  // Protected fields MUST NOT exist in sanitized updates
  assert.equal('verificationStatus' in updates, false);
  assert.equal('role' in updates, false);
  assert.equal('user' in updates, false);
  assert.equal('userId' in updates, false);
  assert.equal('trustScore' in updates, false);
  assert.equal('completedJobs' in updates, false);
  assert.equal('rating' in updates, false);
  assert.equal('nursingRegNo' in updates, false);
  assert.equal('status' in updates, false);
  assert.equal('badges' in updates, false);
  assert.equal('_id' in updates, false);
});

// -----------------------------------------------------------------------------
// Test 2: Caregiver Profile Validation Rules
// -----------------------------------------------------------------------------
test('Step 6 - 2: validateUpdateCaregiverProfile rejects negative rates and invalid settings', () => {
  // Negative rate
  const { req: req1, res: res1, next: next1 } = createMockReqRes({
    body: { hourlyRate: -100 },
  });
  validateUpdateCaregiverProfile(req1, res1, next1);
  assert.equal(res1.statusCode, 400);
  assert.equal(res1.jsonData.error, 'ValidationError');

  // Excessive distance
  const { req: req2, res: res2, next: next2 } = createMockReqRes({
    body: { maxDistanceKm: 250 }, // max is 100
  });
  validateUpdateCaregiverProfile(req2, res2, next2);
  assert.equal(res2.statusCode, 400);

  // Invalid care setting
  const { req: req3, res: res3, next: next3 } = createMockReqRes({
    body: { careSettings: ['Cruise Ship Care'] },
  });
  validateUpdateCaregiverProfile(req3, res3, next3);
  assert.equal(res3.statusCode, 400);

  // Invalid availability status
  const { req: req4, res: res4, next: next4 } = createMockReqRes({
    body: { availabilityStatus: 'Sleeping' },
  });
  validateUpdateCaregiverProfile(req4, res4, next4);
  assert.equal(res4.statusCode, 400);
});

// -----------------------------------------------------------------------------
// Test 3: Availability Timezone & Schedule Validation
// -----------------------------------------------------------------------------
test('Step 6 - 3: validateCaregiverAvailability validates IANA timezones and intervals', () => {
  // Invalid timezone
  const { req: req1, res: res1, next: next1 } = createMockReqRes({
    body: { timezone: 'Mars/Phobos' },
  });
  validateCaregiverAvailability(req1, res1, next1);
  assert.equal(res1.statusCode, 400);
  assert.ok(res1.jsonData.message.includes('Invalid IANA timezone'));

  // Valid timezone passes
  const { req: req2, res: res2, next: next2, getNextCalled: called2 } = createMockReqRes({
    body: { timezone: 'Asia/Kolkata' },
  });
  validateCaregiverAvailability(req2, res2, next2);
  assert.equal(called2(), true);
});

// -----------------------------------------------------------------------------
// Test 4: Overlapping Time Intervals & Ordering Validation
// -----------------------------------------------------------------------------
test('Step 6 - 4: Overlapping intervals and inverted start/end times are rejected', () => {
  // Inverted start/end (start > end)
  const { req: req1, res: res1, next: next1 } = createMockReqRes({
    body: {
      weeklySchedule: [
        {
          day: 'Mon',
          isAvailable: true,
          slots: [{ start: '18:00', end: '09:00' }], // start > end
        },
      ],
    },
  });
  validateCaregiverAvailability(req1, res1, next1);
  assert.equal(res1.statusCode, 400);
  assert.ok(res1.jsonData.message.includes('must be strictly before end time'));

  // Overlapping slots on same day: [09:00 - 13:00] and [12:00 - 16:00]
  const { req: req2, res: res2, next: next2 } = createMockReqRes({
    body: {
      weeklySchedule: [
        {
          day: 'Mon',
          isAvailable: true,
          slots: [
            { start: '09:00', end: '13:00' },
            { start: '12:00', end: '16:00' }, // overlaps!
          ],
        },
      ],
    },
  });
  validateCaregiverAvailability(req2, res2, next2);
  assert.equal(res2.statusCode, 400);
  assert.ok(res2.jsonData.message.includes('Overlapping intervals detected'));

  // Non-overlapping slots pass with complete 7-day schedule
  const fullValidSchedule = [
    {
      day: 'Mon',
      isAvailable: true,
      slots: [
        { start: '08:00', end: '12:00' },
        { start: '13:00', end: '17:00' }, // clean break
      ],
    },
    { day: 'Tue', isAvailable: true, slots: [{ start: '08:00', end: '16:00' }] },
    { day: 'Wed', isAvailable: true, slots: [{ start: '08:00', end: '16:00' }] },
    { day: 'Thu', isAvailable: true, slots: [{ start: '08:00', end: '16:00' }] },
    { day: 'Fri', isAvailable: true, slots: [{ start: '08:00', end: '16:00' }] },
    { day: 'Sat', isAvailable: true, slots: [{ start: '09:00', end: '15:00' }] },
    { day: 'Sun', isAvailable: false, slots: [] },
  ];

  const { req: req3, res: res3, next: next3, getNextCalled: called3 } = createMockReqRes({
    body: {
      weeklySchedule: fullValidSchedule,
    },
  });
  validateCaregiverAvailability(req3, res3, next3);
  assert.equal(called3(), true);
});

// -----------------------------------------------------------------------------
// Test 5: Date Exception Validation & Duplicate Date Rejection
// -----------------------------------------------------------------------------
test('Step 6 - 5: Date exceptions enforce YYYY-MM-DD and reject duplicate dates', () => {
  // Invalid date format
  const { req: req1, res: res1, next: next1 } = createMockReqRes({
    body: {
      dateExceptions: [{ date: '05/11/2026', isAvailable: false }],
    },
  });
  validateCaregiverAvailability(req1, res1, next1);
  assert.equal(res1.statusCode, 400);

  // Duplicate date entry in exceptions
  const { req: req2, res: res2, next: next2 } = createMockReqRes({
    body: {
      dateExceptions: [
        { date: '2026-11-05', isAvailable: false, reason: 'Leave' },
        { date: '2026-11-05', isAvailable: true, reason: 'Duplicate' },
      ],
    },
  });
  validateCaregiverAvailability(req2, res2, next2);
  assert.equal(res2.statusCode, 400);
  assert.ok(res2.jsonData.message.includes('Duplicate date exception'));

  // Valid date exception passes
  const { req: req3, res: res3, next: next3, getNextCalled: called3 } = createMockReqRes({
    body: {
      dateExceptions: [
        { date: '2026-11-05', isAvailable: false, reason: 'Medical appointment' },
        { date: '2026-11-06', isAvailable: true, slots: [{ start: '10:00', end: '14:00' }] },
      ],
    },
  });
  validateCaregiverAvailability(req3, res3, next3);
  assert.equal(called3(), true);
});

// -----------------------------------------------------------------------------
// Test 6: RBAC — Caregiver Endpoints Reject Customers and Admins
// -----------------------------------------------------------------------------
test('Step 6 - 6: Caregiver-only endpoints strictly reject customer and admin roles', () => {
  const caregiverOnly = authorizeRoles('caregiver');

  // Customer attempting access -> 403 Forbidden
  const { req: reqCustomer, res: resCustomer, next: nextCustomer } = createMockReqRes({
    user: { role: 'customer' },
  });
  caregiverOnly(reqCustomer, resCustomer, nextCustomer);
  assert.equal(resCustomer.statusCode, 403);
  assert.equal(resCustomer.jsonData.error, 'Forbidden');

  // Admin attempting access -> 403 Forbidden
  const { req: reqAdmin, res: resAdmin, next: nextAdmin } = createMockReqRes({
    user: { role: 'admin' },
  });
  caregiverOnly(reqAdmin, resAdmin, nextAdmin);
  assert.equal(resAdmin.statusCode, 403);

  // Caregiver allowed
  const { req: reqCaregiver, res: resCaregiver, next: nextCaregiver, getNextCalled } =
    createMockReqRes({
      user: { role: 'caregiver' },
    });
  caregiverOnly(reqCaregiver, resCaregiver, nextCaregiver);
  assert.equal(getNextCalled(), true);
});

// -----------------------------------------------------------------------------
// Test 7: Public Profile Privacy Protection (Leakage Defense)
// -----------------------------------------------------------------------------
test('Step 6 - 7: Public profile lookup rejects invalid ID with 404', async () => {
  await assert.rejects(
    async () => {
      await caregiverService.getPublicCaregiverProfileById('not-an-id');
    },
    (err) => {
      assert.equal(err.statusCode, 404);
      assert.equal(err.name, 'NotFoundError');
      return true;
    },
  );
});

// -----------------------------------------------------------------------------
// Test 8: HTTP Network Route Enforcement on Ephemeral Server
// -----------------------------------------------------------------------------
test('Step 6 - 8: HTTP routes enforce 401 unauthenticated and 404 invalid caregiver ID', async () => {
  const http = await import('http');
  const { default: app } = await import('../src/server.js');

  const server = http.createServer(app);
  await new Promise((resolve) => server.listen(0, resolve));
  const port = server.address().port;

  try {
    // 1. Unauthenticated GET /api/caregiver/profile -> 401
    const res1 = await fetch(`http://localhost:${port}/api/caregiver/profile`);
    assert.equal(res1.status, 401);
    const data1 = await res1.json();
    assert.equal(data1.error, 'Unauthorized');

    // 2. Unauthenticated PATCH /api/caregiver/profile -> 401
    const res2 = await fetch(`http://localhost:${port}/api/caregiver/profile`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ bio: 'Test' }),
    });
    assert.equal(res2.status, 401);

    // 3. Unauthenticated GET /api/caregiver/availability -> 401
    const res3 = await fetch(`http://localhost:${port}/api/caregiver/availability`);
    assert.equal(res3.status, 401);

    // 4. Unauthenticated PUT /api/caregiver/availability -> 401
    const res4 = await fetch(`http://localhost:${port}/api/caregiver/availability`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ timezone: 'Asia/Kolkata' }),
    });
    assert.equal(res4.status, 401);

    // 5. Public GET /api/caregivers/:id with invalid ID -> 404
    const res5 = await fetch(`http://localhost:${port}/api/caregivers/malformed-id-123`);
    assert.equal(res5.status, 404);
    const data5 = await res5.json();
    assert.equal(data5.error, 'NotFoundError');
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});

// -----------------------------------------------------------------------------
// Test 9: Service ID Validation & Realistic Numeric Boundaries
// -----------------------------------------------------------------------------
test('Step 6 - 9: validateUpdateCaregiverProfile validates servicesOffered ObjectIds & numeric bounds', () => {
  // 1. Invalid service ID format (not a 24-char hex)
  const { req: req1, res: res1, next: next1 } = createMockReqRes({
    body: { servicesOffered: ['not-a-valid-id'] },
  });
  validateUpdateCaregiverProfile(req1, res1, next1);
  assert.equal(res1.statusCode, 400);
  assert.equal(res1.jsonData.error, 'ValidationError');
  assert.ok(res1.jsonData.message.includes('valid 24-character hexadecimal ObjectId'));

  // 2. Non-array servicesOffered
  const { req: req2, res: res2, next: next2 } = createMockReqRes({
    body: { servicesOffered: '507f1f77bcf86cd799439099' },
  });
  validateUpdateCaregiverProfile(req2, res2, next2);
  assert.equal(res2.statusCode, 400);

  // 3. Excessive experience years (> 50)
  const { req: req3, res: res3, next: next3 } = createMockReqRes({
    body: { experienceYears: 75 },
  });
  validateUpdateCaregiverProfile(req3, res3, next3);
  assert.equal(res3.statusCode, 400);
  assert.ok(res3.jsonData.message.includes('Experience years must be a number between 0 and 50'));

  // 4. Excessive hourly rate (> 50000)
  const { req: req4, res: res4, next: next4 } = createMockReqRes({
    body: { hourlyRate: 99999 },
  });
  validateUpdateCaregiverProfile(req4, res4, next4);
  assert.equal(res4.statusCode, 400);
  assert.ok(res4.jsonData.message.includes('cannot exceed ₹50,000'));

  // 5. Valid servicesOffered and bounds pass
  const validServiceId = new mongoose.Types.ObjectId().toString();
  const { req: req5, res: res5, next: next5, getNextCalled: called5 } = createMockReqRes({
    body: {
      servicesOffered: [validServiceId],
      experienceYears: 10,
      hourlyRate: 650,
    },
  });
  validateUpdateCaregiverProfile(req5, res5, next5);
  assert.equal(called5(), true);
  assert.deepEqual(req5.sanitizedUpdates.servicesOffered, [validServiceId]);
  assert.equal(req5.sanitizedUpdates.experienceYears, 10);
  assert.equal(req5.sanitizedUpdates.hourlyRate, 650);
});

// -----------------------------------------------------------------------------
// Test 10: Service Catalog Verification (validateServicesExistAndActive)
// -----------------------------------------------------------------------------
test('Step 6 - 10: validateServicesExistAndActive checks catalog existence and active status', async () => {
  // Non-array input
  await assert.rejects(
    async () => {
      await caregiverService.validateServicesExistAndActive('not-an-array');
    },
    (err) => {
      assert.equal(err.statusCode, 400);
      assert.equal(err.name, 'ValidationError');
      return true;
    },
  );

  // Invalid ObjectId syntax
  await assert.rejects(
    async () => {
      await caregiverService.validateServicesExistAndActive(['invalid-hex-id']);
    },
    (err) => {
      assert.equal(err.statusCode, 400);
      assert.ok(err.message.includes('not a valid ObjectId'));
      return true;
    },
  );

  // Empty array passes
  const emptyRes = await caregiverService.validateServicesExistAndActive([]);
  assert.deepEqual(emptyRes, []);

  // Mock Service.find to test catalog verification
  const originalFind = Service.find;
  const activeServiceId = new mongoose.Types.ObjectId();
  const inactiveServiceId = new mongoose.Types.ObjectId();
  const missingServiceId = new mongoose.Types.ObjectId();

  try {
    // Scenario A: Service does not exist in catalog
    Service.find = () => ({
      select: async () => [],
    });

    await assert.rejects(
      async () => {
        await caregiverService.validateServicesExistAndActive([missingServiceId.toString()]);
      },
      (err) => {
        assert.equal(err.statusCode, 400);
        assert.ok(err.message.includes('does not exist in the service catalog'));
        return true;
      },
    );

    // Scenario B: Service is inactive
    Service.find = () => ({
      select: async () => [
        { _id: inactiveServiceId, name: 'Archived Pediatric Care', isActive: false },
      ],
    });

    await assert.rejects(
      async () => {
        await caregiverService.validateServicesExistAndActive([inactiveServiceId.toString()]);
      },
      (err) => {
        assert.equal(err.statusCode, 400);
        assert.ok(err.message.includes('is inactive and cannot be selected'));
        return true;
      },
    );

    // Scenario C: Service is active
    Service.find = () => ({
      select: async () => [
        { _id: activeServiceId, name: 'Bedside Patient Attendant', isActive: true },
      ],
    });

    const validated = await caregiverService.validateServicesExistAndActive([activeServiceId.toString()]);
    assert.equal(validated.length, 1);
    assert.equal(validated[0].toString(), activeServiceId.toString());
  } finally {
    Service.find = originalFind;
  }
});

// -----------------------------------------------------------------------------
// Test 11: Real Calendar Date Validity & Leap Years
// -----------------------------------------------------------------------------
test('Step 6 - 11: Real calendar date validity and leap-year rules', () => {
  // Leap years: 2024 and 2028 are leap years; 2025 and 2026 are not
  assert.equal(isValidCalendarDate('2024-02-29'), true, '2024-02-29 is a valid leap day');
  assert.equal(isValidCalendarDate('2028-02-29'), true, '2028-02-29 is a valid leap day');
  assert.equal(isValidCalendarDate('2025-02-29'), false, '2025-02-29 is not a leap day');
  assert.equal(isValidCalendarDate('2026-02-29'), false, '2026-02-29 is not a leap day');

  // Impossible days and months
  assert.equal(isValidCalendarDate('2026-02-31'), false, 'Feb 31 is impossible');
  assert.equal(isValidCalendarDate('2026-13-45'), false, 'Month 13 / day 45 is impossible');
  assert.equal(isValidCalendarDate('2026-04-31'), false, 'April has only 30 days');
  assert.equal(isValidCalendarDate('2026-11-31'), false, 'November has only 30 days');
  assert.equal(isValidCalendarDate('2026-12-31'), true, 'Dec 31 is valid');

  // validateCaregiverAvailability rejects impossible calendar dates
  const { req, res, next } = createMockReqRes({
    body: {
      dateExceptions: [{ date: '2026-02-31', isAvailable: false }],
    },
  });
  validateCaregiverAvailability(req, res, next);
  assert.equal(res.statusCode, 400);
  assert.ok(res.jsonData.message.includes('Must be a real calendar date'));
});

// -----------------------------------------------------------------------------
// Test 12: Past Dates & Date Exception Slot Constraints
// -----------------------------------------------------------------------------
test('Step 6 - 12: Date exceptions reject past dates and enforce slot rules', () => {
  // 1. Past date rejection
  const { req: req1, res: res1, next: next1 } = createMockReqRes({
    body: {
      timezone: 'Asia/Kolkata',
      dateExceptions: [{ date: '2020-01-01', isAvailable: false }],
    },
  });
  validateCaregiverAvailability(req1, res1, next1);
  assert.equal(res1.statusCode, 400);
  assert.ok(res1.jsonData.message.includes('cannot be in the past'));

  // 2. Available date exception without slots (rejected)
  const { req: req2, res: res2, next: next2 } = createMockReqRes({
    body: {
      dateExceptions: [{ date: '2028-11-15', isAvailable: true, slots: [] }],
    },
  });
  validateCaregiverAvailability(req2, res2, next2);
  assert.equal(res2.statusCode, 400);
  assert.ok(res2.jsonData.message.includes('marked as available must include at least one valid time slot'));

  // 3. Unavailable date exception with active slots (rejected)
  const { req: req3, res: res3, next: next3 } = createMockReqRes({
    body: {
      dateExceptions: [
        {
          date: '2028-11-15',
          isAvailable: false,
          slots: [{ start: '09:00', end: '17:00' }],
        },
      ],
    },
  });
  validateCaregiverAvailability(req3, res3, next3);
  assert.equal(res3.statusCode, 400);
  assert.ok(res3.jsonData.message.includes('marked as unavailable must not have active time slots'));
});

// -----------------------------------------------------------------------------
// Test 13: Weekly Schedule Complete 7-Day Enforcement
// -----------------------------------------------------------------------------
test('Step 6 - 13: Weekly schedule enforces complete 7-day schedule & slot rules', () => {
  // 1. Incomplete schedule (missing Tue-Sun)
  const { req: req1, res: res1, next: next1 } = createMockReqRes({
    body: {
      weeklySchedule: [{ day: 'Mon', isAvailable: true, slots: [{ start: '08:00', end: '16:00' }] }],
    },
  });
  validateCaregiverAvailability(req1, res1, next1);
  assert.equal(res1.statusCode, 400);
  assert.ok(res1.jsonData.message.includes('Weekly schedule is incomplete. Missing weekdays'));
  assert.ok(res1.jsonData.message.includes('All 7 weekdays (Mon-Sun) are required'));

  // 2. Duplicate weekday entry
  const { req: req2, res: res2, next: next2 } = createMockReqRes({
    body: {
      weeklySchedule: [
        { day: 'Mon', isAvailable: true, slots: [{ start: '08:00', end: '16:00' }] },
        { day: 'Mon', isAvailable: false, slots: [] },
      ],
    },
  });
  validateCaregiverAvailability(req2, res2, next2);
  assert.equal(res2.statusCode, 400);
  assert.ok(res2.jsonData.message.includes("Duplicate weekday entry for 'Mon'"));

  // 3. Invalid weekday name
  const { req: req3, res: res3, next: next3 } = createMockReqRes({
    body: {
      weeklySchedule: [{ day: 'Monday', isAvailable: true, slots: [{ start: '08:00', end: '16:00' }] }],
    },
  });
  validateCaregiverAvailability(req3, res3, next3);
  assert.equal(res3.statusCode, 400);
  assert.ok(res3.jsonData.message.includes("Weekday 'Monday' is invalid"));

  // 4. Available weekday without slots
  const scheduleWithoutSlots = [
    { day: 'Mon', isAvailable: true, slots: [] }, // missing slots!
    { day: 'Tue', isAvailable: true, slots: [{ start: '08:00', end: '16:00' }] },
    { day: 'Wed', isAvailable: true, slots: [{ start: '08:00', end: '16:00' }] },
    { day: 'Thu', isAvailable: true, slots: [{ start: '08:00', end: '16:00' }] },
    { day: 'Fri', isAvailable: true, slots: [{ start: '08:00', end: '16:00' }] },
    { day: 'Sat', isAvailable: true, slots: [{ start: '09:00', end: '15:00' }] },
    { day: 'Sun', isAvailable: false, slots: [] },
  ];
  const { req: req4, res: res4, next: next4 } = createMockReqRes({
    body: { weeklySchedule: scheduleWithoutSlots },
  });
  validateCaregiverAvailability(req4, res4, next4);
  assert.equal(res4.statusCode, 400);
  assert.ok(res4.jsonData.message.includes("Weekday 'Mon' marked as available must include at least one valid time slot"));

  // 5. Unavailable weekday with active slots
  const scheduleWithUnavailableSlots = [
    { day: 'Mon', isAvailable: true, slots: [{ start: '08:00', end: '16:00' }] },
    { day: 'Tue', isAvailable: true, slots: [{ start: '08:00', end: '16:00' }] },
    { day: 'Wed', isAvailable: true, slots: [{ start: '08:00', end: '16:00' }] },
    { day: 'Thu', isAvailable: true, slots: [{ start: '08:00', end: '16:00' }] },
    { day: 'Fri', isAvailable: true, slots: [{ start: '08:00', end: '16:00' }] },
    { day: 'Sat', isAvailable: true, slots: [{ start: '09:00', end: '15:00' }] },
    { day: 'Sun', isAvailable: false, slots: [{ start: '08:00', end: '16:00' }] }, // slots on unavailable day!
  ];
  const { req: req5, res: res5, next: next5 } = createMockReqRes({
    body: { weeklySchedule: scheduleWithUnavailableSlots },
  });
  validateCaregiverAvailability(req5, res5, next5);
  assert.equal(res5.statusCode, 400);
  assert.ok(res5.jsonData.message.includes("Weekday 'Sun' marked as unavailable must not have active time slots"));
});

// -----------------------------------------------------------------------------
// Test 14: Public Profile Ineligibility Matrix & Sanitization
// -----------------------------------------------------------------------------
test('Step 6 - 14: Public profile enforces ineligibility rules and shields private fields', async () => {
  const originalFindOne = CaregiverProfile.findOne;
  const testCaregiverId = new mongoose.Types.ObjectId().toString();

  try {
    // 1. Pending verification caregiver -> 404
    CaregiverProfile.findOne = () => ({
      populate: () => ({
        populate: async () => null, // query with verificationStatus: 'verified' finds nothing
      }),
    });
    await assert.rejects(
      async () => {
        await caregiverService.getPublicCaregiverProfileById(testCaregiverId);
      },
      (err) => {
        assert.equal(err.statusCode, 404);
        assert.equal(err.name, 'NotFoundError');
        return true;
      },
    );

    // 2. Verified caregiver but suspended user account -> 404
    CaregiverProfile.findOne = () => ({
      populate: () => ({
        populate: async () => ({
          _id: testCaregiverId,
          verificationStatus: 'verified',
          user: { fullName: 'John Doe', status: 'suspended' },
        }),
      }),
    });
    await assert.rejects(
      async () => {
        await caregiverService.getPublicCaregiverProfileById(testCaregiverId);
      },
      (err) => {
        assert.equal(err.statusCode, 404);
        return true;
      },
    );

    // 3. Verified caregiver but blocked user account -> 404
    CaregiverProfile.findOne = () => ({
      populate: () => ({
        populate: async () => ({
          _id: testCaregiverId,
          verificationStatus: 'verified',
          user: { fullName: 'John Doe', status: 'blocked' },
        }),
      }),
    });
    await assert.rejects(
      async () => {
        await caregiverService.getPublicCaregiverProfileById(testCaregiverId);
      },
      (err) => {
        assert.equal(err.statusCode, 404);
        return true;
      },
    );

    // 4. Verified caregiver and active user -> returns sanitized public profile
    const mockVerifiedProfile = {
      _id: testCaregiverId,
      verificationStatus: 'verified',
      user: {
        fullName: 'Sister Mary Joseph',
        status: 'active',
        avatar: 'https://example.com/mary.jpg',
        email: 'private.mary@hospital.org', // sensitive
        phone: '+919876543210',             // sensitive
      },
      qualification: 'BSc Nursing',
      experienceYears: 12,
      bio: 'Senior critical care attendant.',
      languages: ['English', 'Hindi', 'Malayalam'],
      city: 'Mumbai, MH',
      area: 'Andheri West',
      maxDistanceKm: 20,
      hourlyRate: 750,
      servicesOffered: [
        {
          _id: new mongoose.Types.ObjectId(),
          name: 'Vital Signs Monitoring',
          slug: 'vital-signs-monitoring',
          isActive: true,
        },
      ],
      services: ['Vital Signs Monitoring'],
      careSettings: ['Hospital Care'],
      availabilityStatus: 'Available Now',
      timezone: 'Asia/Kolkata',
      weeklySchedule: [],
      rating: { average: 4.9, count: 48 },
      trustScore: 95,
      completedJobs: 82,
      badges: ['Verified Pro', 'ICU Experienced'],
      nursingRegNo: 'MH-RN-2014-99812', // sensitive
      createdAt: new Date(),
    };

    CaregiverProfile.findOne = () => ({
      populate: () => ({
        populate: async () => mockVerifiedProfile,
      }),
    });

    const publicView = await caregiverService.getPublicCaregiverProfileById(testCaregiverId);
    assert.equal(publicView.fullName, 'Sister Mary Joseph');
    assert.equal(publicView.hourlyRate, 750);
    assert.equal(publicView.servicesOffered.length, 1);
    assert.equal(publicView.servicesOffered[0].name, 'Vital Signs Monitoring');

    // Security: sensitive fields MUST NOT be present in public DTO
    assert.equal(publicView.email, undefined);
    assert.equal(publicView.phone, undefined);
    assert.equal(publicView.nursingRegNo, undefined);
    assert.equal(publicView.passwordHash, undefined);
    assert.equal(publicView.documents, undefined);
  } finally {
    CaregiverProfile.findOne = originalFindOne;
  }
});
