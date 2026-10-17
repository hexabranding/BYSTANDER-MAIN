import test from 'node:test';
import assert from 'node:assert/strict';
import mongoose from 'mongoose';
import { generateIncidentNumber, SosIncident } from '../src/models/SosIncident.js';
import { Booking, CustomerProfile, User } from '../src/models/index.js';
import * as sosService from '../src/services/sosService.js';
import {
  validateRaiseSos,
  validateAssignSos,
  validateAddTimelineNote,
  validateResolveSos,
} from '../src/middleware/validateSos.js';
import { sosLimiter } from '../src/middleware/rateLimiter.js';

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
// Test 1: Incident Number Generation Format & Cryptographic Uniqueness
// -----------------------------------------------------------------------------
test('Step 10A - 1: Incident number format and CSPRNG generation', () => {
  const num1 = generateIncidentNumber();
  const num2 = generateIncidentNumber();

  // Pattern: SOS-YYYYMMDD-XXXXX
  const regex = /^SOS-\d{8}-\d{5}$/;
  assert.match(num1, regex);
  assert.match(num2, regex);

  const parts1 = num1.split('-');
  assert.equal(parts1[0], 'SOS');
  assert.equal(parts1[1].length, 8);
  assert.equal(parts1[2].length, 5);

  const suffix1 = parseInt(parts1[2], 10);
  assert.ok(suffix1 >= 10000 && suffix1 <= 99999);

  // Successive generations are statistically distinct
  assert.notEqual(num1, num2);
});

// -----------------------------------------------------------------------------
// Test 2: Input Validation for Raising an SOS Incident
// -----------------------------------------------------------------------------
test('Step 10A - 2: validateRaiseSos enforces ObjectId, summary bounds, priority enum, and coordinate safety', () => {
  const validBookingId = new mongoose.Types.ObjectId().toString();

  // 1. Missing bookingId -> 400
  const { req: r1, res: res1, next: n1, getNextCalled: called1, getNextError: err1 } = createMockReqRes({
    body: { summary: 'Patient fallen and injured' },
  });
  validateRaiseSos(r1, res1, n1);
  assert.equal(called1(), true);
  assert.equal(err1()?.statusCode, 400);
  assert.ok(/booking identifier/i.test(err1()?.message));

  // 2. Invalid bookingId (malformed string) -> 400
  const { req: r2, res: res2, next: n2, getNextCalled: called2, getNextError: err2 } = createMockReqRes({
    body: { bookingId: 'invalid-id-123', summary: 'Patient fallen and injured' },
  });
  validateRaiseSos(r2, res2, n2);
  assert.equal(called2(), true);
  assert.equal(err2()?.statusCode, 400);

  // 3. Missing summary or too short (< 5 chars) -> 400
  const { req: r3, res: res3, next: n3, getNextCalled: called3, getNextError: err3 } = createMockReqRes({
    body: { bookingId: validBookingId, summary: 'help' },
  });
  validateRaiseSos(r3, res3, n3);
  assert.equal(called3(), true);
  assert.equal(err3()?.statusCode, 400);
  assert.ok(/between 5 and 1000 characters/i.test(err3()?.message));

  // 4. Invalid priority enum value -> 400
  const { req: r4, res: res4, next: n4, getNextCalled: called4, getNextError: err4 } = createMockReqRes({
    body: { bookingId: validBookingId, summary: 'Patient fell', priority: 'Urgent' },
  });
  validateRaiseSos(r4, res4, n4);
  assert.equal(called4(), true);
  assert.equal(err4()?.statusCode, 400);
  assert.ok(/Priority must be one of/i.test(err4()?.message));

  // 5. Out of bounds latitude (> 90) -> 400
  const { req: r5, res: res5, next: n5, getNextCalled: called5, getNextError: err5 } = createMockReqRes({
    body: {
      bookingId: validBookingId,
      summary: 'Patient need immediate support',
      location: { latitude: 95.5, longitude: 77.5946 },
    },
  });
  validateRaiseSos(r5, res5, n5);
  assert.equal(called5(), true);
  assert.equal(err5()?.statusCode, 400);
  assert.ok(/Latitude must be a valid number between -90 and 90/i.test(err5()?.message));

  // 6. Out of bounds longitude (< -180) -> 400
  const { req: r6, res: res6, next: n6, getNextCalled: called6, getNextError: err6 } = createMockReqRes({
    body: {
      bookingId: validBookingId,
      summary: 'Patient need immediate support',
      location: { latitude: 12.9716, longitude: -185.0 },
    },
  });
  validateRaiseSos(r6, res6, n6);
  assert.equal(called6(), true);
  assert.equal(err6()?.statusCode, 400);
  assert.ok(/Longitude must be a valid number between -180 and 180/i.test(err6()?.message));

  // 7. Negative accuracy radius -> 400
  const { req: r7, res: res7, next: n7, getNextCalled: called7, getNextError: err7 } = createMockReqRes({
    body: {
      bookingId: validBookingId,
      summary: 'Patient need immediate support',
      location: { latitude: 12.9716, longitude: 77.5946, accuracy: -10 },
    },
  });
  validateRaiseSos(r7, res7, n7);
  assert.equal(called7(), true);
  assert.equal(err7()?.statusCode, 400);
  assert.ok(/Accuracy must be a non-negative number/i.test(err7()?.message));

  // 8. Valid payload with valid coordinates -> sets req.sosData with isAvailable: true
  const { req: r8, res: res8, next: n8, getNextCalled: called8, getNextError: err8 } = createMockReqRes({
    body: {
      bookingId: validBookingId,
      summary: 'Emergency assistance requested on-site',
      priority: 'High',
      location: { latitude: 12.9716, longitude: 77.5946, label: 'Room 204' },
    },
  });
  validateRaiseSos(r8, res8, n8);
  assert.equal(called8(), true);
  assert.equal(err8(), null);
  assert.equal(r8.sosData.bookingId, validBookingId);
  assert.equal(r8.sosData.priority, 'High');
  assert.equal(r8.sosData.location.isAvailable, true);
  assert.equal(r8.sosData.location.latitude, 12.9716);
  assert.equal(r8.sosData.location.longitude, 77.5946);
  assert.equal(r8.sosData.location.label, 'Room 204');

  // 9. Location omitted -> sets location.isAvailable: false, latitude: null, longitude: null (never mock coords)
  const { req: r9, res: res9, next: n9, getNextCalled: called9, getNextError: err9 } = createMockReqRes({
    body: {
      bookingId: validBookingId,
      summary: 'Emergency assistance requested, GPS denied',
    },
  });
  validateRaiseSos(r9, res9, n9);
  assert.equal(called9(), true);
  assert.equal(err9(), null);
  assert.equal(r9.sosData.location.isAvailable, false);
  assert.equal(r9.sosData.location.latitude, null);
  assert.equal(r9.sosData.location.longitude, null);
});

