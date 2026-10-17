import test from 'node:test';
import assert from 'node:assert/strict';
import mongoose from 'mongoose';
import {
  generateNumericOtp,
  hashOtp,
  verifyOtpHash,
  getOtpSecret,
  assertValidOtpSecret,
  MIN_OTP_SECRET_LENGTH,
  DEV_TEST_FALLBACK_SECRET,
} from '../src/utils/otpUtils.js';
import * as otpService from '../src/services/otpService.js';
import * as bookingService from '../src/services/bookingService.js';
import * as simulatedPaymentService from '../src/services/simulatedPaymentService.js';
import { validateVerifyOtp } from '../src/middleware/validateOtp.js';
import { Booking, SimulatedPayment } from '../src/models/index.js';

// Helper for mocked req, res, next
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
  const next = (err) => {
    nextCalled = true;
    nextError = err;
  };

  return { req, res, next, getNextCalled: () => nextCalled, getNextError: () => nextError };
};

// -----------------------------------------------------------------------------
// Test 1: Cryptographic OTP Generation & Hash Verification
// -----------------------------------------------------------------------------
test('Step 9 - 1: Cryptographic 6-digit OTP generation and timing-safe verification', () => {
  const otp1 = generateNumericOtp();
  const otp2 = generateNumericOtp();

  // 1. Length and numeric format
  assert.equal(typeof otp1, 'string');
  assert.equal(otp1.length, 6);
  assert.match(otp1, /^\d{6}$/);

  // 2. Bound between 100000 and 999999
  const num = parseInt(otp1, 10);
  assert.ok(num >= 100000 && num <= 999999);

  // 3. Random distribution (two successive OTPs are distinct)
  assert.notEqual(otp1, otp2);

  // 4. Hash computation and constant-time match
  const salt = 'booking_123:customer_456';
  const hash = hashOtp(otp1, salt);
  assert.equal(typeof hash, 'string');
  assert.equal(hash.length, 64); // SHA-256 hex digest length

  // Matching verification
  assert.equal(verifyOtpHash(otp1, hash, salt), true);

  // Non-matching inputs
  assert.equal(verifyOtpHash('000000', hash, salt), false);
  assert.equal(verifyOtpHash(otp1, hash, 'wrong_salt'), false);
  assert.equal(verifyOtpHash('', hash, salt), false);
  assert.equal(verifyOtpHash(null, hash, salt), false);
});

// -----------------------------------------------------------------------------
// Test 2: Input Validation Middleware for OTP Endpoints
// -----------------------------------------------------------------------------
test('Step 9 - 2: validateVerifyOtp enforces 6-digit numeric pattern and sanitizes metadata', () => {
  // 1. Missing OTP -> 400
  const { req: r1, res: res1, next: n1, getNextCalled: called1, getNextError: err1 } = createMockReqRes({
    body: {},
  });
  validateVerifyOtp(r1, res1, n1);
  assert.equal(called1(), true);
  assert.equal(err1()?.statusCode, 400);

  // 2. Non-numeric OTP -> 400
  const { req: r2, res: res2, next: n2, getNextCalled: called2, getNextError: err2 } = createMockReqRes({
    body: { otp: 'abcdef' },
  });
  validateVerifyOtp(r2, res2, n2);
  assert.equal(called2(), true);
  assert.equal(err2()?.statusCode, 400);

  // 3. Invalid length (e.g. 5 or 7 digits) -> 400
  const { req: r3, res: res3, next: n3, getNextCalled: called3, getNextError: err3 } = createMockReqRes({
    body: { otp: '12345' },
  });
  validateVerifyOtp(r3, res3, n3);
  assert.equal(called3(), true);
  assert.equal(err3()?.statusCode, 400);

  // 4. Valid 6-digit OTP -> passes and sanitizes metadata
  const { req: r4, res: res4, next: n4, getNextCalled: called4, getNextError: err4 } = createMockReqRes({
    body: {
      otp: '654321',
      selfieUrl: 'https://cdn.bystander.care/selfie.jpg',
      location: '123 Marine Drive, Mumbai',
      notes: 'Patient vitals stable upon arrival',
    },
  });
  validateVerifyOtp(r4, res4, n4);
  assert.equal(called4(), true);
  assert.equal(err4(), undefined);
  assert.equal(r4.otpData.otp, '654321');
  assert.equal(r4.otpData.selfieUrl, 'https://cdn.bystander.care/selfie.jpg');
  assert.equal(r4.otpData.notes, 'Patient vitals stable upon arrival');
});

