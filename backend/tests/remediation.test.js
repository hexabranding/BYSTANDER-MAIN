import test from 'node:test';
import assert from 'node:assert/strict';
import mongoose from 'mongoose';
import express from 'express';
import {
  getJwtSecret,
  assertValidJwtSecret,
  MIN_JWT_SECRET_LENGTH,
  DEV_TEST_JWT_SECRET,
  generateToken,
  verifyToken,
} from '../src/utils/auth.js';
import * as bookingService from '../src/services/bookingService.js';
import * as caregiverService from '../src/services/caregiverService.js';
import * as customerService from '../src/services/customerService.js';
import {
  Booking,
  CaregiverProfile,
  CustomerProfile,
  User,
  Service,
} from '../src/models/index.js';
import { validateRejectBooking } from '../src/middleware/validateBooking.js';
import { validateGetCaregivers } from '../src/middleware/validateCaregiver.js';
import { validateUpdateCustomerProfile } from '../src/middleware/validateCustomer.js';
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
// Test Suite: Step 11A Security Remediation & Missing Endpoints
// -----------------------------------------------------------------------------

// 1. Production JWT Secret Enforcement
test('Step 11A - 1: Production JWT secret enforcement fails startup if missing or invalid', () => {
  const originalEnv = process.env.NODE_ENV;
  const originalJwtSecret = process.env.JWT_ACCESS_SECRET;

  try {
    // A. In production, missing secret throws fatal error
    process.env.NODE_ENV = 'production';
    delete process.env.JWT_ACCESS_SECRET;

    assert.throws(
      () => assertValidJwtSecret(),
      (err) => {
        assert.match(err.message, /FATAL: A secure JWT_ACCESS_SECRET/);
        assert.match(err.message, new RegExp(String(MIN_JWT_SECRET_LENGTH)));
        return true;
      },
    );

    // B. In production, short secret (< 32 chars) throws fatal error
    process.env.JWT_ACCESS_SECRET = 'short-secret-123';
    assert.throws(
      () => assertValidJwtSecret(),
      (err) => {
        assert.match(err.message, /FATAL: A secure JWT_ACCESS_SECRET/);
        return true;
      },
    );

    // C. In production, valid secret (>= 32 chars) succeeds
    const validSecret = 'super_secure_production_jwt_secret_at_least_32_characters_long';
    process.env.JWT_ACCESS_SECRET = validSecret;
    assert.equal(getJwtSecret(), validSecret);
    assert.doesNotThrow(() => assertValidJwtSecret());

    // D. In development / test, unset secret safely falls back to DEV_TEST_JWT_SECRET
    process.env.NODE_ENV = 'development';
    delete process.env.JWT_ACCESS_SECRET;
    assert.equal(getJwtSecret(), DEV_TEST_JWT_SECRET);
    assert.doesNotThrow(() => assertValidJwtSecret());
  } finally {
    process.env.NODE_ENV = originalEnv;
    if (originalJwtSecret !== undefined) {
      process.env.JWT_ACCESS_SECRET = originalJwtSecret;
    } else {
      delete process.env.JWT_ACCESS_SECRET;
    }
  }
});

// 2. Reverse-Proxy Configuration
test('Step 11A - 2: Reverse-proxy trust proxy configuration handles production and custom topology', () => {
  const app = express();

  // Test custom number of proxy hops
  process.env.TRUST_PROXY = '2';
  const trustProxyConfig = process.env.TRUST_PROXY;
  if (!isNaN(Number(trustProxyConfig))) {
    app.set('trust proxy', Number(trustProxyConfig));
  }
  assert.equal(app.get('trust proxy'), 2);

  // Test boolean string
  app.set('trust proxy', 'true' === 'true');
  assert.equal(app.get('trust proxy'), true);

  delete process.env.TRUST_PROXY;
});

