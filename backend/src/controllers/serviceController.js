import * as serviceCatalogService from '../services/serviceCatalogService.js';

/**
 * GET /api/services
 * Public listing of active services with filtering, search, and pagination.
 */
export const listServices = async (req, res, next) => {
  try {
    const result = await serviceCatalogService.listActiveServices(req.query);

    res.status(200).json({
      success: true,
      data: result.services,
      pagination: result.pagination,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/services/:id
 * Public detail view of a single active service.
 */
export const getService = async (req, res, next) => {
  try {
    const service = await serviceCatalogService.getActiveServiceById(req.params.id);

    res.status(200).json({
      success: true,
      data: service,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/admin/services
 * Create a new service (Admin only).
 */
export const createService = async (req, res, next) => {
  try {
    const service = await serviceCatalogService.createService(req.body, req.user._id);

    res.status(201).json({
      success: true,
      message: 'Service created successfully',
      data: service,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * PATCH /api/admin/services/:id
 * Update service fields (Admin only).
 */
export const updateService = async (req, res, next) => {
  try {
    const service = await serviceCatalogService.updateService(req.params.id, req.body, req.user._id);

    res.status(200).json({
      success: true,
      message: 'Service updated successfully',
      data: service,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * PATCH /api/admin/services/:id/status
 * Toggle/set service active status (Admin only).
 */
export const updateServiceStatus = async (req, res, next) => {
  try {
    const service = await serviceCatalogService.updateServiceStatus(
      req.params.id,
      req.body.isActive,
      req.user._id,
    );

    res.status(200).json({
      success: true,
      message: `Service ${service.isActive ? 'activated' : 'deactivated'} successfully`,
      data: service,
    });
  } catch (error) {
    next(error);
  }
};
