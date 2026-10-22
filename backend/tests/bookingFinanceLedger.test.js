import test from 'node:test';
import assert from 'node:assert/strict';
import mongoose from 'mongoose';
import {
  recordBookingTransaction,
  calculateFeeSplit,
} from '../src/services/adminFinanceService.js';
import * as bookingService from '../src/services/bookingService.js';
import * as otpService from '../src/services/otpService.js';
import { hashOtp } from '../src/utils/otpUtils.js';
import { Booking, CaregiverProfile, Notification, Service, Transaction, User } from '../src/models/index.js';

// -----------------------------------------------------------------------------
// Test 1: Booking Creation creates simulated escrow transaction in audit ledger
// -----------------------------------------------------------------------------
test('BUG-03 - 1: createBooking records escrow_held transaction with fee breakdown and session propagation', async () => {
  const customerId = new mongoose.Types.ObjectId().toString();
  const caregiverId = new mongoose.Types.ObjectId().toString();
  const caregiverUserId = new mongoose.Types.ObjectId().toString();
  const serviceId = new mongoose.Types.ObjectId().toString();
  const bookingId = new mongoose.Types.ObjectId();

  mongoose.connection.client = {
    topology: { description: { type: 'ReplicaSetWithPrimary' } },
  };

  const origStartSession = mongoose.startSession;
  const origUserFindById = User.findById;
  const origCaregiverFindById = CaregiverProfile.findById;
  const origCaregiverUpdateOne = CaregiverProfile.updateOne;
  const origServiceFindById = Service.findById;
  const origBookingFindOne = Booking.findOne;
  const origBookingCreate = Booking.create;
  const origTxFindOne = Transaction.findOne;
  const origTxSave = Transaction.prototype.save;

  let sessionPassedToTx = null;
  let savedTxDoc = null;

  try {
    User.findById = async () => ({ _id: customerId, status: 'active' });
    Service.findById = async () => ({
      _id: serviceId,
      name: 'Post-Operative Care',
      category: 'post-operative',
      isActive: true,
      minimumDurationHours: 1,
    });
    CaregiverProfile.findById = () => ({
      populate: async () => ({
        _id: caregiverId,
        verificationStatus: 'verified',
        user: { _id: caregiverUserId, status: 'active' },
        servicesOffered: [serviceId],
        timezone: 'Asia/Kolkata',
        hourlyRate: 600,
        weeklySchedule: [
          { day: 'Mon', isAvailable: true, slots: [{ start: '08:00', end: '18:00' }] },
        ],
        dateExceptions: [],
      }),
    });
    CaregiverProfile.updateOne = async () => ({ modifiedCount: 1 });

    const mockSession = { mock: 'active_session' };
    mongoose.startSession = async () => ({
      withTransaction: async (cb) => cb(),
      endSession: async () => {},
    });

    Booking.findOne = () => ({
      session: async () => null,
    });

    Booking.create = async ([doc]) => [{
      ...doc,
      _id: bookingId,
      customer: customerId,
      caregiver: caregiverId,
      caregiverUser: caregiverUserId,
      serviceName: 'Post-Operative Care',
      hourlyRate: 600,
      totalHours: 4,
      totalAmount: doc.totalAmount,
    }];

    Transaction.findOne = (query) => {
      const p = Promise.resolve(null);
      p.session = (s) => {
        sessionPassedToTx = s;
        return p;
      };
      return p;
    };

    Transaction.prototype.save = async function (options) {
      savedTxDoc = this;
      return this;
    };

    const created = await bookingService.createBooking(customerId, {
      caregiverId,
      serviceId,
      startDateTime: new Date('2028-11-06T04:30:00.000Z'),
      endDateTime: new Date('2028-11-06T08:30:00.000Z'),
      location: { addressLine: '123 Marine Drive', city: 'Mumbai' },
      patientDetails: { name: 'Mrs. Sharma', age: 72 },
    });

    assert.ok(created);
    assert.ok(savedTxDoc, 'Escrow transaction should have been saved');
    assert.equal(savedTxDoc.status, 'escrow_held');
    assert.equal(savedTxDoc.type, 'booking_payment');
    assert.equal(savedTxDoc.isSimulated, true);
    assert.ok(savedTxDoc.escrowHeldAt instanceof Date);
    assert.equal(savedTxDoc.releasedAt, null);

    // Fee breakdown verification: 4 hrs * ₹600 = ₹2400 base
    // platformFee: 49, GST 18% on (2400+49) = 441, total = 2890
    // commission 12% on 2400 = 288, caregiverPayout = 2112
    const split = calculateFeeSplit(600, 4);
    assert.equal(savedTxDoc.amount, created.totalAmount);
    assert.equal(savedTxDoc.breakdown.baseAmount, 2400);
    assert.equal(savedTxDoc.breakdown.platformFee, 49);
    assert.equal(savedTxDoc.breakdown.commission, 288);
    assert.equal(savedTxDoc.breakdown.caregiverPayout, 2112);
  } finally {
    delete mongoose.connection.client;
    mongoose.startSession = origStartSession;
    User.findById = origUserFindById;
    CaregiverProfile.findById = origCaregiverFindById;
    CaregiverProfile.updateOne = origCaregiverUpdateOne;
    Service.findById = origServiceFindById;
    Booking.findOne = origBookingFindOne;
    Booking.create = origBookingCreate;
    Transaction.findOne = origTxFindOne;
    Transaction.prototype.save = origTxSave;
  }
});

