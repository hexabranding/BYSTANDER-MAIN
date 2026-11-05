import { PlatformSettings, Service, CaregiverProfile } from '../models/index.js';

export const DEFAULT_PRICING_CONFIG = {
  serviceBaseRate: 199,
  hourly: {
    initialRate: 200,
    maxCap: 500,
    dynamicPricingEnabled: true,
    tiers: [
      { minReviews: 30, minRating: 4.7, rate: 275, increment: 75, label: 'Silver' },
      { minReviews: 50, minRating: 4.8, rate: 350, increment: 75, label: 'Gold' },
      { minReviews: 70, minRating: 4.8, rate: 425, increment: 75, label: 'Diamond' },
      { minReviews: 90, minRating: 4.8, rate: 500, increment: 75, label: 'Platinum' },
    ],
  },
  daily: {
    baseDailyRate: 1500,
    extraDayDiscount: 250,
  },
  monthly: {
    useFormula: true,
    fixedPackageRate: 37500,
  },
};

/**
 * Retrieves the platform pricing configuration from MongoDB, with fallback defaults.
 */
export const getPlatformPricingSettings = async () => {
  try {
    let settings = await PlatformSettings.findOne().lean();
    if (!settings) {
      const created = await PlatformSettings.create({ pricing: DEFAULT_PRICING_CONFIG });
      return created.pricing || DEFAULT_PRICING_CONFIG;
    }
    if (!settings.pricing || !settings.pricing.hourly) {
      await PlatformSettings.updateOne(
        { _id: settings._id },
        { $set: { pricing: DEFAULT_PRICING_CONFIG } }
      );
      return DEFAULT_PRICING_CONFIG;
    }
    return {
      serviceBaseRate: settings.pricing.serviceBaseRate ?? DEFAULT_PRICING_CONFIG.serviceBaseRate,
      hourly: {
        initialRate: settings.pricing.hourly?.initialRate ?? DEFAULT_PRICING_CONFIG.hourly.initialRate,
        maxCap: settings.pricing.hourly?.maxCap ?? DEFAULT_PRICING_CONFIG.hourly.maxCap,
        dynamicPricingEnabled: settings.pricing.hourly?.dynamicPricingEnabled ?? true,
        tiers: Array.isArray(settings.pricing.hourly?.tiers) && settings.pricing.hourly.tiers.length > 0
          ? settings.pricing.hourly.tiers
          : DEFAULT_PRICING_CONFIG.hourly.tiers,
      },
      daily: {
        baseDailyRate: settings.pricing.daily?.baseDailyRate ?? DEFAULT_PRICING_CONFIG.daily.baseDailyRate,
        extraDayDiscount: settings.pricing.daily?.extraDayDiscount ?? DEFAULT_PRICING_CONFIG.daily.extraDayDiscount,
      },
      monthly: {
        useFormula: settings.pricing.monthly?.useFormula ?? true,
        fixedPackageRate: settings.pricing.monthly?.fixedPackageRate ?? DEFAULT_PRICING_CONFIG.monthly.fixedPackageRate,
      },
    };
  } catch (err) {
    console.warn('[PricingService] Falling back to default pricing config:', err.message);
    return DEFAULT_PRICING_CONFIG;
  }
};

/**
 * Calculates a caretaker's effective hourly rate based on review milestones and 5-star quality.
 *
 * @param {Object} caregiver - Caregiver profile document or object
 * @param {Object} pricing - Active pricing configuration
 * @returns {Object} { rate, tier, isCapped, ratingCount, ratingAvg }
 */
export const calculateCaregiverHourlyRate = (caregiver = {}, pricing = DEFAULT_PRICING_CONFIG) => {
  const hourlyConfig = pricing.hourly || DEFAULT_PRICING_CONFIG.hourly;
  const initialRate = Number(hourlyConfig.initialRate) || 200;
  const maxCap = Number(hourlyConfig.maxCap) || 500;

  const ratingCount = caregiver?.rating?.count || caregiver?.reviewCount || 0;
  const ratingAvg = caregiver?.rating?.average !== undefined ? caregiver.rating.average : 5.0;

  if (!hourlyConfig.dynamicPricingEnabled) {
    const staticRate = Math.min(maxCap, Math.max(initialRate, Number(caregiver?.hourlyRate) || initialRate));
    return {
      rate: staticRate,
      tier: null,
      isCapped: staticRate >= maxCap,
      ratingCount,
      ratingAvg,
    };
  }

  // Sort tiers ascending by minReviews to find the highest unlocked tier
  const tiers = [...(hourlyConfig.tiers || [])].sort((a, b) => a.minReviews - b.minReviews);
  let matchedTier = null;

  for (const tier of tiers) {
    if (ratingCount >= tier.minReviews && ratingAvg >= (tier.minRating || 4.7)) {
      matchedTier = tier;
    }
  }

  let computedRate = matchedTier ? tierRateOrIncrement(initialRate, matchedTier) : initialRate;

  // If the caregiver's profile has a higher custom rate, respect it up to maxCap
  if (caregiver?.hourlyRate && caregiver.hourlyRate > computedRate) {
    computedRate = caregiver.hourlyRate;
  }

  const finalRate = Math.min(maxCap, Math.max(initialRate, Math.round(computedRate)));

  return {
    rate: finalRate,
    tier: matchedTier,
    isCapped: finalRate >= maxCap,
    ratingCount,
    ratingAvg,
  };
};

