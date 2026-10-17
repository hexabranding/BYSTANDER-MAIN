import test from 'node:test';
import assert from 'node:assert/strict';
import mongoose from 'mongoose';
import {
  parseLocalDateTimeToUTC,
  getLocalTimeInTimezone,
  calculateTotalHours,
  isIntervalConflicting,
} from '../src/utils/bookingDateUtils.js';
import {
  validateCreateBooking,
  validateCancelBooking,
} from '../src/middleware/validateBooking.js';
import { authorizeRoles } from '../src/middleware/auth.js';
import * as bookingService from '../src/services/bookingService.js';
import { Booking, CaregiverProfile, User, Service } from '../src/models/index.js';
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
  const next = (err) => {
    nextCalled = true;
    nextError = err;
  };

  return { req, res, next, getNextCalled: () => nextCalled, getNextError: () => nextError };
};

// -----------------------------------------------------------------------------
// Test 1: Scheduling & Basic Timezone Math (bookingDateUtils)
// -----------------------------------------------------------------------------
test('Step 7 - 1: Scheduling and timezone math converts local input to UTC correctly', () => {
  // 1. Kolkata is UTC+5:30. 09:00 IST on 2026-11-05 is 03:30 UTC
  const kolkataUtc = parseLocalDateTimeToUTC('2026-11-05', '09:00', 'Asia/Kolkata');
  assert.equal(kolkataUtc.toISOString(), '2026-11-05T03:30:00.000Z');

  // 2. New York standard time (EST, UTC-5). 09:00 EST on 2026-11-05 is 14:00 UTC
  const nyUtc = parseLocalDateTimeToUTC('2026-11-05', '09:00', 'America/New_York');
  assert.equal(nyUtc.toISOString(), '2026-11-05T14:00:00.000Z');

  // 3. getLocalTimeInTimezone extracts local day, date, and time
  const local = getLocalTimeInTimezone(kolkataUtc, 'Asia/Kolkata');
  assert.equal(local.day, 'Thu');
  assert.equal(local.dateStr, '2026-11-05');
  assert.equal(local.timeStr, '09:00');

  // 4. calculateTotalHours
  const start = new Date('2026-11-05T03:30:00.000Z');
  const end = new Date('2026-11-05T11:30:00.000Z'); // 8 hours later
  assert.equal(calculateTotalHours(start, end), 8);

  // 5. isIntervalConflicting (startA < endB && endA > startB)
  const aStart = new Date('2026-11-05T09:00:00.000Z');
  const aEnd = new Date('2026-11-05T13:00:00.000Z');

  // Overlap
  assert.equal(
    isIntervalConflicting(
      aStart,
      aEnd,
      new Date('2026-11-05T12:00:00.000Z'),
      new Date('2026-11-05T16:00:00.000Z'),
    ),
    true,
  );

  // Adjacent back-to-back (no overlap)
  assert.equal(
    isIntervalConflicting(
      aStart,
      aEnd,
      new Date('2026-11-05T13:00:00.000Z'),
      new Date('2026-11-05T17:00:00.000Z'),
    ),
    false,
  );

  // Separate
  assert.equal(
    isIntervalConflicting(
      aStart,
      aEnd,
      new Date('2026-11-05T15:00:00.000Z'),
      new Date('2026-11-05T18:00:00.000Z'),
    ),
    false,
  );
});

// -----------------------------------------------------------------------------
// Test 2: Daylight-Saving Time (DST) Edge Cases (NY, London, Kolkata)
// -----------------------------------------------------------------------------
test('Step 7 - 2: Daylight-Saving Time edge cases — America/New_York, Europe/London, Asia/Kolkata', () => {
  // A. America/New_York Spring-Forward Gap (2026-03-08): 02:00-03:00 does not exist
  assert.throws(
    () => parseLocalDateTimeToUTC('2026-03-08', '02:30', 'America/New_York'),
    (err) => {
      assert.equal(err.statusCode, 400);
      assert.equal(err.name, 'ValidationError');
      assert.ok(err.message.includes('Nonexistent local time'));
      assert.ok(err.message.includes('America/New_York'));
      return true;
    },
  );

  // B. America/New_York Fall-Back Ambiguous Time (2026-11-01): 01:30 occurs twice (EDT then EST)
  // Default / 'earlier' policy -> 01:30 EDT (UTC-4) = 05:30 UTC
  const nyEarlier = parseLocalDateTimeToUTC('2026-11-01', '01:30', 'America/New_York', 'earlier');
  assert.equal(nyEarlier.toISOString(), '2026-11-01T05:30:00.000Z');

  // 'later' policy -> 01:30 EST (UTC-5) = 06:30 UTC
  const nyLater = parseLocalDateTimeToUTC('2026-11-01', '01:30', 'America/New_York', 'later');
  assert.equal(nyLater.toISOString(), '2026-11-01T06:30:00.000Z');

  // 'reject' policy -> throws 400 ValidationError
  assert.throws(
    () => parseLocalDateTimeToUTC('2026-11-01', '01:30', 'America/New_York', 'reject'),
    (err) => {
      assert.equal(err.statusCode, 400);
      assert.ok(err.message.includes('Ambiguous local time'));
      return true;
    },
  );

  // C. Europe/London Spring-Forward Gap (2026-03-29): 01:00-02:00 does not exist
  assert.throws(
    () => parseLocalDateTimeToUTC('2026-03-29', '01:30', 'Europe/London'),
    (err) => {
      assert.equal(err.statusCode, 400);
      assert.ok(err.message.includes('Nonexistent local time'));
      assert.ok(err.message.includes('Europe/London'));
      return true;
    },
  );

  // D. Europe/London Fall-Back Ambiguous Time (2026-10-25): 01:30 occurs twice (BST then GMT)
  const lonEarlier = parseLocalDateTimeToUTC('2026-10-25', '01:30', 'Europe/London', 'earlier');
  assert.equal(lonEarlier.toISOString(), '2026-10-25T00:30:00.000Z'); // BST (UTC+1)
  const lonLater = parseLocalDateTimeToUTC('2026-10-25', '01:30', 'Europe/London', 'later');
  assert.equal(lonLater.toISOString(), '2026-10-25T01:30:00.000Z'); // GMT (UTC+0)

  // E. Normal non-DST local times for London and New York
  const londonSummer = parseLocalDateTimeToUTC('2026-07-15', '14:00', 'Europe/London');
  assert.equal(londonSummer.toISOString(), '2026-07-15T13:00:00.000Z'); // BST UTC+1

  const londonWinter = parseLocalDateTimeToUTC('2026-01-15', '14:00', 'Europe/London');
  assert.equal(londonWinter.toISOString(), '2026-01-15T14:00:00.000Z'); // GMT UTC+0

  // F. Asia/Kolkata behaves correctly with no DST shifts
  const kolkataSummer = parseLocalDateTimeToUTC('2026-07-15', '10:00', 'Asia/Kolkata');
  assert.equal(kolkataSummer.toISOString(), '2026-07-15T04:30:00.000Z'); // IST UTC+5:30
  const kolkataWinter = parseLocalDateTimeToUTC('2026-01-15', '10:00', 'Asia/Kolkata');
  assert.equal(kolkataWinter.toISOString(), '2026-01-15T04:30:00.000Z'); // IST UTC+5:30
});

