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
