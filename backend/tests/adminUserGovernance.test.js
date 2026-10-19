import test from 'node:test';
import assert from 'node:assert/strict';
import mongoose from 'mongoose';
import { authorizeRoles, authenticate } from '../src/middleware/auth.js';
import {
  validateUserQuery,
  validateCaregiverUserQuery,
  validateUserIdParam,
  validateUpdateUserStatus,
  validateModerationQuery,
} from '../src/middleware/validateAdminUser.js';
import * as adminUserService from '../src/services/adminUserService.js';
import * as adminModerationService from '../src/services/adminModerationService.js';
import { User } from '../src/models/User.js';
import { Message } from '../src/models/Message.js';
import { generateToken } from '../src/utils/auth.js';

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
// Test 1: Admin-only access and rejection of customer & caregiver roles
// -----------------------------------------------------------------------------
test('Step 13C - 1: authorizeRoles enforces admin-only access and rejects customer & caregiver', () => {
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
  assert.match(cgRes.jsonData.message, /Role 'caregiver' is not authorized/);

  // Unauthenticated caller (no req.user) rejected with 401
  const { req: noAuthReq, res: noAuthRes, next: noAuthNext } = createMockReqRes();
  adminGuard(noAuthReq, noAuthRes, noAuthNext);
  assert.equal(noAuthRes.statusCode, 401);
  assert.equal(noAuthRes.jsonData.error, 'Unauthorized');

  // Admin caller permitted
  const { req: adminReq, res: adminRes, next: adminNext, getNextCalled } = createMockReqRes({
    user: { _id: new mongoose.Types.ObjectId(), role: 'admin' },
  });
  adminGuard(adminReq, adminRes, adminNext);
  assert.equal(getNextCalled(), true);
});

// -----------------------------------------------------------------------------
// Test 2: Validation of Customer and Caregiver Directory Query Parameters
// -----------------------------------------------------------------------------
test('Step 13C - 2: validateUserQuery and validateCaregiverUserQuery validate pagination, status, and sort', () => {
  // A. validateUserQuery invalid page
  const { req: pReq, res: pRes, next: pNext } = createMockReqRes({ query: { page: '0' } });
  validateUserQuery(pReq, pRes, pNext);
  assert.equal(pRes.statusCode, 400);
  assert.match(pRes.jsonData.message, /Page parameter must be a positive integer/);

  // B. validateUserQuery invalid limit
  const { req: lReq, res: lRes, next: lNext } = createMockReqRes({ query: { limit: '999' } });
  validateUserQuery(lReq, lRes, lNext);
  assert.equal(lRes.statusCode, 400);
  assert.match(lRes.jsonData.message, /Limit parameter must be an integer between 1 and 100/);

  // C. validateUserQuery invalid status
  const { req: sReq, res: sRes, next: sNext } = createMockReqRes({ query: { status: 'invalid_status' } });
  validateUserQuery(sReq, sRes, sNext);
  assert.equal(sRes.statusCode, 400);
  assert.match(sRes.jsonData.message, /Invalid status filter/);

  // D. validateCaregiverUserQuery invalid verification status
  const { req: vReq, res: vRes, next: vNext } = createMockReqRes({ query: { verificationStatus: 'unknown' } });
  validateCaregiverUserQuery(vReq, vRes, vNext);
  assert.equal(vRes.statusCode, 400);
  assert.match(vRes.jsonData.message, /Invalid verification status filter/);

  // E. validateCaregiverUserQuery invalid sort
  const { req: sortReq, res: sortRes, next: sortNext } = createMockReqRes({ query: { sort: 'hack_column' } });
  validateCaregiverUserQuery(sortReq, sortRes, sortNext);
  assert.equal(sortRes.statusCode, 400);
  assert.match(sortRes.jsonData.message, /Invalid sort field/);

  // F. Valid query passes to next()
  const { req: validReq, res: validRes, next: validNext, getNextCalled } = createMockReqRes({
    query: { page: '2', limit: '20', status: 'active', sort: 'experience' },
  });
  validateCaregiverUserQuery(validReq, validRes, validNext);
  assert.equal(getNextCalled(), true);
});

// -----------------------------------------------------------------------------
// Test 3: ObjectId Parameter Validation
// -----------------------------------------------------------------------------
test('Step 13C - 3: validateUserIdParam rejects non-ObjectId strings with 400', () => {
  const { req: badReq, res: badRes, next: badNext } = createMockReqRes({ params: { id: 'invalid-id-123' } });
  validateUserIdParam(badReq, badRes, badNext);
  assert.equal(badRes.statusCode, 400);
  assert.equal(badRes.jsonData.error, 'ValidationError');

  const { req: okReq, res: okRes, next: okNext, getNextCalled } = createMockReqRes({
    params: { id: new mongoose.Types.ObjectId().toString() },
  });
  validateUserIdParam(okReq, okRes, okNext);
  assert.equal(getNextCalled(), true);
});

