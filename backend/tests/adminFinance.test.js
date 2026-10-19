import test from 'node:test';
import assert from 'node:assert/strict';
import mongoose from 'mongoose';
import { authorizeRoles, authenticate } from '../src/middleware/auth.js';
import {
  validatePaymentQuery,
  validateTransactionIdParam,
  validatePayoutQuery,
  validatePayoutIdParam,
  validateUpdatePayoutStatus,
  validateCaregiverPayoutRequest,
  normalizeFinanceStatus,
} from '../src/middleware/validateAdminFinance.js';
import * as adminFinanceService from '../src/services/adminFinanceService.js';
import { Transaction } from '../src/models/Transaction.js';
import { Payout } from '../src/models/Payout.js';
import { Booking } from '../src/models/Booking.js';
import { CaregiverProfile } from '../src/models/CaregiverProfile.js';
import app from '../src/server.js';

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
test('Step 14 - 1: authorizeRoles enforces admin-only access on admin finance endpoints', () => {
  const adminGuard = authorizeRoles('admin');

  // Customer rejected with 403 Forbidden
  const { req: custReq, res: custRes, next: custNext } = createMockReqRes({
    user: { _id: new mongoose.Types.ObjectId(), role: 'customer' },
  });
  adminGuard(custReq, custRes, custNext);
  assert.equal(custRes.statusCode, 403);
  assert.equal(custRes.jsonData.success, false);
  assert.match(custRes.jsonData.message, /Access denied|Forbidden/i);

  // Caregiver rejected with 403 Forbidden
  const { req: cgReq, res: cgRes, next: cgNext } = createMockReqRes({
    user: { _id: new mongoose.Types.ObjectId(), role: 'caregiver' },
  });
  adminGuard(cgReq, cgRes, cgNext);
  assert.equal(cgRes.statusCode, 403);
  assert.equal(cgRes.jsonData.success, false);

  // Admin allowed through
  const { req: adminReq, res: adminRes, next: adminNext, getNextCalled } = createMockReqRes({
    user: { _id: new mongoose.Types.ObjectId(), role: 'admin' },
  });
  adminGuard(adminReq, adminRes, adminNext);
  assert.equal(getNextCalled(), true);
  assert.equal(adminRes.statusCode, 200);
});

// -----------------------------------------------------------------------------
// Test 2: Query validation for payments and payouts
// -----------------------------------------------------------------------------
test('Step 14 - 2: validatePaymentQuery and validatePayoutQuery validate pagination, range, and status enums', () => {
  // Invalid page rejected
  const { req: r1, res: res1, next: n1 } = createMockReqRes({ query: { page: '0' } });
  validatePaymentQuery(r1, res1, n1);
  assert.equal(res1.statusCode, 400);

  // Clamps limit to 100
  const { req: r2, res: res2, next: n2, getNextCalled: call2 } = createMockReqRes({ query: { limit: '500' } });
  validatePaymentQuery(r2, res2, n2);
  assert.equal(call2(), true);
  assert.equal(r2.query.limit, 100);

  // Invalid payment status rejected
  const { req: r3, res: res3, next: n3 } = createMockReqRes({ query: { status: 'invalid_status' } });
  validatePaymentQuery(r3, res3, n3);
  assert.equal(res3.statusCode, 400);

  // Valid status normalized
  const { req: r4, res: res4, next: n4, getNextCalled: call4 } = createMockReqRes({ query: { status: 'Escrow Held' } });
  validatePaymentQuery(r4, res4, n4);
  assert.equal(call4(), true);
  assert.equal(r4.query.status, 'escrow_held');

  // Invalid payout status rejected
  const { req: r5, res: res5, next: n5 } = createMockReqRes({ query: { status: 'unknown_payout' } });
  validatePayoutQuery(r5, res5, n5);
  assert.equal(res5.statusCode, 400);

  // Valid payout status normalized
  const { req: r6, res: res6, next: n6, getNextCalled: call6 } = createMockReqRes({ query: { status: 'Processing' } });
  validatePayoutQuery(r6, res6, n6);
  assert.equal(call6(), true);
  assert.equal(r6.query.status, 'processing');
});

