import test from 'node:test';
import assert from 'node:assert/strict';
import mongoose from 'mongoose';
import { authorizeRoles } from '../src/middleware/auth.js';
import {
  validateSubmitComplaint,
  validateComplaintIdParam,
  validateComplaintQuery,
  validateUpdateComplaintStatus,
  validateAddComplaintNote,
} from '../src/middleware/validateComplaint.js';
import * as complaintService from '../src/services/complaintService.js';
import { Complaint } from '../src/models/Complaint.js';
import { Booking } from '../src/models/Booking.js';

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
// Test 1: Role-Based Authorization on Administrative Complaint Endpoints
// -----------------------------------------------------------------------------
test('Step 13D - 1: authorizeRoles enforces admin-only access on /api/admin/complaints', () => {
  const adminGuard = authorizeRoles('admin');

  // Customer caller rejected with 403 Forbidden
  const { req: custReq, res: custRes, next: custNext } = createMockReqRes({
    user: { _id: new mongoose.Types.ObjectId(), role: 'customer' },
  });
  adminGuard(custReq, custRes, custNext);
  assert.equal(custRes.statusCode, 403);
  assert.equal(custRes.jsonData.error, 'Forbidden');
  assert.match(custRes.jsonData.message, /Role 'customer' is not authorized/);

  // Caregiver caller rejected with 403 Forbidden
  const { req: cgReq, res: cgRes, next: cgNext } = createMockReqRes({
    user: { _id: new mongoose.Types.ObjectId(), role: 'caregiver' },
  });
  adminGuard(cgReq, cgRes, cgNext);
  assert.equal(cgRes.statusCode, 403);
  assert.equal(cgRes.jsonData.error, 'Forbidden');

  // Admin caller permitted
  const { req: adminReq, res: adminRes, next: adminNext, getNextCalled } = createMockReqRes({
    user: { _id: new mongoose.Types.ObjectId(), role: 'admin' },
  });
  adminGuard(adminReq, adminRes, adminNext);
  assert.equal(getNextCalled(), true);
});

// -----------------------------------------------------------------------------
// Test 2: Input Validation for Complaint Submission
// -----------------------------------------------------------------------------
test('Step 13D - 2: validateSubmitComplaint enforces required fields, bounds, and category enum', () => {
  // A. Missing subject
  const { req: noSubReq, res: noSubRes, next: noSubNext } = createMockReqRes({
    body: { description: 'Detailed text', category: 'Misbehavior' },
  });
  validateSubmitComplaint(noSubReq, noSubRes, noSubNext);
  assert.equal(noSubRes.statusCode, 400);
  assert.match(noSubRes.jsonData.message, /Subject is required/i);

  // B. Description too short (< 5 chars)
  const { req: shortDescReq, res: shortDescRes, next: shortDescNext } = createMockReqRes({
    body: { subject: 'Valid subject', description: 'bad', category: 'Misbehavior' },
  });
  validateSubmitComplaint(shortDescReq, shortDescRes, shortDescNext);
  assert.equal(shortDescRes.statusCode, 400);
  assert.match(shortDescRes.jsonData.message, /at least 5 characters/i);

  // C. Invalid category
  const { req: invCatReq, res: invCatRes, next: invCatNext } = createMockReqRes({
    body: { subject: 'Valid subject', description: 'Valid description here', category: 'ForgedCategory' },
  });
  validateSubmitComplaint(invCatReq, invCatRes, invCatNext);
  assert.equal(invCatRes.statusCode, 400);
  assert.match(invCatRes.jsonData.message, /Category must be one of/i);

  // D. Invalid bookingId (not 24-hex ObjectId)
  const { req: badBookingReq, res: badBookingRes, next: badBookingNext } = createMockReqRes({
    body: {
      subject: 'Valid subject',
      description: 'Valid description here',
      category: 'No-show',
      bookingId: 'invalid-id-xyz',
    },
  });
  validateSubmitComplaint(badBookingReq, badBookingRes, badBookingNext);
  assert.equal(badBookingRes.statusCode, 400);
  assert.match(badBookingRes.jsonData.message, /Invalid booking identifier format/i);

  // E. Valid submission sanitizes payload and forwards to next()
  const { req: validReq, res: validRes, next: validNext, getNextCalled } = createMockReqRes({
    body: {
      subject: 'Caretaker arrived 45 minutes late',
      description: 'The morning medication schedule was delayed by over 45 minutes.',
      category: 'Late arrival',
      priority: 'High',
      evidence: ['photo1.jpg', 'log.txt'],
      // Malicious client attempt to forge identity & admin fields
      complainant: new mongoose.Types.ObjectId().toString(),
      status: 'resolved',
      internalNotes: [{ note: 'fake admin note' }],
    },
  });
  validateSubmitComplaint(validReq, validRes, validNext);
  assert.equal(getNextCalled(), true);

  // Assert malicious fields were stripped
  assert.equal(validReq.sanitizedComplaint.subject, 'Caretaker arrived 45 minutes late');
  assert.equal(validReq.sanitizedComplaint.category, 'Late arrival');
  assert.equal(validReq.sanitizedComplaint.priority, 'High');
  assert.equal(validReq.sanitizedComplaint.complainant, undefined);
  assert.equal(validReq.sanitizedComplaint.status, undefined);
  assert.equal(validReq.sanitizedComplaint.internalNotes, undefined);
});

