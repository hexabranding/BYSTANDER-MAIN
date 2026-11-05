import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import {
  DEFAULT_PRICING_CONFIG,
  calculateCaregiverHourlyRate,
  calculateMultiDayDiscount,
  calculateMonthlyPackage,
  calculateComprehensiveQuote,
} from '../src/services/pricingService.js';

describe('Pricing Engine & Review Milestone Tiers', () => {
  test('New caretaker with 0 reviews starts at base initial price (₹200/hr)', () => {
    const res = calculateCaregiverHourlyRate({ rating: { count: 0, average: 5.0 } });
    assert.equal(res.rate, 200);
    assert.equal(res.tier, null);
    assert.equal(res.isCapped, false);
  });

  test('Caretaker with 29 reviews remains at base rate', () => {
    const res = calculateCaregiverHourlyRate({ rating: { count: 29, average: 5.0 } });
    assert.equal(res.rate, 200);
    assert.equal(res.tier, null);
  });

  test('Tier 1: 30+ reviews with >= 4.7 stars unlocks ₹275/hr (Silver)', () => {
    const res = calculateCaregiverHourlyRate({ rating: { count: 30, average: 4.8 } });
    assert.equal(res.rate, 275);
    assert.equal(res.tier?.label, 'Silver');
  });

  test('Tier 1 blocked if rating is below 4.7 stars', () => {
    const res = calculateCaregiverHourlyRate({ rating: { count: 40, average: 4.2 } });
    assert.equal(res.rate, 200);
    assert.equal(res.tier, null);
  });

  test('Tier 2: 50+ reviews with >= 4.8 stars unlocks ₹350/hr (Gold)', () => {
    const res = calculateCaregiverHourlyRate({ rating: { count: 55, average: 4.9 } });
    assert.equal(res.rate, 350);
    assert.equal(res.tier?.label, 'Gold');
  });

  test('Tier 3: 70+ reviews with >= 4.8 stars unlocks ₹425/hr (Diamond)', () => {
    const res = calculateCaregiverHourlyRate({ rating: { count: 72, average: 4.85 } });
    assert.equal(res.rate, 425);
    assert.equal(res.tier?.label, 'Diamond');
  });

  test('Tier 4: 90+ reviews with >= 4.8 stars reaches maximum cap ₹500/hr (Platinum)', () => {
    const res = calculateCaregiverHourlyRate({ rating: { count: 120, average: 5.0 } });
    assert.equal(res.rate, 500);
    assert.equal(res.tier?.label, 'Platinum');
    assert.equal(res.isCapped, true);
  });

  test('Rate is strictly capped at maxCap ceiling even with high custom rates', () => {
    const res = calculateCaregiverHourlyRate(
      { hourlyRate: 900, rating: { count: 10, average: 5.0 } },
      { ...DEFAULT_PRICING_CONFIG, hourly: { ...DEFAULT_PRICING_CONFIG.hourly, maxCap: 500 } }
    );
    assert.equal(res.rate, 500);
  });
});

describe('Daily & Multi-Day Progressive Discount Engine', () => {
  test('1 Day: Standard base rate of ₹1,500 with zero discount', () => {
    const res = calculateMultiDayDiscount(1);
    assert.equal(res.days, 1);
    assert.equal(res.gross, 1500);
    assert.equal(res.discount, 0);
    assert.equal(res.net, 1500);
    assert.equal(res.avgPerDay, 1500);
  });

  test('2 Days: ₹3,000 gross with -₹250 discount = ₹2,750 net', () => {
    const res = calculateMultiDayDiscount(2);
    assert.equal(res.days, 2);
    assert.equal(res.gross, 3000);
    assert.equal(res.discount, 250);
    assert.equal(res.net, 2750);
    assert.equal(res.avgPerDay, 1375);
  });

  test('3 Days: ₹4,500 gross with -₹500 discount = ₹4,000 net', () => {
    const res = calculateMultiDayDiscount(3);
    assert.equal(res.days, 3);
    assert.equal(res.gross, 4500);
    assert.equal(res.discount, 500);
    assert.equal(res.net, 4000);
    assert.equal(res.avgPerDay, 1333);
  });

  test('7 Days (1 Week): ₹10,500 gross with -₹1,500 discount = ₹9,000 net', () => {
    const res = calculateMultiDayDiscount(7);
    assert.equal(res.days, 7);
    assert.equal(res.gross, 10500);
    assert.equal(res.discount, 1500);
    assert.equal(res.net, 9000);
    assert.equal(res.avgPerDay, 1286);
  });

  test('30 Days: Full progressive discount results in ₹37,750 net (~₹1,258/day)', () => {
    const res = calculateMultiDayDiscount(30, {
      baseDailyRate: 1500,
      extraDayDiscount: 250,
    });
    assert.equal(res.days, 30);
    assert.equal(res.gross, 45000);
    assert.equal(res.discount, 7250);
    assert.equal(res.net, 37750);
    assert.equal(res.avgPerDay, 1258);
  });
});

describe('Monthly Package & Comprehensive Quote Calculator', () => {
  test('Monthly package calculates ₹37,750 with progressive formula', () => {
    const res = calculateMonthlyPackage(DEFAULT_PRICING_CONFIG);
    assert.equal(res.days, 30);
    assert.equal(res.net, 37750);
  });

  test('Comprehensive quote for hourly booking includes platform fee and GST', () => {
    const quote = calculateComprehensiveQuote({
      bookingType: 'hourly',
      hours: 4,
      caregiver: { rating: { count: 0, average: 5.0 } },
      pricingConfig: DEFAULT_PRICING_CONFIG,
    });
    // 4 hours * 200 = 800
    assert.equal(quote.baseAmount, 800);
    assert.equal(quote.platformFee, 49);
    // (800 + 49) * 0.18 = 152.82 -> 153
    assert.equal(quote.tax, 153);
    assert.equal(quote.totalAmount, 800 + 49 + 153);
  });

  test('Comprehensive quote for 3-day booking includes multi-day discount', () => {
    const quote = calculateComprehensiveQuote({
      bookingType: 'daily',
      days: 3,
      pricingConfig: DEFAULT_PRICING_CONFIG,
    });
    assert.equal(quote.days, 3);
    assert.equal(quote.grossAmount, 4500);
    assert.equal(quote.discountAmount, 500);
    assert.equal(quote.baseAmount, 4000);
  });
});

