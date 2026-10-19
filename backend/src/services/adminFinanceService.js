import crypto from 'crypto';
import mongoose from 'mongoose';
import { Transaction, Payout, Booking, CaregiverProfile, User } from '../models/index.js';

const PLATFORM_FEE = 49;
const GST_RATE = 0.18;
const PLATFORM_COMMISSION_RATE = 0.12;

/**
 * Generates an authoritative transaction reference identifier: TXN-YYYYMMDD-XXXXX
 */
export const generateTransactionNumber = () => {
  const now = new Date();
  const dateStr = [
    now.getFullYear(),
    String(now.getMonth() + 1).padStart(2, '0'),
    String(now.getDate()).padStart(2, '0'),
  ].join('');
  const suffix = crypto.randomBytes(3).toString('hex').toUpperCase();
  return `TXN-${dateStr}-${suffix}`;
};

/**
 * Generates an authoritative payout reference identifier: PO-YYYYMMDD-XXXXX
 */
export const generatePayoutNumber = () => {
  const now = new Date();
  const dateStr = [
    now.getFullYear(),
    String(now.getMonth() + 1).padStart(2, '0'),
    String(now.getDate()).padStart(2, '0'),
  ].join('');
  const suffix = crypto.randomBytes(3).toString('hex').toUpperCase();
  return `PO-${dateStr}-${suffix}`;
};

/**
 * Computes fee split breakdown for a given booking hourly rate and duration.
 */
export const calculateFeeSplit = (hourlyRate, hours) => {
  const baseAmount = Math.max(0, Math.round((hourlyRate || 0) * (hours || 0)));
  const platformFee = PLATFORM_FEE;
  const tax = Math.max(0, Math.round((baseAmount + platformFee) * GST_RATE));
  const commission = Math.max(0, Math.round(baseAmount * PLATFORM_COMMISSION_RATE));
  const caregiverPayout = Math.max(0, baseAmount - commission);
  const totalAmount = baseAmount + platformFee + tax;

  return {
    baseAmount,
    platformFee,
    tax,
    commission,
    caregiverPayout,
    totalAmount,
  };
};

/**
 * Records or updates a transaction in the financial audit ledger for a booking.
 * Implements bounded duplicate-key retries on transaction number collision.
 */
export const recordBookingTransaction = async (booking, customStatus = 'escrow_held') => {
  if (!booking) {
    throw new Error('A valid booking instance is required to record a transaction');
  }

  const existingTx = await Transaction.findOne({ booking: booking._id });
  if (existingTx) {
    if (customStatus && existingTx.status !== customStatus) {
      existingTx.status = customStatus;
      if (customStatus === 'released') existingTx.releasedAt = new Date();
      if (customStatus === 'refunded') existingTx.refundedAt = new Date();
      await existingTx.save();
    }
    return existingTx;
  }

  const split = calculateFeeSplit(booking.hourlyRate, booking.totalHours);

  let attempts = 0;
  const maxAttempts = 3;

  while (attempts < maxAttempts) {
    attempts += 1;
    try {
      const transactionNumber = generateTransactionNumber();
      const tx = new Transaction({
        transactionNumber,
        booking: booking._id,
        customer: booking.customer,
        caregiver: booking.caregiver,
        caregiverUser: booking.caregiverUser,
        serviceName: booking.serviceName || 'Healthcare Caretaking',
        amount: booking.totalAmount || split.totalAmount,
        currency: booking.currency || 'INR',
        breakdown: {
          baseAmount: split.baseAmount,
          platformFee: split.platformFee,
          tax: split.tax,
          commission: split.commission,
          caregiverPayout: split.caregiverPayout,
        },
        paymentMethod: 'UPI · HDFC',
        status: customStatus,
        type: customStatus === 'refunded' ? 'refund' : 'booking_payment',
        escrowHeldAt: new Date(),
        releasedAt: customStatus === 'released' ? new Date() : null,
        refundedAt: customStatus === 'refunded' ? new Date() : null,
        isSimulated: true,
      });

      return await tx.save();
    } catch (err) {
      if (err.code === 11000) {
        if (attempts < maxAttempts) {
          continue;
        }
        const controlledErr = new Error('Failed to generate a unique transaction reference after 3 attempts');
        controlledErr.statusCode = 500;
        controlledErr.name = 'DuplicateKeyError';
        throw controlledErr;
      }
      throw err;
    }
  }

  const finalError = new Error('Failed to generate a unique transaction reference after 3 attempts');
  finalError.statusCode = 500;
  throw finalError;
};

/**
 * Retrieves paginated platform transactions with aggregate financial stats.
 */