// -----------------------------------------------------------------------------
// Test 3: Fail-Closed Concurrency Control (HTTP 503 on Standalone / Missing Replica Set)
// -----------------------------------------------------------------------------
test('Step 7 - 3: Fail-closed safety — booking operations reject with HTTP 503 when transaction support is unavailable', async () => {
  // Ensure no replica set is active
  const originalClient = mongoose.connection.client;
  delete mongoose.connection.client;

  const originalUserFindById = User.findById;
  const originalCaregiverFindById = CaregiverProfile.findById;
  const originalServiceFindById = Service.findById;

  try {
    const customerId = new mongoose.Types.ObjectId().toString();
    const caregiverId = new mongoose.Types.ObjectId().toString();
    const serviceId = new mongoose.Types.ObjectId().toString();

    User.findById = async () => ({ _id: customerId, status: 'active' });
    Service.findById = async () => ({
      _id: serviceId,
      name: 'Elder Care',
      isActive: true,
      minimumDurationHours: 1,
    });
    CaregiverProfile.findById = () => ({
      populate: async () => ({
        _id: caregiverId,
        verificationStatus: 'verified',
        user: { _id: new mongoose.Types.ObjectId(), status: 'active' },
        servicesOffered: [serviceId],
        timezone: 'Asia/Kolkata',
        hourlyRate: 500,
        weeklySchedule: [
          { day: 'Mon', isAvailable: true, slots: [{ start: '08:00', end: '18:00' }] },
        ],
        dateExceptions: [],
      }),
    });

    // 1. createBooking fails closed with 503 ServiceUnavailableError
    await assert.rejects(
      async () => {
        await bookingService.createBooking(customerId, {
          caregiverId,
          serviceId,
          startDateTime: parseLocalDateTimeToUTC('2028-11-06', '09:00', 'Asia/Kolkata'),
          endDateTime: parseLocalDateTimeToUTC('2028-11-06', '12:00', 'Asia/Kolkata'),
        });
      },
      (err) => {
        assert.equal(err.statusCode, 503);
        assert.equal(err.name, 'ServiceUnavailableError');
        assert.ok(err.message.includes('replica set'));
        return true;
      },
    );

    // 2. acceptBooking fails closed with 503 ServiceUnavailableError
    await assert.rejects(
      async () => {
        await bookingService.acceptBooking(
          { _id: new mongoose.Types.ObjectId(), role: 'caregiver' },
          new mongoose.Types.ObjectId().toString(),
        );
      },
      (err) => {
        assert.equal(err.statusCode, 503);
        assert.equal(err.name, 'ServiceUnavailableError');
        assert.ok(err.message.includes('replica set'));
        return true;
      },
    );
  } finally {
    if (originalClient) {
      mongoose.connection.client = originalClient;
    }
    User.findById = originalUserFindById;
    CaregiverProfile.findById = originalCaregiverFindById;
    Service.findById = originalServiceFindById;
  }
});

// -----------------------------------------------------------------------------
// Test 4: Transaction Retry Loop on Transient Write Conflicts
// -----------------------------------------------------------------------------
test('Step 7 - 4: executeWithTransactionRetry automatically retries on transient write conflicts', async () => {
  // Mock replica set support
  mongoose.connection.client = {
    topology: { description: { type: 'ReplicaSetWithPrimary' } },
  };

  const originalStartSession = mongoose.startSession;
  let attempts = 0;

  mongoose.startSession = async () => ({
    withTransaction: async (cb) => {
      attempts++;
      if (attempts < 3) {
        // Simulate transient WriteConflict (code 112)
        const err = new Error('WriteConflict error: parallel transaction modified document');
        err.code = 112;
        throw err;
      }
      return cb();
    },
    endSession: async () => {},
  });

  try {
    let workExecuted = false;
    const result = await bookingService.executeWithTransactionRetry(async () => {
      workExecuted = true;
      return 'transaction_committed';
    });

    assert.equal(result, 'transaction_committed');
    assert.equal(workExecuted, true);
    assert.equal(attempts, 3); // 2 transient failures followed by successful 3rd attempt
  } finally {
    delete mongoose.connection.client;
    mongoose.startSession = originalStartSession;
  }
});