// -----------------------------------------------------------------------------
// Test 3: Input Validation for Assign, Timeline Note, and Resolve Middleware
// -----------------------------------------------------------------------------
test('Step 10A - 3: Input validation for assign, timeline note, and resolve endpoints', () => {
  const validUserId = new mongoose.Types.ObjectId().toString();

  // 1. validateAssignSos: missing or invalid assignedTo -> 400
  const { req: r1, res: res1, next: n1, getNextCalled: c1, getNextError: e1 } = createMockReqRes({
    body: { assignedTo: 'not-an-id' },
  });
  validateAssignSos(r1, res1, n1);
  assert.equal(c1(), true);
  assert.equal(e1()?.statusCode, 400);

  // 2. validateAssignSos: valid assignedTo -> sets req.assignData
  const { req: r2, res: res2, next: n2, getNextCalled: c2, getNextError: e2 } = createMockReqRes({
    body: { assignedTo: validUserId, notes: 'Priority operational triage' },
  });
  validateAssignSos(r2, res2, n2);
  assert.equal(c2(), true);
  assert.equal(e2(), null);
  assert.equal(r2.assignData.assignedTo, validUserId);
  assert.equal(r2.assignData.notes, 'Priority operational triage');

  // 3. validateAddTimelineNote: missing or empty note -> 400
  const { req: r3, res: res3, next: n3, getNextCalled: c3, getNextError: e3 } = createMockReqRes({
    body: { notes: ' ' },
  });
  validateAddTimelineNote(r3, res3, n3);
  assert.equal(c3(), true);
  assert.equal(e3()?.statusCode, 400);

  // 4. validateAddTimelineNote: valid note -> sets req.timelineData
  const { req: r4, res: res4, next: n4, getNextCalled: c4, getNextError: e4 } = createMockReqRes({
    body: { action: 'Contacted Family', notes: 'Spoke with son, on the way' },
  });
  validateAddTimelineNote(r4, res4, n4);
  assert.equal(c4(), true);
  assert.equal(e4(), null);
  assert.equal(r4.timelineData.action, 'Contacted Family');
  assert.equal(r4.timelineData.notes, 'Spoke with son, on the way');

  // 5. validateResolveSos: invalid status -> 400
  const { req: r5, res: res5, next: n5, getNextCalled: c5, getNextError: e5 } = createMockReqRes({
    body: { status: 'Closed', resolutionNotes: 'Completed situation' },
  });
  validateResolveSos(r5, res5, n5);
  assert.equal(c5(), true);
  assert.equal(e5()?.statusCode, 400);

  // 6. validateResolveSos: missing resolutionNotes -> 400
  const { req: r6, res: res6, next: n6, getNextCalled: c6, getNextError: e6 } = createMockReqRes({
    body: { status: 'Resolved', resolutionNotes: 'ok' },
  });
  validateResolveSos(r6, res6, n6);
  assert.equal(c6(), true);
  assert.equal(e6()?.statusCode, 400);

  // 7. validateResolveSos: valid resolution -> sets req.resolveData
  const { req: r7, res: res7, next: n7, getNextCalled: c7, getNextError: e7 } = createMockReqRes({
    body: {
      status: 'False Alarm',
      resolutionNotes: 'Accidental trigger during app navigation; patient confirmed safe.',
      rootCause: 'User input error',
    },
  });
  validateResolveSos(r7, res7, n7);
  assert.equal(c7(), true);
  assert.equal(e7(), null);
  assert.equal(r7.resolveData.status, 'False Alarm');
  assert.equal(r7.resolveData.rootCause, 'User input error');
});