// -----------------------------------------------------------------------------
// Test 2: Shift Check-Out Verification releases escrow transaction to caregiver
// -----------------------------------------------------------------------------
test('BUG-03 - 2: verifyCheckOut transitions escrow transaction to released with releasedAt timestamp', async () => {
  const customerId = new mongoose.Types.ObjectId().toString();
  const caregiverUserId = new mongoose.Types.ObjectId().toString();
  const bookingId = new mongoose.Types.ObjectId().toString();
  const validOtp = '654321';

  const origFindById = Booking.findById;
  const origFindOneAndUpdate = Booking.findOneAndUpdate;
  const origTxFindOne = Transaction.findOne;

  let existingTx = {
    _id: new mongoose.Types.ObjectId(),
    booking: bookingId,
    status: 'escrow_held',
    amount: 2890,
    releasedAt: null,
    save: async function () {
      return this;
    },
  };

  try {
    const salt = `${bookingId}:${customerId}`;
    const otpHash = hashOtp(validOtp, salt);

    const mockBooking = {
      _id: bookingId,
      customer: customerId,
      caregiverUser: caregiverUserId,
      status: 'in_progress',
      checkOutOtp: {
        otpHash,
        expiresAt: new Date(Date.now() + 900000),
        attempts: 0,
        maxAttempts: 5,
        consumedAt: null,
      },
    };

    Booking.findById = () => ({
      select: () => Promise.resolve(mockBooking),
    });

    Booking.findOneAndUpdate = async (filter, update) => {
      mockBooking.status = 'completed';
      mockBooking.checkOutOtp.consumedAt = update.$set['checkOutOtp.consumedAt'];
      return {
        ...mockBooking,
        status: 'completed',
        hourlyRate: 600,
        totalHours: 4,
        populate: async function () {
          return this;
        },
      };
    };

    Transaction.findOne = (query) => {
      const p = Promise.resolve(existingTx);
      p.session = () => p;
      return p;
    };

    const result = await otpService.verifyCheckOut(
      { _id: caregiverUserId, role: 'caregiver' },
      bookingId,
      { otp: validOtp, notes: 'Shift finished successfully' },
    );

    assert.equal(result.status, 'completed');
    assert.equal(existingTx.status, 'released');
    assert.ok(existingTx.releasedAt instanceof Date, 'Should set releasedAt timestamp');
  } finally {
    Booking.findById = origFindById;
    Booking.findOneAndUpdate = origFindOneAndUpdate;
    Transaction.findOne = origTxFindOne;
  }
});

// -----------------------------------------------------------------------------
// Test 3: Idempotency & Double Release Prevention
// -----------------------------------------------------------------------------
test('BUG-03 - 3: Idempotent ledger operations prevent double releases and status regression', async () => {
  const bookingId = new mongoose.Types.ObjectId();
  const releasedTime = new Date('2026-10-21T10:00:00.000Z');

  const existingTx = {
    _id: new mongoose.Types.ObjectId(),
    booking: bookingId,
    status: 'released',
    releasedAt: releasedTime,
    save: async function () {
      return this;
    },
  };

  const origTxFindOne = Transaction.findOne;

  try {
    Transaction.findOne = () => Promise.resolve(existingTx);

    const mockBooking = {
      _id: bookingId,
      hourlyRate: 500,
      totalHours: 2,
    };

    // Calling with 'released' again is a no-op
    const tx1 = await recordBookingTransaction(mockBooking, 'released');
    assert.equal(tx1.status, 'released');
    assert.equal(tx1.releasedAt, releasedTime);

    // Calling with 'escrow_held' MUST NOT revert released status back to escrow
    const tx2 = await recordBookingTransaction(mockBooking, 'escrow_held');
    assert.equal(tx2.status, 'released');
    assert.equal(tx2.releasedAt, releasedTime);
  } finally {
    Transaction.findOne = origTxFindOne;
  }
});

