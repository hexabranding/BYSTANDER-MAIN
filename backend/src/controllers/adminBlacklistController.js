import * as adminBlacklistService from '../services/adminBlacklistService.js';

/**
 * Controller: List all blacklist entries with pagination, search, and live summary stats.
 */
export const getBlacklist = async (req, res, next) => {
  try {
    const result = await adminBlacklistService.getBlacklistEntries(req.query);
    res.status(200).json({
      success: true,
      data: result.entries,
      stats: result.stats,
      pagination: result.pagination,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Controller: Add an account to the blacklist and enforce platform-wide block.
 */
export const addToBlacklist = async (req, res, next) => {
  try {
    const result = await adminBlacklistService.addBlacklistEntry(req.body, req.user);
    res.status(201).json({
      success: true,
      data: result,
      message: 'Account successfully added to blacklist',
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Controller: Remove an account from the blacklist and restore access.
 */
export const removeFromBlacklist = async (req, res, next) => {
  try {
    const result = await adminBlacklistService.removeBlacklistEntry(req.params.id, req.body, req.user);
    res.status(200).json({
      success: true,
      ...result,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Controller: List registered user candidates for blacklist selection.
 */
export const getCandidates = async (req, res, next) => {
  try {
    const candidates = await adminBlacklistService.searchRegisteredCandidates(req.query.search);
    res.status(200).json({
      success: true,
      data: candidates,
    });
  } catch (error) {
    next(error);
  }
};