// -----------------------------------------------------------------------------
// Test 3: Customer Check-In OTP Request & Authorization
// -----------------------------------------------------------------------------
test('Step 9 - 3: requestCheckInOtp authorizes only the booking customer and enforces cooldown', async () => {
  const customerId = new mongoose.Types.ObjectId().toString();
  const caregiverUserId = new mongoose.Types.ObjectId().toString();
  const strangerUserId = new mongoose.Types.ObjectId().toString();
  const bookingId = new mongoose.Types.ObjectId().toString();

  const originalFindById = Booking.findById;

  try {
    const mockBooking = {
      _id: bookingId,
      customer: customerId,
      caregiverUser: caregiverUserId,
      status: 'confirmed',
      checkInOtp: { lastRequestedAt: null },
      save: async function () {
        return this;
      },
    };

    Booking.findById = async () => mockBooking;

    // 1. Caregiver cannot request check-in OTP -> 403 Forbidden
    await assert.rejects(
      async () => {
        await otpService.requestCheckInOtp(
          { _id: caregiverUserId, role: 'caregiver' },
          bookingId,
        );
      },
      (err) => {
        assert.equal(err.statusCode, 403);
        assert.ok(err.message.includes('Only the customer'));
        return true;
      },
    );

    // 2. Stranger cannot request check-in OTP -> 403 Forbidden
    await assert.rejects(
      async () => {
        await otpService.requestCheckInOtp(
          { _id: strangerUserId, role: 'customer' },
          bookingId,
        );
      },
      (err) => {
        assert.equal(err.statusCode, 403);
        return true;
      },
    );

    // 3. Customer successfully generates check-in OTP
    const res = await otpService.requestCheckInOtp(
      { _id: customerId, role: 'customer' },
      bookingId,
    );
    assert.equal(res.otp.length, 6);
    assert.ok(res.expiresAt instanceof Date);
    assert.ok(mockBooking.checkInOtp.otpHash);
    assert.equal(mockBooking.checkInOtp.attempts, 0);

    // 4. Cooldown throttling: requesting another OTP within 60 seconds returns 429
    await assert.rejects(
      async () => {
        await otpService.requestCheckInOtp(
          { _id: customerId, role: 'customer' },
          bookingId,
        );
      },
      (err) => {
        assert.equal(err.statusCode, 429);
        assert.equal(err.name, 'TooManyRequestsError');
        return true;
      },
    );

    // 5. Precondition check: cannot request check-in OTP for unconfirmed booking -> 400
    mockBooking.status = 'pending';
    mockBooking.checkInOtp.lastRequestedAt = null; // reset cooldown
    await assert.rejects(
      async () => {
        await otpService.requestCheckInOtp(
          { _id: customerId, role: 'customer' },
          bookingId,
        );
      },
      (err) => {
        assert.equal(err.statusCode, 400);
        assert.ok(err.message.includes('confirmed by the caregiver first'));
        return true;
      },
    );
  } finally {
    Booking.findById = originalFindById;
  }
});

