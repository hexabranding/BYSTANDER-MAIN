import { PlatformSettings, Service } from '../models/index.js';
import {
  getPlatformPricingSettings,
  calculateComprehensiveQuote,
  DEFAULT_PRICING_CONFIG,
} from '../services/pricingService.js';

/**
 * Controller: Get platform pricing configuration & service catalog rates
 * GET /api/admin/pricing
 */
export const getAdminPricing = async (req, res) => {
  try {
    const pricing = await getPlatformPricingSettings();
    const services = await Service.find({})
      .select('_id name category baseHourlyRate minimumDurationHours isActive')
      .sort({ name: 1 })
      .lean();

    res.json({
      success: true,
      pricing,
      services,
    });
  } catch (err) {
    console.error('[AdminPricingController] Failed to fetch pricing settings:', err);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve platform pricing settings',
      error: err.message,
    });
  }
};

/**
 * Controller: Update platform pricing configuration & service catalog rates
 * PUT /api/admin/pricing
 */
export const updateAdminPricing = async (req, res) => {
  try {
    const { pricing, serviceRates } = req.body || {};

    if (!pricing || typeof pricing !== 'object') {
      return res.status(400).json({
        success: false,
        message: 'Invalid request body: pricing object is required',
      });
    }

    // Validate hourly config
    if (pricing.hourly) {
      const initial = Number(pricing.hourly.initialRate);
      const maxCap = Number(pricing.hourly.maxCap);
      if (initial && (initial < 50 || initial > 10000)) {
        return res.status(400).json({
          success: false,
          message: 'Initial caretaker rate must be between ₹50 and ₹10,000',
        });
      }
      if (maxCap && (maxCap < initial || maxCap > 50000)) {
        return res.status(400).json({
          success: false,
          message: 'Maximum price cap must be greater than or equal to initial rate and under ₹50,000',
        });
      }
    }

    // Validate daily config
    if (pricing.daily) {
      const baseDaily = Number(pricing.daily.baseDailyRate);
      const discount = Number(pricing.daily.extraDayDiscount);
      if (baseDaily && baseDaily < 300) {
        return res.status(400).json({
          success: false,
          message: 'Base daily rate must be at least ₹300',
        });
      }
      if (discount < 0) {
        return res.status(400).json({
          success: false,
          message: 'Extra day discount cannot be negative',
        });
      }
    }

    // Update PlatformSettings
    let settings = await PlatformSettings.findOne();
    if (!settings) {
      settings = new PlatformSettings({ pricing });
    } else {
      settings.pricing = {
        ...DEFAULT_PRICING_CONFIG,
        ...(settings.pricing ? (typeof settings.pricing.toObject === 'function' ? settings.pricing.toObject() : settings.pricing) : {}),
        ...pricing,
        hourly: {
          ...DEFAULT_PRICING_CONFIG.hourly,
          ...(settings.pricing?.hourly || {}),
          ...(pricing.hourly || {}),
        },
        daily: {
          ...DEFAULT_PRICING_CONFIG.daily,
          ...(settings.pricing?.daily || {}),
          ...(pricing.daily || {}),
        },
        monthly: {
          ...DEFAULT_PRICING_CONFIG.monthly,
          ...(settings.pricing?.monthly || {}),
          ...(pricing.monthly || {}),
        },
        updatedBy: req.user?._id || null,
      };
    }
    await settings.save();

    // Optionally update individual service rates if provided
    if (Array.isArray(serviceRates) && serviceRates.length > 0) {
      for (const item of serviceRates) {
        if (item.serviceId && typeof item.baseHourlyRate === 'number' && item.baseHourlyRate >= 0) {
          await Service.updateOne(
            { _id: item.serviceId },
            { $set: { baseHourlyRate: Math.round(item.baseHourlyRate) } }
          );
        }
      }
    }

    const updatedPricing = await getPlatformPricingSettings();
    const updatedServices = await Service.find({})
      .select('_id name category baseHourlyRate minimumDurationHours isActive')
      .sort({ name: 1 })
      .lean();

    res.json({
      success: true,
      message: 'Platform pricing and discounts updated successfully',
      pricing: updatedPricing,
      services: updatedServices,
    });
  } catch (err) {
    console.error('[AdminPricingController] Failed to update pricing settings:', err);
    res.status(500).json({
      success: false,
      message: 'Failed to update platform pricing settings',
      error: err.message,
    });
  }
};

