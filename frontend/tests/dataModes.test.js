import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  DATA_MODES,
  FALLBACK_ALLOWLIST,
  FORBIDDEN_FALLBACK_RESOURCES,
  isFallbackPermitted,
  executeDataOperation,
} from '../src/services/dataModes.js';
import { ApiError } from '../src/services/apiClient.js';

describe('Step 12B - Centralized Data Modes & Fallback Governance', () => {
  it('1. Enforces strict fallback allowlist and forbidden mutation blocklist', () => {
    // Verify allowlist and blocklist set structures
    assert.strictEqual(FALLBACK_ALLOWLIST.has('services:list'), true);
    assert.strictEqual(FORBIDDEN_FALLBACK_RESOURCES.has('auth:login'), true);

    // Approved read-only showcase resources
    assert.strictEqual(isFallbackPermitted('services:list'), true);
    assert.strictEqual(isFallbackPermitted('services:detail'), true);
    assert.strictEqual(isFallbackPermitted('caregivers:directory'), true);
    assert.strictEqual(isFallbackPermitted('caregivers:detail'), true);

    // Forbidden transactional, auth, and state-mutation resources
    assert.strictEqual(isFallbackPermitted('auth:login'), false);
    assert.strictEqual(isFallbackPermitted('auth:register'), false);
    assert.strictEqual(isFallbackPermitted('bookings:create'), false);
    assert.strictEqual(isFallbackPermitted('bookings:accept'), false);
    assert.strictEqual(isFallbackPermitted('bookings:checkin_verify'), false);
    assert.strictEqual(isFallbackPermitted('messages:send'), false);
    assert.strictEqual(isFallbackPermitted('sos:create'), false);
    assert.strictEqual(isFallbackPermitted('payments:simulate'), false);
  });

  it('2. Static mode returns static data directly with source: static', async () => {
    const result = await executeDataOperation('services:list', {
      mode: DATA_MODES.STATIC,
      staticFn: async () => [{ id: 'mock-1', name: 'Mock Service' }],
    });

    assert.strictEqual(result.source, 'static');
    assert.strictEqual(result.isFallback, false);
    assert.strictEqual(result.data.length, 1);
    assert.strictEqual(result.data[0].name, 'Mock Service');
  });

  it('3. Api-only mode uses backend as sole source of truth and throws genuine errors', async () => {
    let staticCalled = false;

    // Successful API call
    const successResult = await executeDataOperation('bookings:create', {
      mode: DATA_MODES.API_ONLY,
      apiFn: async () => ({ bookingId: 'bk-real-123' }),
      staticFn: async () => {
        staticCalled = true;
        return { bookingId: 'bk-mock-fake' };
      },
    });

    assert.strictEqual(successResult.source, 'api');
    assert.strictEqual(successResult.isFallback, false);
    assert.strictEqual(successResult.data.bookingId, 'bk-real-123');
    assert.strictEqual(staticCalled, false);

    // Failed API call in api-only mode must throw without falling back
    await assert.rejects(
      async () => {
        await executeDataOperation('bookings:create', {
          mode: DATA_MODES.API_ONLY,
          apiFn: async () => {
            throw new ApiError({ message: 'Overlapping shift exists', status: 409, code: 'ConflictError' });
          },
          staticFn: async () => {
            staticCalled = true;
            return { bookingId: 'bk-mock-fake' };
          },
        });
      },
      (err) => {
        assert(err instanceof ApiError);
        assert.strictEqual(err.status, 409);
        assert.strictEqual(err.code, 'ConflictError');
        return true;
      },
    );

    assert.strictEqual(staticCalled, false, 'Static fallback was illegally called for api-only operation');
  });

  it('4. Api-first mode permits fallback only on network or 5xx server failures for allowlisted resources', async () => {
    // When API fails with network disconnect (status 0) on public catalog
    const fallbackResult = await executeDataOperation('services:list', {
      mode: DATA_MODES.API_FIRST,
      apiFn: async () => {
        throw new ApiError({ message: 'Network offline', status: 0, code: 'NETWORK_ERROR' });
      },
      staticFn: async () => [{ id: 'seed-1', name: 'Seeded Fallback Service' }],
    });

    assert.strictEqual(fallbackResult.source, 'static');
    assert.strictEqual(fallbackResult.isFallback, true);
    assert.strictEqual(fallbackResult.data[0].name, 'Seeded Fallback Service');
    assert.strictEqual(fallbackResult.error.isNetworkError, true);
  });

  it('5. Api-first mode strictly DOES NOT fall back on 400, 401, 403, 404, or 409 application errors', async () => {
    let staticCalled = false;

    await assert.rejects(
      async () => {
        await executeDataOperation('services:list', {
          mode: DATA_MODES.API_FIRST,
          apiFn: async () => {
            throw new ApiError({
              message: 'Invalid filter category',
              status: 400,
              code: 'ValidationError',
            });
          },
          staticFn: async () => {
            staticCalled = true;
            return [{ id: 'seed-1' }];
          },
        });
      },
      (err) => {
        assert(err instanceof ApiError);
        assert.strictEqual(err.status, 400);
        return true;
      },
    );

    assert.strictEqual(staticCalled, false, 'Static fallback was incorrectly triggered on a 400 application error');
  });

  it('6. Api-first mode strictly blocks fallback for forbidden transactional operations even if requested', async () => {
    let staticCalled = false;

    await assert.rejects(
      async () => {
        await executeDataOperation('auth:login', {
          mode: DATA_MODES.API_FIRST,
          apiFn: async () => {
            throw new ApiError({ message: 'Server unavailable', status: 503, code: 'SERVER_ERROR' });
          },
          staticFn: async () => {
            staticCalled = true;
            return { user: { role: 'fake-admin' } };
          },
        });
      },
      (err) => {
        assert(err instanceof ApiError);
        assert.strictEqual(err.status, 503);
        return true;
      },
    );

    assert.strictEqual(staticCalled, false, 'Static fallback was illegally executed for forbidden resource auth:login');
  });
});