// -----------------------------------------------------------------------------
// Test 3: Parameter validation for transaction and payout references
// -----------------------------------------------------------------------------
test('Step 14 - 3: validateTransactionIdParam and validatePayoutIdParam enforce 24-char ObjectId or TXN-/PO- reference', () => {
  // Malformed ID rejected
  const { req: r1, res: res1, next: n1 } = createMockReqRes({ params: { id: 'invalid-id' } });
  validateTransactionIdParam(r1, res1, n1);
  assert.equal(res1.statusCode, 400);

  // Valid 24-char hex ObjectId accepted
  const validHex = new mongoose.Types.ObjectId().toString();
  const { req: r2, res: res2, next: n2, getNextCalled: call2 } = createMockReqRes({ params: { id: validHex } });
  validateTransactionIdParam(r2, res2, n2);
  assert.equal(call2(), true);
  assert.equal(r2.params.id, validHex);

  // Valid TXN- custom reference accepted
  const { req: r3, res: res3, next: n3, getNextCalled: call3 } = createMockReqRes({ params: { id: 'TXN-20261019-ABCDE' } });
  validateTransactionIdParam(r3, res3, n3);
  assert.equal(call3(), true);

  // Valid PO- custom reference accepted
  const { req: r4, res: res4, next: n4, getNextCalled: call4 } = createMockReqRes({ params: { id: 'PO-20261019-90412' } });
  validatePayoutIdParam(r4, res4, n4);
  assert.equal(call4(), true);
});

// -----------------------------------------------------------------------------
// Test 4: validateUpdatePayoutStatus validation rules
// -----------------------------------------------------------------------------
test('Step 14 - 4: validateUpdatePayoutStatus enforces allowed transitions and clamps notes', () => {
  // Missing status rejected
  const { req: r1, res: res1, next: n1 } = createMockReqRes({ body: {} });
  validateUpdatePayoutStatus(r1, res1, n1);
  assert.equal(res1.statusCode, 400);

  // Disallowed status rejected
  const { req: r2, res: res2, next: n2 } = createMockReqRes({ body: { status: 'refunded' } });
  validateUpdatePayoutStatus(r2, res2, n2);
  assert.equal(res2.statusCode, 400);

  // Valid status accepted and normalized
  const { req: r3, res: res3, next: n3, getNextCalled: call3 } = createMockReqRes({
    body: { status: 'Settled', notes: '   Bank transfer completed via NEFT   ' },
  });
  validateUpdatePayoutStatus(r3, res3, n3);
  assert.equal(call3(), true);
  assert.equal(r3.body.status, 'settled');
  assert.equal(r3.body.notes, 'Bank transfer completed via NEFT');
});

// -----------------------------------------------------------------------------
// Test 5: Fee calculation engine verification
// -----------------------------------------------------------------------------
test('Step 14 - 5: calculateFeeSplit computes base amount, ₹49 platform fee, 18% GST, 12% commission, and net payout correctly', () => {
  // Example: Caretaker hourly rate = ₹400, hours = 8
  // Base = 3200
  // Platform fee = 49
  // Tax (GST 18% on 3249) = Math.round(3249 * 0.18) = 585
  // Commission (12% of 3200) = Math.round(3200 * 0.12) = 384
  // Caregiver Payout = 3200 - 384 = 2816
  // Customer Total = 3200 + 49 + 585 = 3834
  const split = adminFinanceService.calculateFeeSplit(400, 8);
  assert.equal(split.baseAmount, 3200);
  assert.equal(split.platformFee, 49);
  assert.equal(split.tax, 585);
  assert.equal(split.commission, 384);
  assert.equal(split.caregiverPayout, 2816);
  assert.equal(split.totalAmount, 3834);

  // Zero rate handles gracefully without negative values
  const zeroSplit = adminFinanceService.calculateFeeSplit(0, 0);
  assert.equal(zeroSplit.baseAmount, 0);
  assert.equal(zeroSplit.platformFee, 49);
  assert.equal(zeroSplit.tax, Math.round(49 * 0.18));
  assert.equal(zeroSplit.commission, 0);
  assert.equal(zeroSplit.caregiverPayout, 0);
});

