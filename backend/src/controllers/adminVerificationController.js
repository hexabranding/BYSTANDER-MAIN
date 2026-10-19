import * as adminVerificationService from '../services/adminVerificationService.js';

/**
 * GET /api/admin/verifications
 * Admin lists caregiver profiles and documents awaiting review.
 */
export const getVerifications = async (req, res, next) => {
  try {
    const result = await adminVerificationService.getVerifications(req.query);

    res.status(200).json({
      success: true,
      data: result.verifications,
      pagination: result.pagination,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/admin/verifications/:id
 * Admin retrieves a caregiver verification dossier with all documents and review history.
 */
export const getVerificationById = async (req, res, next) => {
  try {
    const verification = await adminVerificationService.getVerificationById(req.params.id);

    res.status(200).json({
      success: true,
      data: verification,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * PATCH /api/admin/verifications/documents/:documentId
 * Admin approves or rejects an individual document.
 */
export const updateDocumentStatus = async (req, res, next) => {
  try {
    const updatedDoc = await adminVerificationService.updateDocumentStatus(
      req.params.documentId,
      req.body,
      req.user,
    );

    res.status(200).json({
      success: true,
      message: `Document status updated to '${updatedDoc.verificationStatus}'`,
      data: updatedDoc,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * PATCH /api/admin/verifications/:id/status
 * Admin updates the overall verification status of a caregiver profile.
 */
export const updateCaregiverVerificationStatus = async (req, res, next) => {
  try {
    const updatedCaregiver = await adminVerificationService.updateCaregiverVerificationStatus(
      req.params.id,
      req.body,
      req.user,
    );

    res.status(200).json({
      success: true,
      message: `Caregiver verification status updated to '${updatedCaregiver.verificationStatus}'`,
      data: updatedCaregiver,
    });
  } catch (error) {
    next(error);
  }
};