function tierRateOrIncrement(baseRate, tier) {
  if (tier.rate) return Number(tier.rate);
  if (tier.increment) return baseRate + Number(tier.increment);
  return baseRate;
}

/**
 * Calculates multi-day progressive discount:
 * Total = (N * baseDailyRate) - ((N - 1) * extraDayDiscount)
 */
export const calculateMultiDayDiscount = (days = 1, dailyConfig = DEFAULT_PRICING_CONFIG.daily) => {
  const d = Math.max(1, Math.round(Number(days) || 1));
  const base = Number(dailyConfig.baseDailyRate) || 1500;
  const discountStep = Number(dailyConfig.extraDayDiscount) || 250;

  const gross = d * base;
  const rawDiscount = Math.max(0, (d - 1) * discountStep);
  const net = Math.max(0, gross - rawDiscount);

  return {
    days: d,
    baseDailyRate: base,
    gross,
    discount: rawDiscount,
    net,
    avgPerDay: Math.round(net / d),
  };
};

/**
 * Calculates 30-day monthly package pricing.
 */
export const calculateMonthlyPackage = (pricingConfig = DEFAULT_PRICING_CONFIG) => {
  const monthlyConfig = pricingConfig.monthly || DEFAULT_PRICING_CONFIG.monthly;
  const dailyConfig = pricingConfig.daily || DEFAULT_PRICING_CONFIG.daily;
  const base = Number(dailyConfig.baseDailyRate) || 1500;
  const gross = 30 * base;

  if (monthlyConfig.useFormula) {
    const res = calculateMultiDayDiscount(30, dailyConfig);
    return {
      days: 30,
      mode: 'formula',
      gross: res.gross,
      discount: res.discount,
      net: res.net,
      avgPerDay: res.avgPerDay,
    };
  }

  const net = Number(monthlyConfig.fixedPackageRate) || 37500;
  const discount = Math.max(0, gross - net);
  return {
    days: 30,
    mode: 'fixed',
    gross,
    discount,
    net,
    avgPerDay: Math.round(net / 30),
  };
};

/**
 * Master quote calculator for all booking durations: hourly, daily, monthly.
 */
export const calculateComprehensiveQuote = ({
  bookingType = 'hourly',
  hours = 2,
  days = 1,
  caregiver = null,
  service = null,
  pricingConfig = null,
}) => {
  const cfg = pricingConfig || DEFAULT_PRICING_CONFIG;
  const platformFee = 49;
  const gstRate = 0.18;
  const commissionRate = 0.12;

  let baseAmount = 0;
  let grossAmount = 0;
  let discountAmount = 0;
  let effectiveHourlyRate = cfg.hourly?.initialRate || 200;
  let tierInfo = null;
  let daysCount = 1;
  let hoursCount = 2;

  if (bookingType === 'daily') {
    daysCount = Math.max(1, Math.round(Number(days) || 1));
    hoursCount = daysCount * 24;
    const dailyResult = calculateMultiDayDiscount(daysCount, cfg.daily);
    grossAmount = dailyResult.gross;
    discountAmount = dailyResult.discount;
    baseAmount = dailyResult.net;
    effectiveHourlyRate = Math.round(dailyResult.net / hoursCount);
  } else if (bookingType === 'monthly') {
    daysCount = 30;
    hoursCount = 30 * 24;
    const monthlyResult = calculateMonthlyPackage(cfg);
    grossAmount = monthlyResult.gross;
    discountAmount = monthlyResult.discount;
    baseAmount = monthlyResult.net;
    effectiveHourlyRate = Math.round(monthlyResult.net / hoursCount);
  } else {
    // Hourly
    hoursCount = Math.max(2, Math.round(Number(hours) || 2));
    daysCount = 1;
    const tierResult = calculateCaregiverHourlyRate(caregiver, cfg);
    effectiveHourlyRate = tierResult.rate;
    tierInfo = tierResult.tier;

    // If a service has a higher base hourly rate, ensure it is covered
    if (service?.baseHourlyRate && service.baseHourlyRate > effectiveHourlyRate) {
      effectiveHourlyRate = service.baseHourlyRate;
    }

    baseAmount = Math.round(effectiveHourlyRate * hoursCount);
    grossAmount = baseAmount;
    discountAmount = 0;
  }

  const commission = Math.round(baseAmount * commissionRate);
  const caregiverPayout = baseAmount - commission;
  const tax = Math.round((baseAmount + platformFee) * gstRate);
  const totalAmount = baseAmount + platformFee + tax;

  return {
    bookingType,
    hours: hoursCount,
    days: daysCount,
    effectiveHourlyRate,
    grossAmount,
    discountAmount,
    baseAmount,
    platformFee,
    tax,
    totalAmount,
    caregiverPayout,
    commission,
    tier: tierInfo,
  };
};

