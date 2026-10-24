import * as adminFinanceService from '../services/adminFinanceService.js';

export const getPayments = async (req, res, next) => {
  try {
    const result = await adminFinanceService.getAdminPayments(req.query);
    res.status(200).json({
      success: true,
      data: result.transactions,
      pagination: result.pagination,
      stats: result.stats,
    });
  } catch (err) {
    next(err);
  }
};

export const getPaymentById = async (req, res, next) => {
  try {
    const transaction = await adminFinanceService.getAdminPaymentById(req.params.id);
    res.status(200).json({
      success: true,
      data: transaction,
    });
  } catch (err) {
    next(err);
  }
};

export const getCommissions = async (req, res, next) => {
  try {
    const result = await adminFinanceService.getAdminCommissions(req.query);
    res.status(200).json({
      success: true,
      data: result.commissions,
      pagination: result.pagination,
      stats: result.stats,
    });
  } catch (err) {
    next(err);
  }
};

export const reconcileCommissions = async (req, res, next) => {
  try {
    const result = await adminFinanceService.reconcileCommissions();
    res.status(200).json(result);
  } catch (err) {
    next(err);
  }
};

export const getPayouts = async (req, res, next) => {
  try {
    const result = await adminFinanceService.getAdminPayouts(req.query);
    res.status(200).json({
      success: true,
      data: result.payouts,
      pagination: result.pagination,
      stats: result.stats,
    });
  } catch (err) {
    next(err);
  }
};

export const updatePayoutStatus = async (req, res, next) => {
  try {
    const payout = await adminFinanceService.updatePayoutStatus(
      req.params.id,
      req.body,
      req.user,
    );
    res.status(200).json({
      success: true,
      data: payout,
      message: `Payout status updated to ${payout.status}`,
    });
  } catch (err) {
    next(err);
  }
};

export const getCustomerPayments = async (req, res, next) => {
  try {
    const result = await adminFinanceService.getCustomerPayments(req.user._id, req.query);
    res.status(200).json({
      success: true,
      data: result.transactions,
      stats: result.stats,
      monthlySpend: result.monthlySpend,
    });
  } catch (err) {
    next(err);
  }
};

export const getCaregiverEarnings = async (req, res, next) => {
  try {
    const result = await adminFinanceService.getCaregiverEarnings(req.user._id);
    res.status(200).json({
      success: true,
      data: result.earnings,
      stats: result.stats,
      weeklyEarnings: result.weeklyEarnings,
      monthlyEarnings: result.monthlyEarnings,
    });
  } catch (err) {
    next(err);
  }
};

export const requestCaregiverPayout = async (req, res, next) => {
  try {
    const payout = await adminFinanceService.requestCaregiverPayout(req.user._id, req.body);
    res.status(201).json({
      success: true,
      data: payout,
      message: 'Payout request successfully submitted and queued for processing',
    });
  } catch (err) {
    next(err);
  }
};
