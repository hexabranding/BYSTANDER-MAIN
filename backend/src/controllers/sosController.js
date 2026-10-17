import * as sosService from '../services/sosService.js';

/**
 * POST /api/sos
 * Authenticated customer, assigned caregiver, or admin raises an emergency SOS incident.
 */
export const raiseSos = async (req, res, next) => {
  try {
    const incident = await sosService.raiseSos(req.user, req.sosData);

    res.status(201).json({
      success: true,
      message: 'SOS incident raised successfully',
      data: incident,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/sos
 * List SOS incidents with caller-scoped authorization.
 * Customers and caregivers see incidents for their bookings; admins access operational queue.
 */
export const getSosIncidents = async (req, res, next) => {
  try {
    const result = await sosService.getSosIncidents(req.user, req.query);

    res.status(200).json({
      success: true,
      data: result.incidents,
      pagination: result.pagination,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/sos/:id
 * Retrieve SOS incident details and full audit timeline.
 */
export const getSosById = async (req, res, next) => {
  try {
    const incident = await sosService.getSosById(req.user, req.params.id);

    res.status(200).json({
      success: true,
      data: incident,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * PATCH /api/sos/:id/assign
 * Admin assigns incident to operations desk and transitions status to 'Under Investigation'.
 */
export const assignSos = async (req, res, next) => {
  try {
    const incident = await sosService.assignSos(req.user, req.params.id, req.assignData);

    res.status(200).json({
      success: true,
      message: 'SOS incident assigned successfully',
      data: incident,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/sos/:id/timeline
 * Append an operational note or status event to the incident timeline.
 */
export const addTimelineNote = async (req, res, next) => {
  try {
    const incident = await sosService.addTimelineNote(req.user, req.params.id, req.timelineData);

    res.status(200).json({
      success: true,
      message: 'Timeline note appended successfully',
      data: incident,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * PATCH /api/sos/:id/resolve
 * Admin resolves the incident or marks it as a false alarm with a documented reason.
 */
export const resolveSos = async (req, res, next) => {
  try {
    const incident = await sosService.resolveSos(req.user, req.params.id, req.resolveData);

    res.status(200).json({
      success: true,
      message: 'SOS incident resolved successfully',
      data: incident,
    });
  } catch (error) {
    next(error);
  }
};