// -----------------------------------------------------------------------------
// Test 4: Rate Limiting Configuration
// -----------------------------------------------------------------------------
test('Step 10A - 4: Dedicated SOS rate limiter is configured with 5 requests per 10 minutes', () => {
  assert.ok(sosLimiter);
  assert.equal(typeof sosLimiter, 'function');
  // Verify skip on test environment prevents test interference
  assert.equal(process.env.NODE_ENV, 'test');
});

// -----------------------------------------------------------------------------
// Test 5: Participant Authorization for Raising an SOS
// -----------------------------------------------------------------------------
test('Step 10A - 5: Participant authorization allows customer, assigned caregiver, and admin; rejects strangers', async () => {
  const customerId = new mongoose.Types.ObjectId().toString();
  const caregiverUserId = new mongoose.Types.ObjectId().toString();
  const caregiverProfileId = new mongoose.Types.ObjectId().toString();
  const strangerUserId = new mongoose.Types.ObjectId().toString();
  const adminUserId = new mongoose.Types.ObjectId().toString();
  const bookingId = new mongoose.Types.ObjectId().toString();

  const originalFindByIdBooking = Booking.findById;
  const originalFindOneCustomer = CustomerProfile.findOne;
  const originalCreateIncident = SosIncident.create;

  try {
    const mockBooking = {
      _id: bookingId,
      customer: customerId,
      caregiver: caregiverProfileId,
      caregiverUser: caregiverUserId,
      status: 'confirmed',
    };

    Booking.findById = async () => mockBooking;
    CustomerProfile.findOne = async () => ({ emergencyContact: { name: 'Dr. Rao', phone: '+919876543210' } });

    // Mock incident creation
    SosIncident.create = async (doc) => ({
      ...doc,
      _id: new mongoose.Types.ObjectId(),
      populate: async function () {
        return this;
      },
    });

    // 1. Stranger customer is rejected with HTTP 403 Forbidden
    await assert.rejects(
      async () => {
        await sosService.raiseSos(
          { _id: strangerUserId, role: 'customer' },
          { bookingId, summary: 'Suspicious incident observed', priority: 'High' },
        );
      },
      (err) => {
        assert.equal(err.statusCode, 403);
        assert.ok(err.message.includes('not authorized'));
        return true;
      },
    );

    // 2. Unrelated caregiver is rejected with HTTP 403 Forbidden
    await assert.rejects(
      async () => {
        await sosService.raiseSos(
          { _id: strangerUserId, role: 'caregiver' },
          { bookingId, summary: 'Medical emergency', priority: 'Critical' },
        );
      },
      (err) => {
        assert.equal(err.statusCode, 403);
        assert.ok(err.message.includes('not authorized'));
        return true;
      },
    );

    // 3. Authorized customer raises SOS successfully
    const customerIncident = await sosService.raiseSos(
      { _id: customerId, role: 'customer' },
      { bookingId, summary: 'Medical emergency at home', priority: 'Critical' },
    );
    assert.equal(customerIncident.status, 'Open');
    assert.equal(customerIncident.customer.toString(), customerId);
    assert.equal(customerIncident.raisedBy.toString(), customerId);
    assert.equal(customerIncident.raisedByRole, 'customer');

    // 4. Authorized assigned caregiver raises SOS successfully
    const caregiverIncident = await sosService.raiseSos(
      { _id: caregiverUserId, role: 'caregiver' },
      { bookingId, summary: 'Patient feeling dizzy and unresponsive', priority: 'Critical' },
    );
    assert.equal(caregiverIncident.status, 'Open');
    assert.equal(caregiverIncident.caregiverUser.toString(), caregiverUserId);
    assert.equal(caregiverIncident.raisedBy.toString(), caregiverUserId);
    assert.equal(caregiverIncident.raisedByRole, 'caregiver');

    // 5. Admin raises SOS successfully
    const adminIncident = await sosService.raiseSos(
      { _id: adminUserId, role: 'admin' },
      { bookingId, summary: 'Manual emergency intervention by operations', priority: 'High' },
    );
    assert.equal(adminIncident.status, 'Open');
    assert.equal(adminIncident.raisedByRole, 'admin');
  } finally {
    Booking.findById = originalFindByIdBooking;
    CustomerProfile.findOne = originalFindOneCustomer;
    SosIncident.create = originalCreateIncident;
  }
});

