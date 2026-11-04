import * as geoService from '../services/geoService.js';

/**
 * GET /api/geo/reverse
 * Reverse geocode latitude and longitude into normalized Indian address.
 */
export const reverseGeocode = async (req, res, next) => {
  try {
    const { lat, lng } = req.query;
    const addressData = await geoService.reverseGeocode(lat, lng);

    res.status(200).json({
      success: true,
      data: addressData,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/geo/forward
 * Forward geocode a typed address, town, or pincode into coordinates.
 */
export const forwardGeocode = async (req, res, next) => {
  try {
    const { q, address, street, area, locality, city, district, state, pincode } = req.query;
    const geoData = await geoService.forwardGeocode({
      q,
      address,
      street,
      area,
      locality,
      city,
      district,
      state,
      pincode,
    });

    res.status(200).json({
      success: true,
      data: geoData,
    });
  } catch (error) {
    next(error);
  }
};