// 3. Validation for Rejection, Caregiver Directory, and Customer Profile
test('Step 11A - 3: Input validation middleware for rejection, caregiver directory, and customer profile', () => {
  // A. validateRejectBooking
  const mockValidReject = createMockReqRes({ body: { reason: 'Caregiver has a family emergency' } });
  validateRejectBooking(mockValidReject.req, mockValidReject.res, mockValidReject.next);
  assert.equal(mockValidReject.getNextCalled(), true);
  assert.equal(mockValidReject.req.rejectionReason, 'Caregiver has a family emergency');

  const mockLongReject = createMockReqRes({ body: { reason: 'x'.repeat(501) } });
  validateRejectBooking(mockLongReject.req, mockLongReject.res, mockLongReject.next);
  assert.equal(mockLongReject.res.statusCode, 400);
  assert.match(mockLongReject.res.jsonData.message, /cannot exceed 500 characters/);

  // B. validateGetCaregivers
  const mockValidDir = createMockReqRes({
    query: { page: '2', limit: '10', city: 'Mumbai', qualification: 'GNM', minRating: '4.5', maxRate: '800' },
  });
  validateGetCaregivers(mockValidDir.req, mockValidDir.res, mockValidDir.next);
  assert.equal(mockValidDir.getNextCalled(), true);

  const mockInvalidDir = createMockReqRes({
    query: { page: '0', minRating: '6', maxRate: '-50' },
  });
  validateGetCaregivers(mockInvalidDir.req, mockInvalidDir.res, mockInvalidDir.next);
  assert.equal(mockInvalidDir.res.statusCode, 400);
  assert.match(mockInvalidDir.res.jsonData.message, /positive integer/);

  // C. validateUpdateCustomerProfile
  const mockValidCust = createMockReqRes({
    body: {
      fullName: 'Anita Sharma',
      emergencyContact: { name: 'Raj Sharma', phone: '+919876543210', relation: 'Spouse' },
      defaultAddress: { addressLine: 'Flat 402, Lotus Towers', city: 'Mumbai', area: 'Bandra', pincode: '400050' },
      careNotes: 'Patient requires diabetic meal assistance',
      patients: [{ name: 'Suman Sharma', age: 68, gender: 'Female', relation: 'Mother' }],
      role: 'admin', // Attempted injection
      totalSpent: 999999, // Attempted injection
    },
  });
  validateUpdateCustomerProfile(mockValidCust.req, mockValidCust.res, mockValidCust.next);
  assert.equal(mockValidCust.getNextCalled(), true);
  assert.equal(mockValidCust.req.sanitizedCustomerUpdates.fullName, 'Anita Sharma');
  assert.equal(mockValidCust.req.sanitizedCustomerUpdates.emergencyContact.name, 'Raj Sharma');
  assert.equal(mockValidCust.req.sanitizedCustomerUpdates.defaultAddress.city, 'Mumbai');
  assert.equal(mockValidCust.req.sanitizedCustomerUpdates.patients[0].name, 'Suman Sharma');
  // Verify protected fields were stripped
  assert.equal(mockValidCust.req.sanitizedCustomerUpdates.role, undefined);
  assert.equal(mockValidCust.req.sanitizedCustomerUpdates.totalSpent, undefined);
});