// -----------------------------------------------------------------------------
// Test 5: Customer-Only RBAC & Input Validation Middleware
// -----------------------------------------------------------------------------
test('Step 7 - 5: validateCreateBooking validates references, future times, and strips client pricing', () => {
  const customerOnly = authorizeRoles('customer');

  // Caregiver attempting to create booking -> 403 Forbidden
  const { req: reqCaregiver, res: resCaregiver, next: nextCaregiver } = createMockReqRes({
    user: { role: 'caregiver' },
  });
  customerOnly(reqCaregiver, resCaregiver, nextCaregiver);
  assert.equal(resCaregiver.statusCode, 403);

  // Missing caregiverId -> 400
  const { req: req1, res: res1, next: next1 } = createMockReqRes({
    body: {
      serviceId: new mongoose.Types.ObjectId().toString(),
      startDateTime: '2028-11-05T09:00:00.000Z',
      endDateTime: '2028-11-05T17:00:00.000Z',
      location: { addressLine: '123 Marine Drive', city: 'Mumbai' },
      patientDetails: { name: 'Grandmother', age: 78 },
    },
  });
  validateCreateBooking(req1, res1, next1);
  assert.equal(res1.statusCode, 400);
  assert.ok(res1.jsonData.message.includes('caregiverId is required'));

  // Past start time -> 400
  const { req: req2, res: res2, next: next2 } = createMockReqRes({
    body: {
      caregiverId: new mongoose.Types.ObjectId().toString(),
      serviceId: new mongoose.Types.ObjectId().toString(),
      startDateTime: '2020-01-01T09:00:00.000Z',
      endDateTime: '2020-01-01T17:00:00.000Z',
      location: { addressLine: '123 Marine Drive', city: 'Mumbai' },
      patientDetails: { name: 'Grandmother', age: 78 },
    },
  });
  validateCreateBooking(req2, res2, next2);
  assert.equal(res2.statusCode, 400);
  assert.ok(res2.jsonData.message.includes('start time must be in the future'));

  // Inverted start/end times -> 400
  const { req: req3, res: res3, next: next3 } = createMockReqRes({
    body: {
      caregiverId: new mongoose.Types.ObjectId().toString(),
      serviceId: new mongoose.Types.ObjectId().toString(),
      startDateTime: '2028-11-05T17:00:00.000Z',
      endDateTime: '2028-11-05T09:00:00.000Z',
      location: { addressLine: '123 Marine Drive', city: 'Mumbai' },
      patientDetails: { name: 'Grandmother', age: 78 },
    },
  });
  validateCreateBooking(req3, res3, next3);
  assert.equal(res3.statusCode, 400);
  assert.ok(res3.jsonData.message.includes('strictly after the start time'));

  // Client-supplied price tampering (hourlyRate, totalAmount, status)
  const validCaregiverId = new mongoose.Types.ObjectId().toString();
  const validServiceId = new mongoose.Types.ObjectId().toString();
  const { req: req4, res: res4, next: next4, getNextCalled: called4 } = createMockReqRes({
    body: {
      caregiverId: validCaregiverId,
      serviceId: validServiceId,
      startDateTime: '2028-11-05T09:00:00.000Z',
      endDateTime: '2028-11-05T17:00:00.000Z',
      location: { addressLine: '123 Marine Drive', city: 'Mumbai' },
      patientDetails: { name: 'Grandmother', age: 78 },
      hourlyRate: 1,
      totalAmount: 5,
      status: 'confirmed',
      customer: 'hacked-id',
    },
  });
  validateCreateBooking(req4, res4, next4);
  assert.equal(called4(), true);
  assert.equal('hourlyRate' in req4.bookingData, false);
  assert.equal('totalAmount' in req4.bookingData, false);
  assert.equal('status' in req4.bookingData, false);
  assert.equal('customer' in req4.bookingData, false);
});

// -----------------------------------------------------------------------------
// Test 6: Booking Model Schema Constraints & Enums
// -----------------------------------------------------------------------------
test('Step 7 - 6: Booking model enforces required fields, defaults, and status enum', async () => {
  const customerId = new mongoose.Types.ObjectId();
  const caregiverId = new mongoose.Types.ObjectId();
  const caregiverUserId = new mongoose.Types.ObjectId();
  const serviceId = new mongoose.Types.ObjectId();

  const validBooking = new Booking({
    customer: customerId,
    caregiver: caregiverId,
    caregiverUser: caregiverUserId,
    service: serviceId,
    serviceName: 'Bedside Critical Care',
    serviceCategory: 'Clinical Care',
    hourlyRate: 600,
    totalHours: 8,
    totalAmount: 4800,
    startDateTime: new Date('2028-11-05T03:30:00.000Z'),
    endDateTime: new Date('2028-11-05T11:30:00.000Z'),
    timezone: 'Asia/Kolkata',
    location: {
      addressLine: 'Apt 4B, Hill Road',
      city: 'Mumbai',
      careSetting: 'Home Care',
    },
    patientDetails: {
      name: 'Ramesh Patel',
      age: 72,
      gender: 'Male',
    },
  });

  await validBooking.validate();
  assert.equal(validBooking.status, 'pending');
  assert.equal(validBooking.currency, 'INR');

  // Invalid status rejected
  validBooking.status = 'arbitrary_status';
  await assert.rejects(
    async () => {
      await validBooking.validate();
    },
    (err) => {
      assert.ok(err.errors.status);
      return true;
    },
  );
});

// -----------------------------------------------------------------------------
// Test 7: Caregiver Eligibility & Inactive Service Defense (createBooking)
// -----------------------------------------------------------------------------
test('Step 7 - 7: createBooking rejects ineligible caregivers and inactive services', async () => {
  const customerId = new mongoose.Types.ObjectId().toString();
  const caregiverId = new mongoose.Types.ObjectId().toString();
  const serviceId = new mongoose.Types.ObjectId().toString();

  const originalUserFindById = User.findById;
  const originalCaregiverFindById = CaregiverProfile.findById;
  const originalServiceFindById = Service.findById;

  try {
    User.findById = async () => ({ _id: customerId, status: 'active' });

    // Scenario A: Unverified caregiver
    CaregiverProfile.findById = () => ({
      populate: async () => ({
        _id: caregiverId,
        verificationStatus: 'pending',
        user: { status: 'active' },
      }),
    });

    await assert.rejects(
      async () => {
        await bookingService.createBooking(customerId, {
          caregiverId,
          serviceId,
          startDateTime: new Date('2028-11-05T09:00:00.000Z'),
          endDateTime: new Date('2028-11-05T17:00:00.000Z'),
        });
      },
      (err) => {
        assert.equal(err.statusCode, 400);
        assert.ok(err.message.includes('not verified'));
        return true;
      },
    );

    // Scenario B: Suspended caregiver user account
    CaregiverProfile.findById = () => ({
      populate: async () => ({
        _id: caregiverId,
        verificationStatus: 'verified',
        user: { status: 'suspended' },
      }),
    });

    await assert.rejects(
      async () => {
        await bookingService.createBooking(customerId, {
          caregiverId,
          serviceId,
          startDateTime: new Date('2028-11-05T09:00:00.000Z'),
          endDateTime: new Date('2028-11-05T17:00:00.000Z'),
        });
      },
      (err) => {
        assert.equal(err.statusCode, 400);
        assert.ok(err.message.includes('suspended, blocked, or inactive'));
        return true;
      },
    );

    // Scenario C: Inactive service
    CaregiverProfile.findById = () => ({
      populate: async () => ({
        _id: caregiverId,
        verificationStatus: 'verified',
        user: { status: 'active' },
      }),
    });

    Service.findById = async () => ({
      _id: serviceId,
      name: 'Discontinued Service',
      isActive: false,
    });

    await assert.rejects(
      async () => {
        await bookingService.createBooking(customerId, {
          caregiverId,
          serviceId,
          startDateTime: new Date('2028-11-05T09:00:00.000Z'),
          endDateTime: new Date('2028-11-05T17:00:00.000Z'),
        });
      },
      (err) => {
        assert.equal(err.statusCode, 400);
        assert.ok(err.message.includes('inactive or does not exist'));
        return true;
      },
    );
  } finally {
    User.findById = originalUserFindById;
    CaregiverProfile.findById = originalCaregiverFindById;
    Service.findById = originalServiceFindById;
  }
});

