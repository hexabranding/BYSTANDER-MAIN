import * as complaintService from '../services/complaintService.js';

/**
 * Controller: Submit a new complaint as authenticated user.
 */
export const createComplaint = async (req, res, next) => {
  try {
    const payload = req.sanitizedComplaint || req.body;
    const complaint = await complaintService.createComplaint(req.user, payload);

    res.status(201).json({
      success: true,
      message: `Complaint ${complaint.complaintNumber} registered successfully.`,
      data: complaint,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Controller: List caller's own complaints.
 */
export const getMyComplaints = async (req, res, next) => {
  try {
    const result = await complaintService.getMyComplaints(req.user, req.query);
    res.status(200).json({
      success: true,
      data: result.complaints,
      pagination: result.pagination,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Controller: Retrieve individual complaint details for complainant or respondent.
 */
export const getComplaintById = async (req, res, next) => {
  try {
    const complaint = await complaintService.getComplaintById(req.user, req.params.id);
    res.status(200).json({
      success: true,
      data: complaint,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Controller: Administrative listing of all complaints with stats.
 */
export const getAdminComplaints = async (req, res, next) => {
  try {
    const result = await complaintService.getAdminComplaints(req.query);
    res.status(200).json({
      success: true,
      data: result.complaints,
      pagination: result.pagination,
      stats: result.stats,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Controller: Administrative retrieval of complaint with internal investigation notes.
 */
export const getAdminComplaintById = async (req, res, next) => {
  try {
    const complaint = await complaintService.getAdminComplaintById(req.params.id);
    res.status(200).json({
      success: true,
      data: complaint,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Controller: Administrative update of complaint status and resolution notes.
 */
export const updateComplaintStatus = async (req, res, next) => {
  try {
    const payload = req.sanitizedComplaintUpdate || req.body;
    const updated = await complaintService.updateComplaintStatus(req.params.id, payload, req.user);

    res.status(200).json({
      success: true,
      message: `Complaint status updated to '${updated.status}' successfully.`,
      data: updated,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Controller: Administrative append of internal investigation note.
 */
export const addInternalNote = async (req, res, next) => {
  try {
    const note = req.sanitizedNote || req.body.note;
    const updated = await complaintService.addInternalNote(req.params.id, { note }, req.user);

    res.status(201).json({
      success: true,
      message: 'Internal investigation note added successfully.',
      data: updated,
    });
  } catch (error) {
    next(error);
  }
};
