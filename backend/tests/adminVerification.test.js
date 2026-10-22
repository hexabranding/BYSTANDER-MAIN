import test from 'node:test';
import assert from 'node:assert/strict';
import mongoose from 'mongoose';
import { authorizeRoles } from '../src/middleware/auth.js';
import {
  validateVerificationQuery,
  validateCaregiverIdParam,
  validateDocumentIdParam,
  validateUpdateDocumentStatus,
  validateUpdateCaregiverVerificationStatus,
} from '../src/middleware/validateAdminVerification.js';
import { validateCaregiverDocumentUpload } from '../src/middleware/validateCaregiver.js';
import * as adminVerificationService from '../src/services/adminVerificationService.js';


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
test('Step 13B - 1: authorizeRoles enforces admin-only access and rejects customer & caregiver', () => {
  const adminGuard = authorizeRoles('admin');

  // Customer caller rejected with 403 Forbidden
  const { req: custReq, res: custRes, next: custNext } = createMockReqRes({
    user: { _id: new mongoose.Types.ObjectId(), role: 'customer' },
  });
  adminGuard(custReq, custRes, custNext);
  assert.equal(custRes.statusCode, 403);
  assert.equal(custRes.jsonData.error, 'Forbidden');
  assert.match(custRes.jsonData.message, /not authorized/);

  // Caregiver caller rejected with 403 Forbidden
  const { req: cgReq, res: cgRes, next: cgNext } = createMockReqRes({
    user: { _id: new mongoose.Types.ObjectId(), role: 'caregiver' },
  });
  adminGuard(cgReq, cgRes, cgNext);
  assert.equal(cgRes.statusCode, 403);
  assert.equal(cgRes.jsonData.error, 'Forbidden');
  assert.match(cgRes.jsonData.message, /not authorized/);

  // Unauthenticated caller rejected with 401 Unauthorized
  const { req: unauthReq, res: unauthRes, next: unauthNext } = createMockReqRes({
    user: null,
  });
  adminGuard(unauthReq, unauthRes, unauthNext);
  assert.equal(unauthRes.statusCode, 401);
  assert.equal(unauthRes.jsonData.error, 'Unauthorized');

  // Admin caller permitted
  const { req: adminReq, res: adminRes, next: adminNext, getNextCalled: getAdminCalled, getNextError: getAdminError } = createMockReqRes({
    user: { _id: new mongoose.Types.ObjectId(), role: 'admin' },
  });
  adminGuard(adminReq, adminRes, adminNext);
  assert.equal(getAdminCalled(), true);
  assert.equal(getAdminError(), null);
});

// -----------------------------------------------------------------------------
// Test 2: Verification Query Parameter Validation
// -----------------------------------------------------------------------------
test('Step 13B - 2: validateVerificationQuery validates status, page, and limit bounds', () => {
  // Invalid status
  const { req: invReq, res: invRes, next: invNext, getNextError: getInvError } = createMockReqRes({
    query: { status: 'invalid_status' },
  });
  validateVerificationQuery(invReq, invRes, invNext);
  const invErr = getInvError();
  assert.ok(invErr);
  assert.equal(invErr.statusCode, 400);
  assert.match(invErr.message, /Verification status filter must be one of/);

  // Invalid page (< 1)
  const { req: pReq, res: pRes, next: pNext, getNextError: getPError } = createMockReqRes({
    query: { page: '0' },
  });
  validateVerificationQuery(pReq, pRes, pNext);
  assert.equal(getPError().statusCode, 400);

  // Invalid limit (< 1)
  const { req: lReq, res: lRes, next: lNext, getNextError: getLError } = createMockReqRes({
    query: { limit: '-5' },
  });
  validateVerificationQuery(lReq, lRes, lNext);
  assert.equal(getLError().statusCode, 400);

  // Valid query
  const { req: valReq, res: valRes, next: valNext, getNextError: getValError, getNextCalled } = createMockReqRes({
    query: { status: 'under_review', page: '2', limit: '25' },
  });
  validateVerificationQuery(valReq, valRes, valNext);
  assert.equal(getNextCalled(), true);
  assert.equal(getValError(), null);
});