// -----------------------------------------------------------------------------
// Test 4: Caregiver Check-In Verification, Attempt Limits, and Replay Defense
// -----------------------------------------------------------------------------
test('Step 9 - 4: verifyCheckIn authorizes caregiver, locks after 5 attempts, and transitions atomically', async () => {
  const customerId = new mongoose.Types.ObjectId().toString();
  const caregiverUserId = new mongoose.Types.ObjectId().toString();
  const strangerUserId = new mongoose.Types.ObjectId().toString();
  const bookingId = new mongoose.Types.ObjectId().toString();

  const originalFindById = Booking.findById;
  const originalUpdateOne = Booking.updateOne;
  const originalFindOneAndUpdate = Booking.findOneAndUpdate;

  try {
    const validOtp = '789123';
    const salt = `${bookingId}:${customerId}`;
    const otpHash = hashOtp(validOtp, salt);

    const mockBooking = {
      _id: bookingId,
      customer: customerId,
      caregiverUser: caregiverUserId,
      status: 'confirmed',
      checkInOtp: {
        otpHash,
        expiresAt: new Date(Date.now() + 900000), // 15 mins
        attempts: 0,
        maxAttempts: 5,
        consumedAt: null,
      },
      save: async function () {
        return this;
      },
    };

    const makeQuery = (doc) => {
      const p = Promise.resolve(doc);
      p.select = () => Promise.resolve(doc);
      return p;
    };

    Booking.findById = () => makeQuery(mockBooking);
    Booking.findOneAndUpdate = async (filter, update) => {
      // Atomic failed attempt increment
      if (update.$inc && update.$inc['checkInOtp.attempts']) {
        const limit = filter['checkInOtp.attempts']?.$lt ?? 5;
        if (mockBooking.checkInOtp.attempts >= limit || mockBooking.checkInOtp.consumedAt) {
          return null;
        }
        mockBooking.checkInOtp.attempts += update.$inc['checkInOtp.attempts'];
        return {
          ...mockBooking,
          checkInOtp: { ...mockBooking.checkInOtp },
        };
      }
      // Atomic status transition
      if (update.$set && update.$set.status === 'in_progress') {
        const limit = filter['checkInOtp.attempts']?.$lt ?? 5;
        if (mockBooking.checkInOtp.attempts >= limit || mockBooking.checkInOtp.consumedAt) {
          return null;
        }
        mockBooking.status = 'in_progress';
        mockBooking.checkInOtp.consumedAt = update.$set['checkInOtp.consumedAt'];
        return {
          ...mockBooking,
          status: 'in_progress',
          checkIn: {
            at: update.$set['checkIn.at'],
            verifiedBy: update.$set['checkIn.verifiedBy'],
            selfieUrl: update.$set['checkIn.selfieUrl'],
            location: update.$set['checkIn.location'],
            notes: update.$set['checkIn.notes'],
          },
          populate: async function () {
            return this;
          },
        };
      }
      return null;
    };

    // 1. Customer cannot self-verify check-in -> 403 Forbidden
    await assert.rejects(
      async () => {
        await otpService.verifyCheckIn(
          { _id: customerId, role: 'customer' },
          bookingId,
          { otp: validOtp },
        );
      },
      (err) => {
        assert.equal(err.statusCode, 403);
        assert.ok(err.message.includes('Only the assigned caregiver'));
        return true;
      },
    );

    // 2. Wrong OTP increments attempts and returns remaining count -> 400
    await assert.rejects(
      async () => {
        await otpService.verifyCheckIn(
          { _id: caregiverUserId, role: 'caregiver' },
          bookingId,
          { otp: '000000' },
        );
      },
      (err) => {
        assert.equal(err.statusCode, 400);
        assert.ok(err.message.includes('attempt(s) remaining'));
        return true;
      },
    );

    // 3. Attempt limit lockout (5 attempts reached) -> 400
    mockBooking.checkInOtp.attempts = 5;
    await assert.rejects(
      async () => {
        await otpService.verifyCheckIn(
          { _id: caregiverUserId, role: 'caregiver' },
          bookingId,
          { otp: validOtp },
        );
      },
      (err) => {
        assert.equal(err.statusCode, 400);
        assert.ok(err.message.includes('Maximum verification attempts exceeded'));
        return true;
      },
    );

    // 4. Expired OTP rejected -> 400
    mockBooking.checkInOtp.attempts = 0;
    mockBooking.checkInOtp.expiresAt = new Date(Date.now() - 1000); // 1 sec in past
    await assert.rejects(
      async () => {
        await otpService.verifyCheckIn(
          { _id: caregiverUserId, role: 'caregiver' },
          bookingId,
          { otp: validOtp },
        );
      },
      (err) => {
        assert.equal(err.statusCode, 400);
        assert.ok(err.message.includes('expired'));
        return true;
      },
    );

    // 5. Successful check-in transitions to 'in_progress' and records check-in metadata
    mockBooking.checkInOtp.expiresAt = new Date(Date.now() + 900000);

    const checkedIn = await otpService.verifyCheckIn(
      { _id: caregiverUserId, role: 'caregiver' },
      bookingId,
      {
        otp: validOtp,
        selfieUrl: 'https://cdn.bystander.care/selfie.jpg',
        location: 'Mumbai, India',
        notes: 'Arrived on time',
      },
    );
    assert.equal(checkedIn.status, 'in_progress');
    assert.ok(checkedIn.checkIn.at instanceof Date);

    // 6. Replay attack: submitting an already-consumed OTP -> 400
    mockBooking.status = 'confirmed';
    mockBooking.checkInOtp.consumedAt = new Date();
    await assert.rejects(
      async () => {
        await otpService.verifyCheckIn(
          { _id: caregiverUserId, role: 'caregiver' },
          bookingId,
          { otp: validOtp },
        );
      },
      (err) => {
        assert.equal(err.statusCode, 400);
        assert.ok(err.message.includes('already been used'));
        return true;
      },
    );
  } finally {
    Booking.findById = originalFindById;
    Booking.updateOne = originalUpdateOne;
    Booking.findOneAndUpdate = originalFindOneAndUpdate;
  }
});