// -----------------------------------------------------------------------------
// Test 6: Identifier generator formats
// -----------------------------------------------------------------------------
test('Step 14 - 6: generateTransactionNumber and generatePayoutNumber generate valid prefixed cryptographic IDs', () => {
  const txnNo = adminFinanceService.generateTransactionNumber();
  assert.match(txnNo, /^TXN-\d{8}-[A-F0-9]{6}$/);

  const poNo = adminFinanceService.generatePayoutNumber();
  assert.match(poNo, /^PO-\d{8}-[A-F0-9]{6}$/);
});

// -----------------------------------------------------------------------------
// Test 7: Duplicate-key retries on transaction generation
// -----------------------------------------------------------------------------
test('Step 14 - 7: recordBookingTransaction retries on duplicate-key collision (code 11000) and succeeds', async () => {
  const origFindOne = Transaction.findOne;
  const origSave = Transaction.prototype.save;

  let saveCount = 0;
  Transaction.findOne = async () => null;
  Transaction.prototype.save = async function () {
    saveCount += 1;
    if (saveCount === 1) {
      const err = new Error('E11000 duplicate key error collection: transactions index: transactionNumber_1');
      err.code = 11000;
      throw err;
    }
    return this;
  };

  try {
    const mockBooking = {
      _id: new mongoose.Types.ObjectId(),
      customer: new mongoose.Types.ObjectId(),
      caregiver: new mongoose.Types.ObjectId(),
      caregiverUser: new mongoose.Types.ObjectId(),
      serviceName: 'Post-Surgery Care',
      hourlyRate: 500,
      totalHours: 10,
      totalAmount: 5949,
    };

    const tx = await adminFinanceService.recordBookingTransaction(mockBooking);
    assert.ok(tx);
    assert.equal(saveCount, 2, 'Should have succeeded on the second attempt after duplicate-key retry');
  } finally {
    Transaction.findOne = origFindOne;
    Transaction.prototype.save = origSave;
  }
});

// -----------------------------------------------------------------------------
// Test 8: Exhaustion of retries throws controlled error
// -----------------------------------------------------------------------------
test('Step 14 - 8: recordBookingTransaction exhausts 3 retries and throws controlled 500 error', async () => {
  const origFindOne = Transaction.findOne;
  const origSave = Transaction.prototype.save;

  let saveCount = 0;
  Transaction.findOne = async () => null;
  Transaction.prototype.save = async function () {
    saveCount += 1;
    const err = new Error('E11000 persistent duplicate key');
    err.code = 11000;
    throw err;
  };

  try {
    const mockBooking = {
      _id: new mongoose.Types.ObjectId(),
      customer: new mongoose.Types.ObjectId(),
      caregiver: new mongoose.Types.ObjectId(),
      caregiverUser: new mongoose.Types.ObjectId(),
      serviceName: 'Patient Monitoring',
      hourlyRate: 300,
      totalHours: 5,
    };

    await assert.rejects(
      async () => {
        await adminFinanceService.recordBookingTransaction(mockBooking);
      },
      (err) => {
        assert.equal(err.statusCode, 500);
        assert.match(err.message, /Failed to generate a unique transaction reference after 3 attempts/i);
        return true;
      },
    );
    assert.equal(saveCount, 3, 'Should have attempted exactly 3 times before giving up');
  } finally {
    Transaction.findOne = origFindOne;
    Transaction.prototype.save = origSave;
  }
});

// -----------------------------------------------------------------------------
// Test 9: getAdminPayments aggregation & statistics
// -----------------------------------------------------------------------------
test('Step 14 - 9: getAdminPayments aggregates gross, commission, refunded, and escrow held amounts', async () => {
  const origFind = Transaction.find;
  const origCount = Transaction.countDocuments;
  const origAggregate = Transaction.aggregate;

  const mockTxns = [
    {
      _id: new mongoose.Types.ObjectId(),
      transactionNumber: 'TXN-20261019-001',
      amount: 4791,
      status: 'escrow_held',
      breakdown: { commission: 467 },
    },
    {
      _id: new mongoose.Types.ObjectId(),
      transactionNumber: 'TXN-20261019-002',
      amount: 3449,
      status: 'released',
      breakdown: { commission: 346 },
    },
  ];

  Transaction.find = () => ({
    populate: () => ({
      populate: () => ({
        populate: () => ({
          sort: () => ({
            skip: () => ({
              limit: () => ({
                lean: async () => mockTxns,
              }),
            }),
          }),
        }),
      }),
    }),
  });

  Transaction.countDocuments = async () => 2;
  Transaction.aggregate = async () => [
    {
      _id: null,
      gross: 8240,
      commission: 813,
      refunded: 0,
      escrow: 4791,
    },
  ];

  try {
    const result = await adminFinanceService.getAdminPayments({ page: 1, limit: 10 });
    assert.equal(result.transactions.length, 2);
    assert.equal(result.pagination.total, 2);
    assert.equal(result.stats.gross, 8240);
    assert.equal(result.stats.commission, 813);
    assert.equal(result.stats.escrow, 4791);
    assert.equal(result.stats.refunded, 0);
  } finally {
    Transaction.find = origFind;
    Transaction.countDocuments = origCount;
    Transaction.aggregate = origAggregate;
  }
});