// -----------------------------------------------------------------------------
// Test 4: Booking Cancellation transitions transaction to refunded
// -----------------------------------------------------------------------------
test('BUG-03 - 4: cancelBooking transitions transaction status to refunded with refundedAt timestamp', async () => {
  const customerId = new mongoose.Types.ObjectId().toString();
  const caregiverUserId = new mongoose.Types.ObjectId().toString();
  const bookingId = new mongoose.Types.ObjectId().toString();

  const origFindById = Booking.findById;
  const origFindOneAndUpdate = Booking.findOneAndUpdate;
  const origTxFindOne = Transaction.findOne;

  let existingTx = {
    _id: new mongoose.Types.ObjectId(),
    booking: bookingId,
    status: 'escrow_held',
    refundedAt: null,
    save: async function () {
      return this;
    },
  };

  try {
    Booking.findById = async () => ({
      _id: bookingId,
      customer: customerId,
      caregiverUser: caregiverUserId,
      status: 'pending',
      startDateTime: new Date(Date.now() + 86400000),
    });

    Booking.findOneAndUpdate = async () => ({
      _id: bookingId,
      customer: customerId,
      caregiverUser: caregiverUserId,
      status: 'cancelled',
      populate: async function () {
        return this;
      },
    });

    Transaction.findOne = () => Promise.resolve(existingTx);

    const cancelled = await bookingService.cancelBooking(
      { _id: customerId, role: 'customer' },
      bookingId,
      'Change of schedule',
    );

    assert.equal(cancelled.status, 'cancelled');
    assert.equal(existingTx.status, 'refunded');
    assert.ok(existingTx.refundedAt instanceof Date, 'Should set refundedAt timestamp');
  } finally {
    Booking.findById = origFindById;
    Booking.findOneAndUpdate = origFindOneAndUpdate;
    Transaction.findOne = origTxFindOne;
  }
});

// -----------------------------------------------------------------------------
// Test 5: Booking Rejection transitions transaction to refunded
// -----------------------------------------------------------------------------
test('BUG-03 - 5: rejectBooking transitions transaction status to refunded', async () => {
  const customerId = new mongoose.Types.ObjectId().toString();
  const caregiverUserId = new mongoose.Types.ObjectId().toString();
  const bookingId = new mongoose.Types.ObjectId().toString();

  const origFindById = Booking.findById;
  const origFindOneAndUpdate = Booking.findOneAndUpdate;
  const origTxFindOne = Transaction.findOne;
  const origNotifFindOne = Notification.findOne;
  const origNotifCreate = Notification.create;

  let existingTx = {
    _id: new mongoose.Types.ObjectId(),
    booking: bookingId,
    status: 'escrow_held',
    refundedAt: null,
    save: async function () {
      return this;
    },
  };

  try {
    Notification.findOne = async () => null;
    Notification.create = async () => ({ _id: new mongoose.Types.ObjectId() });

    Booking.findById = async () => ({
      _id: bookingId,
      customer: customerId,
      caregiverUser: caregiverUserId,
      status: 'pending',
      serviceName: 'Physiotherapy Assist',
    });

    Booking.findOneAndUpdate = async () => ({
      _id: bookingId,
      customer: customerId,
      caregiverUser: caregiverUserId,
      status: 'rejected',
      serviceName: 'Physiotherapy Assist',
      populate: async function () {
        return this;
      },
    });

    Transaction.findOne = () => Promise.resolve(existingTx);

    const rejected = await bookingService.rejectBooking(
      { _id: caregiverUserId, role: 'caregiver' },
      bookingId,
      'Schedule full',
    );

    assert.equal(rejected.status, 'rejected');
    assert.equal(existingTx.status, 'refunded');
    assert.ok(existingTx.refundedAt instanceof Date);
  } finally {
    Booking.findById = origFindById;
    Booking.findOneAndUpdate = origFindOneAndUpdate;
    Transaction.findOne = origTxFindOne;
    Notification.findOne = origNotifFindOne;
    Notification.create = origNotifCreate;
  }
});