// -----------------------------------------------------------------------------
// Test 3: Complaint Creation & Booking Participation Verification
// -----------------------------------------------------------------------------
test('Step 13D - 3: createComplaint derives complainant server-side and validates booking participation', async () => {
  const customerId = new mongoose.Types.ObjectId();
  const caregiverUserId = new mongoose.Types.ObjectId();
  const strangerUserId = new mongoose.Types.ObjectId();
  const bookingId = new mongoose.Types.ObjectId();

  const customerUser = {
    _id: customerId,
    fullName: 'Priya Sharma',
    role: 'customer',
  };

  const strangerUser = {
    _id: strangerUserId,
    fullName: 'Rando Stranger',
    role: 'customer',
  };

  const originalFindById = Booking.findById;
  const originalCreate = Complaint.create;

  try {
    // Mock booking record
    Booking.findById = (id) => {
      if (String(id) === bookingId.toString()) {
        return Promise.resolve({
          _id: bookingId,
          bookingNumber: 'BK-TEST-1',
          customer: customerId,
          caregiverUser: caregiverUserId,
        });
      }
      return Promise.resolve(null);
    };

    // 1. Stranger filing complaint on booking -> 403 Forbidden
    await assert.rejects(
      async () => {
        await complaintService.createComplaint(strangerUser, {
          bookingId: bookingId.toString(),
          category: 'Misbehavior',
          subject: 'Unrelated complaint attempt',
          description: 'Stranger attempting to intervene in private booking',
        });
      },
      (err) => {
        assert.equal(err.statusCode, 403);
        assert.match(err.message, /not an authorized participant/i);
        return true;
      },
    );

    // 2. Authorized customer filing complaint -> derives complainant & respondent accurately
    let createdPayload = null;
    Complaint.create = (doc) => {
      createdPayload = doc;
      return Promise.resolve({
        ...doc,
        _id: new mongoose.Types.ObjectId(),
        toObject() {
          return { ...this };
        },
      });
    };

    const created = await complaintService.createComplaint(customerUser, {
      bookingId: bookingId.toString(),
      category: 'No-show',
      subject: 'Caretaker did not arrive for scheduled shift',
      description: 'The caretaker did not arrive and did not respond to messaging.',
      priority: 'High',
    });

    assert.ok(created);
    assert.ok(createdPayload);
    // Identity strictly derived from session
    assert.equal(createdPayload.complainant.toString(), customerId.toString());
    assert.equal(createdPayload.complainantRole, 'customer');
    // Respondent derived from booking engagement
    assert.equal(createdPayload.respondent.toString(), caregiverUserId.toString());
    assert.equal(createdPayload.respondentRole, 'caregiver');
    assert.equal(createdPayload.status, 'submitted');
    assert.match(createdPayload.complaintNumber, /^CP-\d{8}-\d{5}$/);
    assert.equal(createdPayload.timeline.length, 1);
  } finally {
    Booking.findById = originalFindById;
    Complaint.create = originalCreate;
  }
});