// -----------------------------------------------------------------------------
// Test 5: Check-Out OTP Request, Verification & Lifecycle Completion
// -----------------------------------------------------------------------------
test('Step 9 - 5: Check-out OTP workflow transitions booking from in_progress to completed', async () => {
  const customerId = new mongoose.Types.ObjectId().toString();
  const caregiverUserId = new mongoose.Types.ObjectId().toString();
  const bookingId = new mongoose.Types.ObjectId().toString();

  const originalFindById = Booking.findById;
  const originalFindOneAndUpdate = Booking.findOneAndUpdate;

  try {
    const mockBooking = {
      _id: bookingId,
      customer: customerId,
      caregiverUser: caregiverUserId,
      status: 'in_progress',
      checkOutOtp: { lastRequestedAt: null },
      save: async function () {
        return this;
      },
    };

    const makeQuery = (doc) => {
      const p = Promise.resolve(doc);
      p.select = () => Promise.resolve(doc);
      return p;
    };

    Booking.findById = () => makeQuery(mockBooking);

    // 1. Cannot request check-out OTP if booking is not in_progress -> 400
    mockBooking.status = 'confirmed';
    await assert.rejects(
      async () => {
        await otpService.requestCheckOutOtp(
          { _id: customerId, role: 'customer' },
          bookingId,
        );
      },
      (err) => {
        assert.equal(err.statusCode, 400);
        assert.ok(err.message.includes('Shift must be actively in progress'));
        return true;
      },
    );

    // 2. Customer generates check-out OTP for in_progress booking
    mockBooking.status = 'in_progress';
    const otpRes = await otpService.requestCheckOutOtp(
      { _id: customerId, role: 'customer' },
      bookingId,
    );
    assert.equal(otpRes.otp.length, 6);

    Booking.findOneAndUpdate = async (filter, update) => {
      if (update.$inc && update.$inc['checkOutOtp.attempts']) {
        const limit = filter['checkOutOtp.attempts']?.$lt ?? 5;
        if (mockBooking.checkOutOtp.attempts >= limit || mockBooking.checkOutOtp.consumedAt) {
          return null;
        }
        mockBooking.checkOutOtp.attempts += update.$inc['checkOutOtp.attempts'];
        return {
          ...mockBooking,
          checkOutOtp: { ...mockBooking.checkOutOtp },
        };
      }
      if (update.$set && update.$set.status === 'completed') {
        const limit = filter['checkOutOtp.attempts']?.$lt ?? 5;
        if (mockBooking.checkOutOtp.attempts >= limit || mockBooking.checkOutOtp.consumedAt) {
          return null;
        }
        mockBooking.status = 'completed';
        mockBooking.checkOutOtp.consumedAt = update.$set['checkOutOtp.consumedAt'];
        return {
          ...mockBooking,
          status: 'completed',
          checkOut: {
            at: update.$set['checkOut.at'],
            verifiedBy: update.$set['checkOut.verifiedBy'],
            selfieUrl: update.$set['checkOut.selfieUrl'],
            location: update.$set['checkOut.location'],
            notes: update.$set['checkOut.notes'],
          },
          populate: async function () {
            return this;
          },
        };
      }
      return null;
    };

    // 3. Submitting invalid check-out OTP increments attempts -> 400
    await assert.rejects(
      async () => {
        await otpService.verifyCheckOut(
          { _id: caregiverUserId, role: 'caregiver' },
          bookingId,
          { otp: '000000' },
        );
      },
      (err) => {
        assert.equal(err.statusCode, 400);
        assert.ok(err.message.includes('attempt(s) remaining'));
        return true;
      },
    );

    // 4. Caregiver submits valid check-out OTP -> transitions to 'completed'
    const completed = await otpService.verifyCheckOut(
      { _id: caregiverUserId, role: 'caregiver' },
      bookingId,
      {
        otp: otpRes.otp,
        notes: 'Shift completed, vitals handed over to family.',
      },
    );
    assert.equal(completed.status, 'completed');
    assert.ok(completed.checkOut.at instanceof Date);
    assert.equal(completed.checkOut.notes, 'Shift completed, vitals handed over to family.');
  } finally {
    Booking.findById = originalFindById;
    Booking.findOneAndUpdate = originalFindOneAndUpdate;
  }
});

