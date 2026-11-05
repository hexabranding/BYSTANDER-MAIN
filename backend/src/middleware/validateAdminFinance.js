import mongoose from 'mongoose';

const ALLOWED_PAYMENT_STATUSES = [
  'all',
  'escrow_held',
  'released',
  'refunded',
  'disputed',
  'cancelled',
  'accrued',
  'settled',
];
const ALLOWED_PAYOUT_STATUSES = ['all', 'pending', 'processing', 'settled', 'failed'];

/**
 * Normalizes input status from title-case or snake-case to lowercase snake_case
 */
export const normalizeFinanceStatus = (val) => {
  if (!val) return 'all';
  const clean = String(val).trim().toLowerCase().replace(/\s+/g, '_');
  return clean;
};

/**
 * Middleware: Validate payment query parameters.
 */
export const validatePaymentQuery = (req, res, next) => {
  const query = req.query || {};

  if (query.page !== undefined) {
    const pageNum = parseInt(query.page, 10);
    if (isNaN(pageNum) || pageNum < 1) {
      return res.status(400).json({
        success: false,
        message: 'Page parameter must be a positive integer greater than or equal to 1',
      });
    }
    req.query.page = pageNum;
  } else {
    req.query.page = 1;
  }

  if (query.limit !== undefined) {
    const limitNum = parseInt(query.limit, 10);
    if (isNaN(limitNum) || limitNum < 1) {
      return res.status(400).json({
        success: false,
        message: 'Limit parameter must be a positive integer between 1 and 100',
      });
    }
    req.query.limit = Math.min(limitNum, 100);
  } else {
    req.query.limit = 10;
  }

  let norm = 'all';
  if (query.status) {
    norm = normalizeFinanceStatus(query.status);
    if (!ALLOWED_PAYMENT_STATUSES.includes(norm)) {
      return res.status(400).json({
        success: false,
        message: `Invalid payment status filter. Allowed values: ${ALLOWED_PAYMENT_STATUSES.join(', ')}`,
      });
    }
  }

  const validated = { ...query, page: req.query.page || 1, limit: req.query.limit || 10, status: norm };
  try {
    Object.defineProperty(req, 'query', { value: validated, writable: true, configurable: true });
  } catch (_) {
    req.query.status = norm;
  }

  if (query.range !== undefined) {
    const r = String(query.range).trim().toLowerCase();
    if (!['7', '30', '90', '365', 'all'].includes(r) && isNaN(Number(r))) {
      return res.status(400).json({
        success: false,
        message: 'Range must be one of: 7, 30, 90, 365, all, or a valid number of days',
      });
    }
  }

  if (query.search && typeof query.search === 'string') {
    req.query.search = query.search.trim().slice(0, 100);
  }

  next();
};

/**
 * Middleware: Validate transaction ID param.
 */
export const validateTransactionIdParam = (req, res, next) => {
  const { id } = req.params;
  if (!id || typeof id !== 'string') {
    return res.status(400).json({
      success: false,
      message: 'Transaction identifier is required',
    });
  }

  const trimmed = id.trim();
  const isValidObjectId = mongoose.Types.ObjectId.isValid(trimmed) && trimmed.length === 24;
  const isCustomTxnRef = /^TXN-[A-Za-z0-9-]+$/i.test(trimmed);

  if (!isValidObjectId && !isCustomTxnRef) {
    return res.status(400).json({
      success: false,
      message: 'Transaction ID must be a valid 24-character hexadecimal ObjectId or TXN reference',
    });
  }

  req.params.id = trimmed;
  next();
};

/**
 * Middleware: Validate payout query parameters.
 */
export const validatePayoutQuery = (req, res, next) => {
  const query = req.query || {};

  if (query.page !== undefined) {
    const pageNum = parseInt(query.page, 10);
    if (isNaN(pageNum) || pageNum < 1) {
      return res.status(400).json({
        success: false,
        message: 'Page parameter must be a positive integer greater than or equal to 1',
      });
    }
    req.query.page = pageNum;
  } else {
    req.query.page = 1;
  }

  if (query.limit !== undefined) {
    const limitNum = parseInt(query.limit, 10);
    if (isNaN(limitNum) || limitNum < 1) {
      return res.status(400).json({
        success: false,
        message: 'Limit parameter must be a positive integer between 1 and 100',
      });
    }
    req.query.limit = Math.min(limitNum, 100);
  } else {
    req.query.limit = 10;
  }

  let norm = 'all';
  if (query.status) {
    norm = normalizeFinanceStatus(query.status);
    if (!ALLOWED_PAYOUT_STATUSES.includes(norm)) {
      return res.status(400).json({
        success: false,
        message: `Invalid payout status filter. Allowed values: ${ALLOWED_PAYOUT_STATUSES.join(', ')}`,
      });
    }
  }

  const validated = { ...query, page: req.query.page || 1, limit: req.query.limit || 10, status: norm };
  try {
    Object.defineProperty(req, 'query', { value: validated, writable: true, configurable: true });
  } catch (_) {
    req.query.status = norm;
  }

  if (query.search && typeof query.search === 'string') {
    req.query.search = query.search.trim().slice(0, 100);
  }

  next();
};

/**
 * Middleware: Validate payout ID param.
 */
export const validatePayoutIdParam = (req, res, next) => {
  const { id } = req.params;
  if (!id || typeof id !== 'string') {
    return res.status(400).json({
      success: false,
      message: 'Payout identifier is required',
    });
  }

  const trimmed = id.trim();
  const isValidObjectId = mongoose.Types.ObjectId.isValid(trimmed) && trimmed.length === 24;
  const isCustomPayoutRef = /^PO-[A-Za-z0-9-]+$/i.test(trimmed);

  if (!isValidObjectId && !isCustomPayoutRef) {
    return res.status(400).json({
      success: false,
      message: 'Payout ID must be a valid 24-character hexadecimal ObjectId or PO reference',
    });
  }

  req.params.id = trimmed;
  next();
};

/**
 * Middleware: Validate updating payout status.
 */
export const validateUpdatePayoutStatus = (req, res, next) => {
  const { status, notes, razorpay_payment_id } = req.body || {};

  if (!status || typeof status !== 'string') {
    return res.status(400).json({
      success: false,
      message: 'Target payout status is required',
    });
  }

  const norm = normalizeFinanceStatus(status);
  if (!['pending', 'processing', 'settled', 'failed'].includes(norm)) {
    return res.status(400).json({
      success: false,
      message: 'Invalid payout status. Allowed transitions: pending, processing, settled, failed',
    });
  }

  req.body.status = norm;

  if (notes !== undefined && typeof notes === 'string') {
    req.body.notes = notes.trim().slice(0, 500);
  }

  if (razorpay_payment_id !== undefined && typeof razorpay_payment_id === 'string') {
    req.body.razorpay_payment_id = razorpay_payment_id.trim();
  }

  if (norm === 'failed') {
    if (!req.body.notes || req.body.notes.length < 5) {
      return res.status(400).json({
        success: false,
        message: 'A meaningful audit note of at least 5 characters is required when marking a payout as failed',
      });
    }
  }

  next();
};

/**
 * Middleware: Validate caregiver payout request body.
 */
export const validateCaregiverPayoutRequest = (req, res, next) => {
  const { disbursalMethod, notes } = req.body || {};

  if (disbursalMethod !== undefined && typeof disbursalMethod === 'string') {
    req.body.disbursalMethod = disbursalMethod.trim().slice(0, 100);
  }

  if (notes !== undefined && typeof notes === 'string') {
    req.body.notes = notes.trim().slice(0, 500);
  }

  next();
};