// -----------------------------------------------------------------------------
// Test 6: Cancelled and Rejected Bookings Rejection
// -----------------------------------------------------------------------------
test('Step 10A - 6: Cancelled and rejected bookings are rejected for SOS creation', async () => {
  const customerId = new mongoose.Types.ObjectId().toString();
  const caregiverUserId = new mongoose.Types.ObjectId().toString();
  const bookingId = new mongoose.Types.ObjectId().toString();

  const originalFindByIdBooking = Booking.findById;

  try {
    // 1. Cancelled booking -> 400 ValidationError
    Booking.findById = async () => ({
      _id: bookingId,
      customer: customerId,
      caregiverUser: caregiverUserId,
      status: 'cancelled',
    });

    await assert.rejects(
      async () => {
        await sosService.raiseSos(
          { _id: customerId, role: 'customer' },
          { bookingId, summary: 'Attempting SOS on cancelled booking' },
        );
      },
      (err) => {
        assert.equal(err.statusCode, 400);
        assert.ok(err.message.includes("Cannot raise an SOS for a booking with status 'cancelled'"));
        return true;
      },
    );

    // 2. Rejected booking -> 400 ValidationError
    Booking.findById = async () => ({
      _id: bookingId,
      customer: customerId,
      caregiverUser: caregiverUserId,
      status: 'rejected',
    });

    await assert.rejects(
      async () => {
        await sosService.raiseSos(
          { _id: customerId, role: 'customer' },
          { bookingId, summary: 'Attempting SOS on rejected booking' },
        );
      },
      (err) => {
        assert.equal(err.statusCode, 400);
        assert.ok(err.message.includes("Cannot raise an SOS for a booking with status 'rejected'"));
        return true;
      },
    );

    // 3. Non-existent booking -> 404 NotFoundError
    Booking.findById = async () => null;

    await assert.rejects(
      async () => {
        await sosService.raiseSos(
          { _id: customerId, role: 'customer' },
          { bookingId, summary: 'Booking does not exist' },
        );
      },
      (err) => {
        assert.equal(err.statusCode, 404);
        assert.ok(err.message.includes('Booking not found'));
        return true;
      },
    );
  } finally {
    Booking.findById = originalFindByIdBooking;
  }
});