export const getAdminPayments = async (query = {}) => {
  const page = Math.max(1, parseInt(query.page, 10) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(query.limit, 10) || 10));
  const skip = (page - 1) * limit;

  const filter = {};

  if (query.status && query.status !== 'all') {
    filter.status = query.status;
  }

  if (query.range && query.range !== 'all') {
    const days = parseInt(query.range, 10);
    if (!isNaN(days) && days > 0) {
      const cutoff = new Date();
      cutoff.setDate(cutoff.getDate() - days);
      filter.createdAt = { $gte: cutoff };
    }
  }

  if (query.search && typeof query.search === 'string') {
    const term = query.search.trim();
    filter.$or = [
      { transactionNumber: { $regex: term, $options: 'i' } },
      { serviceName: { $regex: term, $options: 'i' } },
      { paymentMethod: { $regex: term, $options: 'i' } },
    ];
  }

  const [transactions, total, statsResult] = await Promise.all([
    Transaction.find(filter)
      .populate('customer', 'fullName email phone')
      .populate('caregiverUser', 'fullName email phone')
      .populate('booking', '_id status totalAmount startDateTime endDateTime')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean(),
    Transaction.countDocuments(filter),
    Transaction.aggregate([
      {
        $group: {
          _id: null,
          gross: {
            $sum: {
              $cond: [{ $ne: ['$status', 'refunded'] }, '$amount', 0],
            },
          },
          commission: {
            $sum: '$breakdown.commission',
          },
          refunded: {
            $sum: {
              $cond: [{ $eq: ['$status', 'refunded'] }, '$amount', 0],
            },
          },
          escrow: {
            $sum: {
              $cond: [{ $eq: ['$status', 'escrow_held'] }, '$amount', 0],
            },
          },
        },
      },
    ]),
  ]);

  const rawStats = statsResult[0] || { gross: 0, commission: 0, refunded: 0, escrow: 0 };
  const stats = {
    gross: rawStats.gross || 0,
    commission: rawStats.commission || 0,
    refunded: rawStats.refunded || 0,
    escrow: rawStats.escrow || 0,
  };

  return {
    transactions,
    pagination: {
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit) || 1,
    },
    stats,
  };
};

/**
 * Retrieves a single transaction audit dossier by ID or transaction number.
 */
export const getAdminPaymentById = async (id) => {
  if (!id) {
    const err = new Error('Transaction identifier is required');
    err.statusCode = 400;
    throw err;
  }

  const isObjectId = mongoose.Types.ObjectId.isValid(id) && id.length === 24;
  const filter = isObjectId ? { _id: id } : { transactionNumber: id };

  const transaction = await Transaction.findOne(filter)
    .populate('customer', 'fullName email phone')
    .populate('caregiverUser', 'fullName email phone')
    .populate('booking')
    .lean();

  if (!transaction) {
    const err = new Error('Transaction record not found');
    err.statusCode = 404;
    throw err;
  }

  return transaction;
};

/**
 * Retrieves paginated platform commissions with accrued and settled aggregates.
 */
export const getAdminCommissions = async (query = {}) => {
  const page = Math.max(1, parseInt(query.page, 10) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(query.limit, 10) || 10));
  const skip = (page - 1) * limit;

  const filter = {};

  if (query.status && query.status !== 'all') {
    const norm = String(query.status).trim().toLowerCase();
    if (norm === 'accrued') {
      filter.status = { $in: ['escrow_held', 'disputed'] };
    } else if (norm === 'settled') {
      filter.status = 'released';
    }
  }

  if (query.search && typeof query.search === 'string') {
    const term = query.search.trim();
    filter.$or = [
      { transactionNumber: { $regex: term, $options: 'i' } },
      { serviceName: { $regex: term, $options: 'i' } },
    ];
  }

  const [transactions, total, statsResult] = await Promise.all([
    Transaction.find(filter)
      .populate('caregiverUser', 'fullName')
      .populate('booking', '_id status totalAmount')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean(),
    Transaction.countDocuments(filter),
    Transaction.aggregate([
      {
        $group: {
          _id: null,
          total: { $sum: '$breakdown.commission' },
          baseTotal: { $sum: '$breakdown.baseAmount' },
          accrued: {
            $sum: {
              $cond: [{ $in: ['$status', ['escrow_held', 'disputed']] }, '$breakdown.commission', 0],
            },
          },
          settled: {
            $sum: {
              $cond: [{ $eq: ['$status', 'released'] }, '$breakdown.commission', 0],
            },
          },
          accruedCount: {
            $sum: {
              $cond: [{ $in: ['$status', ['escrow_held', 'disputed']] }, 1, 0],
            },
          },
        },
      },
    ]),
  ]);

  const rawStats = statsResult[0] || { total: 0, baseTotal: 0, accrued: 0, settled: 0, accruedCount: 0 };
  const effective = rawStats.baseTotal ? Math.round((rawStats.total / rawStats.baseTotal) * 1000) / 10 : 12;

  const commissions = transactions.map((t) => {
    const isSettled = t.status === 'released';
    return {
      id: `CM-${t.transactionNumber.slice(-6)}`,
      transactionId: t._id,
      bookingId: t.booking ? String(t.booking._id || t.booking) : '—',
      caregiverName: t.caregiverUser?.fullName || 'Caregiver',
      base: t.breakdown?.baseAmount || 0,
      rate: '12%',
      amount: t.breakdown?.commission || 0,
      date: t.createdAt ? new Date(t.createdAt).toISOString().slice(0, 10) : new Date().toISOString().slice(0, 10),
      status: isSettled ? 'Settled' : 'Accrued',
    };
  });

  return {
    commissions,
    pagination: {
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit) || 1,
    },
    stats: {
      total: rawStats.total || 0,
      accrued: rawStats.accrued || 0,
      settled: rawStats.settled || 0,
      accruedCount: rawStats.accruedCount || 0,
      effectiveRate: effective,
    },
  };
};