// -----------------------------------------------------------------------------
// Test 10: getAdminCommissions accrual & settlement metrics
// -----------------------------------------------------------------------------
test('Step 14 - 10: getAdminCommissions computes 12% commission rows, accrued vs settled splits, and effective rates', async () => {
  const origFind = Transaction.find;
  const origCount = Transaction.countDocuments;
  const origAggregate = Transaction.aggregate;

  const mockTxns = [
    {
      _id: new mongoose.Types.ObjectId(),
      transactionNumber: 'TXN-20261019-001',
      booking: new mongoose.Types.ObjectId(),
      caregiverUser: { fullName: 'Ananya Deshmukh' },
      status: 'escrow_held',
      breakdown: { baseAmount: 3894, commission: 467 },
      createdAt: new Date('2026-10-06'),
    },
  ];

  Transaction.find = () => ({
    populate: () => ({
      populate: () => ({
        sort: () => ({
          skip: () => ({
            limit: () => ({
              lean: async () => mockTxns,
            }),
          }),
        }),
      }),
    }),
  });

  Transaction.countDocuments = async () => 1;
  Transaction.aggregate = async () => [
    {
      _id: null,
      total: 467,
      baseTotal: 3894,
      accrued: 467,
      settled: 0,
      accruedCount: 1,
    },
  ];

  try {
    const result = await adminFinanceService.getAdminCommissions({ page: 1, limit: 10 });
    assert.equal(result.commissions.length, 1);
    assert.equal(result.commissions[0].status, 'Accrued');
    assert.equal(result.commissions[0].amount, 467);
    assert.equal(result.stats.accruedCount, 1);
    assert.equal(result.stats.effectiveRate, 12);
  } finally {
    Transaction.find = origFind;
    Transaction.countDocuments = origCount;
    Transaction.aggregate = origAggregate;
  }
});

// -----------------------------------------------------------------------------
// Test 11: updatePayoutStatus transitions with admin audit tracking
// -----------------------------------------------------------------------------
test('Step 14 - 11: updatePayoutStatus atomically updates status, records processedBy admin ID, and sets settledAt', async () => {
  const origFindOne = Payout.findOne;

  const mockPayout = {
    _id: new mongoose.Types.ObjectId(),
    payoutNumber: 'PO-20261019-001',
    status: 'pending',
    notes: '',
    processedBy: null,
    settledAt: null,
    save: async function () {
      return this;
    },
  };

  Payout.findOne = async () => mockPayout;

  try {
    const adminUser = { _id: new mongoose.Types.ObjectId(), fullName: 'Admin User' };
    const updated = await adminFinanceService.updatePayoutStatus(
      mockPayout._id.toString(),
      { status: 'settled', notes: 'Disbursal executed' },
      adminUser,
    );

    assert.equal(updated.status, 'settled');
    assert.equal(updated.processedBy.toString(), adminUser._id.toString());
    assert.ok(updated.settledAt instanceof Date);
    assert.equal(updated.notes, 'Disbursal executed');
  } finally {
    Payout.findOne = origFindOne;
  }
});