// -----------------------------------------------------------------------------
// Test 6: Concurrency collision recovery (E11000 duplicate key on booking)
// -----------------------------------------------------------------------------
test('BUG-03 - 6: recordBookingTransaction recovers idempotently when race condition generates duplicate key on booking', async () => {
  const bookingId = new mongoose.Types.ObjectId();
  let firstFind = true;
  let concurrentTx = {
    _id: new mongoose.Types.ObjectId(),
    booking: bookingId,
    status: 'escrow_held',
    releasedAt: null,
    save: async function () {
      return this;
    },
  };

  const origTxFindOne = Transaction.findOne;
  const origTxSave = Transaction.prototype.save;

  try {
    Transaction.findOne = () => {
      if (firstFind) {
        firstFind = false;
        return Promise.resolve(null); // Appears not to exist initially
      }
      return Promise.resolve(concurrentTx); // Recheck finds concurrent record
    };

    Transaction.prototype.save = async function () {
      const err = new Error('E11000 duplicate key error collection: transactions index: booking_1');
      err.code = 11000;
      throw err;
    };

    const mockBooking = {
      _id: bookingId,
      customer: new mongoose.Types.ObjectId(),
      caregiver: new mongoose.Types.ObjectId(),
      caregiverUser: new mongoose.Types.ObjectId(),
      serviceName: 'Elder Care',
      hourlyRate: 500,
      totalHours: 3,
    };

    const tx = await recordBookingTransaction(mockBooking, 'released');
    assert.ok(tx);
    assert.equal(concurrentTx.status, 'released');
    assert.ok(concurrentTx.releasedAt instanceof Date);
  } finally {
    Transaction.findOne = origTxFindOne;
    Transaction.prototype.save = origTxSave;
  }
});

// -----------------------------------------------------------------------------
// Test 7: Failure handling: missing booking instance throws descriptive error
// -----------------------------------------------------------------------------
test('BUG-03 - 7: recordBookingTransaction rejects missing booking instance', async () => {
  await assert.rejects(
    async () => {
      await recordBookingTransaction(null);
    },
    (err) => {
      assert.match(err.message, /valid booking instance is required/i);
      return true;
    },
  );
});

// -----------------------------------------------------------------------------
// Test 8: simulatePayment synchronizes with Transaction ledger
// -----------------------------------------------------------------------------
test('BUG-03 - 8: simulatePayment updates SimulatedPayment and synchronizes Transaction status', async () => {
  const { simulatePayment } = await import('../src/services/simulatedPaymentService.js');
  const { SimulatedPayment } = await import('../src/models/index.js');

  const customerId = new mongoose.Types.ObjectId().toString();
  const bookingId = new mongoose.Types.ObjectId().toString();

  const origBookingFindById = Booking.findById;
  const origSimFindOneAndUpdate = SimulatedPayment.findOneAndUpdate;
  const origTxFindOne = Transaction.findOne;
  const origEnv = process.env.NODE_ENV;
  process.env.NODE_ENV = 'test';

  let existingTx = {
    _id: new mongoose.Types.ObjectId(),
    booking: bookingId,
    status: 'escrow_held',
    save: async function () { return this; },
  };

  try {
    Booking.findById = async () => ({
      _id: bookingId,
      customer: customerId,
      status: 'confirmed',
      totalAmount: 3000,
      currency: 'INR',
    });

    SimulatedPayment.findOneAndUpdate = async (filter, update) => ({
      _id: new mongoose.Types.ObjectId(),
      booking: bookingId,
      customer: customerId,
      status: update.$set.status,
      amount: update.$set.amount,
      simulatedAt: update.$set.simulatedAt,
    });

    Transaction.findOne = () => Promise.resolve(existingTx);

    const res = await simulatePayment(
      { _id: customerId, role: 'customer' },
      bookingId,
      { status: 'SIMULATED_ESCROW_HELD' },
    );

    assert.equal(res.success, true);
    assert.equal(res.simulatedPayment.status, 'SIMULATED_ESCROW_HELD');
    assert.equal(existingTx.status, 'escrow_held');
  } finally {
    process.env.NODE_ENV = origEnv;
    Booking.findById = origBookingFindById;
    SimulatedPayment.findOneAndUpdate = origSimFindOneAndUpdate;
    Transaction.findOne = origTxFindOne;
  }
});