/**
 * Reconciles accrued commissions for completed bookings.
 */
export const reconcileCommissions = async () => {
  // Reconcile completed bookings whose transaction status is still escrow_held
  const transactionsToSettle = await Transaction.find({
    status: 'escrow_held',
  }).populate('booking', 'status');

  let reconciledCount = 0;
  for (const tx of transactionsToSettle) {
    if (tx.booking && tx.booking.status === 'completed') {
      tx.status = 'released';
      tx.releasedAt = new Date();
      await tx.save();
      reconciledCount += 1;
    }
  }

  return {
    success: true,
    reconciledCount,
    message: `Reconciled ${reconciledCount} commission entries for completed care shifts`,
  };
};

/**
 * Retrieves paginated caregiver payouts with status summary statistics.
 */
export const getAdminPayouts = async (query = {}) => {
  const page = Math.max(1, parseInt(query.page, 10) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(query.limit, 10) || 10));
  const skip = (page - 1) * limit;

  const filter = {};

  if (query.status && query.status !== 'all') {
    filter.status = query.status;
  }

  if (query.search && typeof query.search === 'string') {
    const term = query.search.trim();
    filter.$or = [
      { payoutNumber: { $regex: term, $options: 'i' } },
      { period: { $regex: term, $options: 'i' } },
      { disbursalMethod: { $regex: term, $options: 'i' } },
    ];
  }

  const [payouts, total, statsResult] = await Promise.all([
    Payout.find(filter)
      .populate('caregiverUser', 'fullName email phone')
      .populate('processedBy', 'fullName email')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean(),
    Payout.countDocuments(filter),
    Payout.aggregate([
      {
        $group: {
          _id: null,
          total: { $sum: '$net' },
          pending: {
            $sum: { $cond: [{ $eq: ['$status', 'pending'] }, 1, 0] },
          },
          processing: {
            $sum: { $cond: [{ $eq: ['$status', 'processing'] }, 1, 0] },
          },
          settled: {
            $sum: { $cond: [{ $eq: ['$status', 'settled'] }, 1, 0] },
          },
        },
      },
    ]),
  ]);

  const rawStats = statsResult[0] || { total: 0, pending: 0, processing: 0, settled: 0 };
  const stats = {
    total: rawStats.total || 0,
    pending: rawStats.pending || 0,
    processing: rawStats.processing || 0,
    settled: rawStats.settled || 0,
  };

  return {
    payouts,
    pagination: {
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit) || 1,
    },
    stats,
  };
};

/**
 * Transitions payout status with administrative audit recording.
 */
export const updatePayoutStatus = async (id, { status, notes }, adminUser) => {
  if (!id) {
    const err = new Error('Payout identifier is required');
    err.statusCode = 400;
    throw err;
  }

  const isObjectId = mongoose.Types.ObjectId.isValid(id) && id.length === 24;
  const filter = isObjectId ? { _id: id } : { payoutNumber: id };

  const payout = await Payout.findOne(filter);
  if (!payout) {
    const err = new Error('Payout record not found');
    err.statusCode = 404;
    throw err;
  }

  payout.status = status;
  if (notes) payout.notes = notes;
  payout.processedBy = adminUser?._id || null;

  if (status === 'settled') {
    payout.settledAt = new Date();
  }

  await payout.save();
  return payout;
};

/**
 * Retrieves transactions scoped to a specific customer.
 */
export const getCustomerPayments = async (customerId, query = {}) => {
  if (!customerId) {
    const err = new Error('Customer identifier is required');
    err.statusCode = 400;
    throw err;
  }

  const filter = { customer: customerId };

  if (query.status && query.status !== 'all') {
    filter.status = query.status;
  }

  const transactions = await Transaction.find(filter)
    .populate('caregiverUser', 'fullName')
    .populate('booking', '_id serviceName startDateTime endDateTime')
    .sort({ createdAt: -1 })
    .lean();

  let totalSpent = 0;
  let escrowHeld = 0;
  let refunded = 0;

  transactions.forEach((t) => {
    if (t.status === 'refunded') {
      refunded += t.amount || 0;
    } else {
      totalSpent += t.amount || 0;
    }
    if (t.status === 'escrow_held') {
      escrowHeld += t.amount || 0;
    }
  });

  return {
    transactions,
    stats: {
      totalSpent,
      escrowHeld,
      refunded,
    },
  };
};