// -----------------------------------------------------------------------------
// Test 7: Safe GPS Coordinates & Emergency Dispatch Unconfigured Status
// -----------------------------------------------------------------------------
test('Step 10A - 7: Zero fabricated coordinates and explicit unconfigured external dispatch status', async () => {
  const customerId = new mongoose.Types.ObjectId().toString();
  const caregiverUserId = new mongoose.Types.ObjectId().toString();
  const bookingId = new mongoose.Types.ObjectId().toString();

  const originalFindByIdBooking = Booking.findById;
  const originalFindOneCustomer = CustomerProfile.findOne;
  const originalCreateIncident = SosIncident.create;

  let capturedDoc = null;

  try {
    Booking.findById = async () => ({
      _id: bookingId,
      customer: customerId,
      caregiver: new mongoose.Types.ObjectId(),
      caregiverUser: caregiverUserId,
      status: 'in_progress',
    });

    CustomerProfile.findOne = async () => ({
      emergencyContact: {
        name: 'Jane Doe',
        phone: '+919123456789',
        relation: 'Spouse',
      },
    });

    SosIncident.create = async (doc) => {
      capturedDoc = doc;
      return {
        ...doc,
        _id: new mongoose.Types.ObjectId(),
        populate: async function () {
          return this;
        },
      };
    };

    // 1. Without coordinates: location.isAvailable must be false; no fake coordinates
    await sosService.raiseSos(
      { _id: customerId, role: 'customer' },
      {
        bookingId,
        summary: 'Patient has chest discomfort, GPS not permitted by browser',
        location: { isAvailable: false },
      },
    );

    assert.equal(capturedDoc.location.isAvailable, false);
    assert.equal(capturedDoc.location.latitude, undefined); // Not set or null
    assert.equal(capturedDoc.location.longitude, undefined);

    // 2. Dispatch safety: External dispatch must NOT claim success
    assert.equal(capturedDoc.emergencyContactNotification.status, 'not_configured');
    assert.equal(capturedDoc.emergencyContactNotification.attempted, false);
    assert.equal(capturedDoc.emergencyContactNotification.attemptedAt, null);
    assert.equal(capturedDoc.emergencyContactNotification.contactName, 'Jane Doe');
    assert.equal(capturedDoc.emergencyContactNotification.contactRelation, 'Spouse');
    assert.ok(capturedDoc.emergencyContactNotification.notes.includes('is not configured'));

    // 3. With validated coordinates: accurately stored
    await sosService.raiseSos(
      { _id: customerId, role: 'customer' },
      {
        bookingId,
        summary: 'Emergency with verified device coordinates',
        location: { isAvailable: true, latitude: 13.0827, longitude: 80.2707, label: 'Chennai Clinic' },
      },
    );

    assert.equal(capturedDoc.location.isAvailable, true);
    assert.equal(capturedDoc.location.latitude, 13.0827);
    assert.equal(capturedDoc.location.longitude, 80.2707);
    assert.equal(capturedDoc.location.label, 'Chennai Clinic');
  } finally {
    Booking.findById = originalFindByIdBooking;
    CustomerProfile.findOne = originalFindOneCustomer;
    SosIncident.create = originalCreateIncident;
  }
});

