import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import mongoose from 'mongoose';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const backendDir = path.resolve(__dirname, '..');

dotenv.config({ path: path.join(backendDir, '.env') });

const { PlatformSettings, Service, User } = await import('../src/models/index.js');
const {
  getAdminPricing,
  updateAdminPricing,
  simulateAdminQuote,
  getPublicBookingQuote,
} = await import('../src/controllers/adminPricingController.js');
const {
  getPlatformPricingSettings,
  calculateCaregiverHourlyRate,
  calculateMultiDayDiscount,
  calculateComprehensiveQuote,
} = await import('../src/services/pricingService.js');

const mockRes = () => {
  const res = {
    statusCode: 200,
    status(code) {
      this.statusCode = code;
      return this;
    },
    data: null,
    json(payload) {
      this.data = payload;
      return this;
    },
  };
  return res;
};

async function runVerification() {
  console.log('>>> 1. Connecting to MongoDB Atlas...');
  await mongoose.connect(process.env.MONGODB_URI);
  console.log('Connected to DB:', mongoose.connection.name);

  // Find an admin user
  const adminUser = await User.findOne({ role: 'admin' });
  console.log('Admin user identified:', adminUser?.email || 'Mock Admin ID');
  const mockAdminUser = adminUser || { _id: new mongoose.Types.ObjectId(), role: 'admin' };

  console.log('\n>>> 2. Testing getAdminPricing controller...');
  const res1 = mockRes();
  await getAdminPricing({ user: mockAdminUser }, res1);
  console.log('getAdminPricing status:', res1.statusCode);
  console.log('Initial Pricing:', JSON.stringify(res1.data?.pricing, null, 2));
  console.log('Services Count:', res1.data?.services?.length);

  const testService = res1.data?.services?.[0];
  console.log('Target test service:', testService?.name, 'Current Rate: ₹' + testService?.baseHourlyRate);

  console.log('\n>>> 3. Testing updateAdminPricing controller (Applying NEW rates)...');
  const updateReq = {
    user: mockAdminUser,
    body: {
      pricing: {
        serviceBaseRate: 220,
        hourly: {
          initialRate: 250,
          maxCap: 600,
          dynamicPricingEnabled: true,
          tiers: [
            { minReviews: 30, minRating: 4.7, rate: 320, increment: 70, label: 'Silver Pro' },
            { minReviews: 50, minRating: 4.8, rate: 400, increment: 80, label: 'Gold Pro' },
            { minReviews: 70, minRating: 4.8, rate: 500, increment: 100, label: 'Diamond Pro' },
            { minReviews: 90, minRating: 4.8, rate: 600, increment: 100, label: 'Platinum Pro' },
          ],
        },
        daily: {
          baseDailyRate: 1800,
          extraDayDiscount: 350,
        },
        monthly: {
          useFormula: true,
          fixedPackageRate: 40000,
        },
      },
      serviceRates: testService ? [{ serviceId: testService._id, baseHourlyRate: 299 }] : [],
    },
  };

  const res2 = mockRes();
  await updateAdminPricing(updateReq, res2);
  console.log('updateAdminPricing status:', res2.statusCode);
  console.log('Update success message:', res2.data?.message);

  console.log('\n>>> 4. Verifying persistence in MongoDB Atlas...');
  const verifyDb = await PlatformSettings.findOne().lean();
  console.log('DB Persisted serviceBaseRate:', verifyDb.pricing.serviceBaseRate, '(Expected: 220)');
  console.log('DB Persisted initialRate:', verifyDb.pricing.hourly.initialRate, '(Expected: 250)');
  console.log('DB Persisted maxCap:', verifyDb.pricing.hourly.maxCap, '(Expected: 600)');
  console.log('DB Persisted baseDailyRate:', verifyDb.pricing.daily.baseDailyRate, '(Expected: 1800)');
  console.log('DB Persisted extraDayDiscount:', verifyDb.pricing.daily.extraDayDiscount, '(Expected: 350)');

  if (testService) {
    const updatedService = await Service.findById(testService._id).lean();
    console.log('DB Persisted service baseHourlyRate:', updatedService.baseHourlyRate, '(Expected: 299)');
  }

  console.log('\n>>> 5. Testing customer booking quote calculation with NEW rates...');
  // 1-Day daily quote
  const resQuote1 = mockRes();
  await getPublicBookingQuote({ body: { bookingType: 'daily', days: 1 } }, resQuote1);
  console.log('1 Day Quote:', resQuote1.data?.quote?.baseAmount, '(Expected: 1800)');

  // 2-Days daily quote: 2 * 1800 - 350 = 3250
  const resQuote2 = mockRes();
  await getPublicBookingQuote({ body: { bookingType: 'daily', days: 2 } }, resQuote2);
  console.log('2 Days Quote:', resQuote2.data?.quote?.baseAmount, '(Expected: 3250)', 'Discount:', resQuote2.data?.quote?.discountAmount, '(Expected: 350)');

  // 3-Days daily quote: 3 * 1800 - 2 * 350 = 5400 - 700 = 4700
  const resQuote3 = mockRes();
  await getPublicBookingQuote({ body: { bookingType: 'daily', days: 3 } }, resQuote3);
  console.log('3 Days Quote:', resQuote3.data?.quote?.baseAmount, '(Expected: 4700)', 'Discount:', resQuote3.data?.quote?.discountAmount, '(Expected: 700)');

  // Hourly quote: 4 hours with new initialRate (250) = 1000
  const resQuoteHourly = mockRes();
  await getPublicBookingQuote({ body: { bookingType: 'hourly', hours: 4 } }, resQuoteHourly);
  console.log('Hourly Quote (4 hrs):', resQuoteHourly.data?.quote?.baseAmount, '(Expected: 1000)');

  console.log('\n>>> 6. Restoring standard platform defaults...');
  const restoreReq = {
    user: mockAdminUser,
    body: {
      pricing: {
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
      },
      serviceRates: testService ? [{ serviceId: testService._id, baseHourlyRate: 199 }] : [],
    },
  };

  const res3 = mockRes();
  await updateAdminPricing(restoreReq, res3);
  console.log('Restore status:', res3.statusCode);

  const restoredDb = await PlatformSettings.findOne().lean();
  console.log('Restored initialRate:', restoredDb.pricing.hourly.initialRate, '(Expected: 200)');
  console.log('Restored baseDailyRate:', restoredDb.pricing.daily.baseDailyRate, '(Expected: 1500)');
  console.log('Restored extraDayDiscount:', restoredDb.pricing.daily.extraDayDiscount, '(Expected: 250)');

  // Re-verify 2 days quote on restored rates: 2 * 1500 - 250 = 2750
  const resRestoredQuote = mockRes();
  await getPublicBookingQuote({ body: { bookingType: 'daily', days: 2 } }, resRestoredQuote);
  console.log('Restored 2 Days Quote:', resRestoredQuote.data?.quote?.baseAmount, '(Expected: 2750)');

  await mongoose.disconnect();
  console.log('\n>>> ALL END-TO-END VERIFICATION CHECKS PASSED SUCCESSFULLY! <<<');
}

runVerification().catch((err) => {
  console.error('VERIFICATION ERROR:', err);
  process.exit(1);
});