// -----------------------------------------------------------------------------
// Test 6: In-Progress Shifts Cannot Be Cancelled via Self-Service API
// -----------------------------------------------------------------------------
test('Step 9 - 6: cancelBooking rejects cancellation of bookings that are actively in_progress', async () => {
  const customerId = new mongoose.Types.ObjectId().toString();
  const caregiverUserId = new mongoose.Types.ObjectId().toString();
  const bookingId = new mongoose.Types.ObjectId().toString();

  const originalFindById = Booking.findById;

  try {
    Booking.findById = async () => ({
      _id: bookingId,
      customer: customerId,
      caregiverUser: caregiverUserId,
      status: 'in_progress', // Active shift in progress
    });

    await assert.rejects(
      async () => {
        await bookingService.cancelBooking(
          { _id: customerId, role: 'customer' },
          bookingId,
          'Attempt cancel during active shift',
        );
      },
      (err) => {
        assert.equal(err.statusCode, 400);
        assert.ok(err.message.includes('actively in progress'));
        return true;
      },
    );
  } finally {
    Booking.findById = originalFindById;
  }
});

// -----------------------------------------------------------------------------
// Test 7: Test-Only Payment Simulation Safety & Production Blocking
// -----------------------------------------------------------------------------
test('Step 9 - 7: Payment simulation is strictly blocked in production and isolated from real funds', async () => {
  const customerId = new mongoose.Types.ObjectId().toString();
  const bookingId = new mongoose.Types.ObjectId().toString();

  const originalEnv = process.env.NODE_ENV;
  const originalFindById = Booking.findById;
  const originalFindOneAndUpdate = SimulatedPayment.findOneAndUpdate;

  try {
    Booking.findById = async () => ({
      _id: bookingId,
      customer: customerId,
      status: 'confirmed',
      totalAmount: 2400,
      currency: 'INR',
    });

    // 1. In production (NODE_ENV=production), simulation throws 403 Forbidden
    process.env.NODE_ENV = 'production';
    await assert.rejects(
      async () => {
        await simulatedPaymentService.simulatePayment(
          { _id: customerId, role: 'customer' },
          bookingId,
          { status: 'SIMULATED_ESCROW_HELD' },
        );
      },
      (err) => {
        assert.equal(err.statusCode, 403);
        assert.equal(err.name, 'ForbiddenError');
        assert.ok(err.message.includes('strictly forbidden in production'));
        return true;
      },
    );

    // 2. In test environment (NODE_ENV=test), simulation records simulated event
    process.env.NODE_ENV = 'test';
    SimulatedPayment.findOneAndUpdate = async (filter, update) => ({
      booking: bookingId,
      customer: customerId,
      amount: 2400,
      status: update.$set.status,
      isSimulated: true,
      provider: 'SIMULATED_TEST_HARNESS',
    });

    const simRes = await simulatedPaymentService.simulatePayment(
      { _id: customerId, role: 'customer' },
      bookingId,
      { status: 'SIMULATED_ESCROW_HELD' },
    );

    assert.equal(simRes.success, true);
    assert.equal(simRes.simulatedPayment.isSimulated, true);
    assert.equal(simRes.simulatedPayment.status, 'SIMULATED_ESCROW_HELD');
    assert.ok(/no real monetary funds/i.test(simRes.message));
  } finally {
    process.env.NODE_ENV = originalEnv;
    Booking.findById = originalFindById;
    SimulatedPayment.findOneAndUpdate = originalFindOneAndUpdate;
  }
});