// -----------------------------------------------------------------------------
// Test 4: Account Status Mutation Validation (Mandatory Reason & Allowed Statuses)
// -----------------------------------------------------------------------------
test('Step 13C - 4: validateUpdateUserStatus enforces allowed target statuses and mandatory reason', () => {
  // A. Missing status
  const { req: noStatusReq, res: noStatusRes, next: noStatusNext } = createMockReqRes({
    body: { reason: 'Suspicious off-platform payment attempts' },
  });
  validateUpdateUserStatus(noStatusReq, noStatusRes, noStatusNext);
  assert.equal(noStatusRes.statusCode, 400);
  assert.match(noStatusRes.jsonData.message, /Account status is required/);

  // B. Invalid status
  const { req: invStatusReq, res: invStatusRes, next: invStatusNext } = createMockReqRes({
    body: { status: 'deleted', reason: 'User requested removal' },
  });
  validateUpdateUserStatus(invStatusReq, invStatusRes, invStatusNext);
  assert.equal(invStatusRes.statusCode, 400);
  assert.match(invStatusRes.jsonData.message, /Status must be one of: active, suspended, blocked/);

  // C. Missing reason
  const { req: noReasonReq, res: noReasonRes, next: noReasonNext } = createMockReqRes({
    body: { status: 'suspended' },
  });
  validateUpdateUserStatus(noReasonReq, noReasonRes, noReasonNext);
  assert.equal(noReasonRes.statusCode, 400);
  assert.match(noReasonRes.jsonData.message, /A mandatory reason of at least 3 characters is required/);

  // D. Reason too short (< 3 characters)
  const { req: shortReasonReq, res: shortReasonRes, next: shortReasonNext } = createMockReqRes({
    body: { status: 'suspended', reason: 'no' },
  });
  validateUpdateUserStatus(shortReasonReq, shortReasonRes, shortReasonNext);
  assert.equal(shortReasonRes.statusCode, 400);
  assert.match(shortReasonRes.jsonData.message, /at least 3 characters/);

  // E. Valid payload sets sanitizedStatusUpdate and calls next()
  const { req: validReq, res: validRes, next: validNext, getNextCalled } = createMockReqRes({
    body: { status: 'suspended', reason: 'Policy violation: off-platform booking solicitation' },
  });
  validateUpdateUserStatus(validReq, validRes, validNext);
  assert.equal(getNextCalled(), true);
  assert.equal(validReq.sanitizedStatusUpdate.status, 'suspended');
  assert.equal(validReq.sanitizedStatusUpdate.reason, 'Policy violation: off-platform booking solicitation');
});