// -----------------------------------------------------------------------------
// Test 4: Internal Investigation Notes Strictly Shielded from Public Views
// -----------------------------------------------------------------------------
test('Step 13D - 4: getMyComplaints and getComplaintById strictly omit internal investigation notes for users', async () => {
  const customerId = new mongoose.Types.ObjectId();
  const complaintId = new mongoose.Types.ObjectId();

  const customerUser = {
    _id: customerId,
    fullName: 'Priya Sharma',
    role: 'customer',
  };

  const mockComplaintDoc = {
    _id: complaintId,
    complaintNumber: 'CP-20261019-12345',
    complainant: customerId,
    complainantRole: 'customer',
    subject: 'Delayed arrival',
    description: 'Caretaker arrived late.',
    status: 'under_review',
    // Internal notes that MUST NEVER leak to the complainant
    internalNotes: [
      {
        note: 'INTERNAL SECRET: Reaching out to caregiver for explanation before escalation',
        by: new mongoose.Types.ObjectId(),
        byName: 'Admin Investigator',
        at: new Date(),
      },
    ],
    timeline: [{ action: 'Complaint submitted', by: customerId, byRole: 'customer' }],
    toObject() {
      return { ...this };
    },
  };

  const originalFind = Complaint.find;
  const originalFindById = Complaint.findById;
  const originalCount = Complaint.countDocuments;

  try {
    // 1. getMyComplaints verifies internalNotes is stripped
    Complaint.find = () => ({
      sort: () => ({
        skip: () => ({
          limit: () => ({
            select: () => ({
              populate: () => ({
                populate: () => Promise.resolve([mockComplaintDoc]),
              }),
            }),
          }),
        }),
      }),
    });
    Complaint.countDocuments = () => Promise.resolve(1);

    const myResult = await complaintService.getMyComplaints(customerUser);
    assert.equal(myResult.complaints.length, 1);
    assert.equal(myResult.complaints[0].internalNotes, undefined, 'internalNotes must be omitted from customer list');

    // 2. getComplaintById verifies internalNotes is stripped for customer
    Complaint.findById = () => ({
      populate: () => ({
        populate: () => ({
          populate: () =>
            Promise.resolve({
              ...mockComplaintDoc,
              complainant: { _id: customerId, fullName: 'Priya Sharma', role: 'customer' },
            }),
        }),
      }),
    });

    const singleResult = await complaintService.getComplaintById(customerUser, complaintId.toString());
    assert.equal(singleResult.internalNotes, undefined, 'internalNotes must be omitted from customer detail view');

    // 3. Admin caller DOES receive internalNotes
    const adminUser = { _id: new mongoose.Types.ObjectId(), role: 'admin', fullName: 'Lead Admin' };
    const adminResult = await complaintService.getComplaintById(adminUser, complaintId.toString());
    assert.ok(adminResult.internalNotes, 'internalNotes must be accessible to admin');
    assert.equal(adminResult.internalNotes.length, 1);
  } finally {
    Complaint.find = originalFind;
    Complaint.findById = originalFindById;
    Complaint.countDocuments = originalCount;
  }
});

