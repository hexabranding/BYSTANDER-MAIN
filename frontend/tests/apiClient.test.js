import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import {
  apiClient,
  ApiError,
  setAuthToken,
  getAuthToken,
  clearAuthToken,
  getApiBaseUrl,
  parseErrorResponse,
} from '../src/services/apiClient.js';

describe('Step 12B - Centralized API Client', () => {
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    clearAuthToken();
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    clearAuthToken();
  });

  it('1. Resolves API base URL defaulting to relative /api', () => {
    const baseUrl = getApiBaseUrl();
    assert.strictEqual(baseUrl, '/api');
  });

  it('2. In-memory token management maintains tokens without localStorage', () => {
    assert.strictEqual(getAuthToken(), null);
    setAuthToken('test-token-12345');
    assert.strictEqual(getAuthToken(), 'test-token-12345');
    clearAuthToken();
    assert.strictEqual(getAuthToken(), null);
  });

  it('3. Sends requests with credentials: include and Authorization header if token set', async () => {
    setAuthToken('jwt-in-memory-token');

    let capturedUrl = '';
    let capturedOptions = {};

    globalThis.fetch = async (url, options) => {
      capturedUrl = url;
      capturedOptions = options;
      return new Response(JSON.stringify({ success: true, message: 'All good' }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      });
    };

    const result = await apiClient.get('/test-endpoint');

    assert.strictEqual(capturedUrl, '/api/test-endpoint');
    assert.strictEqual(capturedOptions.credentials, 'include');
    assert.strictEqual(capturedOptions.headers.Authorization, 'Bearer jwt-in-memory-token');
    assert.strictEqual(capturedOptions.headers.Accept, 'application/json');
    assert.strictEqual(result.success, true);
  });

  it('4. Handles 204 No Content safely without parsing errors', async () => {
    globalThis.fetch = async () => new Response(null, { status: 204 });

    const result = await apiClient.delete('/test-delete');
    assert.strictEqual(result.status, 204);
    assert.strictEqual(result.data, null);
  });

  it('5. Normalizes JSON error responses into ApiError instances', async () => {
    globalThis.fetch = async () =>
      new Response(
        JSON.stringify({
          success: false,
          error: 'ValidationError',
          message: 'Password is too short',
          errors: ['Password must be at least 8 characters'],
        }),
        {
          status: 400,
          headers: { 'content-type': 'application/json' },
        },
      );

    await assert.rejects(
      async () => {
        await apiClient.post('/auth/register/customer', { password: '123' });
      },
      (err) => {
        assert(err instanceof ApiError);
        assert.strictEqual(err.status, 400);
        assert.strictEqual(err.code, 'ValidationError');
        assert.strictEqual(err.message, 'Password is too short');
        assert.deepStrictEqual(err.errors, ['Password must be at least 8 characters']);
        assert.strictEqual(err.isValidationError, true);
        assert.strictEqual(err.isAuthError, false);
        return true;
      },
    );
  });

  it('6. Handles non-JSON error responses (e.g. 502 HTML proxy error) safely', async () => {
    globalThis.fetch = async () =>
      new Response('<html><body>502 Bad Gateway</body></html>', {
        status: 502,
        headers: { 'content-type': 'text/html' },
      });

    await assert.rejects(
      async () => {
        await apiClient.get('/some-broken-service');
      },
      (err) => {
        assert(err instanceof ApiError);
        assert.strictEqual(err.status, 502);
        assert.strictEqual(err.code, 'SERVER_ERROR');
        assert.strictEqual(err.isServerError, true);
        return true;
      },
    );
  });

  it('7. Classifies 401 Unauthorized and 403 Forbidden distinctly', async () => {
    // 401
    const res401 = new Response(JSON.stringify({ message: 'Token expired' }), {
      status: 401,
      headers: { 'content-type': 'application/json' },
    });
    const err401 = await parseErrorResponse(res401);
    assert.strictEqual(err401.isAuthError, true);
    assert.strictEqual(err401.isForbidden, false);
    assert.strictEqual(err401.status, 401);

    // 403
    const res403 = new Response(JSON.stringify({ message: 'Role caregiver required' }), {
      status: 403,
      headers: { 'content-type': 'application/json' },
    });
    const err403 = await parseErrorResponse(res403);
    assert.strictEqual(err403.isAuthError, false);
    assert.strictEqual(err403.isForbidden, true);
    assert.strictEqual(err403.status, 403);
  });

  it('8. Catches network disconnections and normalizes to NETWORK_ERROR with status 0', async () => {
    globalThis.fetch = async () => {
      throw new TypeError('Failed to fetch');
    };

    await assert.rejects(
      async () => {
        await apiClient.get('/test-network-fail');
      },
      (err) => {
        assert(err instanceof ApiError);
        assert.strictEqual(err.status, 0);
        assert.strictEqual(err.code, 'NETWORK_ERROR');
        assert.strictEqual(err.isNetworkError, true);
        return true;
      },
    );
  });
});