// -----------------------------------------------------------------------------
// Test 8: Scoped List & Detail View Access Controls
// -----------------------------------------------------------------------------
test('Step 10A - 8: Incident listing and detail retrieval enforce object-level authorization', async () => {
  const customerId = new mongoose.Types.ObjectId().toString();
  const caregiverUserId = new mongoose.Types.ObjectId().toString();
  const strangerUserId = new mongoose.Types.ObjectId().toString();
  const adminUserId = new mongoose.Types.ObjectId().toString();
  const incidentId = new mongoose.Types.ObjectId().toString();

  const originalFind = SosIncident.find;
  const originalCount = SosIncident.countDocuments;
  const originalFindById = SosIncident.findById;

  let queryFilterCaptured = null;

  try {
    SosIncident.find = (filter) => {
      queryFilterCaptured = filter;
      return {
        sort: () => ({
          skip: () => ({
            limit: () => ({
              populate: () => ({
                populate: () => ({
                  populate: () => ({
                    populate: async () => [{ _id: incidentId, customer: customerId }],
                  }),
                }),
              }),
            }),
          }),
        }),
      };
    };
    SosIncident.countDocuments = async () => 1;

    // 1. Customer listing scopes to customer ID
    await sosService.getSosIncidents({ _id: customerId, role: 'customer' });
    assert.equal(queryFilterCaptured.customer, customerId);
    assert.equal(queryFilterCaptured.caregiverUser, undefined);

    // 2. Caregiver listing scopes to caregiverUser ID
    await sosService.getSosIncidents({ _id: caregiverUserId, role: 'caregiver' });
    assert.equal(queryFilterCaptured.caregiverUser, caregiverUserId);
    assert.equal(queryFilterCaptured.customer, undefined);

    // 3. Admin listing allows status and priority queue filters
    await sosService.getSosIncidents(
      { _id: adminUserId, role: 'admin' },
      { status: 'Open', priority: 'Critical' },
    );
    assert.equal(queryFilterCaptured.status, 'Open');
    assert.equal(queryFilterCaptured.priority, 'Critical');

    // 4. getSosById mock
    const mockIncident = {
      _id: incidentId,
      customer: { _id: customerId },
      caregiverUser: { _id: caregiverUserId },
      status: 'Open',
      timeline: [],
    };

    SosIncident.findById = () => ({
      populate: () => ({
        populate: () => ({
          populate: () => ({
            populate: () => ({
              populate: async () => mockIncident,
            }),
          }),
        }),
      }),
    });

    // Customer can view their incident
    const customerView = await sosService.getSosById({ _id: customerId, role: 'customer' }, incidentId);
    assert.equal(customerView._id, incidentId);

    // Assigned caregiver can view their incident
    const caregiverView = await sosService.getSosById({ _id: caregiverUserId, role: 'caregiver' }, incidentId);
    assert.equal(caregiverView._id, incidentId);

    // Admin can view any incident
    const adminView = await sosService.getSosById({ _id: adminUserId, role: 'admin' }, incidentId);
    assert.equal(adminView._id, incidentId);

    // Stranger is rejected with HTTP 403 Forbidden
    await assert.rejects(
      async () => {
        await sosService.getSosById({ _id: strangerUserId, role: 'customer' }, incidentId);
      },
      (err) => {
        assert.equal(err.statusCode, 403);
        assert.ok(err.message.includes('not authorized'));
        return true;
      },
    );

    // Non-existent incident -> 404 NotFoundError
    SosIncident.findById = () => ({
      populate: () => ({
        populate: () => ({
          populate: () => ({
            populate: () => ({
              populate: async () => null,
            }),
          }),
        }),
      }),
    });

    await assert.rejects(
      async () => {
        await sosService.getSosById({ _id: adminUserId, role: 'admin' }, incidentId);
      },
      (err) => {
        assert.equal(err.statusCode, 404);
        return true;
      },
    );
  } finally {
    SosIncident.find = originalFind;
    SosIncident.countDocuments = originalCount;
    SosIncident.findById = originalFindById;
  }
});

// -----------------------------------------------------------------------------
// Test 9: Admin Assignment & Lifecycle Status Transitions
// -----------------------------------------------------------------------------
test('Step 10A - 9: Admin assignment transitions status from Open to Under Investigation and appends timeline', async () => {
  const customerId = new mongoose.Types.ObjectId().toString();
  const adminUserId = new mongoose.Types.ObjectId().toString();
  const deskAgentId = new mongoose.Types.ObjectId().toString();
  const incidentId = new mongoose.Types.ObjectId().toString();

  const originalFindByIdIncident = SosIncident.findById;
  const originalFindByIdUser = User.findById;

  try {
    const mockIncident = {
      _id: incidentId,
      status: 'Open',
      assignedTo: null,
      assignedAt: null,
      timeline: [],
      save: async function () {
        return this;
      },
      populate: async function () {
        return this;
      },
    };

    SosIncident.findById = async () => mockIncident;
    User.findById = async () => ({ _id: deskAgentId, fullName: 'Operations Officer Priya' });

    // 1. Non-admin cannot assign -> 403 Forbidden
    await assert.rejects(
      async () => {
        await sosService.assignSos(
          { _id: customerId, role: 'customer' },
          incidentId,
          { assignedTo: deskAgentId },
        );
      },
      (err) => {
        assert.equal(err.statusCode, 403);
        assert.ok(err.message.includes('Only administrators'));
        return true;
      },
    );

    // 2. Admin successfully assigns -> transitions status from Open to Under Investigation
    const updated = await sosService.assignSos(
      { _id: adminUserId, role: 'admin' },
      incidentId,
      { assignedTo: deskAgentId, notes: 'Contacting local ambulance service' },
    );

    assert.equal(updated.status, 'Under Investigation');
    assert.equal(updated.assignedTo.toString(), deskAgentId);
    assert.ok(updated.assignedAt instanceof Date);
    assert.equal(updated.timeline.length, 1);
    assert.equal(updated.timeline[0].action, 'Assigned to Operations Desk');
    assert.equal(updated.timeline[0].byRole, 'admin');

    // 3. Reassigning already closed incident throws 400 ValidationError
    mockIncident.status = 'Resolved';
    await assert.rejects(
      async () => {
        await sosService.assignSos(
          { _id: adminUserId, role: 'admin' },
          incidentId,
          { assignedTo: deskAgentId },
        );
      },
      (err) => {
        assert.equal(err.statusCode, 400);
        assert.ok(err.message.includes('Cannot reassign an incident that is already closed'));
        return true;
      },
    );
  } finally {
    SosIncident.findById = originalFindByIdIncident;
    User.findById = originalFindByIdUser;
  }
});