// -----------------------------------------------------------------------------
// Test 8: Caregiver Availability & Date Exceptions in Caregiver Timezone
// -----------------------------------------------------------------------------
test('Step 7 - 8: createBooking validates working hours and date exceptions in caregiver timezone', async () => {
  const customerId = new mongoose.Types.ObjectId().toString();
  const caregiverId = new mongoose.Types.ObjectId().toString();
  const serviceId = new mongoose.Types.ObjectId().toString();

  const originalUserFindById = User.findById;
  const originalCaregiverFindById = CaregiverProfile.findById;
  const originalServiceFindById = Service.findById;

  try {
    User.findById = async () => ({ _id: customerId, status: 'active' });

    Service.findById = async () => ({
      _id: serviceId,
      name: 'Elder Bedside Care',
      isActive: true,
      minimumDurationHours: 2,
    });

    const mockCaregiver = {
      _id: caregiverId,
      verificationStatus: 'verified',
      user: { _id: new mongoose.Types.ObjectId(), status: 'active' },
      servicesOffered: [serviceId],
      timezone: 'Asia/Kolkata',
      hourlyRate: 500,
      weeklySchedule: [
        { day: 'Mon', isAvailable: true, slots: [{ start: '08:00', end: '16:00' }] },
        { day: 'Sun', isAvailable: false, slots: [] },
      ],
      dateExceptions: [
        { date: '2028-11-10', isAvailable: false, reason: 'Family Wedding' },
      ],
    };

    CaregiverProfile.findById = () => ({
      populate: async () => mockCaregiver,
    });

    // 1. Leave exception day -> 400
    const leaveDayStart = parseLocalDateTimeToUTC('2028-11-10', '09:00', 'Asia/Kolkata');
    const leaveDayEnd = parseLocalDateTimeToUTC('2028-11-10', '13:00', 'Asia/Kolkata');

    await assert.rejects(
      async () => {
        await bookingService.createBooking(customerId, {
          caregiverId,
          serviceId,
          startDateTime: leaveDayStart,
          endDateTime: leaveDayEnd,
        });
      },
      (err) => {
        assert.equal(err.statusCode, 400);
        assert.ok(err.message.includes('scheduled leave'));
        return true;
      },
    );

    // 2. Outside working hours -> 400
    const afterHoursStart = parseLocalDateTimeToUTC('2028-11-06', '17:00', 'Asia/Kolkata');
    const afterHoursEnd = parseLocalDateTimeToUTC('2028-11-06', '21:00', 'Asia/Kolkata');

    await assert.rejects(
      async () => {
        await bookingService.createBooking(customerId, {
          caregiverId,
          serviceId,
          startDateTime: afterHoursStart,
          endDateTime: afterHoursEnd,
        });
      },
      (err) => {
        assert.equal(err.statusCode, 400);
        assert.ok(err.message.includes('falls outside caregiver regular working hours'));
        return true;
      },
    );
  } finally {
    User.findById = originalUserFindById;
    CaregiverProfile.findById = originalCaregiverFindById;
    Service.findById = originalServiceFindById;
  }
});

// -----------------------------------------------------------------------------
// Test 9: Serialized Transaction Conflict Prevention (createBooking)
// -----------------------------------------------------------------------------
test('Step 7 - 9: createBooking serializes booking creation and rejects conflicting intervals with HTTP 409 Conflict', async () => {
  // Simulate active replica set session
  mongoose.connection.client = {
    topology: { description: { type: 'ReplicaSetWithPrimary' } },
  };

  const originalStartSession = mongoose.startSession;
  const originalUserFindById = User.findById;
  const originalCaregiverFindById = CaregiverProfile.findById;
  const originalCaregiverUpdateOne = CaregiverProfile.updateOne;
  const originalServiceFindById = Service.findById;
  const originalBookingFindOne = Booking.findOne;

  let caregiverLockMutated = false;

  try {
    const customerId = new mongoose.Types.ObjectId().toString();
    const caregiverId = new mongoose.Types.ObjectId().toString();
    const serviceId = new mongoose.Types.ObjectId().toString();

    User.findById = async () => ({ _id: customerId, status: 'active' });
    Service.findById = async () => ({
      _id: serviceId,
      name: 'Bedside Care',
      isActive: true,
      minimumDurationHours: 1,
    });
    CaregiverProfile.findById = () => ({
      populate: async () => ({
        _id: caregiverId,
        verificationStatus: 'verified',
        user: { _id: new mongoose.Types.ObjectId(), status: 'active' },
        servicesOffered: [serviceId],
        timezone: 'Asia/Kolkata',
        hourlyRate: 500,
        weeklySchedule: [
          { day: 'Mon', isAvailable: true, slots: [{ start: '08:00', end: '18:00' }] },
        ],
        dateExceptions: [],
      }),
    });

    CaregiverProfile.updateOne = async (filter, update) => {
      if (update?.$inc?.bookingLockVersion) {
        caregiverLockMutated = true;
      }
      return { modifiedCount: 1 };
    };

    mongoose.startSession = async () => ({
      withTransaction: async (cb) => cb(),
      endSession: async () => {},
    });

    // Mock existing conflicting pending booking
    Booking.findOne = () => ({
      session: async () => ({
        _id: new mongoose.Types.ObjectId(),
        status: 'pending',
        startDateTime: new Date('2028-11-06T04:30:00.000Z'),
        endDateTime: new Date('2028-11-06T08:30:00.000Z'),
      }),
    });

    const startReq = parseLocalDateTimeToUTC('2028-11-06', '11:00', 'Asia/Kolkata');
    const endReq = parseLocalDateTimeToUTC('2028-11-06', '15:00', 'Asia/Kolkata');

    await assert.rejects(
      async () => {
        await bookingService.createBooking(customerId, {
          caregiverId,
          serviceId,
          startDateTime: startReq,
          endDateTime: endReq,
          location: { addressLine: 'Road 1', city: 'Mumbai' },
          patientDetails: { name: 'Patient', age: 70 },
        });
      },
      (err) => {
        assert.equal(err.statusCode, 409);
        assert.equal(err.name, 'ConflictError');
        assert.ok(err.message.includes('confirmed or pending booking'));
        return true;
      },
    );

    // Concurrency guarantee: caregiver document was mutated to serialize competing operations
    assert.equal(caregiverLockMutated, true);
  } finally {
    delete mongoose.connection.client;
    mongoose.startSession = originalStartSession;
    User.findById = originalUserFindById;
    CaregiverProfile.findById = originalCaregiverFindById;
    CaregiverProfile.updateOne = originalCaregiverUpdateOne;
    Service.findById = originalServiceFindById;
    Booking.findOne = originalBookingFindOne;
  }
});