// -----------------------------------------------------------------------------
// Test 3: Caregiver and Document ObjectId validation
// -----------------------------------------------------------------------------
test('Step 13B - 3: validateCaregiverIdParam and validateDocumentIdParam enforce 24-char ObjectId format', () => {
  // Invalid Caregiver ID
  const { req: badCg, res: res1, next: next1, getNextError: getCgErr } = createMockReqRes({
    params: { id: 'not-an-objectid' },
  });
  validateCaregiverIdParam(badCg, res1, next1);
  assert.equal(getCgErr().statusCode, 400);
  assert.equal(getCgErr().name, 'ValidationError');

  // Valid Caregiver ID
  const { req: goodCg, res: res2, next: next2, getNextError: getGoodCgErr, getNextCalled: cgCalled } = createMockReqRes({
    params: { id: new mongoose.Types.ObjectId().toString() },
  });
  validateCaregiverIdParam(goodCg, res2, next2);
  assert.equal(cgCalled(), true);
  assert.equal(getGoodCgErr(), null);

  // Invalid Document ID
  const { req: badDoc, res: res3, next: next3, getNextError: getDocErr } = createMockReqRes({
    params: { documentId: 'bad-doc-id-123' },
  });
  validateDocumentIdParam(badDoc, res3, next3);
  assert.equal(getDocErr().statusCode, 400);
  assert.equal(getDocErr().name, 'ValidationError');

  // Valid Document ID
  const { req: goodDoc, res: res4, next: next4, getNextError: getGoodDocErr, getNextCalled: docCalled } = createMockReqRes({
    params: { documentId: new mongoose.Types.ObjectId().toString() },
  });
  validateDocumentIdParam(goodDoc, res4, next4);
  assert.equal(docCalled(), true);
  assert.equal(getGoodDocErr(), null);
});

// -----------------------------------------------------------------------------
// Test 4: Document Status Update Validation
// -----------------------------------------------------------------------------
test('Step 13B - 4: validateUpdateDocumentStatus enforces status enum and notes length limits', () => {
  // Missing status
  const { req: noStatus, res: res1, next: next1, getNextError: getNoStatusErr } = createMockReqRes({
    body: {},
  });
  validateUpdateDocumentStatus(noStatus, res1, next1);
  assert.equal(getNoStatusErr().statusCode, 400);

  // Invalid status
  const { req: badStatus, res: res2, next: next2, getNextError: getBadStatusErr } = createMockReqRes({
    body: { status: 'approved' }, // valid is verified
  });
  validateUpdateDocumentStatus(badStatus, res2, next2);
  assert.equal(getBadStatusErr().statusCode, 400);

  // Notes exceeding 1000 characters
  const { req: longNotes, res: res3, next: next3, getNextError: getLongNotesErr } = createMockReqRes({
    body: { status: 'verified', notes: 'x'.repeat(1001) },
  });
  validateUpdateDocumentStatus(longNotes, res3, next3);
  assert.equal(getLongNotesErr().statusCode, 400);
  assert.match(getLongNotesErr().message, /cannot exceed 1000 characters/);

  // Valid status and notes
  const { req: validReq, res: res4, next: next4, getNextError: getValidErr, getNextCalled } = createMockReqRes({
    body: { status: 'verified', notes: 'Valid council registration verified against state portal.' },
  });
  validateUpdateDocumentStatus(validReq, res4, next4);
  assert.equal(getNextCalled(), true);
  assert.equal(getValidErr(), null);
  assert.equal(validReq.body.status, 'verified');
});

// -----------------------------------------------------------------------------
// Test 5: Caregiver Verification Status Update Validation
// -----------------------------------------------------------------------------
test('Step 13B - 5: validateUpdateCaregiverVerificationStatus enforces status enum, reason, and trust score bounds', () => {
  // Missing status
  const { req: r1, res: res1, next: next1, getNextError: e1 } = createMockReqRes({ body: {} });
  validateUpdateCaregiverVerificationStatus(r1, res1, next1);
  assert.equal(e1().statusCode, 400);

  // Invalid status
  const { req: r2, res: res2, next: next2, getNextError: e2 } = createMockReqRes({ body: { status: 'active' } });
  validateUpdateCaregiverVerificationStatus(r2, res2, next2);
  assert.equal(e2().statusCode, 400);

  // Reason exceeding 1000 chars
  const { req: r3, res: res3, next: next3, getNextError: e3 } = createMockReqRes({
    body: { status: 'rejected', reason: 'a'.repeat(1005) },
  });
  validateUpdateCaregiverVerificationStatus(r3, res3, next3);
  assert.equal(e3().statusCode, 400);

  // Trust score out of bounds
  const { req: r4, res: res4, next: next4, getNextError: e4 } = createMockReqRes({
    body: { status: 'verified', trustScore: 120 },
  });
  validateUpdateCaregiverVerificationStatus(r4, res4, next4);
  assert.equal(e4().statusCode, 400);

  // Valid update
  const { req: r5, res: res5, next: next5, getNextError: e5, getNextCalled } = createMockReqRes({
    body: { status: 'verified', reason: 'All documents authenticated', trustScore: 92 },
  });
  validateUpdateCaregiverVerificationStatus(r5, res5, next5);
  assert.equal(getNextCalled(), true);
  assert.equal(e5(), null);
  assert.equal(r5.body.status, 'verified');
  assert.equal(r5.body.trustScore, 92);
});