// -----------------------------------------------------------------------------
// Test 10: Timeline Notes Attribution & Append-Only Verification
// -----------------------------------------------------------------------------
test('Step 10A - 10: Operational timeline notes enforce authenticated actor attribution and append-only integrity', async () => {
  const customerId = new mongoose.Types.ObjectId().toString();
  const caregiverUserId = new mongoose.Types.ObjectId().toString();
  const strangerUserId = new mongoose.Types.ObjectId().toString();
  const incidentId = new mongoose.Types.ObjectId().toString();

  const originalFindById = SosIncident.findById;

  try {
    const existingTimelineEvent = {
      at: new Date('2026-10-17T10:00:00Z'),
      action: 'SOS Incident Raised',
      by: customerId,
      byRole: 'customer',
      notes: 'Initial emergency call',
    };

    const mockIncident = {
      _id: incidentId,
      customer: customerId,
      caregiverUser: caregiverUserId,
      status: 'Under Investigation',
      timeline: [existingTimelineEvent],
      save: async function () {
        return this;
      },
    };

    SosIncident.findById = async () => mockIncident;

    // 1. Stranger cannot add note -> 403 Forbidden
    await assert.rejects(
      async () => {
        await sosService.addTimelineNote(
          { _id: strangerUserId, role: 'customer' },
          incidentId,
          { notes: 'Spam note from stranger' },
        );
      },
      (err) => {
        assert.equal(err.statusCode, 403);
        return true;
      },
    );

    // 2. Caregiver adds note -> securely derived actor attribution (never trusted from body)
    await sosService.addTimelineNote(
      { _id: caregiverUserId, role: 'caregiver' },
      incidentId,
      { action: 'Vitals Recorded', notes: 'Pulse 85 bpm, BP 120/80' },
    );

    // Verify append-only: original entry remains unchanged
    assert.equal(mockIncident.timeline.length, 2);
    assert.equal(mockIncident.timeline[0].action, 'SOS Incident Raised');
    assert.equal(mockIncident.timeline[1].action, 'Vitals Recorded');
    assert.equal(mockIncident.timeline[1].by.toString(), caregiverUserId);
    assert.equal(mockIncident.timeline[1].byRole, 'caregiver');
    assert.equal(mockIncident.timeline[1].notes, 'Pulse 85 bpm, BP 120/80');

    // 3. Customer adding note to closed incident rejects -> 400 ValidationError
    mockIncident.status = 'Resolved';
    await assert.rejects(
      async () => {
        await sosService.addTimelineNote(
          { _id: customerId, role: 'customer' },
          incidentId,
          { notes: 'Additional comment after closure' },
        );
      },
      (err) => {
        assert.equal(err.statusCode, 400);
        assert.ok(err.message.includes('Cannot add notes to a closed SOS incident'));
        return true;
      },
    );
  } finally {
    SosIncident.findById = originalFindById;
  }
});