/**
 * Controller: Simulate quote based on pricing parameters
 * POST /api/admin/pricing/simulate
 */
export const simulateAdminQuote = async (req, res) => {
  try {
    const { bookingType, hours, days, caregiverReviews, caregiverRating, serviceRate } = req.body || {};

    const pricing = await getPlatformPricingSettings();
    const simulatedCaregiver = {
      rating: {
        count: Number(caregiverReviews) || 0,
        average: Number(caregiverRating) || 5.0,
      },
    };
    const simulatedService = serviceRate ? { baseHourlyRate: Number(serviceRate) } : null;

    const quote = calculateComprehensiveQuote({
      bookingType: bookingType || 'hourly',
      hours: Number(hours) || 2,
      days: Number(days) || 1,
      caregiver: simulatedCaregiver,
      service: simulatedService,
      pricingConfig: pricing,
    });

    res.json({
      success: true,
      quote,
    });
  } catch (err) {
    console.error('[AdminPricingController] Simulation error:', err);
    res.status(500).json({
      success: false,
      message: 'Simulation failed',
      error: err.message,
    });
  }
};

/**
 * Public Endpoint: Get active platform pricing configuration for customers & wizards
 * GET /api/pricing/config
 */
export const getPublicPricingConfig = async (req, res) => {
  try {
    const pricing = await getPlatformPricingSettings();
    res.json({
      success: true,
      pricing: {
        serviceBaseRate: pricing.serviceBaseRate ?? 199,
        hourly: {
          initialRate: pricing.hourly?.initialRate ?? 200,
          maxCap: pricing.hourly?.maxCap ?? 500,
          dynamicPricingEnabled: pricing.hourly?.dynamicPricingEnabled ?? true,
          tiers: pricing.hourly?.tiers || [],
        },
        daily: {
          baseDailyRate: pricing.daily?.baseDailyRate ?? 1500,
          extraDayDiscount: pricing.daily?.extraDayDiscount ?? 250,
        },
        monthly: {
          useFormula: pricing.monthly?.useFormula ?? true,
          fixedPackageRate: pricing.monthly?.fixedPackageRate ?? 37500,
        },
      },
    });
  } catch (err) {
    console.error('[PublicPricingConfig] Error:', err);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve pricing configuration',
      error: err.message,
    });
  }
};

/**
 * Public/Customer Endpoint: Calculate Authoritative Booking Quote
 * POST /api/pricing/quote
 */
export const getPublicBookingQuote = async (req, res) => {
  try {
    const { bookingType, hours, days, caregiverId, serviceId } = req.body || {};

    const pricing = await getPlatformPricingSettings();
    let caregiver = null;
    let service = null;

    if (caregiverId) {
      caregiver = await CaregiverProfile.findById(caregiverId).select('hourlyRate rating').lean();
    }
    if (serviceId) {
      service = await Service.findById(serviceId).select('baseHourlyRate name category').lean();
    }

    const quote = calculateComprehensiveQuote({
      bookingType: bookingType || 'hourly',
      hours: Number(hours) || 2,
      days: Number(days) || 1,
      caregiver,
      service,
      pricingConfig: pricing,
    });

    res.json({
      success: true,
      quote,
    });
  } catch (err) {
    console.error('[PricingQuote] Quote calculation error:', err);
    res.status(500).json({
      success: false,
      message: 'Failed to calculate quote',
      error: err.message,
    });
  }
};