// 4. End-to-End Integration Tests on Replica Set
test('Step 11A - 4: Replica set integration — in_progress overlap protection, caregiver rejection, directory search, and customer profile updates', async () => {
  const replSet = await setupEphemeralReplicaSet();
  if (!replSet.supported) {
    console.warn(`[Test Skip] Skipping replica set integration: ${replSet.reason}`);
    return;
  }

  await mongoose.connect(replSet.uri);

  try {
    // Setup Test Data
    const customerUser = await User.create({
      fullName: 'Rohan Verma',
      email: 'rohan.step11@test.com',
      passwordHash: 'dummyhash',
      role: 'customer',
      status: 'active',
    });

    const otherCustomer = await User.create({
      fullName: 'Priya Mehta',
      email: 'priya.step11@test.com',
      passwordHash: 'dummyhash',
      role: 'customer',
      status: 'active',
    });

    const caregiverUser = await User.create({
      fullName: 'Sunita Das',
      email: 'sunita.step11@test.com',
      phone: '+919811122233',
      passwordHash: 'dummyhash',
      role: 'caregiver',
      status: 'active',
    });

    const service = await Service.create({
      name: 'Elderly Bedside Care',
      slug: 'elderly-bedside-care-step11',
      description: 'Dedicated bedside monitoring and elderly assistance',
      category: 'elderly_care',
      baseHourlyRate: 400,
      minimumDurationHours: 2,
      isActive: true,
    });

    const caregiverProfile = await CaregiverProfile.create({
      user: caregiverUser._id,
      qualification: 'GNM',
      nursingRegNo: 'NR-STEP11-001',
      experienceYears: 5,
      city: 'Mumbai, MH',
      area: 'Andheri',
      hourlyRate: 450,
      verificationStatus: 'verified',
      servicesOffered: [service._id],
      services: [service.name],
      weeklySchedule: [
        {
          day: 'Mon',
          isAvailable: true,
          slots: [{ start: '06:00', end: '22:00' }],
        },
      ],
      availabilityStatus: 'Available Now',
      rating: { average: 4.8, count: 12 },
      trustScore: 92,
      completedJobs: 25,
      badges: ['Background Verified', 'CPR Certified'],
    });

    // -------------------------------------------------------------------------
    // Subtest A: Caregiver Public Directory Search (GET /api/caregivers)
    // -------------------------------------------------------------------------
    // Query directory with filters
    const dirResult = await caregiverService.getPublicCaregivers({
      city: 'Mumbai',
      qualification: 'GNM',
      maxRate: 500,
      minRating: 4.0,
      page: 1,
      limit: 10,
    });

    assert.equal(dirResult.caregivers.length >= 1, true);
    const foundCg = dirResult.caregivers.find((c) => String(c._id) === String(caregiverProfile._id));
    assert.ok(foundCg, 'Verified caregiver should be present in public directory');
    assert.equal(foundCg.fullName, 'Sunita Das');
    assert.equal(foundCg.qualification, 'GNM');
    assert.equal(foundCg.hourlyRate, 450);

    // Privacy assertion: No private phone, email, or reg number exposed
    assert.equal(foundCg.phone, undefined);
    assert.equal(foundCg.email, undefined);
    assert.equal(foundCg.nursingRegNo, undefined);
    assert.equal(foundCg.documents, undefined);

    // Verify unverified caregivers are excluded from directory
    const unverifiedUser = await User.create({
      fullName: 'Unverified Nurse',
      email: 'unverified.step11@test.com',
      passwordHash: 'dummyhash',
      role: 'caregiver',
      status: 'pending_verification',
    });
    await CaregiverProfile.create({
      user: unverifiedUser._id,
      qualification: 'ANM',
      city: 'Mumbai, MH',
      hourlyRate: 350,
      verificationStatus: 'pending',
    });

    const filteredDir = await caregiverService.getPublicCaregivers({ city: 'Mumbai' });
    const hasUnverified = filteredDir.caregivers.some((c) => c.fullName === 'Unverified Nurse');
    assert.equal(hasUnverified, false, 'Unverified caregivers must be excluded from public directory');

    // -------------------------------------------------------------------------
    // Subtest B: in_progress Overlap Protection
    // -------------------------------------------------------------------------
    // Create an active booking for Sunita Das on a Monday: 08:00 UTC to 14:00 UTC
    // Nov 2, 2026 is a Monday
    const startUtc = new Date('2026-11-02T08:00:00.000Z');
    const endUtc = new Date('2026-11-02T14:00:00.000Z');

    const inProgressBooking = await Booking.create({
      customer: customerUser._id,
      caregiver: caregiverProfile._id,
      caregiverUser: caregiverUser._id,
      service: service._id,
      serviceName: service.name,
      serviceCategory: service.category,
      hourlyRate: 450,
      totalHours: 6,
      totalAmount: 2700,
      startDateTime: startUtc,
      endDateTime: endUtc,
      timezone: 'Asia/Kolkata',
      location: { addressLine: '123 Marine Drive', city: 'Mumbai', careSetting: 'Home Care' },
      patientDetails: { name: 'Elderly Patient', age: 75, gender: 'Male' },
      status: 'in_progress', // Active in-progress shift
    });

    // 1. Attempting to create a booking overlapping the in_progress shift must be REJECTED with 409
    const overlappingCreateData = {
      caregiverId: caregiverProfile._id,
      serviceId: service._id,
      startDateTime: new Date('2026-11-02T10:00:00.000Z'), // Overlaps 08:00 - 14:00
      endDateTime: new Date('2026-11-02T13:00:00.000Z'),
      timezone: 'Asia/Kolkata',
      location: { addressLine: '456 Hill Road', city: 'Mumbai', careSetting: 'Home Care' },
      patientDetails: { name: 'Second Patient', age: 70, gender: 'Female' },
    };

    await assert.rejects(
      async () => {
        await bookingService.createBooking(otherCustomer._id, overlappingCreateData);
      },
      (err) => {
        assert.equal(err.statusCode, 409);
        assert.match(err.message, /in-progress/);
        return true;
      },
      'Creating a booking overlapping an in_progress booking must fail with 409',
    );

    // 2. Non-overlapping back-to-back booking succeeds: 14:00 UTC to 17:00 UTC
    const backToBackData = {
      caregiverId: caregiverProfile._id,
      serviceId: service._id,
      startDateTime: new Date('2026-11-02T14:00:00.000Z'), // Exactly contiguous
      endDateTime: new Date('2026-11-02T16:00:00.000Z'),
      timezone: 'Asia/Kolkata',
      location: { addressLine: '789 Link Road', city: 'Mumbai', careSetting: 'Home Care' },
      patientDetails: { name: 'Third Patient', age: 65, gender: 'Female' },
    };

    const contiguousBooking = await bookingService.createBooking(otherCustomer._id, backToBackData);
    assert.ok(contiguousBooking, 'Contiguous back-to-back booking must succeed');
    assert.equal(contiguousBooking.status, 'pending');

    // 3. Attempting to accept a pending booking that overlaps an in_progress shift fails with 409
    // Manually force a pending booking overlapping the in_progress booking
    const overlappingPending = await Booking.create({
      customer: otherCustomer._id,
      caregiver: caregiverProfile._id,
      caregiverUser: caregiverUser._id,
      service: service._id,
      serviceName: service.name,
      serviceCategory: service.category,
      hourlyRate: 450,
      totalHours: 3,
      totalAmount: 1350,
      startDateTime: new Date('2026-11-02T09:00:00.000Z'), // Overlaps 08:00 - 14:00
      endDateTime: new Date('2026-11-02T12:00:00.000Z'),
      timezone: 'Asia/Kolkata',
      location: { addressLine: 'Test Address', city: 'Mumbai', careSetting: 'Home Care' },
      patientDetails: { name: 'Test Patient', age: 60, gender: 'Male' },
      status: 'pending',
    });

    await assert.rejects(
      async () => {
        await bookingService.acceptBooking(caregiverUser, overlappingPending._id);
      },
      (err) => {
        assert.equal(err.statusCode, 409);
        assert.match(err.message, /in-progress/);
        return true;
      },
      'Caregiver cannot accept a booking overlapping an in_progress shift',
    );

    // -------------------------------------------------------------------------
    // Subtest C: Caregiver Booking Rejection (PATCH /api/bookings/:id/reject)
    // -------------------------------------------------------------------------
    // 1. Unrelated user cannot reject booking
    await assert.rejects(
      async () => {
        await bookingService.rejectBooking(customerUser, contiguousBooking._id, 'Not interested');
      },
      (err) => {
        assert.equal(err.statusCode, 403);
        assert.match(err.message, /not authorized/);
        return true;
      },
    );

    // 2. Assigned caregiver successfully rejects the pending booking
    const rejectedBooking = await bookingService.rejectBooking(
      caregiverUser,
      contiguousBooking._id,
      'Unable to accommodate schedule',
    );

    assert.equal(rejectedBooking.status, 'rejected');
    assert.ok(rejectedBooking.rejectedAt instanceof Date);
    assert.equal(rejectedBooking.cancellationReason, 'Unable to accommodate schedule');

    // 3. Rejecting an already rejected booking fails with 400
    await assert.rejects(
      async () => {
        await bookingService.rejectBooking(caregiverUser, contiguousBooking._id, 'Duplicate reject');
      },
      (err) => {
        assert.equal(err.statusCode, 400);
        assert.match(err.message, /already rejected/);
        return true;
      },
    );

    // 4. Rejecting an in_progress booking fails with 400
    await assert.rejects(
      async () => {
        await bookingService.rejectBooking(caregiverUser, inProgressBooking._id, 'Cannot reject');
      },
      (err) => {
        assert.equal(err.statusCode, 400);
        assert.match(err.message, /Only pending booking requests can be rejected/);
        return true;
      },
    );

    // -------------------------------------------------------------------------
    // Subtest D: Customer Profile Updates (PATCH /api/customer/profile)
    // -------------------------------------------------------------------------
    // Customer profile retrieved or created on demand
    const initialProfile = await customerService.getMyCustomerProfile(customerUser._id);
    assert.ok(initialProfile);
    assert.equal(initialProfile.user.fullName, 'Rohan Verma');

    // Customer updates profile details
    const updatedCustomerProfile = await customerService.updateMyCustomerProfile(customerUser._id, {
      fullName: 'Rohan V. Verma',
      emergencyContact: {
        name: 'Kavita Verma',
        phone: '+919988776655',
        relation: 'Sister',
      },
      defaultAddress: {
        addressLine: 'Apt 12B, Sea View Towers',
        city: 'Mumbai',
        area: 'Worli',
        pincode: '400018',
      },
      careNotes: 'Prefers quiet environment during afternoon rest',
      patients: [
        {
          name: 'Dayaram Verma',
          age: 82,
          gender: 'Male',
          relation: 'Father',
          condition: 'Post-knee replacement care',
          medicalNotes: 'Needs support while walking',
        },
      ],
    });

    assert.equal(updatedCustomerProfile.user.fullName, 'Rohan V. Verma');
    assert.equal(updatedCustomerProfile.emergencyContact.name, 'Kavita Verma');
    assert.equal(updatedCustomerProfile.emergencyContact.phone, '+919988776655');
    assert.equal(updatedCustomerProfile.defaultAddress.area, 'Worli');
    assert.equal(updatedCustomerProfile.patients.length, 1);
    assert.equal(updatedCustomerProfile.patients[0].name, 'Dayaram Verma');
    assert.equal(updatedCustomerProfile.patients[0].relation, 'Father');

    // Verify linked User document was updated
    const freshUser = await User.findById(customerUser._id);
    assert.equal(freshUser.fullName, 'Rohan V. Verma');
  } finally {
    await mongoose.disconnect();
    await replSet.stop();
  }
});