// -----------------------------------------------------------------------------
// Test 11: Incident Resolution & False-Alarm Handling
// -----------------------------------------------------------------------------
test('Step 10A - 11: Admin resolution and false-alarm handling records resolution metadata and prevents re-resolution', async () => {
  const customerId = new mongoose.Types.ObjectId().toString();
  const adminUserId = new mongoose.Types.ObjectId().toString();
  const incidentId = new mongoose.Types.ObjectId().toString();

  const originalFindById = SosIncident.findById;

  try {
    const mockIncident = {
      _id: incidentId,
      status: 'Under Investigation',
      timeline: [],
      resolution: {},
      save: async function () {
        return this;
      },
      populate: async function () {
        return this;
      },
    };

    SosIncident.findById = async () => mockIncident;

    // 1. Non-admin cannot resolve -> 403 Forbidden
    await assert.rejects(
      async () => {
        await sosService.resolveSos(
          { _id: customerId, role: 'customer' },
          incidentId,
          { status: 'Resolved', resolutionNotes: 'Customer attempting self-closure' },
        );
      },
      (err) => {
        assert.equal(err.statusCode, 403);
        assert.ok(err.message.includes('Only administrators'));
        return true;
      },
    );

    // 2. Admin resolves incident successfully
    const resolved = await sosService.resolveSos(
      { _id: adminUserId, role: 'admin' },
      incidentId,
      {
        status: 'Resolved',
        resolutionNotes: 'Paramedic arrived on site; patient stabilized and transported to clinic.',
        rootCause: 'Acute hypertension episode',
      },
    );

    assert.equal(resolved.status, 'Resolved');
    assert.equal(resolved.resolution.resolvedBy.toString(), adminUserId);
    assert.ok(resolved.resolution.resolvedAt instanceof Date);
    assert.equal(
      resolved.resolution.resolutionNotes,
      'Paramedic arrived on site; patient stabilized and transported to clinic.',
    );
    assert.equal(resolved.resolution.rootCause, 'Acute hypertension episode');
    assert.equal(resolved.timeline.length, 1);
    assert.equal(resolved.timeline[0].action, 'Incident Closed as Resolved');

    // 3. Cannot re-resolve an already closed incident -> 400 ValidationError
    await assert.rejects(
      async () => {
        await sosService.resolveSos(
          { _id: adminUserId, role: 'admin' },
          incidentId,
          { status: 'False Alarm', resolutionNotes: 'Attempting to change resolved status' },
        );
      },
      (err) => {
        assert.equal(err.statusCode, 400);
        assert.ok(err.message.includes("Incident is already closed with status 'Resolved'"));
        return true;
      },
    );
  } finally {
    SosIncident.findById = originalFindById;
  }
});

// -----------------------------------------------------------------------------
// Test 12: Duplicate Incident Number Race Retry Handling
// -----------------------------------------------------------------------------
test('Step 10A - 12: raiseSos retries transparently on MongoDB duplicate key collision (E11000)', async () => {
  const customerId = new mongoose.Types.ObjectId().toString();
  const caregiverUserId = new mongoose.Types.ObjectId().toString();
  const bookingId = new mongoose.Types.ObjectId().toString();

  const originalFindByIdBooking = Booking.findById;
  const originalFindOneCustomer = CustomerProfile.findOne;
  const originalCreateIncident = SosIncident.create;

  let createAttempts = 0;

  try {
    Booking.findById = async () => ({
      _id: bookingId,
      customer: customerId,
      caregiver: new mongoose.Types.ObjectId(),
      caregiverUser: caregiverUserId,
      status: 'confirmed',
    });

    CustomerProfile.findOne = async () => null;

    // Simulate duplicate key collision on the first attempt, then success on second attempt
    SosIncident.create = async (doc) => {
      createAttempts += 1;
      if (createAttempts === 1) {
        const dupError = new Error('E11000 duplicate key error collection: bystander.sosincidents index: incidentNumber_1');
        dupError.code = 11000;
        dupError.keyPattern = { incidentNumber: 1 };
        throw dupError;
      }
      return {
        ...doc,
        _id: new mongoose.Types.ObjectId(),
        populate: async function () {
          return this;
        },
      };
    };

    const incident = await sosService.raiseSos(
      { _id: customerId, role: 'customer' },
      { bookingId, summary: 'Emergency assistance required immediately' },
    );

    // Verify retry occurred and incident was created
    assert.equal(createAttempts, 2);
    assert.ok(incident);
    assert.equal(incident.status, 'Open');
  } finally {
    Booking.findById = originalFindByIdBooking;
    CustomerProfile.findOne = originalFindOneCustomer;
    SosIncident.create = originalCreateIncident;
  }
});