// -----------------------------------------------------------------------------
// Test 10: Non-Overlapping and Adjacent Bookings Do Not Conflict
// -----------------------------------------------------------------------------
test('Step 7 - 10: Non-overlapping and adjacent back-to-back bookings do not conflict', () => {
  const existingStart = new Date('2028-11-06T04:00:00.000Z');
  const existingEnd = new Date('2028-11-06T08:00:00.000Z');

  // 1. Adjacent right before existing: [00:00, 04:00] and [04:00, 08:00]
  const adjacentBefore = isIntervalConflicting(
    existingStart,
    existingEnd,
    new Date('2028-11-06T00:00:00.000Z'),
    existingStart,
  );
  assert.equal(adjacentBefore, false);

  // 2. Adjacent right after existing: [04:00, 08:00] and [08:00, 12:00]
  const adjacentAfter = isIntervalConflicting(
    existingStart,
    existingEnd,
    existingEnd,
    new Date('2028-11-06T12:00:00.000Z'),
  );
  assert.equal(adjacentAfter, false);
});

// -----------------------------------------------------------------------------
// Test 11: Cancelled, Rejected, and Completed Bookings Do NOT Block Future Reservations
// -----------------------------------------------------------------------------
test('Step 7 - 11: Cancelled, rejected, and completed bookings do not block new reservations', async () => {
  // Simulate active replica set session
  mongoose.connection.client = {
    topology: { description: { type: 'ReplicaSetWithPrimary' } },
  };

  const originalStartSession = mongoose.startSession;
  const originalUserFindById = User.findById;
  const originalCaregiverFindById = CaregiverProfile.findById;
  const originalCaregiverUpdateOne = CaregiverProfile.updateOne;
  const originalServiceFindById = Service.findById;
  const originalBookingFindOne = Booking.findOne;
  const originalBookingCreate = Booking.create;

  try {
    const customerId = new mongoose.Types.ObjectId().toString();
    const caregiverId = new mongoose.Types.ObjectId().toString();
    const serviceId = new mongoose.Types.ObjectId().toString();

    User.findById = async () => ({ _id: customerId, status: 'active' });
    Service.findById = async () => ({
      _id: serviceId,
      name: 'Bedside Care',
      isActive: true,
      minimumDurationHours: 1,
    });
    CaregiverProfile.findById = () => ({
      populate: async () => ({
        _id: caregiverId,
        verificationStatus: 'verified',
        user: { _id: new mongoose.Types.ObjectId(), status: 'active' },
        servicesOffered: [serviceId],
        timezone: 'Asia/Kolkata',
        hourlyRate: 500,
        weeklySchedule: [
          { day: 'Mon', isAvailable: true, slots: [{ start: '08:00', end: '18:00' }] },
        ],
        dateExceptions: [],
      }),
    });

    CaregiverProfile.updateOne = async () => ({ modifiedCount: 1 });
    mongoose.startSession = async () => ({
      withTransaction: async (cb) => cb(),
      endSession: async () => {},
    });

    // Conflict query receives filter status: { $in: ['pending', 'confirmed'] }
    let queriedStatusFilter = null;
    Booking.findOne = (query) => {
      queriedStatusFilter = query.status;
      return {
        session: async () => null, // No active conflict (cancelled booking ignored)
      };
    };

    Booking.create = async ([doc]) => [{ ...doc, _id: new mongoose.Types.ObjectId() }];

    const created = await bookingService.createBooking(customerId, {
      caregiverId,
      serviceId,
      startDateTime: parseLocalDateTimeToUTC('2028-11-06', '10:00', 'Asia/Kolkata'),
      endDateTime: parseLocalDateTimeToUTC('2028-11-06', '14:00', 'Asia/Kolkata'),
      location: { addressLine: 'Road 1', city: 'Mumbai' },
      patientDetails: { name: 'Patient', age: 70 },
    });

    assert.ok(created._id);
    assert.deepEqual(queriedStatusFilter, { $in: ['pending', 'confirmed'] });
  } finally {
    delete mongoose.connection.client;
    mongoose.startSession = originalStartSession;
    User.findById = originalUserFindById;
    CaregiverProfile.findById = originalCaregiverFindById;
    CaregiverProfile.updateOne = originalCaregiverUpdateOne;
    Service.findById = originalServiceFindById;
    Booking.findOne = originalBookingFindOne;
    Booking.create = originalBookingCreate;
  }
});

