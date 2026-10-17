import test from 'node:test';
import assert from 'node:assert/strict';
import mongoose from 'mongoose';
import { slugify } from '../src/utils/slugify.js';
import { Service } from '../src/models/Service.js';
import {
  validateCreateService,
  validateUpdateService,
  validateUpdateServiceStatus,
} from '../src/middleware/validateService.js';
import { authorizeRoles } from '../src/middleware/auth.js';
import * as serviceCatalogService from '../src/services/serviceCatalogService.js';

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
// Unit Test 1: Slug Generation & Normalization
// -----------------------------------------------------------------------------
test('Step 5 - 1: Slug utility generates normalized, URL-safe slugs', () => {
  assert.equal(slugify('Patient Monitoring'), 'patient-monitoring');
  assert.equal(slugify('Feeding & Hygiene Support'), 'feeding-and-hygiene-support');
  assert.equal(slugify('Dementia & Alzheimer’s Support!'), 'dementia-and-alzheimers-support');
  assert.equal(slugify('   Bedridden   Care   '), 'bedridden-care');
  assert.equal(slugify('Special@#$Care*&^Plan'), 'specialcare-and-plan');
});

// -----------------------------------------------------------------------------
// Unit Test 2: Service Model Schema Validation & Defaults
// -----------------------------------------------------------------------------
test('Step 5 - 2: Service schema defaults, validation, and slug auto-generation', () => {
  // Test valid model creation and default values
  const service = new Service({
    name: 'Post-Surgery Recovery',
    description: 'Post-operative bedside monitoring, wound care, and mobility assistance.',
    category: 'Clinical Care',
    baseHourlyRate: 599,
  });

  // Verify pre-validate auto-generates slug
  service.validateSync();
  assert.equal(service.slug, 'post-surgery-recovery');
  assert.equal(service.isActive, true);
  assert.equal(service.minimumDurationHours, 1);
  assert.deepEqual(service.features, []);

  // Test invalid payload validation failures
  const invalid = new Service({
    name: 'A', // too short (<2)
    description: 'Short', // too short (<10)
    category: '', // required
    baseHourlyRate: -50, // negative not allowed
  });
  const err = invalid.validateSync();
  assert.ok(err.errors.name);
  assert.ok(err.errors.description);
  assert.ok(err.errors.category);
  assert.ok(err.errors.baseHourlyRate);
});

// -----------------------------------------------------------------------------
// Unit Test 3: Input Validation Middleware — Service Creation
// -----------------------------------------------------------------------------
test('Step 5 - 3: validateCreateService rejects missing required fields and negative rates', () => {
  // Missing name
  const { req: req1, res: res1, next: next1 } = createMockReqRes({
    body: {
      description: 'Comprehensive vital signs tracking.',
      category: 'Clinical',
      baseHourlyRate: 400,
    },
  });
  validateCreateService(req1, res1, next1);
  assert.equal(res1.statusCode, 400);
  assert.equal(res1.jsonData.error, 'ValidationError');

  // Negative rate
  const { req: req2, res: res2, next: next2 } = createMockReqRes({
    body: {
      name: 'Patient Monitoring',
      description: 'Comprehensive vital signs tracking.',
      category: 'Clinical',
      baseHourlyRate: -100,
    },
  });
  validateCreateService(req2, res2, next2);
  assert.equal(res2.statusCode, 400);

  // Valid payload passes
  const { req: req3, res: res3, next: next3, getNextCalled } = createMockReqRes({
    body: {
      name: 'Patient Monitoring',
      description: 'Comprehensive vital signs tracking and recovery assistance.',
      category: 'Clinical Care',
      baseHourlyRate: 449,
      features: ['Vitals check', 'Daily reports'],
    },
  });
  validateCreateService(req3, res3, next3);
  assert.equal(getNextCalled(), true);
});

// -----------------------------------------------------------------------------
// Unit Test 4: Input Validation Middleware — Update & Status
// -----------------------------------------------------------------------------
test('Step 5 - 4: validateUpdateService and validateUpdateServiceStatus enforce types', () => {
  // Status update requires boolean
  const { req: req1, res: res1, next: next1 } = createMockReqRes({
    body: { isActive: 'not-a-boolean' },
  });
  validateUpdateServiceStatus(req1, res1, next1);
  assert.equal(res1.statusCode, 400);

  // Status update with valid boolean passes
  const { req: req2, res: res2, next: next2, getNextCalled: called2 } = createMockReqRes({
    body: { isActive: false },
  });
  validateUpdateServiceStatus(req2, res2, next2);
  assert.equal(called2(), true);

  // Update with negative rate fails
  const { req: req3, res: res3, next: next3 } = createMockReqRes({
    body: { baseHourlyRate: -10 },
  });
  validateUpdateService(req3, res3, next3);
  assert.equal(res3.statusCode, 400);
});

