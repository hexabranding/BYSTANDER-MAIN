import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import {
  normalizeQualification,
  normalizeUser,
  login,
  registerCustomer,
  registerCaregiver,
  getMe,
  logout,
} from '../src/services/authService.js';
import { setAuthToken, getAuthToken, clearAuthToken } from '../src/services/apiClient.js';

describe('Step 12B - Authentication Service & Security Integration', () => {
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    clearAuthToken();
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    clearAuthToken();
  });

  it('1. Normalizes UI qualifications to backend APPROVED_QUALIFICATIONS enum', () => {
    assert.strictEqual(normalizeQualification('GNM Nursing'), 'GNM');
    assert.strictEqual(normalizeQualification('B.Sc Nursing'), 'BSc Nursing');
    assert.strictEqual(normalizeQualification('ANM Nursing'), 'ANM');
    assert.strictEqual(normalizeQualification('Nursing Student (Final Year)'), 'nursing_student');
    assert.strictEqual(normalizeQualification('MBBS'), 'MBBS');
    assert.strictEqual(normalizeQualification('Physiotherapy Assistant'), 'Physiotherapy Assistant');
    assert.strictEqual(normalizeQualification('Certified Elder Care Giver'), 'Certified Elder Care Giver');
    assert.strictEqual(normalizeQualification('Paramedic'), 'Paramedic');
    assert.strictEqual(normalizeQualification('Unrecognized Certificate'), 'other');
    assert.strictEqual(normalizeQualification(null), 'other');
  });

  it('2. Normalizes backend user and profile documents for frontend UI compatibility', () => {
    const rawUser = {
      _id: '671190abcdef123456789012',
      fullName: 'Aarav Patel',
      email: 'aarav.patel@example.com',
      phone: '+919876543210',
      role: 'customer',
      avatar: 'https://example.com/avatar.jpg',
      status: 'active',
      createdAt: '2026-10-15T10:00:00.000Z',
    };

    const rawProfile = {
      defaultAddress: {
        addressLine1: 'Flat 402, Sunshine Apts',
        addressLine2: 'Andheri West',
        city: 'Mumbai',
        postalCode: '400053',
      },
      patients: [
        {
          fullName: 'Kishore Patel',
          age: 78,
          relation: 'Father',
          diagnosis: 'Post-stroke mobility recovery',
        },
      ],
    };

    const user = normalizeUser(rawUser, rawProfile);

    assert.strictEqual(user.id, '671190abcdef123456789012');
    assert.strictEqual(user.name, 'Aarav Patel');
    assert.strictEqual(user.fullName, 'Aarav Patel');
    assert.strictEqual(user.email, 'aarav.patel@example.com');
    assert.strictEqual(user.phone, '+919876543210');
    assert.strictEqual(user.role, 'customer');
    assert.strictEqual(user.city, 'Mumbai');
    assert.strictEqual(user.address, 'Flat 402, Sunshine Apts, Andheri West, Mumbai, 400053');
    assert.strictEqual(user.patientInfo?.name, 'Kishore Patel');
    assert.strictEqual(user.patientInfo?.age, 78);
    assert.strictEqual(user.patientInfo?.relation, 'Father');
    assert.strictEqual(user.patientInfo?.condition, 'Post-stroke mobility recovery');
  });

  it('3. Login maps email/phone to identifier and saves token in memory only', async () => {
    let capturedBody = null;

    globalThis.fetch = async (url, options) => {
      capturedBody = JSON.parse(options.body);
      return new Response(
        JSON.stringify({
          success: true,
          message: 'Logged in successfully',
          data: {
            user: { _id: '6711a1b2c3d4e5f6a7b8c9d0', fullName: 'Priya Sharma', role: 'customer' },
            profile: {},
            token: 'valid-jwt-access-token',
          },
        }),
        { status: 200, headers: { 'content-type': 'application/json' } },
      );
    };

    const result = await login({ email: 'priya@example.com', password: 'Password123!' });

    assert.strictEqual(result.ok, true);
    assert.strictEqual(capturedBody.identifier, 'priya@example.com');
    assert.strictEqual(capturedBody.password, 'Password123!');
    assert.strictEqual(result.user.name, 'Priya Sharma');
    assert.strictEqual(getAuthToken(), 'valid-jwt-access-token');
  });

  it('4. Login handles 401 invalid credentials gracefully without unhandled exceptions', async () => {
    globalThis.fetch = async () =>
      new Response(
        JSON.stringify({
          success: false,
          error: 'Unauthorized',
          message: 'Invalid email/phone or password',
        }),
        { status: 401, headers: { 'content-type': 'application/json' } },
      );

    const result = await login({ email: 'wrong@example.com', password: 'badpassword' });

    assert.strictEqual(result.ok, false);
    assert.strictEqual(result.message, 'Invalid email/phone or password');
    assert.strictEqual(getAuthToken(), null);
  });

  it('5. Customer registration enforces required bounds and maps mobile to phone', async () => {
    let capturedPayload = null;

    globalThis.fetch = async (url, options) => {
      if (url.includes('/customer/profile')) {
        return new Response(JSON.stringify({ success: true, data: {} }), { status: 200, headers: { 'content-type': 'application/json' } });
      }
      capturedPayload = JSON.parse(options.body);
      return new Response(
        JSON.stringify({
          success: true,
          data: {
            user: { _id: '6711customer123', fullName: 'Neha Gupta', role: 'customer' },
            profile: {},
            token: 'customer-registered-token',
          },
        }),
        { status: 201, headers: { 'content-type': 'application/json' } },
      );
    };

    // Rejects password shorter than 8 chars
    const shortPassResult = await registerCustomer({
      fullName: 'Neha Gupta',
      email: 'neha@example.com',
      mobile: '+919876543210',
      password: 'short',
    });
    assert.strictEqual(shortPassResult.ok, false);
    assert.match(shortPassResult.message, /8 characters/i);

    // Valid registration
    const validResult = await registerCustomer({
      fullName: 'Neha Gupta',
      email: 'neha@example.com',
      mobile: '+91 98765 43210',
      password: 'StrongPassword123!',
      city: 'Pune',
      area: 'Kothrud',
      address: 'Plot 12, Mayur Colony',
      pincode: '411038',
      patientInfo: {
        name: 'Suresh Gupta',
        age: 72,
        relation: 'Father',
        condition: 'Hypertension',
      },
    });

    assert.strictEqual(validResult.ok, true);
    assert.strictEqual(capturedPayload.phone, '+919876543210');
    assert.strictEqual(capturedPayload.fullName, 'Neha Gupta');
    assert.strictEqual(getAuthToken(), 'customer-registered-token');
  });

  it('6. Caregiver registration normalizes qualification and maps rate and mobile', async () => {
    let capturedPayload = null;

    globalThis.fetch = async (url, options) => {
      if (url.includes('/caregiver/profile')) {
        return new Response(JSON.stringify({ success: true, data: {} }), { status: 200, headers: { 'content-type': 'application/json' } });
      }
      capturedPayload = JSON.parse(options.body);
      return new Response(
        JSON.stringify({
          success: true,
          data: {
            user: { _id: '6711caregiver123', fullName: 'Ananya Deshmukh', role: 'caregiver' },
            profile: { qualification: 'BSc Nursing', hourlyRate: 600 },
            token: 'caregiver-registered-token',
          },
        }),
        { status: 201, headers: { 'content-type': 'application/json' } },
      );
    };

    const result = await registerCaregiver({
      fullName: 'Ananya Deshmukh',
      email: 'ananya@example.com',
      mobile: '+91 98219 30044',
      password: 'StrongPassword123!',
      qualification: 'B.Sc Nursing',
      hourlyRate: 600,
      city: 'Mumbai',
    });

    assert.strictEqual(result.ok, true);
    assert.strictEqual(capturedPayload.qualification, 'BSc Nursing');
    assert.strictEqual(capturedPayload.phone, '+919821930044');
    assert.strictEqual(capturedPayload.hourlyRate, 600);
  });

  it('7. Session restoration (getMe) recovers user on 200 and reports unauthenticated on 401', async () => {
    // 200 Success
    globalThis.fetch = async () =>
      new Response(
        JSON.stringify({
          success: true,
          data: {
            user: { _id: 'user-active-1', fullName: 'Restored User', role: 'customer' },
            profile: {},
          },
        }),
        { status: 200, headers: { 'content-type': 'application/json' } },
      );

    const activeResult = await getMe();
    assert.strictEqual(activeResult.ok, true);
    assert.strictEqual(activeResult.user.name, 'Restored User');

    // 401 Unauthenticated
    globalThis.fetch = async () =>
      new Response(JSON.stringify({ message: 'No session' }), { status: 401, headers: { 'content-type': 'application/json' } });

    const unauthResult = await getMe();
    assert.strictEqual(unauthResult.ok, false);
    assert.strictEqual(unauthResult.user, undefined);
  });

  it('8. Logout wipes in-memory token even if backend request encounters network failure', async () => {
    setAuthToken('token-to-be-cleared');
    assert.strictEqual(getAuthToken(), 'token-to-be-cleared');

    globalThis.fetch = async () => {
      throw new TypeError('Network error during logout');
    };

    const logoutResult = await logout();
    assert.strictEqual(logoutResult.ok, true);
    assert.strictEqual(getAuthToken(), null, 'In-memory token was not cleared after logout failure');
  });
});