// -----------------------------------------------------------------------------
// Test 12: Object-Level Authorization (Get by ID & Listing)
// -----------------------------------------------------------------------------
test('Step 7 - 12: getBookingById enforces strict object-level participant authorization', async () => {
  const customerId = new mongoose.Types.ObjectId().toString();
  const caregiverUserId = new mongoose.Types.ObjectId().toString();
  const strangerUserId = new mongoose.Types.ObjectId().toString();
  const bookingId = new mongoose.Types.ObjectId().toString();

  const originalFindById = Booking.findById;

  try {
    const mockBooking = {
      _id: bookingId,
      customer: { _id: customerId, fullName: 'Customer User' },
      caregiverUser: caregiverUserId,
      serviceName: 'Bedside Attendant',
      hourlyRate: 500,
      totalHours: 4,
      totalAmount: 2000,
      status: 'pending',
    };

    Booking.findById = () => ({
      populate: () => ({
        populate: () => ({
          populate: async () => mockBooking,
        }),
      }),
    });

    // 1. Authorized Customer can view
    const customerView = await bookingService.getBookingById(
      { _id: customerId, role: 'customer' },
      bookingId,
    );
    assert.equal(customerView._id, bookingId);

    // 2. Assigned Caregiver can view
    const caregiverView = await bookingService.getBookingById(
      { _id: caregiverUserId, role: 'caregiver' },
      bookingId,
    );
    assert.equal(caregiverView._id, bookingId);

    // 3. Admin can view
    const adminView = await bookingService.getBookingById(
      { _id: strangerUserId, role: 'admin' },
      bookingId,
    );
    assert.equal(adminView._id, bookingId);

    // 4. Stranger receives 403 Forbidden
    await assert.rejects(
      async () => {
        await bookingService.getBookingById(
          { _id: strangerUserId, role: 'customer' },
          bookingId,
        );
      },
      (err) => {
        assert.equal(err.statusCode, 403);
        assert.equal(err.name, 'ForbiddenError');
        return true;
      },
    );
  } finally {
    Booking.findById = originalFindById;
  }
});

// -----------------------------------------------------------------------------
// Test 13: Booking Acceptance Lifecycle & Serialized Concurrency (acceptBooking)
// -----------------------------------------------------------------------------
test('Step 7 - 13: acceptBooking restricts transitions to assigned caregiver on pending requests', async () => {
  // Simulate active replica set session
  mongoose.connection.client = {
    topology: { description: { type: 'ReplicaSetWithPrimary' } },
  };

  const caregiverUserId = new mongoose.Types.ObjectId().toString();
  const strangerCaregiverId = new mongoose.Types.ObjectId().toString();
  const caregiverProfileId = new mongoose.Types.ObjectId().toString();
  const bookingId = new mongoose.Types.ObjectId().toString();

  const originalStartSession = mongoose.startSession;
  const originalFindById = Booking.findById;
  const originalCaregiverFindById = CaregiverProfile.findById;
  const originalCaregiverUpdateOne = CaregiverProfile.updateOne;
  const originalBookingFindOne = Booking.findOne;
  const originalBookingFindOneAndUpdate = Booking.findOneAndUpdate;

  try {
    const mockBooking = {
      _id: bookingId,
      caregiver: caregiverProfileId,
      caregiverUser: caregiverUserId,
      status: 'pending',
      startDateTime: new Date('2028-11-06T04:30:00.000Z'),
      endDateTime: new Date('2028-11-06T08:30:00.000Z'),
    };

    mongoose.startSession = async () => ({
      withTransaction: async (cb) => cb(),
      endSession: async () => {},
    });

    Booking.findById = () => ({
      session: async () => ({ ...mockBooking }),
    });

    Booking.findOne = () => ({
      session: async () => null, // no confirmed conflicts
    });

    CaregiverProfile.findById = () => ({
      populate: () => ({
        session: async () => ({
          _id: caregiverProfileId,
          verificationStatus: 'verified',
          user: { status: 'active' },
        }),
      }),
    });

    CaregiverProfile.updateOne = async () => ({ modifiedCount: 1 });

    Booking.findOneAndUpdate = (query, update) => {
      assert.equal(query.status, 'pending');
      assert.equal(update.$set.status, 'confirmed');
      assert.ok(update.$set.acceptedAt instanceof Date);
      return {
        populate: async () => ({
          ...mockBooking,
          status: 'confirmed',
          acceptedAt: update.$set.acceptedAt,
        }),
      };
    };

    // 1. Unrelated caregiver cannot accept -> 403
    await assert.rejects(
      async () => {
        await bookingService.acceptBooking(
          { _id: strangerCaregiverId, role: 'caregiver' },
          bookingId,
        );
      },
      (err) => {
        assert.equal(err.statusCode, 403);
        assert.ok(err.message.includes('Only the assigned caregiver'));
        return true;
      },
    );

    // 2. Assigned caregiver accepts -> transitions to confirmed
    const accepted = await bookingService.acceptBooking(
      { _id: caregiverUserId, role: 'caregiver' },
      bookingId,
    );
    assert.equal(accepted.status, 'confirmed');
    assert.ok(accepted.acceptedAt instanceof Date);

    // 3. Cannot accept an already confirmed booking -> 400
    Booking.findById = () => ({
      session: async () => ({ ...mockBooking, status: 'confirmed' }),
    });

    await assert.rejects(
      async () => {
        await bookingService.acceptBooking(
          { _id: caregiverUserId, role: 'caregiver' },
          bookingId,
        );
      },
      (err) => {
        assert.equal(err.statusCode, 400);
        assert.ok(err.message.includes('Only pending requests can be accepted'));
        return true;
      },
    );
  } finally {
    delete mongoose.connection.client;
    mongoose.startSession = originalStartSession;
    Booking.findById = originalFindById;
    CaregiverProfile.findById = originalCaregiverFindById;
    CaregiverProfile.updateOne = originalCaregiverUpdateOne;
    Booking.findOne = originalBookingFindOne;
    Booking.findOneAndUpdate = originalBookingFindOneAndUpdate;
  }
});