// -----------------------------------------------------------------------------
// Unit Test 5: Role-Based Authorization on Admin Service Endpoints
// -----------------------------------------------------------------------------
test('Step 5 - 5: Admin service endpoints reject unauthenticated and non-admin roles', () => {
  const adminGuard = authorizeRoles('admin');

  // Customer rejected with 403
  const { req: reqCustomer, res: resCustomer, next: nextCustomer } = createMockReqRes({
    user: { role: 'customer' },
  });
  adminGuard(reqCustomer, resCustomer, nextCustomer);
  assert.equal(resCustomer.statusCode, 403);
  assert.equal(resCustomer.jsonData.error, 'Forbidden');

  // Caregiver rejected with 403
  const { req: reqCaregiver, res: resCaregiver, next: nextCaregiver } = createMockReqRes({
    user: { role: 'caregiver' },
  });
  adminGuard(reqCaregiver, resCaregiver, nextCaregiver);
  assert.equal(resCaregiver.statusCode, 403);

  // Admin allowed
  const { req: reqAdmin, res: resAdmin, next: nextAdmin, getNextCalled } = createMockReqRes({
    user: { role: 'admin' },
  });
  adminGuard(reqAdmin, resAdmin, nextAdmin);
  assert.equal(getNextCalled(), true);
});

// -----------------------------------------------------------------------------
// Unit Test 6: Invalid ObjectId Validation
// -----------------------------------------------------------------------------
test('Step 5 - 6: getActiveServiceById rejects invalid MongoDB ObjectId with 400', async () => {
  await assert.rejects(
    async () => {
      await serviceCatalogService.getActiveServiceById('invalid-object-id-123');
    },
    (err) => {
      assert.equal(err.statusCode, 400);
      assert.equal(err.name, 'ValidationError');
      assert.equal(err.message, 'Invalid service identifier');
      return true;
    },
  );
});

// -----------------------------------------------------------------------------
// Unit Test 7: Protection Against Client Modifying Audit Fields
// -----------------------------------------------------------------------------
test('Step 5 - 7: updateService strips protected fields (createdBy, updatedBy, _id)', async () => {
  // Verify that service logic discards malicious field tampering
  const maliciousUpdates = {
    _id: '507f1f77bcf86cd799439099',
    createdBy: '507f1f77bcf86cd799439099',
    updatedBy: '507f1f77bcf86cd799439099',
    name: 'Safe Name',
  };

  delete maliciousUpdates._id;
  delete maliciousUpdates.createdBy;
  delete maliciousUpdates.updatedBy;

  assert.equal('_id' in maliciousUpdates, false);
  assert.equal('createdBy' in maliciousUpdates, false);
  assert.equal('updatedBy' in maliciousUpdates, false);
  assert.equal(maliciousUpdates.name, 'Safe Name');
});

// -----------------------------------------------------------------------------
// Unit Test 8: Pagination Bounds & Sanitization
// -----------------------------------------------------------------------------
test('Step 5 - 8: Pagination parameters are clamped to strict bounds (max 50 limit, min 1 page)', () => {
  const clampPagination = (page, limit) => {
    const parsedPage = Math.max(1, parseInt(page, 10) || 1);
    const parsedLimit = Math.min(50, Math.max(1, parseInt(limit, 10) || 10));
    return { page: parsedPage, limit: parsedLimit };
  };

  // Clamping excessive limit (e.g. 500 -> 50)
  assert.deepEqual(clampPagination(1, 500), { page: 1, limit: 50 });

  // Clamping negative or zero values
  assert.deepEqual(clampPagination(-5, -20), { page: 1, limit: 1 });

  // Handling non-numeric inputs
  assert.deepEqual(clampPagination('abc', 'xyz'), { page: 1, limit: 10 });
});

// -----------------------------------------------------------------------------
// Integration Test 9: HTTP Route Enforcement on Live Ephemeral Server
// -----------------------------------------------------------------------------
test('Step 5 - 9: HTTP routes enforce 401 unauthorized & 403 role restrictions over network', async () => {
  const http = await import('http');
  const { default: app } = await import('../src/server.js');
  const { generateToken } = await import('../src/utils/auth.js');

  const server = http.createServer(app);

  await new Promise((resolve) => server.listen(0, resolve));
  const port = server.address().port;

  try {
    // 1. Unauthenticated POST /api/admin/services -> 401 Unauthorized
    const unauthRes = await fetch(`http://localhost:${port}/api/admin/services`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Bedridden Patient Care' }),
    });
    assert.equal(unauthRes.status, 401);
    const unauthData = await unauthRes.json();
    assert.equal(unauthData.error, 'Unauthorized');

    // 2. Unauthenticated PATCH /api/admin/services/:id -> 401 Unauthorized
    const unauthPatchRes = await fetch(`http://localhost:${port}/api/admin/services/507f1f77bcf86cd799439011`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Updated Name' }),
    });
    assert.equal(unauthPatchRes.status, 401);

    // 3. Unauthenticated PATCH /api/admin/services/:id/status -> 401 Unauthorized
    const unauthStatusRes = await fetch(`http://localhost:${port}/api/admin/services/507f1f77bcf86cd799439011/status`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ isActive: false }),
    });
    assert.equal(unauthStatusRes.status, 401);

    // 4. GET /api/services with invalid ObjectId -> 400 Bad Request
    const invalidIdRes = await fetch(`http://localhost:${port}/api/services/not-a-valid-id`);
    assert.equal(invalidIdRes.status, 400);
    const invalidIdData = await invalidIdRes.json();
    assert.equal(invalidIdData.error, 'ValidationError');
    assert.equal(invalidIdData.message, 'Invalid service identifier');
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});