// -----------------------------------------------------------------------------
// Test 8: Production OTP HMAC Secret Management and Startup Enforcement
// -----------------------------------------------------------------------------
test('Step 9 - 8: Production OTP HMAC Secret Management and Startup Enforcement', () => {
  const originalEnv = process.env.NODE_ENV;
  const originalOtpSecret = process.env.OTP_HMAC_SECRET;
  const originalJwtSecret = process.env.JWT_ACCESS_SECRET;

  try {
    // 1. Missing secret in production throws fatal error
    process.env.NODE_ENV = 'production';
    delete process.env.OTP_HMAC_SECRET;
    delete process.env.JWT_ACCESS_SECRET;

    assert.throws(
      () => {
        assertValidOtpSecret();
      },
      (err) => {
        assert.ok(err.message.includes('FATAL: A secure OTP_HMAC_SECRET'));
        assert.ok(err.message.includes('minimum length of 32'));
        return true;
      },
    );

    // 2. Secret < 32 characters in production throws fatal error
    process.env.OTP_HMAC_SECRET = 'short_insecure_secret_12345';
    assert.throws(
      () => {
        assertValidOtpSecret();
      },
      (err) => {
        assert.ok(err.message.includes('minimum length of 32'));
        return true;
      },
    );

    // 3. Valid OTP_HMAC_SECRET (>= 32 chars) in production succeeds
    const secureSecret = 'a'.repeat(32);
    process.env.OTP_HMAC_SECRET = secureSecret;
    assert.equal(getOtpSecret(), secureSecret);

    // 4. Dedicated OTP_HMAC_SECRET takes precedence over JWT_ACCESS_SECRET
    const jwtSecret = 'b'.repeat(32);
    process.env.JWT_ACCESS_SECRET = jwtSecret;
    assert.equal(getOtpSecret(), secureSecret);

    // 5. JWT_ACCESS_SECRET is accepted if OTP_HMAC_SECRET is unset (preserving backwards compatibility)
    delete process.env.OTP_HMAC_SECRET;
    assert.equal(getOtpSecret(), jwtSecret);

    // 6. Non-production environment safely falls back to test default if secret is absent
    process.env.NODE_ENV = 'test';
    delete process.env.JWT_ACCESS_SECRET;
    assert.equal(getOtpSecret(), DEV_TEST_FALLBACK_SECRET);
  } finally {
    process.env.NODE_ENV = originalEnv;
    if (originalOtpSecret !== undefined) process.env.OTP_HMAC_SECRET = originalOtpSecret;
    else delete process.env.OTP_HMAC_SECRET;
    if (originalJwtSecret !== undefined) process.env.JWT_ACCESS_SECRET = originalJwtSecret;
    else delete process.env.JWT_ACCESS_SECRET;
  }
});

