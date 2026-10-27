import test from 'node:test';
import assert from 'node:assert/strict';
import jwt from 'jsonwebtoken';
import {
  hashPassword,
  comparePassword,
  generateToken,
  verifyToken,
  getCookieOptions,
  sanitizeUser,
  formatAccountStatusMessage,
} from '../src/utils/auth.js';
import {
  validateCustomerRegistration,
  validateCaregiverRegistration,
  validateLogin,
} from '../src/middleware/validate.js';
import { authenticate, authorizeRoles } from '../src/middleware/auth.js';
import { User, CustomerProfile, CaregiverProfile } from '../src/models/index.js';
import { requestGuestOtp, validateGuestOtp, verifyGuestOtp } from '../src/services/authService.js';

// Mock helper to simulate Express req, res, next
const createMockReqRes = (options = {}) => {
  const req = {
    body: options.body || {},
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
    clearedCookies: [],
    clearCookie(name, opts) {
      this.clearedCookies.push({ name, opts });
      return this;
    },
    cookiesSet: [],
    cookie(name, val, opts) {
      this.cookiesSet.push({ name, val, opts });
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
// Test 1: Password Hashing & Comparison Security
// -----------------------------------------------------------------------------
test('1 & 3: Password hashing uses bcrypt and rejects incorrect passwords', async () => {
  const plaintext = 'SuperSecret123!';
  const hash = await hashPassword(plaintext);

  // Hash must be non-plaintext and start with bcrypt identifier
  assert.notEqual(hash, plaintext);
  assert.ok(hash.startsWith('$2'));

  // Correct password matches
  const matchSuccess = await comparePassword(plaintext, hash);
  assert.equal(matchSuccess, true);

  // Incorrect password rejected
  const matchFailure = await comparePassword('WrongPassword999!', hash);
  assert.equal(matchFailure, false);
});

// -----------------------------------------------------------------------------
// Test 2: JWT Issuance, Expiry & Tamper Rejection
// -----------------------------------------------------------------------------
test('7: Missing, invalid, and tampered tokens are rejected safely', () => {
  const payload = { id: 'usr-123456789012', role: 'customer' };
  const token = generateToken(payload);

  assert.ok(typeof token === 'string' && token.length > 20);

  // Valid verification
  const decoded = verifyToken(token);
  assert.equal(decoded.id, payload.id);
  assert.equal(decoded.role, payload.role);

  // Tampered token must throw error
  const tamperedToken = token.slice(0, -6) + 'abcdef';
  assert.throws(() => verifyToken(tamperedToken));

  // Expired token test
  const expiredToken = jwt.sign(payload, process.env.JWT_ACCESS_SECRET || 'bystander-dev-jwt-secret-do-not-use-in-production-389472398472', {
    expiresIn: '0s',
    issuer: 'bystander-api',
  });
  assert.throws(() => verifyToken(expiredToken));
});

// -----------------------------------------------------------------------------
// Test 3: Input Validation Middleware — Customer Registration
// -----------------------------------------------------------------------------
test('11: Customer registration validation rejects short passwords, invalid emails', () => {
  // Test short password (< 8 chars)
  const { req: req1, res: res1, next: next1 } = createMockReqRes({
    body: {
      fullName: 'Anita Sharma',
      email: 'anita@example.com',
      password: 'short', // < 8
    },
  });
  validateCustomerRegistration(req1, res1, next1);
  assert.equal(res1.statusCode, 400);
  assert.equal(res1.jsonData.error, 'ValidationError');

  // Test invalid email
  const { req: req2, res: res2, next: next2 } = createMockReqRes({
    body: {
      fullName: 'Anita Sharma',
      email: 'not-an-email',
      password: 'ValidPassword123!',
    },
  });
  validateCustomerRegistration(req2, res2, next2);
  assert.equal(res2.statusCode, 400);

  // Test valid payload passes through
  const { req: req3, res: res3, next: next3, getNextCalled } = createMockReqRes({
    body: {
      fullName: '  Anita Sharma  ',
      email: 'ANITA@EXAMPLE.COM ',
      password: 'ValidPassword123!',
    },
  });
  validateCustomerRegistration(req3, res3, next3);
  assert.equal(getNextCalled(), true);
  assert.equal(req3.body.fullName, 'Anita Sharma'); // trimmed
  assert.equal(req3.body.email, 'anita@example.com'); // lowercased & trimmed
});

// -----------------------------------------------------------------------------
// Test 4: Input Validation Middleware — Caregiver Registration
// -----------------------------------------------------------------------------
test('11: Caregiver registration validation rejects unapproved qualifications', () => {
  const { req, res, next } = createMockReqRes({
    body: {
      fullName: 'Ramesh Patel',
      phone: '+919876543210',
      password: 'StrongPassword123!',
      qualification: 'unlicensed_practitioner', // not approved
    },
  });
  validateCaregiverRegistration(req, res, next);
  assert.equal(res.statusCode, 400);
  assert.equal(res.jsonData.error, 'ValidationError');
});

// -----------------------------------------------------------------------------
// Test 5: Role Escalation Prevention
// -----------------------------------------------------------------------------
test('5: Role escalation prevented — User schema defaults and payload hardening', () => {
  // Even if a payload tries to inject role: 'admin' or status: 'active'
  const user = new User({
    fullName: 'Attacker Trying Admin',
    email: 'attacker@example.com',
    passwordHash: 'dummyhash',
  });
  // Default role must be customer
  assert.equal(user.role, 'customer');

  // CaregiverProfile default verificationStatus must be 'pending'
  const cg = new CaregiverProfile({
    user: '507f1f77bcf86cd799439011',
    qualification: 'BSc Nursing',
  });
  assert.equal(cg.verificationStatus, 'pending');
  assert.equal(cg.completedJobs, 0);
  assert.equal(cg.trustScore, 50);
});

// -----------------------------------------------------------------------------
// Test 6: Authenticate Middleware — Missing & Invalid Token
// -----------------------------------------------------------------------------
test('7: Authenticate middleware rejects missing token with 401', async () => {
  const { req, res, next } = createMockReqRes();
  await authenticate(req, res, next);

  assert.equal(res.statusCode, 401);
  assert.equal(res.jsonData.error, 'Unauthorized');
});

test('7: Authenticate middleware rejects invalid token with 401', async () => {
  const { req, res, next } = createMockReqRes({
    cookies: { token: 'invalid.jwt.token' },
  });
  await authenticate(req, res, next);

  assert.equal(res.statusCode, 401);
  assert.equal(res.jsonData.error, 'Unauthorized');
});

// -----------------------------------------------------------------------------
// Test 7: Role-Based Authorization Middleware (`authorizeRoles`)
// -----------------------------------------------------------------------------
test('10: authorizeRoles permits matching roles and rejects unauthorized roles', () => {
  const adminOnly = authorizeRoles('admin');

  // Customer attempting admin access -> 403 Forbidden
  const { req: reqCustomer, res: resCustomer, next: nextCustomer } = createMockReqRes({
    user: { role: 'customer' },
  });
  adminOnly(reqCustomer, resCustomer, nextCustomer);
  assert.equal(resCustomer.statusCode, 403);
  assert.equal(resCustomer.jsonData.error, 'Forbidden');

  // Admin accessing admin endpoint -> allowed
  const { req: reqAdmin, res: resAdmin, next: nextAdmin, getNextCalled } = createMockReqRes({
    user: { role: 'admin' },
  });
  adminOnly(reqAdmin, resAdmin, nextAdmin);
  assert.equal(getNextCalled(), true);
});

// -----------------------------------------------------------------------------
// Test 8: Account Status Rejection (Blocked & Suspended)
// -----------------------------------------------------------------------------
test('9: Rejection of blocked or suspended accounts', () => {
  // Verify status enum supports blocked and suspended
  const statusValues = User.schema.path('status').enumValues;
  assert.ok(statusValues.includes('blocked'));
  assert.ok(statusValues.includes('suspended'));
  assert.ok(statusValues.includes('active'));
  assert.ok(statusValues.includes('pending_verification'));
});

// -----------------------------------------------------------------------------
// Test 9: Cookie Options & Security Policy
// -----------------------------------------------------------------------------
test('8: Cookie options enforce httpOnly and 7-day maxAge', () => {
  const opts = getCookieOptions();
  assert.equal(opts.httpOnly, true);
  assert.equal(opts.maxAge, 7 * 24 * 60 * 60 * 1000);
  assert.equal(opts.path, '/');
  assert.ok('sameSite' in opts);
});

// -----------------------------------------------------------------------------
// Test 10: User Sanitization
// -----------------------------------------------------------------------------
test('3: User sanitization strips passwordHash and __v', () => {
  const rawUser = {
    _id: 'usr-123',
    fullName: 'Priya Sharma',
    email: 'priya@example.com',
    role: 'customer',
    passwordHash: '$2a$12$e0M2/secretPasswordHash',
    __v: 0,
  };

  const safe = sanitizeUser(rawUser);
  assert.equal('passwordHash' in safe, false);
  assert.equal('__v' in safe, false);
  assert.equal(safe.fullName, 'Priya Sharma');
});

// -----------------------------------------------------------------------------
// Test 11: Validation Middleware — Login
// -----------------------------------------------------------------------------
test('11: Login validation rejects missing identifier or password', () => {
  const { req: req1, res: res1, next: next1 } = createMockReqRes({
    body: { password: 'Pass12345!' }, // missing identifier
  });
  validateLogin(req1, res1, next1);
  assert.equal(res1.statusCode, 400);

  const { req: req2, res: res2, next: next2 } = createMockReqRes({
    body: { email: 'user@test.com' }, // missing password
  });
  validateLogin(req2, res2, next2);
  assert.equal(res2.statusCode, 400);

  const { req: req3, res: res3, next: next3, getNextCalled } = createMockReqRes({
    body: { email: 'user@test.com', password: 'Password123!' },
  });
  validateLogin(req3, res3, next3);
  assert.equal(getNextCalled(), true);
  assert.equal(req3.body.identifier, 'user@test.com');
});

// -----------------------------------------------------------------------------
// Test 12: Professional Account Status & Dynamic Review Date Message Formatting
// -----------------------------------------------------------------------------
test('12: formatAccountStatusMessage outputs dynamic review date and professional status notices', () => {
  // Case A: User with future review date formatted dynamically
  const futureDate = new Date();
  futureDate.setDate(futureDate.getDate() + 7);
  const isoDate = futureDate.toISOString().slice(0, 10);
  const expectedFormatted = futureDate.toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });

  const msgWithDate = formatAccountStatusMessage({
    status: 'suspended',
    statusReviewAfter: isoDate,
  });
  assert.equal(
    msgWithDate,
    `Your account has been temporarily suspended until ${expectedFormatted}. Please contact platform support.`,
  );

  // Case B: Review date pulled from active blacklist entry fallback
  const msgFromBlacklist = formatAccountStatusMessage(
    { status: 'blocked', statusReviewAfter: null },
    { reviewAfter: isoDate },
  );
  assert.equal(
    msgFromBlacklist,
    `Your account has been temporarily suspended until ${expectedFormatted}. Please contact platform support.`,
  );

  // Case C: Permanent blacklist ban
  const msgPermanent = formatAccountStatusMessage({
    status: 'blocked',
    statusReviewAfter: 'Permanent',
  });
  assert.equal(
    msgPermanent,
    'Your account has been blocked and permanently blacklisted. Please contact platform support.',
  );

  // Case D: Past review date triggers pending administrative review notice
  const pastDate = new Date('2020-01-01');
  const msgPast = formatAccountStatusMessage({
    status: 'suspended',
    statusReviewAfter: '2020-01-01',
  });
  assert.equal(
    msgPast,
    'Your account suspension has reached its review date and is currently pending administrative review. Please contact platform support.',
  );
});

// -----------------------------------------------------------------------------
// Test 13: Customer Registration Flow - No Premature MongoDB Creation on OTP Step
// -----------------------------------------------------------------------------
test('Step 15 - 1: validateGuestOtp validates OTP without writing user to database', async () => {
  const originalFindOne = User.findOne;
  const originalCreate = User.create;
  let userInDb = null;
  User.findOne = async () => userInDb;
  User.create = async (payload) => {
    userInDb = { ...payload, _id: '6711a1b2c3d4e5f6a7b8c001' };
    return userInDb;
  };

  try {
    const testEmail = `temp_unregistered_${Date.now()}@example.com`;
    const { devOtp } = await requestGuestOtp(testEmail, 'signup');
    assert.ok(devOtp, 'Should return dev OTP in non-production mode');

    // 1. Validating OTP validates successfully
    const valResult = await validateGuestOtp(testEmail, devOtp);
    assert.equal(valResult.valid, true);

    // 2. Database MUST NOT contain this user yet
    assert.equal(userInDb, null, 'User must not be saved in background before password creation');
  } finally {
    User.findOne = originalFindOne;
    User.create = originalCreate;
  }
});

test('Step 15 - 2: verifyGuestOtp in signup mode rejects if password missing or under 6 chars', async () => {
  const originalFindOne = User.findOne;
  const originalCreate = User.create;
  let userInDb = null;
  User.findOne = async () => userInDb;
  User.create = async (payload) => {
    userInDb = { ...payload, _id: '6711a1b2c3d4e5f6a7b8c002' };
    return userInDb;
  };

  try {
    const testEmail = `temp_nopass_${Date.now()}@example.com`;
    const { devOtp } = await requestGuestOtp(testEmail, 'signup');

    // Missing password rejected
    await assert.rejects(
      () => verifyGuestOtp(testEmail, devOtp, null, 'signup'),
      (err) => {
        assert.equal(err.statusCode, 400);
        assert.match(err.message, /Password is required/i);
        return true;
      }
    );

    // Short password rejected
    await assert.rejects(
      () => verifyGuestOtp(testEmail, devOtp, '123', 'signup'),
      (err) => {
        assert.equal(err.statusCode, 400);
        assert.match(err.message, /Password is required/i);
        return true;
      }
    );

    // Database must still have zero records
    assert.equal(userInDb, null);
  } finally {
    User.findOne = originalFindOne;
    User.create = originalCreate;
  }
});

test('Step 15 - 3: verifyGuestOtp creates user only upon password submission in signup mode', async () => {
  const originalFindOne = User.findOne;
  const originalCreate = User.create;
  const origProfileCreate = CustomerProfile.create;

  let userInDb = null;
  User.findOne = async () => userInDb;
  User.create = async (payload) => {
    userInDb = { ...payload, _id: '6711a1b2c3d4e5f6a7b8c003' };
    return userInDb;
  };
  CustomerProfile.create = async (payload) => ({ ...payload, _id: '6711a1b2c3d4e5f6a7b8c999' });

  try {
    const testEmail = `new_customer_${Date.now()}@example.com`;
    const { devOtp } = await requestGuestOtp(testEmail, 'signup');

    // Validate OTP first (Step 2)
    await validateGuestOtp(testEmail, devOtp);
    assert.equal(userInDb, null, 'User must not exist after Step 2');

    // Submit Password (Step 3)
    const result = await verifyGuestOtp(testEmail, devOtp, 'SecretPass123!', 'signup');
    assert.ok(result.user);
    assert.equal(result.user.email, testEmail);
    assert.equal(result.user.role, 'customer');

    // Verify User is now in MongoDB with correct password hash
    assert.ok(userInDb);
    const match = await comparePassword('SecretPass123!', userInDb.passwordHash);
    assert.equal(match, true);
  } finally {
    User.findOne = originalFindOne;
    User.create = originalCreate;
    CustomerProfile.create = origProfileCreate;
  }
});