// -----------------------------------------------------------------------------
// Test 5: Status Transitions & Mandatory Resolution Enforcement
// -----------------------------------------------------------------------------
test('Step 13D - 5: updateComplaintStatus enforces valid transitions and mandatory resolution details', async () => {
  const adminUser = {
    _id: new mongoose.Types.ObjectId(),
    fullName: 'Operations Desk',
    role: 'admin',
  };
  const complaintId = new mongoose.Types.ObjectId();

  const originalFindById = Complaint.findById;

  try {
    // A. Attempting to transition to identical status -> 400
    Complaint.findById = () =>
      Promise.resolve({
        _id: complaintId,
        status: 'under_review',
        save: () => Promise.resolve(),
      });

    await assert.rejects(
      async () => {
        await complaintService.updateComplaintStatus(
          complaintId.toString(),
          { status: 'under_review' },
          adminUser,
        );
      },
      (err) => {
        assert.equal(err.statusCode, 400);
        assert.match(err.message, /already in 'under_review' status/);
        return true;
      },
    );

    // B. Attempting to revert resolved complaint to submitted -> 400
    Complaint.findById = () =>
      Promise.resolve({
        _id: complaintId,
        status: 'resolved',
        save: () => Promise.resolve(),
      });

    await assert.rejects(
      async () => {
        await complaintService.updateComplaintStatus(
          complaintId.toString(),
          { status: 'submitted' },
          adminUser,
        );
      },
      (err) => {
        assert.equal(err.statusCode, 400);
        assert.match(err.message, /Cannot reset a closed 'resolved' complaint/);
        return true;
      },
    );

    // C. Validation middleware enforces resolutionDetails when status is resolved
    const { req: noResReq, res: noResRes, next: noResNext } = createMockReqRes({
      body: { status: 'resolved' }, // missing resolutionDetails
    });
    validateUpdateComplaintStatus(noResReq, noResRes, noResNext);
    assert.equal(noResRes.statusCode, 400);
    assert.match(noResRes.jsonData.message, /Resolution details of at least 3 characters are required/);

    // D. Valid status transition updates status and appends timeline audit
    let savedDoc = null;
    Complaint.findById = () =>
      Promise.resolve({
        _id: complaintId,
        complaintNumber: 'CP-101',
        complainant: new mongoose.Types.ObjectId(),
        status: 'under_review',
        timeline: [],
        resolution: {},
        save() {
          savedDoc = this;
          return Promise.resolve(this);
        },
      });

    const updated = await complaintService.updateComplaintStatus(
      complaintId.toString(),
      {
        status: 'resolved',
        resolutionDetails: 'Caregiver counselled on punctuality; replacement shift arranged.',
      },
      adminUser,
    );

    assert.equal(updated.status, 'resolved');
    assert.equal(savedDoc.resolution.resolutionDetails, 'Caregiver counselled on punctuality; replacement shift arranged.');
    assert.ok(savedDoc.resolution.resolvedAt);
    assert.equal(savedDoc.timeline.length, 1);
    assert.equal(savedDoc.timeline[0].action, 'Status changed to resolved');
  } finally {
    Complaint.findById = originalFindById;
  }
});

// -----------------------------------------------------------------------------
// Test 6: Internal Investigation Notes Endpoint
// -----------------------------------------------------------------------------
test('Step 13D - 6: addInternalNote validates note length and records administrator attribution', async () => {
  const adminUser = {
    _id: new mongoose.Types.ObjectId(),
    fullName: 'Investigator Priya',
    role: 'admin',
  };
  const complaintId = new mongoose.Types.ObjectId();

  // 1. Validation middleware rejects short note
  const { req: shortReq, res: shortRes, next: shortNext } = createMockReqRes({
    body: { note: 'ab' },
  });
  validateAddComplaintNote(shortReq, shortRes, shortNext);
  assert.equal(shortRes.statusCode, 400);
  assert.match(shortRes.jsonData.message, /at least 3 characters/);

  // 2. Service appends note and timeline entry
  const originalFindById = Complaint.findById;
  try {
    let savedComplaint = null;
    Complaint.findById = () =>
      Promise.resolve({
        _id: complaintId,
        internalNotes: [],
        timeline: [],
        save() {
          savedComplaint = this;
          return Promise.resolve(this);
        },
      });

    const result = await complaintService.addInternalNote(
      complaintId.toString(),
      { note: 'Contacted customer by phone. They agreed with the proposed resolution plan.' },
      adminUser,
    );

    assert.ok(savedComplaint);
    assert.equal(savedComplaint.internalNotes.length, 1);
    assert.equal(savedComplaint.internalNotes[0].note, 'Contacted customer by phone. They agreed with the proposed resolution plan.');
    assert.equal(savedComplaint.internalNotes[0].byName, 'Investigator Priya');
    assert.equal(savedComplaint.timeline.length, 1);
    assert.equal(savedComplaint.timeline[0].action, 'Internal investigation note added');
  } finally {
    Complaint.findById = originalFindById;
  }
});