// -----------------------------------------------------------------------------
// Test 9: Atomic OTP verification attempt limit under concurrent invalid requests
// -----------------------------------------------------------------------------
test('Step 9 - 9: Atomic conditional database operation enforces exact 5-attempt verification limit', async () => {
  const customerId = new mongoose.Types.ObjectId().toString();
  const caregiverUserId = new mongoose.Types.ObjectId().toString();
  const bookingId = new mongoose.Types.ObjectId().toString();

  const originalFindById = Booking.findById;
  const originalFindOneAndUpdate = Booking.findOneAndUpdate;

  try {
    const validOtp = '112233';
    const salt = `${bookingId}:${customerId}`;
    const otpHash = hashOtp(validOtp, salt);

    // Shared state simulating MongoDB document
    let sharedAttempts = 0;
    let sharedConsumedAt = null;
    let sharedStatus = 'confirmed';

    const getMockDoc = () => ({
      _id: bookingId,
      customer: customerId,
      caregiverUser: caregiverUserId,
      status: sharedStatus,
      checkInOtp: {
        otpHash,
        expiresAt: new Date(Date.now() + 900000),
        attempts: sharedAttempts,
        maxAttempts: 5,
        consumedAt: sharedConsumedAt,
      },
    });

    const makeQuery = () => {
      const doc = getMockDoc();
      const p = Promise.resolve(doc);
      p.select = () => Promise.resolve(doc);
      return p;
    };

    Booking.findById = () => makeQuery();

    // Atomic findOneAndUpdate simulating MongoDB serialization
    Booking.findOneAndUpdate = async (filter, update) => {
      if (update.$inc && update.$inc['checkInOtp.attempts']) {
        const limit = filter['checkInOtp.attempts']?.$lt ?? 5;
        // Atomic conditional check: attempts < 5 AND consumedAt is null
        if (sharedAttempts >= limit || sharedConsumedAt !== null) {
          return null; // Atomic condition failed: not matched
        }
        sharedAttempts += update.$inc['checkInOtp.attempts'];
        return getMockDoc();
      }
      if (update.$set && update.$set.status === 'in_progress') {
        const limit = filter['checkInOtp.attempts']?.$lt ?? 5;
        if (sharedAttempts >= limit || sharedConsumedAt !== null) {
          return null;
        }
        sharedStatus = 'in_progress';
        sharedConsumedAt = update.$set['checkInOtp.consumedAt'];
        return {
          ...getMockDoc(),
          populate: async function () {
            return this;
          },
        };
      }
      return null;
    };

    // 1. Simulate 10 simultaneous concurrent invalid OTP requests
    const concurrentRequests = Array.from({ length: 10 }).map((_, idx) =>
      otpService.verifyCheckIn(
        { _id: caregiverUserId, role: 'caregiver' },
        bookingId,
        { otp: `00000${idx}` },
      ),
    );

    const results = await Promise.allSettled(concurrentRequests);
    assert.equal(results.length, 10);
    // All 10 must be rejected
    assert.ok(results.every((r) => r.status === 'rejected'));

    // 2. Concurrency guarantee: exactly 5 attempts admitted in database, NEVER more than 5
    assert.equal(sharedAttempts, 5, 'Atomic operation must cap attempts at exactly 5');

    // 3. Submitting the CORRECT OTP now must be rejected because max attempts was reached
    await assert.rejects(
      async () => {
        await otpService.verifyCheckIn(
          { _id: caregiverUserId, role: 'caregiver' },
          bookingId,
          { otp: validOtp },
        );
      },
      (err) => {
        assert.equal(err.statusCode, 400);
        assert.ok(err.message.includes('Maximum verification attempts exceeded'));
        return true;
      },
    );

    // 4. Verify check-out attempt limiting behaves with the same atomicity
    sharedStatus = 'in_progress';
    let checkOutAttempts = 0;
    let checkOutConsumedAt = null;

    const getCheckOutDoc = () => ({
      _id: bookingId,
      customer: customerId,
      caregiverUser: caregiverUserId,
      status: sharedStatus,
      checkOutOtp: {
        otpHash,
        expiresAt: new Date(Date.now() + 900000),
        attempts: checkOutAttempts,
        maxAttempts: 5,
        consumedAt: checkOutConsumedAt,
      },
    });

    Booking.findById = () => {
      const doc = getCheckOutDoc();
      const p = Promise.resolve(doc);
      p.select = () => Promise.resolve(doc);
      return p;
    };

    Booking.findOneAndUpdate = async (filter, update) => {
      if (update.$inc && update.$inc['checkOutOtp.attempts']) {
        const limit = filter['checkOutOtp.attempts']?.$lt ?? 5;
        if (checkOutAttempts >= limit || checkOutConsumedAt !== null) {
          return null;
        }
        checkOutAttempts += update.$inc['checkOutOtp.attempts'];
        return getCheckOutDoc();
      }
      if (update.$set && update.$set.status === 'completed') {
        const limit = filter['checkOutOtp.attempts']?.$lt ?? 5;
        if (checkOutAttempts >= limit || checkOutConsumedAt !== null) {
          return null;
        }
        sharedStatus = 'completed';
        checkOutConsumedAt = update.$set['checkOutOtp.consumedAt'];
        return {
          ...getCheckOutDoc(),
          populate: async function () {
            return this;
          },
        };
      }
      return null;
    };

    const concurrentCheckOut = Array.from({ length: 8 }).map((_, idx) =>
      otpService.verifyCheckOut(
        { _id: caregiverUserId, role: 'caregiver' },
        bookingId,
        { otp: `99999${idx}` },
      ),
    );

    const outResults = await Promise.allSettled(concurrentCheckOut);
    assert.equal(outResults.length, 8);
    assert.ok(outResults.every((r) => r.status === 'rejected'));
    assert.equal(checkOutAttempts, 5, 'Check-out atomic attempts must be capped at exactly 5');
  } finally {
    Booking.findById = originalFindById;
    Booking.findOneAndUpdate = originalFindOneAndUpdate;
  }
});