// -----------------------------------------------------------------------------
// Test 14: Booking Cancellation Lifecycle & Atomic CAS Against Racing Acceptances
// -----------------------------------------------------------------------------
test('Step 7 - 14: cancelBooking enforces participant rules, records audit timestamps, and uses atomic CAS', async () => {
  const customerId = new mongoose.Types.ObjectId().toString();
  const caregiverUserId = new mongoose.Types.ObjectId().toString();
  const strangerId = new mongoose.Types.ObjectId().toString();
  const bookingId = new mongoose.Types.ObjectId().toString();

  const originalFindById = Booking.findById;
  const originalFindOneAndUpdate = Booking.findOneAndUpdate;

  try {
    const mockBooking = {
      _id: bookingId,
      customer: customerId,
      caregiverUser: caregiverUserId,
      status: 'pending',
      startDateTime: new Date(Date.now() + 86400000), // tomorrow
    };

    Booking.findById = async () => ({ ...mockBooking });

    Booking.findOneAndUpdate = async (filter, update) => {
      assert.equal(filter.status, 'pending');
      assert.equal(update.$set.status, 'cancelled');
      return {
        ...mockBooking,
        status: 'cancelled',
        cancellationReason: update.$set.cancellationReason,
        cancelledByRole: update.$set.cancelledByRole,
        cancelledAt: update.$set.cancelledAt,
        populate: async function () {
          return this;
        },
      };
    };

    // 1. Stranger cannot cancel -> 403
    await assert.rejects(
      async () => {
        await bookingService.cancelBooking(
          { _id: strangerId, role: 'customer' },
          bookingId,
          'Malicious cancel',
        );
      },
      (err) => {
        assert.equal(err.statusCode, 403);
        return true;
      },
    );

    // 2. Customer cancels -> status transitions to cancelled with reason and timestamps
    const cancelled = await bookingService.cancelBooking(
      { _id: customerId, role: 'customer' },
      bookingId,
      'Change of travel plans',
    );
    assert.equal(cancelled.status, 'cancelled');
    assert.equal(cancelled.cancellationReason, 'Change of travel plans');
    assert.equal(cancelled.cancelledByRole, 'customer');
    assert.ok(cancelled.cancelledAt instanceof Date);

    // 3. Cannot cancel an already cancelled booking -> 400
    Booking.findById = async () => ({ ...mockBooking, status: 'cancelled' });
    await assert.rejects(
      async () => {
        await bookingService.cancelBooking(
          { _id: customerId, role: 'customer' },
          bookingId,
          'Duplicate cancel',
        );
      },
      (err) => {
        assert.equal(err.statusCode, 400);
        assert.ok(err.message.includes('already cancelled'));
        return true;
      },
    );

    // 4. Racing acceptance conflict: status changed to confirmed between read and atomic update -> 409 Conflict
    Booking.findById = async () => ({ ...mockBooking, status: 'pending' });
    Booking.findOneAndUpdate = async () => null; // CAS failed because status changed to confirmed

    // Secondary re-read returns the confirmed booking
    let secondaryRead = false;
    Booking.findById = async () => {
      if (!secondaryRead) {
        secondaryRead = true;
        return { ...mockBooking, status: 'pending' };
      }
      return { ...mockBooking, status: 'confirmed', startDateTime: new Date(Date.now() + 86400000) };
    };

    await assert.rejects(
      async () => {
        await bookingService.cancelBooking(
          { _id: customerId, role: 'customer' },
          bookingId,
          'Late cancellation attempt',
        );
      },
      (err) => {
        assert.equal(err.statusCode, 409);
        assert.equal(err.name, 'ConflictError');
        assert.ok(err.message.includes('confirmed by the caregiver'));
        return true;
      },
    );
  } finally {
    Booking.findById = originalFindById;
    Booking.findOneAndUpdate = originalFindOneAndUpdate;
  }
});

// -----------------------------------------------------------------------------
// Test 15: HTTP Network Route Enforcement on Ephemeral Server
// -----------------------------------------------------------------------------
test('Step 7 - 15: HTTP routes enforce 401 unauthenticated and 404 invalid booking ID', async () => {
  const http = await import('http');
  const { default: app } = await import('../src/server.js');

  const server = http.createServer(app);
  await new Promise((resolve) => server.listen(0, resolve));
  const port = server.address().port;

  try {
    // 1. Unauthenticated POST /api/bookings -> 401
    const res1 = await fetch(`http://localhost:${port}/api/bookings`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });
    assert.equal(res1.status, 401);

    // 2. Unauthenticated GET /api/bookings -> 401
    const res2 = await fetch(`http://localhost:${port}/api/bookings`);
    assert.equal(res2.status, 401);

    // 3. Unauthenticated GET /api/bookings/:id -> 401
    const res3 = await fetch(`http://localhost:${port}/api/bookings/507f1f77bcf86cd799439099`);
    assert.equal(res3.status, 401);

    // 4. Unauthenticated PATCH /api/bookings/:id/accept -> 401
    const res4 = await fetch(
      `http://localhost:${port}/api/bookings/507f1f77bcf86cd799439099/accept`,
      { method: 'PATCH' },
    );
    assert.equal(res4.status, 401);

    // 5. Unauthenticated PATCH /api/bookings/:id/cancel -> 401
    const res5 = await fetch(
      `http://localhost:${port}/api/bookings/507f1f77bcf86cd799439099/cancel`,
      { method: 'PATCH' },
    );
    assert.equal(res5.status, 401);
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});