// -----------------------------------------------------------------------------
// Test 7: Duplicate-Key Collision Handling & Retry
// -----------------------------------------------------------------------------
test('Step 13D - 7: createComplaint retries on duplicate-key collision (code 11000) and succeeds', async () => {
  const customerId = new mongoose.Types.ObjectId();
  const customerUser = {
    _id: customerId,
    fullName: 'Priya Sharma',
    role: 'customer',
  };

  const originalCreate = Complaint.create;
  let attempts = 0;

  try {
    Complaint.create = (doc) => {
      attempts += 1;
      if (attempts === 1) {
        const dupErr = new Error('E11000 duplicate key error collection: complaints index: complaintNumber_1 dup key');
        dupErr.code = 11000;
        return Promise.reject(dupErr);
      }
      return Promise.resolve({
        ...doc,
        _id: new mongoose.Types.ObjectId(),
        toObject() {
          return { ...this };
        },
      });
    };

    const created = await complaintService.createComplaint(customerUser, {
      category: 'Billing',
      subject: 'Disputed extra hour surcharge',
      description: 'Charged for extra hour that was not authorized.',
      priority: 'Medium',
    });

    assert.ok(created);
    assert.equal(attempts, 2, 'Should succeed on attempt 2 after 1 collision');
    assert.match(created.complaintNumber, /^CP-\d{8}-\d{5}$/);
  } finally {
    Complaint.create = originalCreate;
  }
});

// -----------------------------------------------------------------------------
// Test 8: Duplicate-Key Retry Exhaustion
// -----------------------------------------------------------------------------
test('Step 13D - 8: createComplaint exhausts 3 retries on persistent duplicate keys and throws controlled error', async () => {
  const customerId = new mongoose.Types.ObjectId();
  const customerUser = {
    _id: customerId,
    fullName: 'Priya Sharma',
    role: 'customer',
  };

  const originalCreate = Complaint.create;
  let attempts = 0;

  try {
    Complaint.create = () => {
      attempts += 1;
      const dupErr = new Error('E11000 duplicate key error');
      dupErr.code = 11000;
      return Promise.reject(dupErr);
    };

    await assert.rejects(
      async () => {
        await complaintService.createComplaint(customerUser, {
          category: 'Billing',
          subject: 'Disputed payment',
          description: 'Payment issue description here.',
        });
      },
      (err) => {
        assert.equal(err.name, 'DuplicateKeyError');
        assert.equal(err.statusCode, 500);
        assert.match(err.message, /Failed to generate a unique complaint reference/i);
        return true;
      },
    );

    assert.equal(attempts, 3, 'Must cap retries at exactly 3 attempts');
  } finally {
    Complaint.create = originalCreate;
  }
});

// -----------------------------------------------------------------------------
// Test 9: Immediate Non-Duplicate Error Propagation
// -----------------------------------------------------------------------------
test('Step 13D - 9: createComplaint immediately propagates non-duplicate database errors without retry', async () => {
  const customerId = new mongoose.Types.ObjectId();
  const customerUser = {
    _id: customerId,
    fullName: 'Priya Sharma',
    role: 'customer',
  };

  const originalCreate = Complaint.create;
  let attempts = 0;

  try {
    Complaint.create = () => {
      attempts += 1;
      const dbErr = new Error('MongoNetworkTimeoutError: connection timed out');
      dbErr.name = 'MongoNetworkTimeoutError';
      dbErr.statusCode = 503;
      return Promise.reject(dbErr);
    };

    await assert.rejects(
      async () => {
        await complaintService.createComplaint(customerUser, {
          category: 'Misbehavior',
          subject: 'Caregiver misbehavior report',
          description: 'Caregiver refused to follow simple instructions.',
        });
      },
      (err) => {
        assert.equal(err.name, 'MongoNetworkTimeoutError');
        assert.equal(err.statusCode, 503);
        assert.match(err.message, /connection timed out/);
        return true;
      },
    );

    assert.equal(attempts, 1, 'Non-duplicate error must not trigger retry; attempts must equal 1');
  } finally {
    Complaint.create = originalCreate;
  }
});

