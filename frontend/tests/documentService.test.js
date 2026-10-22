import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { getMyDocuments, uploadDocument } from '../src/services/documentService.js';
import { ApiError } from '../src/services/apiClient.js';

describe('BUG-01: Document Service calling signature & execution tests', () => {
  let mockFetchCalls = [];

  const MOCK_DOSSIER = {
    id: 'VR-6711A1B2C3D4E5F6A7B8C801',
    caregiverId: '6711a1b2c3d4e5f6a7b8c801',
    userId: '6711a1b2c3d4e5f6a7b8c802',
    name: 'Nurse Sneha Patil',
    regNo: 'MNC-2026-9921',
    qualification: 'registered_nurse',
    status: 'Under Review',
    verificationStatus: 'under_review',
    verified: false,
    documents: [
      {
        id: 'doc-1',
        type: 'Nursing Registration Certificate',
        documentType: 'nursing_registration',
        fileName: 'nursing_cert.pdf',
        fileSize: 2048576,
        status: 'Under review',
        verificationStatus: 'under_review',
      },
    ],
    history: [
      {
        at: '2026-10-21T10:00:00.000Z',
        action: 'Document uploaded — nursing_registration',
        by: 'Nurse Sneha Patil',
      },
    ],
  };

  const MOCK_UPLOADED_DOC = {
    _id: '6711a1b2c3d4e5f6a7b8c899',
    documentType: 'identity',
    fileName: 'aadhaar_card.pdf',
    fileSize: 1048576,
    mimeType: 'application/pdf',
    verificationStatus: 'under_review',
  };

  beforeEach(() => {
    mockFetchCalls = [];
    globalThis.fetch = async (url, options = {}) => {
      const urlStr = String(url);
      const method = (options.method || 'GET').toUpperCase();

      let body = options.body;
      if (typeof options.body === 'string') {
        try {
          body = JSON.parse(options.body);
        } catch {
          body = options.body;
        }
      }

      mockFetchCalls.push({ url: urlStr, method, body, headers: options.headers });

      // GET /api/caregiver/documents
      if (urlStr.includes('/caregiver/documents') && method === 'GET') {
        return new Response(
          JSON.stringify({
            success: true,
            data: MOCK_DOSSIER,
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } },
        );
      }

      // POST /api/caregiver/documents - Success
      if (urlStr.includes('/caregiver/documents') && method === 'POST') {
        // If testing error scenario
        if (body && body.triggerError) {
          return new Response(
            JSON.stringify({
              success: false,
              error: 'ValidationError',
              message: 'Invalid document type provided',
            }),
            { status: 400, headers: { 'Content-Type': 'application/json' } },
          );
        }

        return new Response(
          JSON.stringify({
            success: true,
            message: 'Document submitted successfully and is now under review',
            data: MOCK_UPLOADED_DOC,
          }),
          { status: 201, headers: { 'Content-Type': 'application/json' } },
        );
      }

      return new Response(
        JSON.stringify({ error: 'NotFoundError', message: 'Not Found' }),
        { status: 404, headers: { 'Content-Type': 'application/json' } },
      );
    };
  });

  it('1. getMyDocuments correctly invokes executeDataOperation with resourceKey and retrieves dossier', async () => {
    const res = await getMyDocuments();

    assert.ok(res, 'Should return truthy dossier');
    assert.strictEqual(mockFetchCalls.length, 1);
    assert.ok(mockFetchCalls[0].url.includes('/caregiver/documents'));
    assert.strictEqual(mockFetchCalls[0].method, 'GET');

    // Both direct property access and res.data access work
    assert.strictEqual(res.id, 'VR-6711A1B2C3D4E5F6A7B8C801');
    assert.strictEqual(res.name, 'Nurse Sneha Patil');
    assert.strictEqual(res.status, 'Under Review');
    assert.strictEqual(Array.isArray(res.documents), true);
    assert.strictEqual(res.documents.length, 1);
    assert.strictEqual(res.documents[0].fileName, 'nursing_cert.pdf');

    // Standard executeDataOperation metadata preserved
    assert.strictEqual(res.source, 'api');
    assert.strictEqual(res.isFallback, false);
    assert.ok(res.data);
  });

  it('2. uploadDocument correctly uploads document payload via POST /caregiver/documents', async () => {
    const payload = {
      documentType: 'identity',
      fileName: 'aadhaar_card.pdf',
      fileSize: 1048576,
      mimeType: 'application/pdf',
      fileData: 'data:application/pdf;base64,JVBERi0xLjQK...',
    };

    const res = await uploadDocument(payload);

    assert.ok(res, 'Should return upload response');
    assert.strictEqual(mockFetchCalls.length, 1);
    assert.ok(mockFetchCalls[0].url.includes('/caregiver/documents'));
    assert.strictEqual(mockFetchCalls[0].method, 'POST');
    assert.strictEqual(mockFetchCalls[0].body.documentType, 'identity');
    assert.strictEqual(mockFetchCalls[0].body.fileName, 'aadhaar_card.pdf');

    // Returned document structure
    assert.strictEqual(res.documentType, 'identity');
    assert.strictEqual(res.fileName, 'aadhaar_card.pdf');
    assert.strictEqual(res.verificationStatus, 'under_review');
    assert.strictEqual(res.source, 'api');
  });

  it('3. uploadDocument supports FormData payloads without throwing signature errors', async () => {
    const formData = new FormData();
    formData.append('documentType', 'police_clearance');
    formData.append('fileName', 'pcc.pdf');

    const res = await uploadDocument(formData);

    assert.ok(res);
    assert.strictEqual(mockFetchCalls.length, 1);
    assert.strictEqual(mockFetchCalls[0].method, 'POST');
    assert.strictEqual(mockFetchCalls[0].body, formData);
  });

  it('4. uploadDocument throws genuine ApiError on 400 failure and never fabricates mock success', async () => {
    const invalidPayload = {
      documentType: 'invalid_type',
      triggerError: true,
    };

    await assert.rejects(
      async () => {
        await uploadDocument(invalidPayload);
      },
      (err) => {
        assert.ok(err instanceof ApiError || err.name === 'ApiError');
        assert.strictEqual(err.status, 400);
        assert.strictEqual(err.message, 'Invalid document type provided');
        return true;
      },
    );

    assert.strictEqual(mockFetchCalls.length, 1);
  });

  it('5. uploadDocument rejects when no payload is provided', async () => {
    await assert.rejects(
      async () => {
        await uploadDocument(null);
      },
      {
        message: 'Document payload is required for upload',
      },
    );
  });
});