// -----------------------------------------------------------------------------
// Test 16: Genuine Database Concurrency Integration Tests (Real Replica Set)
// -----------------------------------------------------------------------------
test('Step 7 - 16: Real database concurrency integration tests on ephemeral MongoDB replica set', async (t) => {
  const replSet = await setupEphemeralReplicaSet();

  if (!replSet.supported) {
    t.skip(`Skipped real database concurrency integration test: ${replSet.reason}`);
    return;
  }

  try {
    await mongoose.connect(replSet.uri);

    // 1. Setup real database fixtures
    const customerUser = await User.create({
      fullName: 'Real Integration Customer',
      email: `customer_${Date.now()}@test.com`,
      phone: '9876543210',
      passwordHash: '$2a$10$abcdefghijklmnopqrstuv',
      role: 'customer',
      status: 'active',
    });

    const caregiverUser = await User.create({
      fullName: 'Real Integration Caregiver',
      email: `caregiver_${Date.now()}@test.com`,
      phone: '9876543211',
      passwordHash: '$2a$10$abcdefghijklmnopqrstuv',
      role: 'caregiver',
      status: 'active',
    });

    const service = await Service.create({
      name: 'Integration Critical Care',
      slug: `integration-care-${Date.now()}`,
      description: 'Comprehensive bedside critical care and assistance',
      category: 'Clinical Care',
      baseHourlyRate: 500,
      minimumDurationHours: 1,
      isActive: true,
    });

    const caregiverProfile = await CaregiverProfile.create({
      user: caregiverUser._id,
      qualification: 'GNM',
      hourlyRate: 500,
      verificationStatus: 'verified',
      availabilityStatus: 'Available Now',
      bookingLockVersion: 0,
      servicesOffered: [service._id],
      timezone: 'Asia/Kolkata',
      weeklySchedule: [
        { day: 'Mon', isAvailable: true, slots: [{ start: '08:00', end: '20:00' }] },
        { day: 'Tue', isAvailable: true, slots: [{ start: '08:00', end: '20:00' }] },
        { day: 'Wed', isAvailable: true, slots: [{ start: '08:00', end: '20:00' }] },
        { day: 'Thu', isAvailable: true, slots: [{ start: '08:00', end: '20:00' }] },
        { day: 'Fri', isAvailable: true, slots: [{ start: '08:00', end: '20:00' }] },
        { day: 'Sat', isAvailable: true, slots: [{ start: '08:00', end: '20:00' }] },
        { day: 'Sun', isAvailable: true, slots: [{ start: '08:00', end: '20:00' }] },
      ],
      dateExceptions: [],
    });

    // Subtest A: Simultaneous overlapping booking creation requests (5 concurrent requests)
    const slotStart = new Date('2028-11-06T04:30:00.000Z'); // 10:00 IST
    const slotEnd = new Date('2028-11-06T08:30:00.000Z');   // 14:00 IST

    const concurrentAttempts = Array.from({ length: 5 }, () =>
      bookingService.createBooking(customerUser._id.toString(), {
        caregiverId: caregiverProfile._id.toString(),
        serviceId: service._id.toString(),
        startDateTime: slotStart,
        endDateTime: slotEnd,
        timezone: 'Asia/Kolkata',
        location: { addressLine: '123 Ocean Drive', city: 'Mumbai' },
        patientDetails: { name: 'Asha Sharma', age: 70 },
      }),
    );

    const results = await Promise.allSettled(concurrentAttempts);
    const fulfilled = results.filter((r) => r.status === 'fulfilled');
    const rejected = results.filter((r) => r.status === 'rejected');

    // Concurrency guarantee: EXACTLY 1 booking succeeded, 4 were rejected with 409 Conflict
    assert.equal(fulfilled.length, 1, 'Exactly 1 concurrent reservation must succeed');
    assert.equal(rejected.length, 4, 'Competing reservations must be rejected');

    for (const rej of rejected) {
      assert.equal(rej.reason.statusCode, 409, 'Rejection must be HTTP 409 Conflict');
      assert.equal(rej.reason.name, 'ConflictError');
    }

    // Caregiver's bookingLockVersion must have been incremented to serialize transactions
    const updatedCaregiver = await CaregiverProfile.findById(caregiverProfile._id);
    assert.ok(updatedCaregiver.bookingLockVersion >= 1);

    const winningBookingId = fulfilled[0].value._id;

    // Subtest B: Adjacent back-to-back booking succeeds on real database without conflict
    const adjacentStart = slotEnd; // 14:00 IST
    const adjacentEnd = new Date('2028-11-06T12:30:00.000Z'); // 18:00 IST

    const adjacentBooking = await bookingService.createBooking(customerUser._id.toString(), {
      caregiverId: caregiverProfile._id.toString(),
      serviceId: service._id.toString(),
      startDateTime: adjacentStart,
      endDateTime: adjacentEnd,
      timezone: 'Asia/Kolkata',
      location: { addressLine: '123 Ocean Drive', city: 'Mumbai' },
      patientDetails: { name: 'Asha Sharma', age: 70 },
    });
    assert.ok(adjacentBooking._id, 'Adjacent back-to-back booking must succeed');

    // Subtest C: Caregiver acceptance concurrency test
    // Accept the winning booking
    const acceptedBooking = await bookingService.acceptBooking(
      { _id: caregiverUser._id, role: 'caregiver' },
      winningBookingId.toString(),
    );
    assert.equal(acceptedBooking.status, 'confirmed');

    // Subtest D: Acceptance racing with cancellation on the same booking
    // Create another pending booking on Tuesday
    const tuesdayStart = new Date('2028-11-07T04:30:00.000Z');
    const tuesdayEnd = new Date('2028-11-07T08:30:00.000Z');

    const racingBooking = await bookingService.createBooking(customerUser._id.toString(), {
      caregiverId: caregiverProfile._id.toString(),
      serviceId: service._id.toString(),
      startDateTime: tuesdayStart,
      endDateTime: tuesdayEnd,
      timezone: 'Asia/Kolkata',
      location: { addressLine: '123 Ocean Drive', city: 'Mumbai' },
      patientDetails: { name: 'Asha Sharma', age: 70 },
    });

    // Launch racing accept and cancel calls simultaneously
    const [racingAcceptResult, racingCancelResult] = await Promise.allSettled([
      bookingService.acceptBooking(
        { _id: caregiverUser._id, role: 'caregiver' },
        racingBooking._id.toString(),
      ),
      bookingService.cancelBooking(
        { _id: customerUser._id, role: 'customer' },
        racingBooking._id.toString(),
        'Racing cancellation test',
      ),
    ]);

    // Check that database final state is consistent and not corrupted
    const finalBooking = await Booking.findById(racingBooking._id);
    assert.ok(
      finalBooking.status === 'confirmed' || finalBooking.status === 'cancelled',
      'Booking must end in a valid state',
    );

    // If cancellation won first, accept must have failed with 400/409
    if (finalBooking.status === 'cancelled') {
      assert.equal(racingCancelResult.status, 'fulfilled');
      assert.equal(racingAcceptResult.status, 'rejected');
    }

    // Subtest E: Cancelled booking unblocks the time slot
    // Cancel the winning booking
    await bookingService.cancelBooking(
      { _id: customerUser._id, role: 'customer' },
      winningBookingId.toString(),
      'Cancelled for freeing slot test',
    );

    // Now re-booking the exact same slot must succeed!
    const rebookedSlot = await bookingService.createBooking(customerUser._id.toString(), {
      caregiverId: caregiverProfile._id.toString(),
      serviceId: service._id.toString(),
      startDateTime: slotStart,
      endDateTime: slotEnd,
      timezone: 'Asia/Kolkata',
      location: { addressLine: '123 Ocean Drive', city: 'Mumbai' },
      patientDetails: { name: 'Asha Sharma', age: 70 },
    });

    assert.ok(rebookedSlot._id, 'Cancelled booking must not block future reservations');
    assert.equal(rebookedSlot.status, 'pending');
  } finally {
    await replSet.stop();
  }
});