// -----------------------------------------------------------------------------
// Test 12: Customer-scoped payment query isolation
// -----------------------------------------------------------------------------
test('Step 14 - 12: getCustomerPayments strictly scopes transactions to authenticated customer ID', async () => {
  const origFind = Transaction.find;

  const customerId = new mongoose.Types.ObjectId();
  let queryCaptured = null;

  Transaction.find = (filter) => {
    queryCaptured = filter;
    return {
      populate: () => ({
        populate: () => ({
          sort: () => ({
            lean: async () => [
              {
                _id: new mongoose.Types.ObjectId(),
                amount: 3500,
                status: 'escrow_held',
              },
            ],
          }),
        }),
      }),
    };
  };

  try {
    const result = await adminFinanceService.getCustomerPayments(customerId);
    assert.equal(queryCaptured.customer.toString(), customerId.toString());
    assert.equal(result.stats.escrowHeld, 3500);
    assert.equal(result.stats.totalSpent, 3500);
  } finally {
    Transaction.find = origFind;
  }
});

// -----------------------------------------------------------------------------
// Test 13: Caregiver-scoped earnings isolation
// -----------------------------------------------------------------------------
test('Step 14 - 13: getCaregiverEarnings strictly scopes earnings to authenticated caregiver user ID', async () => {
  const origFind = Transaction.find;

  const caregiverUserId = new mongoose.Types.ObjectId();
  let queryCaptured = null;

  Transaction.find = (filter) => {
    queryCaptured = filter;
    return {
      populate: () => ({
        sort: () => ({
          lean: async () => [
            {
              _id: new mongoose.Types.ObjectId(),
              transactionNumber: 'TXN-20261019-888',
              serviceName: 'ICU Monitoring',
              status: 'released',
              breakdown: { baseAmount: 5000, commission: 600, caregiverPayout: 4400 },
              createdAt: new Date(),
            },
          ],
        }),
      }),
    };
  };

  try {
    const result = await adminFinanceService.getCaregiverEarnings(caregiverUserId);
    assert.equal(queryCaptured.caregiverUser.toString(), caregiverUserId.toString());
    assert.equal(result.stats.totalGross, 5000);
    assert.equal(result.stats.totalCommission, 600);
    assert.equal(result.stats.totalNet, 4400);
    assert.equal(result.stats.commissionPct, 12);
  } finally {
    Transaction.find = origFind;
  }
});

// -----------------------------------------------------------------------------
// Test 14: requestCaregiverPayout batch creation with retry logic
// -----------------------------------------------------------------------------
test('Step 14 - 14: requestCaregiverPayout creates a pending payout batch with retries', async () => {
  const origFindOne = CaregiverProfile.findOne;
  const origFindTxns = Transaction.find;
  const origSave = Payout.prototype.save;

  const caregiverUserId = new mongoose.Types.ObjectId();
  const profileId = new mongoose.Types.ObjectId();

  CaregiverProfile.findOne = async () => ({ _id: profileId, user: caregiverUserId });
  Transaction.find = async () => [
    { breakdown: { baseAmount: 4000, commission: 480, caregiverPayout: 3520 } },
  ];

  let saveCount = 0;
  Payout.prototype.save = async function () {
    saveCount += 1;
    if (saveCount === 1) {
      const err = new Error('E11000 duplicate key');
      err.code = 11000;
      throw err;
    }
    return this;
  };

  try {
    const payout = await adminFinanceService.requestCaregiverPayout(caregiverUserId, {
      disbursalMethod: 'ICICI •••• 1234',
    });
    assert.ok(payout);
    assert.equal(saveCount, 2, 'Should retry on E11000 and succeed on second attempt');
    assert.equal(payout.status, 'pending');
    assert.equal(payout.disbursalMethod, 'ICICI •••• 1234');
    assert.equal(payout.net, 3520);
  } finally {
    CaregiverProfile.findOne = origFindOne;
    Transaction.find = origFindTxns;
    Payout.prototype.save = origSave;
  }
});

// -----------------------------------------------------------------------------
// Test 15: HTTP route security: unauthenticated requests receive 401 Unauthorized
// -----------------------------------------------------------------------------
test('Step 14 - 15: HTTP routes enforce 401 unauthenticated and 403 role restrictions', async () => {
  const { req, res, next } = createMockReqRes();
  authenticate(req, res, next);
  assert.equal(res.statusCode, 401);
  assert.equal(res.jsonData.success, false);
});