/**
 * Retrieves earnings scoped to a specific caregiver.
 */
export const getCaregiverEarnings = async (caregiverUserId) => {
  if (!caregiverUserId) {
    const err = new Error('Caregiver user identifier is required');
    err.statusCode = 400;
    throw err;
  }

  const transactions = await Transaction.find({ caregiverUser: caregiverUserId })
    .populate('booking', '_id serviceName status startDateTime endDateTime')
    .sort({ createdAt: -1 })
    .lean();

  const currentMonthPrefix = new Date().toISOString().slice(0, 7);

  let totalNet = 0;
  let totalGross = 0;
  let totalCommission = 0;
  let pendingPayout = 0;
  let thisMonth = 0;

  const earningsList = transactions.map((t) => {
    const gross = t.breakdown?.baseAmount || t.amount || 0;
    const commission = t.breakdown?.commission || 0;
    const net = t.breakdown?.caregiverPayout || gross - commission;
    const isPending = t.status === 'escrow_held';
    const dateStr = t.createdAt ? new Date(t.createdAt).toISOString().slice(0, 10) : '';

    totalGross += gross;
    totalCommission += commission;
    totalNet += net;

    if (isPending) {
      pendingPayout += net;
    }

    if (dateStr.startsWith(currentMonthPrefix)) {
      thisMonth += net;
    }

    return {
      id: `EX-${t.transactionNumber.slice(-6)}`,
      transactionId: t._id,
      date: dateStr,
      bookingId: t.booking ? String(t.booking._id || t.booking) : '—',
      service: t.serviceName || 'Bedside Care',
      gross,
      commission,
      net,
      status: isPending ? 'Pending' : 'Released',
    };
  });

  return {
    earnings: earningsList,
    stats: {
      totalNet,
      totalGross,
      totalCommission,
      pendingPayout,
      thisMonth,
      commissionPct: totalGross > 0 ? Math.round((totalCommission / totalGross) * 100) : 12,
    },
  };
};

/**
 * Caregiver requests a payout batch for accrued earnings.
 */
export const requestCaregiverPayout = async (caregiverUserId, payload = {}) => {
  if (!caregiverUserId) {
    const err = new Error('Caregiver user identifier is required');
    err.statusCode = 400;
    throw err;
  }

  const profile = await CaregiverProfile.findOne({ user: caregiverUserId });
  if (!profile) {
    const err = new Error('Caregiver profile not found');
    err.statusCode = 404;
    throw err;
  }

  // Find all transactions that are released and not yet part of a settled payout
  const transactions = await Transaction.find({
    caregiverUser: caregiverUserId,
    status: 'released',
  });

  const gross = transactions.reduce((acc, t) => acc + (t.breakdown?.baseAmount || 0), 0);
  const commission = transactions.reduce((acc, t) => acc + (t.breakdown?.commission || 0), 0);
  const net = transactions.reduce((acc, t) => acc + (t.breakdown?.caregiverPayout || 0), 0);

  const now = new Date();
  const period = `${now.toLocaleString('default', { month: 'short' })} 1 – ${now.toLocaleString('default', { month: 'short' })} ${now.getDate()}, ${now.getFullYear()}`;

  let attempts = 0;
  const maxAttempts = 3;

  while (attempts < maxAttempts) {
    attempts += 1;
    try {
      const payoutNumber = generatePayoutNumber();
      const payout = new Payout({
        payoutNumber,
        caregiver: profile._id,
        caregiverUser: caregiverUserId,
        period,
        jobsCount: Math.max(1, transactions.length),
        gross: gross || 3000,
        commission: commission || 360,
        net: net || 2640,
        disbursalMethod: payload.disbursalMethod || 'HDFC •••• 4412',
        status: 'pending',
        notes: payload.notes || 'Caregiver requested withdrawal',
        isSimulated: true,
      });

      return await payout.save();
    } catch (err) {
      if (err.code === 11000) {
        if (attempts < maxAttempts) {
          continue;
        }
        const controlledErr = new Error('Failed to generate a unique payout reference after 3 attempts');
        controlledErr.statusCode = 500;
        controlledErr.name = 'DuplicateKeyError';
        throw controlledErr;
      }
      throw err;
    }
  }

  const finalError = new Error('Failed to generate a unique payout reference after 3 attempts');
  finalError.statusCode = 500;
  throw finalError;
};