// -----------------------------------------------------------------------------
// Test 6: Invalid ObjectId parameter rejection in service layer
// -----------------------------------------------------------------------------
test('Step 13B - 6: Service layer raises NotFoundError on invalid ObjectId formats', async () => {
  const invalidId = 'not-a-valid-24char-hex-id';

  // getVerificationById with invalid ID format
  await assert.rejects(
    async () => {
      await adminVerificationService.getVerificationById(invalidId);
    },
    {
      name: 'NotFoundError',
      statusCode: 404,
    },
  );

  // updateDocumentStatus with invalid ID format
  await assert.rejects(
    async () => {
      await adminVerificationService.updateDocumentStatus(
        invalidId,
        { status: 'verified' },
        { _id: new mongoose.Types.ObjectId() },
      );
    },
    {
      name: 'NotFoundError',
      statusCode: 404,
    },
  );

  // updateCaregiverVerificationStatus with invalid ID format
  await assert.rejects(
    async () => {
      await adminVerificationService.updateCaregiverVerificationStatus(
        invalidId,
        { status: 'verified' },
        { _id: new mongoose.Types.ObjectId() },
      );
    },
    {
      name: 'NotFoundError',
      statusCode: 404,
    },
  );
});

// -----------------------------------------------------------------------------
// Test 7: Caregiver Document Upload Validation
// -----------------------------------------------------------------------------
test('Step 13B - 7: validateCaregiverDocumentUpload rejects invalid documentType, invalid mimeType, and oversize files', () => {
  // Invalid documentType
  const { req: invTypeReq, res: invTypeRes, next: invTypeNext } = createMockReqRes({
    body: { documentType: 'invalid_type', fileName: 'test.pdf' },
  });
  validateCaregiverDocumentUpload(invTypeReq, invTypeRes, invTypeNext);
  assert.equal(invTypeRes.statusCode, 400);
  assert.equal(invTypeRes.jsonData.error, 'ValidationError');

  // Invalid mimeType
  const { req: invMimeReq, res: invMimeRes, next: invMimeNext } = createMockReqRes({
    body: { documentType: 'identity', fileName: 'test.exe', mimeType: 'application/x-msdownload' },
  });
  validateCaregiverDocumentUpload(invMimeReq, invMimeRes, invMimeNext);
  assert.equal(invMimeRes.statusCode, 400);
  assert.equal(invMimeRes.jsonData.error, 'ValidationError');

  // Oversize fileSize
  const { req: invSizeReq, res: invSizeRes, next: invSizeNext } = createMockReqRes({
    body: { documentType: 'identity', fileName: 'test.pdf', fileSize: 15 * 1024 * 1024 },
  });
  validateCaregiverDocumentUpload(invSizeReq, invSizeRes, invSizeNext);
  assert.equal(invSizeRes.statusCode, 400);
  assert.equal(invSizeRes.jsonData.error, 'ValidationError');
});

test('Step 13B - 8: validateCaregiverDocumentUpload passes valid document payload and sanitizes fields', () => {
  const userId = new mongoose.Types.ObjectId();
  const { req: validReq, res: validRes, next: validNext, getNextCalled } = createMockReqRes({
    user: { _id: userId, role: 'caregiver' },
    body: {
      documentType: 'identity',
      fileName: 'aadhaar_card.pdf',
      fileSize: 204800,
      mimeType: 'application/pdf',
      fileData: 'data:application/pdf;base64,JVBERi0xLjQK...',
    },
  });
  validateCaregiverDocumentUpload(validReq, validRes, validNext);
  assert.equal(getNextCalled(), true);
  assert.ok(validReq.sanitizedDocument);
  assert.equal(validReq.sanitizedDocument.documentType, 'identity');
  assert.equal(validReq.sanitizedDocument.fileName, 'aadhaar_card.pdf');
  assert.equal(validReq.sanitizedDocument.fileSize, 204800);
  assert.equal(validReq.sanitizedDocument.mimeType, 'application/pdf');
  assert.equal(validReq.sanitizedDocument.fileKey, 'data:application/pdf;base64,JVBERi0xLjQK...');
});