// -----------------------------------------------------------------------------
// Test 5: Self-Suspension Prevention & Last-Admin Protection Safeguards
// -----------------------------------------------------------------------------
test('Step 13C - 5: updateUserStatus prevents admin self-suspension and last active admin lockout', async () => {
  const adminId = new mongoose.Types.ObjectId();
  const actingAdmin = {
    _id: adminId,
    fullName: 'Master Admin',
    role: 'admin',
    status: 'active',
  };

  // Mock User.findById to return the target user as the same admin
  const originalFindById = User.findById;
  const originalCountDocuments = User.countDocuments;

  try {
    // 1. Self-suspension test
    User.findById = () => ({
      _id: adminId,
      fullName: 'Master Admin',
      role: 'admin',
      status: 'active',
    });

    await assert.rejects(
      async () => {
        await adminUserService.updateUserStatus(
          adminId.toString(),
          { status: 'suspended', reason: 'Testing self lockout prevention' },
          actingAdmin,
        );
      },
      (err) => {
        assert.equal(err.statusCode, 400);
        assert.match(err.message, /Administrators cannot suspend or block their own account/);
        return true;
      },
    );

    // 2. Last-admin lockout protection test
    const otherAdminId = new mongoose.Types.ObjectId();
    User.findById = () => ({
      _id: otherAdminId,
      fullName: 'Second Admin',
      role: 'admin',
      status: 'active',
    });
    // Return count of active admins = 1 (meaning otherAdmin is the last active admin)
    User.countDocuments = async () => 1;

    await assert.rejects(
      async () => {
        await adminUserService.updateUserStatus(
          otherAdminId.toString(),
          { status: 'blocked', reason: 'Testing last active admin protection' },
          actingAdmin,
        );
      },
      (err) => {
        assert.equal(err.statusCode, 400);
        assert.match(err.message, /Cannot suspend or block the platform's last active administrator/);
        return true;
      },
    );

    // 3. Status transition to same status test
    User.findById = () => ({
      _id: new mongoose.Types.ObjectId(),
      fullName: 'Customer Test',
      role: 'customer',
      status: 'active',
    });

    await assert.rejects(
      async () => {
        await adminUserService.updateUserStatus(
          new mongoose.Types.ObjectId().toString(),
          { status: 'active', reason: 'Reactivating already active user' },
          actingAdmin,
        );
      },
      (err) => {
        assert.equal(err.statusCode, 400);
        assert.match(err.message, /Account is already in 'active' status/);
        return true;
      },
    );
  } finally {
    User.findById = originalFindById;
    User.countDocuments = originalCountDocuments;
  }
});

// -----------------------------------------------------------------------------
// Test 6: Authentication Middleware Enforcement for Blocked & Suspended Accounts
// -----------------------------------------------------------------------------
test('Step 13C - 6: authenticate middleware rejects suspended and blocked accounts with 403', async () => {
  const suspendedUserId = new mongoose.Types.ObjectId();
  const blockedUserId = new mongoose.Types.ObjectId();
  const activeUserId = new mongoose.Types.ObjectId();

  const originalFindById = User.findById;

  try {
    // 1. Suspended user token
    const suspendedToken = generateToken({ id: suspendedUserId.toString(), role: 'customer' });
    User.findById = (id) => {
      if (String(id) === suspendedUserId.toString()) {
        return Promise.resolve({
          _id: suspendedUserId,
          role: 'customer',
          status: 'suspended',
        });
      }
      return Promise.resolve(null);
    };

    const { req: sReq, res: sRes, next: sNext } = createMockReqRes({
      headers: { authorization: `Bearer ${suspendedToken}` },
    });
    await authenticate(sReq, sRes, sNext);
    assert.equal(sRes.statusCode, 403);
    assert.equal(sRes.jsonData.error, 'Forbidden');
    assert.match(sRes.jsonData.message, /temporarily suspended/);

    // 2. Blocked user token
    const blockedToken = generateToken({ id: blockedUserId.toString(), role: 'caregiver' });
    User.findById = (id) => {
      if (String(id) === blockedUserId.toString()) {
        return Promise.resolve({
          _id: blockedUserId,
          role: 'caregiver',
          status: 'blocked',
        });
      }
      return Promise.resolve(null);
    };

    const { req: bReq, res: bRes, next: bNext } = createMockReqRes({
      headers: { authorization: `Bearer ${blockedToken}` },
    });
    await authenticate(bReq, bRes, bNext);
    assert.equal(bRes.statusCode, 403);
    assert.equal(bRes.jsonData.error, 'Forbidden');
    assert.match(bRes.jsonData.message, /account has been blocked/);

    // 3. Active user token passes
    const activeToken = generateToken({ id: activeUserId.toString(), role: 'customer' });
    User.findById = (id) => {
      if (String(id) === activeUserId.toString()) {
        return Promise.resolve({
          _id: activeUserId,
          role: 'customer',
          status: 'active',
        });
      }
      return Promise.resolve(null);
    };

    const { req: aReq, res: aRes, next: aNext, getNextCalled } = createMockReqRes({
      headers: { authorization: `Bearer ${activeToken}` },
    });
    await authenticate(aReq, aRes, aNext);
    assert.equal(getNextCalled(), true);
    assert.equal(aReq.user.status, 'active');
  } finally {
    User.findById = originalFindById;
  }
});

// -----------------------------------------------------------------------------
// Test 7: Flagged-Message Moderation Queue Privacy & Filtering Safeguards
// -----------------------------------------------------------------------------
test('Step 13C - 7: adminModerationService strictly queries { isFlagged: true } and validates query limits', async () => {
  // A. validateModerationQuery bounds
  const { req: badPageReq, res: badPageRes, next: badPageNext } = createMockReqRes({ query: { page: '-1' } });
  validateModerationQuery(badPageReq, badPageRes, badPageNext);
  assert.equal(badPageRes.statusCode, 400);

  const { req: badLimitReq, res: badLimitRes, next: badLimitNext } = createMockReqRes({ query: { limit: '100' } });
  validateModerationQuery(badLimitReq, badLimitRes, badLimitNext);
  assert.equal(badLimitRes.statusCode, 400);
  assert.match(badLimitRes.jsonData.message, /between 1 and 50/);

  // B. Mock Message.find to verify that isFlagged: true is unconditionally enforced
  const originalFind = Message.find;
  const originalCount = Message.countDocuments;

  let queryCaptured = null;
  try {
    Message.find = (query) => {
      queryCaptured = query;
      return {
        sort: () => ({
          skip: () => ({
            limit: () => ({
              select: () => ({
                populate: () => ({
                  populate: () => ({
                    populate: () => Promise.resolve([]),
                  }),
                }),
              }),
            }),
          }),
        }),
      };
    };
    Message.countDocuments = () => Promise.resolve(0);

    await adminModerationService.getFlaggedMessages({ page: 1, limit: 10, search: 'test' });

    // Assert that { isFlagged: true } was strictly included in the MongoDB filter
    assert.ok(queryCaptured, 'Expected query to be passed to Message.find');
    assert.equal(queryCaptured.isFlagged, true, 'isFlagged: true must be unconditionally enforced');
  } finally {
    Message.find = originalFind;
    Message.countDocuments = originalCount;
  }
});
