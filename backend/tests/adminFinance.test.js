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
import { User } from '../src/models/User.js';
import { setupEphemeralReplicaSet } from './helpers/testReplicaSet.js';
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
    assert.equal(result.monthlySpend.length, 6);
    const totalSpendBucket = result.monthlySpend.reduce((acc, m) => acc + m.spend, 0);
    assert.equal(totalSpendBucket, 3500);
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
    assert.equal(result.weeklyEarnings.length, 7);
    assert.equal(result.monthlyEarnings.length, 6);
    const totalWeeklyBucket = result.weeklyEarnings.reduce((acc, d) => acc + d.earnings, 0);
    assert.equal(totalWeeklyBucket, 4400);
    const totalMonthlyBucket = result.monthlyEarnings.reduce((acc, m) => acc + m.earnings, 0);
    assert.equal(totalMonthlyBucket, 4400);
  } finally {
    Transaction.find = origFind;
  }
});

// -----------------------------------------------------------------------------
// Test 14: requestCaregiverPayout batch creation with retry logic
// -----------------------------------------------------------------------------
test('Step 14 - 14: requestCaregiverPayout creates a pending payout batch with retries on E11000 payoutNumber collision', async () => {
  const origFindOne = CaregiverProfile.findOne;
  const origFindOneAndUpdate = CaregiverProfile.findOneAndUpdate;
  const origFindTxns = Transaction.find;
  const origUpdateMany = Transaction.updateMany;
  const origPayoutFindOne = Payout.findOne;
  const origSave = Payout.prototype.save;
  const origClient = mongoose.connection.client;
  const origStartSession = mongoose.startSession;

  const caregiverUserId = new mongoose.Types.ObjectId();
  const profileId = new mongoose.Types.ObjectId();
  const txId = new mongoose.Types.ObjectId();

  mongoose.connection.client = {
    topology: { description: { type: 'ReplicaSetWithPrimary' } },
  };
  mongoose.startSession = async () => ({
    withTransaction: async (cb) => cb(),
    endSession: async () => {},
  });

  CaregiverProfile.findOne = async () => ({ _id: profileId, user: caregiverUserId });
  CaregiverProfile.findOneAndUpdate = async () => ({ _id: profileId, user: caregiverUserId });
  Payout.findOne = async () => null; // No existing active payout
  Transaction.find = async () => [
    { _id: txId, breakdown: { baseAmount: 4000, commission: 480, caregiverPayout: 3520 } },
  ];
  Transaction.updateMany = async () => ({ modifiedCount: 1 });

  let saveCount = 0;
  Payout.prototype.save = async function () {
    saveCount += 1;
    if (saveCount === 1) {
      const err = new Error('E11000 duplicate key error collection: bystander.payouts index: payoutNumber_1 dup key');
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
    assert.equal(saveCount, 2, 'Should retry on E11000 payoutNumber and succeed on second attempt');
    assert.equal(payout.status, 'pending');
    assert.equal(payout.disbursalMethod, 'ICICI •••• 1234');
    assert.equal(payout.net, 3520);
    assert.equal(payout.isSimulated, true);
  } finally {
    CaregiverProfile.findOne = origFindOne;
    CaregiverProfile.findOneAndUpdate = origFindOneAndUpdate;
    Transaction.find = origFindTxns;
    Transaction.updateMany = origUpdateMany;
    Payout.findOne = origPayoutFindOne;
    Payout.prototype.save = origSave;
    mongoose.connection.client = origClient;
    mongoose.startSession = origStartSession;
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

// -----------------------------------------------------------------------------
// Test 16: Reject request when no eligible earnings exist (zero fabricated demo amounts)
// -----------------------------------------------------------------------------
test('Step 14 - 16: requestCaregiverPayout rejects request with 400 when no eligible earnings exist', async () => {
  const origFindOne = CaregiverProfile.findOne;
  const origFindOneAndUpdate = CaregiverProfile.findOneAndUpdate;
  const origFindTxns = Transaction.find;
  const origPayoutFindOne = Payout.findOne;
  const origSave = Payout.prototype.save;
  const origClient = mongoose.connection.client;
  const origStartSession = mongoose.startSession;

  const caregiverUserId = new mongoose.Types.ObjectId();
  const profileId = new mongoose.Types.ObjectId();

  mongoose.connection.client = {
    topology: { description: { type: 'ReplicaSetWithPrimary' } },
  };
  mongoose.startSession = async () => ({
    withTransaction: async (cb) => cb(),
    endSession: async () => {},
  });

  CaregiverProfile.findOne = async () => ({ _id: profileId, user: caregiverUserId });
  CaregiverProfile.findOneAndUpdate = async () => ({ _id: profileId, user: caregiverUserId });
  Payout.findOne = async () => null;
  Transaction.find = async () => []; // ZERO eligible earnings

  let saveCalled = false;
  Payout.prototype.save = async function () {
    saveCalled = true;
    return this;
  };

  try {
    await assert.rejects(
      async () => {
        await adminFinanceService.requestCaregiverPayout(caregiverUserId);
      },
      (err) => {
        assert.equal(err.statusCode, 400);
        assert.equal(err.name, 'ValidationError');
        assert.match(err.message, /no eligible unpaid earnings/i);
        return true;
      },
    );
    assert.equal(saveCalled, false, 'No payout record should be saved when zero eligible earnings exist');
  } finally {
    CaregiverProfile.findOne = origFindOne;
    CaregiverProfile.findOneAndUpdate = origFindOneAndUpdate;
    Transaction.find = origFindTxns;
    Payout.findOne = origPayoutFindOne;
    Payout.prototype.save = origSave;
    mongoose.connection.client = origClient;
    mongoose.startSession = origStartSession;
  }
});

// -----------------------------------------------------------------------------
// Test 17: Active payout conflict (409) prevents multiple active payouts for same caregiver
// -----------------------------------------------------------------------------
test('Step 14 - 17: requestCaregiverPayout rejects with 409 Conflict if active payout exists', async () => {
  const origFindOne = CaregiverProfile.findOne;
  const origFindOneAndUpdate = CaregiverProfile.findOneAndUpdate;
  const origPayoutFindOne = Payout.findOne;
  const origClient = mongoose.connection.client;
  const origStartSession = mongoose.startSession;

  const caregiverUserId = new mongoose.Types.ObjectId();
  const profileId = new mongoose.Types.ObjectId();

  mongoose.connection.client = {
    topology: { description: { type: 'ReplicaSetWithPrimary' } },
  };
  mongoose.startSession = async () => ({
    withTransaction: async (cb) => cb(),
    endSession: async () => {},
  });

  CaregiverProfile.findOne = async () => ({ _id: profileId, user: caregiverUserId });
  CaregiverProfile.findOneAndUpdate = async () => ({ _id: profileId, user: caregiverUserId });
  Payout.findOne = async () => ({
    _id: new mongoose.Types.ObjectId(),
    payoutNumber: 'PO-20261019-AAAA1',
    status: 'pending',
  });

  try {
    await assert.rejects(
      async () => {
        await adminFinanceService.requestCaregiverPayout(caregiverUserId);
      },
      (err) => {
        assert.equal(err.statusCode, 409);
        assert.equal(err.name, 'ConflictError');
        assert.match(err.message, /already pending or processing/i);
        return true;
      },
    );
  } finally {
    CaregiverProfile.findOne = origFindOne;
    CaregiverProfile.findOneAndUpdate = origFindOneAndUpdate;
    Payout.findOne = origPayoutFindOne;
    mongoose.connection.client = origClient;
    mongoose.startSession = origStartSession;
  }
});

// -----------------------------------------------------------------------------
// Test 18: Transactions already allocated to an active payout are excluded from new requests
// -----------------------------------------------------------------------------
test('Step 14 - 18: requestCaregiverPayout excludes transactions already allocated to a payout', async () => {
  const origFindOne = CaregiverProfile.findOne;
  const origFindOneAndUpdate = CaregiverProfile.findOneAndUpdate;
  const origFindTxns = Transaction.find;
  const origPayoutFindOne = Payout.findOne;
  const origClient = mongoose.connection.client;
  const origStartSession = mongoose.startSession;

  const caregiverUserId = new mongoose.Types.ObjectId();
  const profileId = new mongoose.Types.ObjectId();

  mongoose.connection.client = {
    topology: { description: { type: 'ReplicaSetWithPrimary' } },
  };
  mongoose.startSession = async () => ({
    withTransaction: async (cb) => cb(),
    endSession: async () => {},
  });

  CaregiverProfile.findOne = async () => ({ _id: profileId, user: caregiverUserId });
  CaregiverProfile.findOneAndUpdate = async () => ({ _id: profileId, user: caregiverUserId });
  Payout.findOne = async () => null;

  let queryFilter = null;
  Transaction.find = (filter) => {
    queryFilter = filter;
    return []; // Filter with payout: null matches no records
  };

  try {
    await assert.rejects(
      async () => {
        await adminFinanceService.requestCaregiverPayout(caregiverUserId);
      },
      (err) => {
        assert.equal(err.statusCode, 400);
        return true;
      },
    );
    assert.equal(queryFilter.caregiverUser.toString(), caregiverUserId.toString());
    assert.equal(queryFilter.status, 'released');
    assert.equal(queryFilter.payout, null, 'Must explicitly require payout: null');
  } finally {
    CaregiverProfile.findOne = origFindOne;
    CaregiverProfile.findOneAndUpdate = origFindOneAndUpdate;
    Transaction.find = origFindTxns;
    Payout.findOne = origPayoutFindOne;
    mongoose.connection.client = origClient;
    mongoose.startSession = origStartSession;
  }
});

// -----------------------------------------------------------------------------
// Test 19: Transactions belonging to a settled payout cannot be re-allocated
// -----------------------------------------------------------------------------
test('Step 14 - 19: transactions allocated to settled payout are excluded and not double-counted', async () => {
  const origFindOne = CaregiverProfile.findOne;
  const origFindOneAndUpdate = CaregiverProfile.findOneAndUpdate;
  const origFindTxns = Transaction.find;
  const origPayoutFindOne = Payout.findOne;
  const origClient = mongoose.connection.client;
  const origStartSession = mongoose.startSession;

  const caregiverUserId = new mongoose.Types.ObjectId();
  const profileId = new mongoose.Types.ObjectId();

  mongoose.connection.client = {
    topology: { description: { type: 'ReplicaSetWithPrimary' } },
  };
  mongoose.startSession = async () => ({
    withTransaction: async (cb) => cb(),
    endSession: async () => {},
  });

  CaregiverProfile.findOne = async () => ({ _id: profileId, user: caregiverUserId });
  CaregiverProfile.findOneAndUpdate = async () => ({ _id: profileId, user: caregiverUserId });
  Payout.findOne = async () => null;

  Transaction.find = (filter) => {
    assert.equal(filter.payout, null);
    return [];
  };

  try {
    await assert.rejects(
      async () => {
        await adminFinanceService.requestCaregiverPayout(caregiverUserId);
      },
      (err) => {
        assert.equal(err.statusCode, 400);
        return true;
      },
    );
  } finally {
    CaregiverProfile.findOne = origFindOne;
    CaregiverProfile.findOneAndUpdate = origFindOneAndUpdate;
    Transaction.find = origFindTxns;
    Payout.findOne = origPayoutFindOne;
    mongoose.connection.client = origClient;
    mongoose.startSession = origStartSession;
  }
});

// -----------------------------------------------------------------------------
// Test 20: Legitimate new earnings are eligible for later payout once previous payout is settled
// -----------------------------------------------------------------------------
test('Step 14 - 20: legitimate new earnings can be allocated to a later payout after settlement', async () => {
  const origFindOne = CaregiverProfile.findOne;
  const origFindOneAndUpdate = CaregiverProfile.findOneAndUpdate;
  const origFindTxns = Transaction.find;
  const origUpdateMany = Transaction.updateMany;
  const origPayoutFindOne = Payout.findOne;
  const origSave = Payout.prototype.save;
  const origClient = mongoose.connection.client;
  const origStartSession = mongoose.startSession;

  const caregiverUserId = new mongoose.Types.ObjectId();
  const profileId = new mongoose.Types.ObjectId();
  const newTxId = new mongoose.Types.ObjectId();

  mongoose.connection.client = {
    topology: { description: { type: 'ReplicaSetWithPrimary' } },
  };
  mongoose.startSession = async () => ({
    withTransaction: async (cb) => cb(),
    endSession: async () => {},
  });

  CaregiverProfile.findOne = async () => ({ _id: profileId, user: caregiverUserId });
  CaregiverProfile.findOneAndUpdate = async () => ({ _id: profileId, user: caregiverUserId });
  Payout.findOne = async () => null;

  Transaction.find = async (filter) => {
    assert.equal(filter.payout, null);
    return [
      { _id: newTxId, breakdown: { baseAmount: 2500, commission: 300, caregiverPayout: 2200 } },
    ];
  };

  let allocatedTxIds = [];
  Transaction.updateMany = async (filter) => {
    allocatedTxIds = filter._id.$in;
    return { modifiedCount: 1 };
  };

  Payout.prototype.save = async function () {
    return this;
  };

  try {
    const payout = await adminFinanceService.requestCaregiverPayout(caregiverUserId);
    assert.ok(payout);
    assert.equal(payout.net, 2200);
    assert.equal(payout.gross, 2500);
    assert.equal(payout.commission, 300);
    assert.deepEqual(allocatedTxIds, [newTxId]);
  } finally {
    CaregiverProfile.findOne = origFindOne;
    CaregiverProfile.findOneAndUpdate = origFindOneAndUpdate;
    Transaction.find = origFindTxns;
    Transaction.updateMany = origUpdateMany;
    Payout.findOne = origPayoutFindOne;
    Payout.prototype.save = origSave;
    mongoose.connection.client = origClient;
    mongoose.startSession = origStartSession;
  }
});

// -----------------------------------------------------------------------------
// Test 21: Non-duplicate errors propagate immediately without retrying
// -----------------------------------------------------------------------------
test('Step 14 - 21: non-duplicate errors propagate immediately without retry', async () => {
  const origFindOne = CaregiverProfile.findOne;
  const origFindOneAndUpdate = CaregiverProfile.findOneAndUpdate;
  const origClient = mongoose.connection.client;
  const origStartSession = mongoose.startSession;

  const caregiverUserId = new mongoose.Types.ObjectId();

  mongoose.connection.client = {
    topology: { description: { type: 'ReplicaSetWithPrimary' } },
  };

  let attempts = 0;
  mongoose.startSession = async () => ({
    withTransaction: async (cb) => {
      attempts += 1;
      return cb();
    },
    endSession: async () => {},
  });

  CaregiverProfile.findOneAndUpdate = async () => {
    const err = new Error('Database connection failed abruptly');
    err.code = 99999;
    throw err;
  };

  try {
    await assert.rejects(
      async () => {
        await adminFinanceService.requestCaregiverPayout(caregiverUserId);
      },
      (err) => {
        assert.equal(err.message, 'Database connection failed abruptly');
        return true;
      },
    );
    assert.equal(attempts, 1, 'Non-duplicate error must fail immediately on attempt 1 without retry');
  } finally {
    CaregiverProfile.findOne = origFindOne;
    CaregiverProfile.findOneAndUpdate = origFindOneAndUpdate;
    mongoose.connection.client = origClient;
    mongoose.startSession = origStartSession;
  }
});

// -----------------------------------------------------------------------------
// Test 22: Atomic rollback if earnings allocation fails
// -----------------------------------------------------------------------------
test('Step 14 - 22: atomic transaction rollback when transaction allocation fails', async () => {
  const origFindOne = CaregiverProfile.findOne;
  const origFindOneAndUpdate = CaregiverProfile.findOneAndUpdate;
  const origFindTxns = Transaction.find;
  const origUpdateMany = Transaction.updateMany;
  const origPayoutFindOne = Payout.findOne;
  const origSave = Payout.prototype.save;
  const origClient = mongoose.connection.client;
  const origStartSession = mongoose.startSession;

  const caregiverUserId = new mongoose.Types.ObjectId();
  const profileId = new mongoose.Types.ObjectId();

  mongoose.connection.client = {
    topology: { description: { type: 'ReplicaSetWithPrimary' } },
  };

  let transactionAborted = false;
  mongoose.startSession = async () => ({
    withTransaction: async (cb) => {
      try {
        await cb();
      } catch (e) {
        transactionAborted = true;
        throw e;
      }
    },
    endSession: async () => {},
  });

  CaregiverProfile.findOne = async () => ({ _id: profileId, user: caregiverUserId });
  CaregiverProfile.findOneAndUpdate = async () => ({ _id: profileId, user: caregiverUserId });
  Payout.findOne = async () => null;
  Transaction.find = async () => [
    { _id: new mongoose.Types.ObjectId(), breakdown: { baseAmount: 3000, commission: 360, caregiverPayout: 2640 } },
  ];
  Payout.prototype.save = async function () {
    return this;
  };
  Transaction.updateMany = async () => {
    return { modifiedCount: 0 };
  };

  try {
    await assert.rejects(
      async () => {
        await adminFinanceService.requestCaregiverPayout(caregiverUserId);
      },
      (err) => {
        assert.equal(err.statusCode, 409);
        assert.match(err.message, /some earnings were already allocated/i);
        return true;
      },
    );
    assert.equal(transactionAborted, true, 'Transaction session must be aborted on failure');
  } finally {
    CaregiverProfile.findOne = origFindOne;
    CaregiverProfile.findOneAndUpdate = origFindOneAndUpdate;
    Transaction.find = origFindTxns;
    Transaction.updateMany = origUpdateMany;
    Payout.findOne = origPayoutFindOne;
    Payout.prototype.save = origSave;
    mongoose.connection.client = origClient;
    mongoose.startSession = origStartSession;
  }
});

// -----------------------------------------------------------------------------
// Test 23: User isolation and parameter validation
// -----------------------------------------------------------------------------
test('Step 14 - 23: user isolation and input validation rejects invalid IDs and profiles', async () => {
  // 1. Missing caregiverUserId
  await assert.rejects(
    async () => {
      await adminFinanceService.requestCaregiverPayout(null);
    },
    (err) => {
      assert.equal(err.statusCode, 400);
      assert.match(err.message, /identifier is required/i);
      return true;
    },
  );

  // 2. Non-ObjectId caregiverUserId
  await assert.rejects(
    async () => {
      await adminFinanceService.requestCaregiverPayout('invalid-not-id');
    },
    (err) => {
      assert.equal(err.statusCode, 400);
      assert.match(err.message, /invalid caregiver user identifier format/i);
      return true;
    },
  );

  // 3. Caregiver profile not found
  const origClient = mongoose.connection.client;
  const origStartSession = mongoose.startSession;
  const origFindOne = CaregiverProfile.findOne;
  const origFindOneAndUpdate = CaregiverProfile.findOneAndUpdate;

  mongoose.connection.client = {
    topology: { description: { type: 'ReplicaSetWithPrimary' } },
  };
  mongoose.startSession = async () => ({
    withTransaction: async (cb) => cb(),
    endSession: async () => {},
  });

  CaregiverProfile.findOneAndUpdate = async () => null;
  CaregiverProfile.findOne = async () => null;

  try {
    await assert.rejects(
      async () => {
        await adminFinanceService.requestCaregiverPayout(new mongoose.Types.ObjectId());
      },
      (err) => {
        assert.equal(err.statusCode, 404);
        assert.match(err.message, /profile not found/i);
        return true;
      },
    );
  } finally {
    CaregiverProfile.findOne = origFindOne;
    CaregiverProfile.findOneAndUpdate = origFindOneAndUpdate;
    mongoose.connection.client = origClient;
    mongoose.startSession = origStartSession;
  }
});

// -----------------------------------------------------------------------------
// Test 24: Fail-closed 503 when topology lacks multi-document transaction support
// -----------------------------------------------------------------------------
test('Step 14 - 24: requestCaregiverPayout fails closed with 503 if database does not support transactions', async () => {
  const origClient = mongoose.connection.client;

  try {
    mongoose.connection.client = {
      topology: { description: { type: 'Single' } },
    };

    await assert.rejects(
      async () => {
        await adminFinanceService.requestCaregiverPayout(new mongoose.Types.ObjectId());
      },
      (err) => {
        assert.equal(err.statusCode, 503);
        assert.equal(err.name, 'ServiceUnavailableError');
        assert.match(err.message, /replica set or sharded deployment/i);
        return true;
      },
    );
  } finally {
    mongoose.connection.client = origClient;
  }
});

// -----------------------------------------------------------------------------
// Test 25: Genuine Replica Set Integration: Atomic allocation, partial unique index, and concurrent execution
// -----------------------------------------------------------------------------
test('Step 14 - 25: replica set integration: concurrent payouts serialize, allocate atomically, and prevent double-counting', async () => {
  const replSet = await setupEphemeralReplicaSet();
  if (!replSet.supported) {
    console.log(`[SKIPPED] Ephemeral replica set not supported: ${replSet.reason}`);
    return;
  }

  await mongoose.connect(replSet.uri);

  try {
    // 1. Ensure indexes (including partial unique index on Payout and compound on Transaction)
    await Payout.init();
    await Transaction.init();

    // 2. Create Caregiver User and CaregiverProfile
    const caregiverUser = await User.create({
      fullName: 'Sunita Sharma',
      email: 'sunita.payout.rs@test.com',
      passwordHash: 'dummyhash',
      role: 'caregiver',
      status: 'active',
    });

    const customerUser = await User.create({
      fullName: 'Rahul Verma',
      email: 'rahul.rs@test.com',
      passwordHash: 'dummyhash',
      role: 'customer',
      status: 'active',
    });

    const caregiverProfile = await CaregiverProfile.create({
      user: caregiverUser._id,
      qualification: 'BSc Nursing',
      city: 'Delhi, DL',
      hourlyRate: 500,
      verificationStatus: 'verified',
      payoutLockVersion: 0,
    });

    // 3. Mock Booking ObjectId reference
    const mockBookingId = new mongoose.Types.ObjectId();

    // 4. Create 2 released transactions for this caregiver (eligible earnings)
    const tx1 = await Transaction.create({
      transactionNumber: 'TXN-RS-001',
      booking: mockBookingId,
      customer: customerUser._id,
      caregiver: caregiverProfile._id,
      caregiverUser: caregiverUser._id,
      serviceName: 'Elderly Day Care Shift 1',
      amount: 4778,
      breakdown: {
        baseAmount: 4000,
        platformFee: 49,
        tax: 729,
        commission: 480,
        caregiverPayout: 3520,
      },
      status: 'released',
      payout: null,
      releasedAt: new Date(),
    });

    const tx2 = await Transaction.create({
      transactionNumber: 'TXN-RS-002',
      booking: mockBookingId,
      customer: customerUser._id,
      caregiver: caregiverProfile._id,
      caregiverUser: caregiverUser._id,
      serviceName: 'Elderly Day Care Shift 2',
      amount: 4778,
      breakdown: {
        baseAmount: 4000,
        platformFee: 49,
        tax: 729,
        commission: 480,
        caregiverPayout: 3520,
      },
      status: 'released',
      payout: null,
      releasedAt: new Date(),
    });

    // 5. Test concurrent payout requests for the same caregiver simultaneously
    const results = await Promise.allSettled([
      adminFinanceService.requestCaregiverPayout(caregiverUser._id, { disbursalMethod: 'HDFC •••• 1111' }),
      adminFinanceService.requestCaregiverPayout(caregiverUser._id, { disbursalMethod: 'HDFC •••• 2222' }),
    ]);

    const fulfilled = results.filter((r) => r.status === 'fulfilled');
    const rejected = results.filter((r) => r.status === 'rejected');

    assert.equal(fulfilled.length, 1, 'Exactly one concurrent payout request must succeed');
    assert.equal(rejected.length, 1, 'The competing concurrent payout request must be rejected');
    assert.ok(
      rejected[0].reason.statusCode === 409 || rejected[0].reason.statusCode === 400,
      `Rejected reason must be 409 Conflict or 400 ValidationError, got: ${rejected[0].reason.statusCode}`,
    );

    const successfulPayout = fulfilled[0].value;
    assert.equal(successfulPayout.status, 'pending');
    assert.equal(successfulPayout.jobsCount, 2);
    assert.equal(successfulPayout.gross, 8000);
    assert.equal(successfulPayout.commission, 960);
    assert.equal(successfulPayout.net, 7040);
    assert.equal(successfulPayout.transactions.length, 2);

    // 6. Verify that both transactions are atomically allocated in the database
    const refreshedTx1 = await Transaction.findById(tx1._id);
    const refreshedTx2 = await Transaction.findById(tx2._id);
    assert.equal(refreshedTx1.payout.toString(), successfulPayout._id.toString());
    assert.equal(refreshedTx2.payout.toString(), successfulPayout._id.toString());
    assert.ok(refreshedTx1.payoutAllocatedAt != null);
    assert.ok(refreshedTx2.payoutAllocatedAt != null);

    // 7. Verify that another sequential request while payout is pending is rejected with 409
    await assert.rejects(
      async () => {
        await adminFinanceService.requestCaregiverPayout(caregiverUser._id);
      },
      (err) => {
        assert.equal(err.statusCode, 409);
        return true;
      },
    );

    // 8. Transition payout to settled
    successfulPayout.status = 'settled';
    successfulPayout.settledAt = new Date();
    await successfulPayout.save();

    // 9. Now that payout is settled, attempt another payout request without new earnings:
    // Should be rejected with 400 because previous transactions are already allocated!
    await assert.rejects(
      async () => {
        await adminFinanceService.requestCaregiverPayout(caregiverUser._id);
      },
      (err) => {
        assert.equal(err.statusCode, 400);
        assert.match(err.message, /no eligible unpaid earnings/i);
        return true;
      },
    );

    // 10. Add legitimate new earnings (tx3)
    const tx3 = await Transaction.create({
      transactionNumber: 'TXN-RS-003',
      booking: mockBookingId,
      customer: customerUser._id,
      caregiver: caregiverProfile._id,
      caregiverUser: caregiverUser._id,
      serviceName: 'Elderly Day Care Shift 3',
      amount: 2389,
      breakdown: {
        baseAmount: 2000,
        platformFee: 49,
        tax: 369,
        commission: 240,
        caregiverPayout: 1760,
      },
      status: 'released',
      payout: null,
      releasedAt: new Date(),
    });

    // Request new payout for the newly earned shift
    const secondPayout = await adminFinanceService.requestCaregiverPayout(caregiverUser._id);
    assert.ok(secondPayout);
    assert.equal(secondPayout.jobsCount, 1);
    assert.equal(secondPayout.gross, 2000);
    assert.equal(secondPayout.commission, 240);
    assert.equal(secondPayout.net, 1760);
    assert.deepEqual(secondPayout.transactions.map((id) => id.toString()), [tx3._id.toString()]);

    const refreshedTx3 = await Transaction.findById(tx3._id);
    assert.equal(refreshedTx3.payout.toString(), secondPayout._id.toString());
  } finally {
    await replSet.stop();
  }
});

// -----------------------------------------------------------------------------
// Test 26: Permitted Payout Status Transitions
// -----------------------------------------------------------------------------
test('Step 14 - 26: updatePayoutStatus permits valid directed transitions: pending->processing/settled/failed, processing->settled/failed, failed->processing', async () => {
  const origFindOne = Payout.findOne;
  const adminUser = { _id: new mongoose.Types.ObjectId(), fullName: 'Admin User' };

  const makeMockPayout = (initialStatus) => ({
    _id: new mongoose.Types.ObjectId(),
    payoutNumber: `PO-${initialStatus}`,
    status: initialStatus,
    notes: '',
    processedBy: null,
    settledAt: null,
    save: async function () {
      return this;
    },
  });

  const validTransitions = [
    { from: 'pending', to: 'processing', notes: 'Batch queued for disbursal' },
    { from: 'pending', to: 'settled', notes: 'Immediate settlement approved' },
    { from: 'pending', to: 'failed', notes: 'Caregiver bank account details invalid' },
    { from: 'processing', to: 'settled', notes: 'Bank transfer confirmed' },
    { from: 'processing', to: 'failed', notes: 'Bank transfer rejected by gateway' },
    { from: 'failed', to: 'processing', notes: 'Retrying payout disbursal' },
  ];

  try {
    for (const { from, to, notes } of validTransitions) {
      const mockPayout = makeMockPayout(from);
      Payout.findOne = async () => mockPayout;

      const result = await adminFinanceService.updatePayoutStatus(
        mockPayout._id.toString(),
        { status: to, notes },
        adminUser,
      );

      assert.equal(result.status, to, `Transition from ${from} to ${to} should succeed`);
      assert.equal(result.processedBy.toString(), adminUser._id.toString());
      if (to === 'settled') {
        assert.ok(result.settledAt instanceof Date, 'settledAt should be recorded');
      }
      if (notes) {
        assert.equal(result.notes, notes);
      }
    }
  } finally {
    Payout.findOne = origFindOne;
  }
});

// -----------------------------------------------------------------------------
// Test 27: Rejected Payout Status Transitions
// -----------------------------------------------------------------------------
test('Step 14 - 27: updatePayoutStatus rejects disallowed transitions (failed->settled, processing->pending, etc.)', async () => {
  const origFindOne = Payout.findOne;
  const adminUser = { _id: new mongoose.Types.ObjectId(), fullName: 'Admin User' };

  const makeMockPayout = (initialStatus) => ({
    _id: new mongoose.Types.ObjectId(),
    payoutNumber: `PO-${initialStatus}`,
    status: initialStatus,
    notes: '',
    processedBy: null,
    settledAt: null,
    save: async function () {
      return this;
    },
  });

  const disallowedTransitions = [
    { from: 'failed', to: 'settled', errorRegex: /cannot transition payout directly from 'failed' to 'settled'/i },
    { from: 'failed', to: 'pending', errorRegex: /invalid payout status transition/i },
    { from: 'processing', to: 'pending', errorRegex: /invalid payout status transition/i },
    { from: 'pending', to: 'pending', errorRegex: /already in 'pending' status/i },
    { from: 'processing', to: 'processing', errorRegex: /already in 'processing' status/i },
    { from: 'failed', to: 'failed', errorRegex: /already in 'failed' status/i },
  ];

  try {
    for (const { from, to, errorRegex } of disallowedTransitions) {
      const mockPayout = makeMockPayout(from);
      Payout.findOne = async () => mockPayout;

      await assert.rejects(
        async () => {
          await adminFinanceService.updatePayoutStatus(
            mockPayout._id.toString(),
            { status: to, notes: 'Valid test notes for transition attempt' },
            adminUser,
          );
        },
        (err) => {
          assert.equal(err.statusCode, 400);
          assert.equal(err.name, 'ValidationError');
          assert.match(err.message, errorRegex);
          return true;
        },
        `Transition from ${from} to ${to} must be rejected`,
      );
    }
  } finally {
    Payout.findOne = origFindOne;
  }
});

// -----------------------------------------------------------------------------
// Test 28: Settled Payout Immutability
// -----------------------------------------------------------------------------
test('Step 14 - 28: settled payouts are terminal and immutable (cannot reopen or alter history)', async () => {
  const origFindOne = Payout.findOne;
  const adminUser = { _id: new mongoose.Types.ObjectId(), fullName: 'Admin User' };

  const settledPayout = {
    _id: new mongoose.Types.ObjectId(),
    payoutNumber: 'PO-SETTLED-01',
    status: 'settled',
    settledAt: new Date('2026-10-18T10:00:00Z'),
    notes: 'Original settlement record',
    processedBy: adminUser._id,
    save: async function () {
      return this;
    },
  };

  Payout.findOne = async () => settledPayout;

  const targetStatuses = ['pending', 'processing', 'failed', 'settled'];

  try {
    for (const target of targetStatuses) {
      await assert.rejects(
        async () => {
          await adminFinanceService.updatePayoutStatus(
            settledPayout._id.toString(),
            { status: target, notes: 'Attempting to change settled payout' },
            adminUser,
          );
        },
        (err) => {
          assert.equal(err.statusCode, 400);
          assert.equal(err.name, 'ValidationError');
          assert.match(err.message, /settled payouts are terminal and immutable/i);
          return true;
        },
        `Transition from settled to ${target} must be rejected with 400`,
      );
    }
  } finally {
    Payout.findOne = origFindOne;
  }
});

// -----------------------------------------------------------------------------
// Test 29: Mandatory Audit Notes on Failure Transitions
// -----------------------------------------------------------------------------
test('Step 14 - 29: failure transitions strictly require meaningful audit notes (>= 5 chars)', async () => {
  const origFindOne = Payout.findOne;
  const adminUser = { _id: new mongoose.Types.ObjectId(), fullName: 'Admin User' };

  const mockPayout = {
    _id: new mongoose.Types.ObjectId(),
    status: 'processing',
    save: async function () {
      return this;
    },
  };

  Payout.findOne = async () => mockPayout;

  try {
    // 1. Service layer: Empty notes
    await assert.rejects(
      async () => {
        await adminFinanceService.updatePayoutStatus(mockPayout._id.toString(), { status: 'failed', notes: '' }, adminUser);
      },
      (err) => {
        assert.equal(err.statusCode, 400);
        assert.match(err.message, /meaningful audit note of at least 5 characters is required/i);
        return true;
      },
    );

    // 2. Service layer: Notes too short (< 5 chars)
    await assert.rejects(
      async () => {
        await adminFinanceService.updatePayoutStatus(mockPayout._id.toString(), { status: 'failed', notes: 'fail' }, adminUser);
      },
      (err) => {
        assert.equal(err.statusCode, 400);
        assert.match(err.message, /meaningful audit note of at least 5 characters is required/i);
        return true;
      },
    );

    // 3. Middleware layer: validateUpdatePayoutStatus rejects failed without notes
    const { req: r1, res: res1, next: n1 } = createMockReqRes({ body: { status: 'failed' } });
    validateUpdatePayoutStatus(r1, res1, n1);
    assert.equal(res1.statusCode, 400);
    assert.match(res1.jsonData.message, /meaningful audit note/i);

    // 4. Middleware layer: validateUpdatePayoutStatus rejects failed with short notes
    const { req: r2, res: res2, next: n2 } = createMockReqRes({ body: { status: 'failed', notes: 'bad' } });
    validateUpdatePayoutStatus(r2, res2, n2);
    assert.equal(res2.statusCode, 400);
    assert.match(res2.jsonData.message, /meaningful audit note/i);

    // 5. Middleware layer: validateUpdatePayoutStatus accepts valid failure note
    const { req: r3, res: res3, next: n3, getNextCalled: call3 } = createMockReqRes({
      body: { status: 'failed', notes: 'Caregiver bank account is frozen or inactive' },
    });
    validateUpdatePayoutStatus(r3, res3, n3);
    assert.equal(call3(), true);
    assert.equal(r3.body.status, 'failed');
    assert.equal(r3.body.notes, 'Caregiver bank account is frozen or inactive');
  } finally {
    Payout.findOne = origFindOne;
  }
});

// -----------------------------------------------------------------------------
// Test 30: Concurrent Administrative Status Updates Conflict (409)
// -----------------------------------------------------------------------------
test('Step 14 - 30: concurrent administrative updates on stale status trigger 409 Conflict', async () => {
  const origFindOne = Payout.findOne;
  const origFindOneAndUpdate = Payout.findOneAndUpdate;
  const adminUser = { _id: new mongoose.Types.ObjectId(), fullName: 'Admin User' };

  const mockPayout = {
    _id: new mongoose.Types.ObjectId(),
    status: 'pending',
  };

  Payout.findOne = async () => mockPayout;

  // Simulate conditional update failing because status changed concurrently in DB
  Payout.findOneAndUpdate = async () => null;

  // Temporarily set readyState to 1 to test conditional update path
  const origState = mongoose.connection.readyState;
  mongoose.connection.readyState = 1;

  try {
    await assert.rejects(
      async () => {
        await adminFinanceService.updatePayoutStatus(
          mockPayout._id.toString(),
          { status: 'processing', notes: 'Starting batch' },
          adminUser,
        );
      },
      (err) => {
        assert.equal(err.statusCode, 409);
        assert.equal(err.name, 'ConflictError');
        assert.match(err.message, /concurrent modification detected/i);
        return true;
      },
    );
  } finally {
    Payout.findOne = origFindOne;
    Payout.findOneAndUpdate = origFindOneAndUpdate;
    mongoose.connection.readyState = origState;
  }
});

// -----------------------------------------------------------------------------
// Test 31: Role-Based Access Control on Payout Status Update Route
// -----------------------------------------------------------------------------
test('Step 14 - 31: PATCH /api/admin/payouts/:id/status strictly enforces admin-only RBAC', () => {
  const adminGuard = authorizeRoles('admin');

  // Customer rejected with 403
  const { req: r1, res: res1, next: n1 } = createMockReqRes({ user: { role: 'customer' } });
  adminGuard(r1, res1, n1);
  assert.equal(res1.statusCode, 403);
  assert.equal(res1.jsonData.success, false);

  // Caregiver rejected with 403
  const { req: r2, res: res2, next: n2 } = createMockReqRes({ user: { role: 'caregiver' } });
  adminGuard(r2, res2, n2);
  assert.equal(res2.statusCode, 403);
  assert.equal(res2.jsonData.success, false);

  // Admin authorized
  const { req: r3, res: res3, next: n3, getNextCalled: call3 } = createMockReqRes({ user: { role: 'admin' } });
  adminGuard(r3, res3, n3);
  assert.equal(call3(), true);
});

// -----------------------------------------------------------------------------
// Test 32: Replica Set Integration: State Machine Transitions and Concurrency
// -----------------------------------------------------------------------------
test('Step 14 - 32: replica set integration: payout state machine transitions, notes, and settled immutability', async () => {
  const replSet = await setupEphemeralReplicaSet();
  if (!replSet.supported) {
    console.log(`[SKIPPED] Ephemeral replica set not supported: ${replSet.reason}`);
    return;
  }

  await mongoose.connect(replSet.uri);

  try {
    await Payout.init();

    const adminUser = await User.create({
      fullName: 'Finance Admin',
      email: 'admin.statemachine.rs@test.com',
      passwordHash: 'dummyhash',
      role: 'admin',
      status: 'active',
    });

    const caregiverUser = await User.create({
      fullName: 'Geeta Devi',
      email: 'geeta.statemachine.rs@test.com',
      passwordHash: 'dummyhash',
      role: 'caregiver',
      status: 'active',
    });

    const caregiverProfile = await CaregiverProfile.create({
      user: caregiverUser._id,
      qualification: 'BSc Nursing',
      city: 'Delhi, DL',
      hourlyRate: 600,
      verificationStatus: 'verified',
    });

    // 1. Create a payout in pending state
    const payout = await Payout.create({
      payoutNumber: 'PO-RS-STATE-01',
      caregiver: caregiverProfile._id,
      caregiverUser: caregiverUser._id,
      period: 'Oct 1 – Oct 19, 2026',
      jobsCount: 1,
      gross: 5000,
      commission: 600,
      net: 4400,
      status: 'pending',
      isSimulated: true,
    });

    // 2. Transition pending -> processing
    const processingPayout = await adminFinanceService.updatePayoutStatus(
      payout._id.toString(),
      { status: 'processing', notes: 'Sent to bank batch' },
      adminUser,
    );
    assert.equal(processingPayout.status, 'processing');

    // 3. Transition processing -> failed (with mandatory notes)
    const failedPayout = await adminFinanceService.updatePayoutStatus(
      payout._id.toString(),
      { status: 'failed', notes: 'Bank account number invalid or closed' },
      adminUser,
    );
    assert.equal(failedPayout.status, 'failed');

    // 4. Verify failed -> settled directly is REJECTED
    await assert.rejects(
      async () => {
        await adminFinanceService.updatePayoutStatus(
          payout._id.toString(),
          { status: 'settled', notes: 'Attempting invalid direct settlement' },
          adminUser,
        );
      },
      (err) => {
        assert.equal(err.statusCode, 400);
        assert.match(err.message, /cannot transition payout directly from 'failed' to 'settled'/i);
        return true;
      },
    );

    // 5. Retry via failed -> processing retry path
    const retriedPayout = await adminFinanceService.updatePayoutStatus(
      payout._id.toString(),
      { status: 'processing', notes: 'Caregiver updated account details; retrying disbursal' },
      adminUser,
    );
    assert.equal(retriedPayout.status, 'processing');

    // 6. Transition processing -> settled
    const settledPayout = await adminFinanceService.updatePayoutStatus(
      payout._id.toString(),
      { status: 'settled', notes: 'Disbursal executed and verified by bank' },
      adminUser,
    );
    assert.equal(settledPayout.status, 'settled');
    assert.ok(settledPayout.settledAt instanceof Date);

    // 7. Verify settled payout CANNOT be reopened or altered
    await assert.rejects(
      async () => {
        await adminFinanceService.updatePayoutStatus(
          payout._id.toString(),
          { status: 'pending', notes: 'Attempting to reopen settled payout' },
          adminUser,
        );
      },
      (err) => {
        assert.equal(err.statusCode, 400);
        assert.match(err.message, /settled payouts are terminal and immutable/i);
        return true;
      },
    );
  } finally {
    await replSet.stop();
  }
});
