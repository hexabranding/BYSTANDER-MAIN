import mongoose from 'mongoose';
import { Service } from '../models/Service.js';
import { slugify } from '../utils/slugify.js';

// Public field projection
const PUBLIC_SERVICE_FIELDS =
  '_id name slug description category features baseHourlyRate minimumDurationHours isActive createdAt updatedAt';

/**
 * Escape special characters in search string for safe regex matching
 */
const escapeRegex = (string) => string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/**
 * List active services for public view with search, category filter, and pagination.
 */
export const listActiveServices = async (queryOptions = {}) => {
  const { category, search, page = 1, limit = 10, sort = 'createdAt:desc' } = queryOptions;

  // Strict constraint: public listings only show active services
  const filter = { isActive: true };

  // Category filter
  if (category && typeof category === 'string' && category.trim()) {
    filter.category = new RegExp('^' + escapeRegex(category.trim()) + '$', 'i');
  }

  // Text search filter across name, description, category, and features
  if (search && typeof search === 'string' && search.trim()) {
    const escapedSearch = escapeRegex(search.trim());
    filter.$or = [
      { name: { $regex: escapedSearch, $options: 'i' } },
      { description: { $regex: escapedSearch, $options: 'i' } },
      { category: { $regex: escapedSearch, $options: 'i' } },
      { features: { $elemMatch: { $regex: escapedSearch, $options: 'i' } } },
    ];
  }

  // Pagination parameters with strict bounds
  const parsedPage = Math.max(1, parseInt(page, 10) || 1);
  const parsedLimit = Math.min(50, Math.max(1, parseInt(limit, 10) || 10)); // max 50
  const skip = (parsedPage - 1) * parsedLimit;

  // Sort parameter parsing
  const sortOptions = {};
  if (sort && typeof sort === 'string') {
    const [field, direction] = sort.split(':');
    const allowedSortFields = ['baseHourlyRate', 'name', 'createdAt', 'minimumDurationHours'];
    if (allowedSortFields.includes(field)) {
      sortOptions[field] = direction === 'asc' ? 1 : -1;
    } else {
      sortOptions.createdAt = -1;
    }
  } else {
    sortOptions.createdAt = -1;
  }

  const [services, total] = await Promise.all([
    Service.find(filter).select(PUBLIC_SERVICE_FIELDS).sort(sortOptions).skip(skip).limit(parsedLimit),
    Service.countDocuments(filter),
  ]);

  const totalPages = Math.ceil(total / parsedLimit) || 1;

  return {
    services,
    pagination: {
      page: parsedPage,
      limit: parsedLimit,
      total,
      totalPages,
      hasNextPage: parsedPage < totalPages,
      hasPrevPage: parsedPage > 1,
    },
  };
};

/**
 * Retrieve a single active service by its MongoDB ObjectId.
 */
export const getActiveServiceById = async (id) => {
  if (!mongoose.Types.ObjectId.isValid(id)) {
    const err = new Error('Invalid service identifier');
    err.statusCode = 400;
    err.name = 'ValidationError';
    throw err;
  }

  const service = await Service.findOne({ _id: id, isActive: true }).select(PUBLIC_SERVICE_FIELDS);

  if (!service) {
    const err = new Error('Service not found or is currently inactive');
    err.statusCode = 404;
    err.name = 'NotFoundError';
    throw err;
  }

  return service;
};

/**
 * Create a new service (Admin only).
 */
export const createService = async (payload, adminUserId) => {
  const { name, slug, description, category, features, baseHourlyRate, minimumDurationHours, isActive } =
    payload;

  // Determine normalized slug
  const targetSlug = slugify(slug || name);
  if (!targetSlug) {
    const err = new Error('Could not generate a valid slug from the provided name or slug');
    err.statusCode = 400;
    err.name = 'ValidationError';
    throw err;
  }

  // Check for duplicate slug
  const existing = await Service.findOne({ slug: targetSlug });
  if (existing) {
    const err = new Error(`A service with the slug '${targetSlug}' already exists`);
    err.statusCode = 409;
    err.name = 'ConflictError';
    throw err;
  }

  const service = await Service.create({
    name: name.trim(),
    slug: targetSlug,
    description: description.trim(),
    category: category.trim(),
    features: Array.isArray(features) ? features.map((f) => String(f).trim()).filter(Boolean) : [],
    baseHourlyRate: Number(baseHourlyRate),
    minimumDurationHours: minimumDurationHours ? Math.max(1, Number(minimumDurationHours)) : 1,
    isActive: isActive !== undefined ? Boolean(isActive) : true,
    createdBy: adminUserId,
    updatedBy: adminUserId,
  });

  return service;
};

/**
 * Update service fields (Admin only).
 */
export const updateService = async (id, updates, adminUserId) => {
  if (!mongoose.Types.ObjectId.isValid(id)) {
    const err = new Error('Invalid service identifier');
    err.statusCode = 400;
    err.name = 'ValidationError';
    throw err;
  }

  const service = await Service.findById(id);
  if (!service) {
    const err = new Error('Service not found');
    err.statusCode = 404;
    err.name = 'NotFoundError';
    throw err;
  }

  // Security: Prevent overriding protected audit or identity fields
  delete updates._id;
  delete updates.createdBy;
  delete updates.updatedBy;
  delete updates.createdAt;
  delete updates.updatedAt;

  // Handle slug change / name change
  if (updates.slug || updates.name) {
    const newSlug = slugify(updates.slug || updates.name);
    if (newSlug && newSlug !== service.slug) {
      const existing = await Service.findOne({ slug: newSlug, _id: { $ne: id } });
      if (existing) {
        const err = new Error(`A service with the slug '${newSlug}' already exists`);
        err.statusCode = 409;
        err.name = 'ConflictError';
        throw err;
      }
      updates.slug = newSlug;
    }
  }

  // Sanitize updates
  if (updates.name) service.name = updates.name.trim();
  if (updates.slug) service.slug = updates.slug;
  if (updates.description) service.description = updates.description.trim();
  if (updates.category) service.category = updates.category.trim();
  if (updates.features && Array.isArray(updates.features)) {
    service.features = updates.features.map((f) => String(f).trim()).filter(Boolean);
  }
  if (updates.baseHourlyRate !== undefined) {
    service.baseHourlyRate = Number(updates.baseHourlyRate);
  }
  if (updates.minimumDurationHours !== undefined) {
    service.minimumDurationHours = Math.max(1, Number(updates.minimumDurationHours));
  }
  if (updates.isActive !== undefined) {
    service.isActive = Boolean(updates.isActive);
  }

  service.updatedBy = adminUserId;
  await service.save();

  return service;
};

/**
 * Toggle or set service active status (Deactivation pattern instead of deletion).
 */
export const updateServiceStatus = async (id, isActive, adminUserId) => {
  if (!mongoose.Types.ObjectId.isValid(id)) {
    const err = new Error('Invalid service identifier');
    err.statusCode = 400;
    err.name = 'ValidationError';
    throw err;
  }

  const service = await Service.findById(id);
  if (!service) {
    const err = new Error('Service not found');
    err.statusCode = 404;
    err.name = 'NotFoundError';
    throw err;
  }

  service.isActive = Boolean(isActive);
  service.updatedBy = adminUserId;
  await service.save();

  return service;
};
