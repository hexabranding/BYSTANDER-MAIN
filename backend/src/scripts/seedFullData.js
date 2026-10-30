import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import {
  User,
  CustomerProfile,
  CaregiverProfile,
  Service,
  Booking,
  Transaction,
  Review,
  Message,
} from '../models/index.js';
import { hashPassword } from '../utils/auth.js';
import { seedDatabase } from './seed.js';

dotenv.config();

/**
 * Rich demo caregiver definitions for realistic showcase and QA filtering across cities.
 */
const DEMO_CAREGIVERS = [
  {
    name: 'Rajesh Nair',
    email: 'rajesh.nair@example.com',
    phone: '+919820112233',
    gender: 'Male',
    avatar: 'https://randomuser.me/api/portraits/men/32.jpg',
    qualification: 'GNM',
    nursingRegNo: 'KL-NUR-2016-1182',
    experienceYears: 12,
    rating: { average: 4.8, count: 214 },
    hourlyRate: 720,
    services: ['Night-Duty Care', 'Bedridden Patient Care', 'Mobility Assistance'],
    languages: ['English', 'Hindi', 'Malayalam'],
    city: 'Mumbai, MH',
    area: 'Andheri West',
    maxDistanceKm: 25,
    careSettings: ['Home Care', 'Hospital Care'],
    bio: 'Senior male nurse with deep expertise in night-vigil care, post-stroke mobilization, and tracheostomy bedside support.',
    trustScore: 97,
    completedJobs: 214,
    badges: ['Top Rated', 'Night Shift Specialist', 'ID Verified'],
  },
  {
    name: 'Pooja Sharma',
    email: 'pooja.sharma.care@example.com',
    phone: '+919820223344',
    gender: 'Female',
    avatar: 'https://randomuser.me/api/portraits/women/68.jpg',
    qualification: 'Certified Elder Care Giver',
    nursingRegNo: 'MH-ELDER-2020-0981',
    experienceYears: 7,
    rating: { average: 4.9, count: 98 },
    hourlyRate: 420,
    services: ['Companionship', 'Medication Reminders', 'Feeding & Hygiene Support'],
    languages: ['English', 'Hindi', 'Marathi'],
    city: 'Pune, MH',
    area: 'Kothrud',
    maxDistanceKm: 18,
    careSettings: ['Home Care'],
    bio: 'Specialised geriatric caregiver certified by the National Institute of Social Defence. Warm, conversational, and attentive.',
    trustScore: 95,
    completedJobs: 98,
    badges: ['Dementia Trained', 'Background Checked', 'ID Verified'],
  },
  {
    name: 'Mary Joseph',
    email: 'mary.joseph@example.com',
    phone: '+919820334455',
    gender: 'Female',
    avatar: 'https://randomuser.me/api/portraits/women/65.jpg',
    qualification: 'BSc Nursing',
    nursingRegNo: 'KA-NUR-2015-3321',
    experienceYears: 10,
    rating: { average: 4.95, count: 186 },
    hourlyRate: 699,
    services: ['Patient Monitoring', 'Post-Surgery Care', 'Dementia & Alzheimer’s Support'],
    languages: ['English', 'Kannada', 'Tamil', 'Hindi'],
    city: 'Bengaluru, KA',
    area: 'Indiranagar',
    maxDistanceKm: 22,
    careSettings: ['Home Care', 'Hospital Care'],
    bio: 'Ten years across Apollo and Manipal hospital cardiac recovery units. Calm bedside presence, meticulous reporting.',
    trustScore: 99,
    completedJobs: 186,
    badges: ['Hospital Care Expert', 'Nursing Council Registered', 'Top Rated'],
  },
  {
    name: 'Suresh Kumar',
    email: 'suresh.kumar@example.com',
    phone: '+919820445566',
    gender: 'Male',
    avatar: 'https://randomuser.me/api/portraits/men/75.jpg',
    qualification: 'ANM',
    nursingRegNo: 'DL-NUR-2017-7729',
    experienceYears: 8,
    rating: { average: 4.7, count: 74 },
    hourlyRate: 499,
    services: ['Mobility Assistance', 'Feeding & Hygiene Support', 'Patient Monitoring'],
    languages: ['English', 'Hindi', 'Punjabi'],
    city: 'Delhi NCR',
    area: 'Dwarka',
    maxDistanceKm: 20,
    careSettings: ['Home Care'],
    bio: 'Experienced male healthcare assistant specialising in mobility, transfer safely from bed to wheelchair, and daily vitals monitoring.',
    trustScore: 93,
    completedJobs: 74,
    badges: ['Mobility Specialist', 'ID Verified', 'Background Checked'],
  },
  {
    name: 'Fatima Sheikh',
    email: 'fatima.sheikh@example.com',
    phone: '+919820556688',
    gender: 'Female',
    avatar: 'https://randomuser.me/api/portraits/women/29.jpg',
    qualification: 'nursing_student',
    nursingRegNo: 'MH-STUDENT-2024-5512',
    experienceYears: 3,
    rating: { average: 4.85, count: 42 },
    hourlyRate: 350,
    services: ['Companionship', 'Medication Reminders', 'Feeding & Hygiene Support'],
    languages: ['English', 'Hindi', 'Urdu'],
    city: 'Mumbai, MH',
    area: 'Bandra West',
    maxDistanceKm: 15,
    careSettings: ['Home Care', 'Hospital Care'],
    bio: 'Final-year B.Sc Nursing student at Grant Medical College. Enthusiastic, thorough, and trained in basic bedside procedures.',
    trustScore: 92,
    completedJobs: 42,
    badges: ['College Verified', 'Background Checked', 'Student Attendant'],
  },
];

/**
 * Seeds comprehensive test data (services, multiple caregivers, bookings, reviews, transactions, messages).
 */
export async function seedFullTestData(options = {}) {
  // 1. Run baseline seed (services, admin, initial demo customer & caregiver)
  console.log('[Full Seed] Running baseline services and initial demo users...');
  const baseResult = await seedDatabase(options);

  const defaultPassword = options.demoUserPassword || 'DemoPassword123!';
  const passwordHash = await hashPassword(defaultPassword);

  const allServices = await Service.find({ isActive: true });
  const serviceMap = new Map(allServices.map((s) => [s.name, s]));

  // 2. Seed Additional Diverse Caregivers
  console.log('[Full Seed] Seeding additional verified caregivers across cities...');
  let extraCaregiversCreated = 0;

  for (const cgData of DEMO_CAREGIVERS) {
    let user = await User.findOne({ email: cgData.email });
    if (!user) {
      user = await User.create({
        fullName: `${cgData.name} (QA Demo)`,
        email: cgData.email,
        phone: cgData.phone,
        passwordHash,
        role: 'caregiver',
        status: 'active',
        isEmailVerified: true,
        isPhoneVerified: true,
      });
      extraCaregiversCreated++;
    }

    let profile = await CaregiverProfile.findOne({ user: user._id });
    if (!profile) {
      const offeredServiceIds = cgData.services
        .map((name) => serviceMap.get(name)?._id)
        .filter(Boolean);

      profile = await CaregiverProfile.create({
        user: user._id,
        avatar: cgData.avatar,
        qualification: cgData.qualification,
        nursingRegNo: cgData.nursingRegNo,
        experienceYears: cgData.experienceYears,
        bio: cgData.bio,
        languages: cgData.languages,
        city: cgData.city,
        area: cgData.area,
        maxDistanceKm: cgData.maxDistanceKm,
        hourlyRate: cgData.hourlyRate,
        servicesOffered: offeredServiceIds,
        services: cgData.services,
        careSettings: cgData.careSettings,
        availabilityStatus: 'Available Now',
        verificationStatus: 'verified',
        rating: cgData.rating,
        trustScore: cgData.trustScore,
        completedJobs: cgData.completedJobs,
        badges: cgData.badges,
      });
    }
  }

  // 3. Retrieve Primary Customer and Caregivers for Booking Associations
  const primaryCustomerUser = await User.findOne({ email: 'priya.sharma@example.com' });
  const primaryCaregiverUser = await User.findOne({ email: 'ananya.deshmukh@example.com' });
  const primaryCaregiverProfile = await CaregiverProfile.findOne({ user: primaryCaregiverUser?._id });
  const rajeshUser = await User.findOne({ email: 'rajesh.nair@example.com' });
  const rajeshProfile = await CaregiverProfile.findOne({ user: rajeshUser?._id });

  if (!primaryCustomerUser || !primaryCaregiverProfile) {
    console.log('[Full Seed] Skipping bookings creation: primary demo users not found.');
    return { success: true, baseResult, extraCaregiversCreated };
  }

  // 4. Seed Realistic Test Bookings
  console.log('[Full Seed] Seeding realistic test bookings across lifecycle states...');
  const monitoringService = serviceMap.get('Patient Monitoring') || allServices[0];
  const postSurgeryService = serviceMap.get('Post-Surgery Care') || allServices[1];
  const nightDutyService = serviceMap.get('Night-Duty Care') || allServices[2];

  // Booking 1: Completed Booking (Patient Monitoring, 4 hours)
  const pastDate = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000);
  const pastStart = new Date(pastDate);
  pastStart.setHours(9, 0, 0, 0);
  const pastEnd = new Date(pastDate);
  pastEnd.setHours(13, 0, 0, 0);

  let booking1 = await Booking.findOne({
    customer: primaryCustomerUser._id,
    service: monitoringService._id,
    status: 'completed',
  });

  if (!booking1) {
    const hourlyRate = primaryCaregiverProfile.hourlyRate || 649;
    const totalAmount = hourlyRate * 4;

    booking1 = await Booking.create({
      customer: primaryCustomerUser._id,
      caregiver: primaryCaregiverProfile._id,
      caregiverUser: primaryCaregiverUser._id,
      service: monitoringService._id,
      serviceName: monitoringService.name,
      serviceCategory: monitoringService.category,
      hourlyRate,
      totalHours: 4,
      totalAmount,
      currency: 'INR',
      startDateTime: pastStart,
      endDateTime: pastEnd,
      timezone: 'Asia/Kolkata',
      location: {
        addressLine: 'B-703, Hiranandani Gardens',
        city: 'Mumbai',
        area: 'Powai',
        pincode: '400076',
        careSetting: 'Home Care',
      },
      patientDetails: {
        name: 'Radhika Sharma',
        age: 74,
        gender: 'Female',
        specialInstructions: 'Morning BP and blood sugar check before breakfast.',
      },
      status: 'completed',
      acceptedAt: new Date(pastStart.getTime() - 24 * 60 * 60 * 1000),
    });

    // Seed Transaction for Booking 1 (Released)
    const commission = Math.round(totalAmount * 0.12);
    const caregiverPayout = totalAmount - commission;
    await Transaction.create({
      transactionNumber: `TXN-${Date.now().toString().slice(-8)}-001`,
      booking: booking1._id,
      customer: primaryCustomerUser._id,
      caregiver: primaryCaregiverProfile._id,
      caregiverUser: primaryCaregiverUser._id,
      serviceName: monitoringService.name,
      amount: totalAmount + 49 + Math.round((totalAmount + 49) * 0.18),
      currency: 'INR',
      breakdown: {
        baseAmount: totalAmount,
        platformFee: 49,
        tax: Math.round((totalAmount + 49) * 0.18),
        commission,
        caregiverPayout,
      },
      paymentMethod: 'UPI · GooglePay',
      status: 'released',
      type: 'booking_payment',
      escrowHeldAt: new Date(pastStart.getTime() - 24 * 60 * 60 * 1000),
      releasedAt: pastEnd,
    });

    // Seed Review for Booking 1
    await Review.create({
      booking: booking1._id,
      customer: primaryCustomerUser._id,
      caregiver: primaryCaregiverProfile._id,
      caregiverUser: primaryCaregiverUser._id,
      rating: 5,
      criteria: {
        serviceQuality: 5,
        behaviour: 5,
        punctuality: 5,
        overall: 5,
      },
      comment: 'Ananya was exceptionally punctual, calm, and meticulous with my mother’s post-operative vitals. Highly recommended!',
      reply: 'Thank you so much Priya! It was a pleasure caring for Radhika ji.',
      replyAt: new Date(pastEnd.getTime() + 4 * 60 * 60 * 1000),
      isPublic: true,
    });
  }

  // Booking 2: Active In-Progress Booking (Post-Surgery Care)
  const todayStart = new Date();
  todayStart.setHours(todayStart.getHours() - 2);
  const todayEnd = new Date(todayStart);
  todayEnd.setHours(todayStart.getHours() + 4);

  let booking2 = await Booking.findOne({
    customer: primaryCustomerUser._id,
    service: postSurgeryService._id,
    status: 'in_progress',
  });

  if (!booking2) {
    const hourlyRate = primaryCaregiverProfile.hourlyRate || 649;
    const totalAmount = hourlyRate * 4;

    booking2 = await Booking.create({
      customer: primaryCustomerUser._id,
      caregiver: primaryCaregiverProfile._id,
      caregiverUser: primaryCaregiverUser._id,
      service: postSurgeryService._id,
      serviceName: postSurgeryService.name,
      serviceCategory: postSurgeryService.category,
      hourlyRate,
      totalHours: 4,
      totalAmount,
      currency: 'INR',
      startDateTime: todayStart,
      endDateTime: todayEnd,
      timezone: 'Asia/Kolkata',
      location: {
        addressLine: 'B-703, Hiranandani Gardens',
        city: 'Mumbai',
        area: 'Powai',
        pincode: '400076',
        careSetting: 'Home Care',
      },
      patientDetails: {
        name: 'Radhika Sharma',
        age: 74,
        gender: 'Female',
        specialInstructions: 'Assistance with dressing change and walker mobility.',
      },
      status: 'in_progress',
      acceptedAt: new Date(todayStart.getTime() - 12 * 60 * 60 * 1000),
    });

    // Seed Messages for Booking 2
    await Message.create({
      booking: booking2._id,
      sender: primaryCustomerUser._id,
      senderRole: 'customer',
      recipient: primaryCaregiverUser._id,
      recipientRole: 'caregiver',
      content: 'Good morning Ananya, will you be bringing the sterile dressing kit?',
      read: true,
      readAt: todayStart,
    });

    await Message.create({
      booking: booking2._id,
      sender: primaryCaregiverUser._id,
      senderRole: 'caregiver',
      recipient: primaryCustomerUser._id,
      recipientRole: 'customer',
      content: 'Yes Priya! I have the surgical dressings and BP monitor ready. I will arrive at 8:45 AM.',
      read: true,
      readAt: todayStart,
    });
  }

  // Booking 3: Upcoming Confirmed Booking with Rajesh Nair
  if (rajeshUser && rajeshProfile) {
    const futureDate = new Date(Date.now() + 2 * 24 * 60 * 60 * 1000);
    futureDate.setHours(20, 0, 0, 0);
    const futureEnd = new Date(futureDate);
    futureEnd.setHours(futureDate.getHours() + 12);

    let booking3 = await Booking.findOne({
      customer: primaryCustomerUser._id,
      caregiver: rajeshProfile._id,
      status: 'confirmed',
    });

    if (!booking3) {
      const hourlyRate = rajeshProfile.hourlyRate || 720;
      const totalAmount = hourlyRate * 12;

      await Booking.create({
        customer: primaryCustomerUser._id,
        caregiver: rajeshProfile._id,
        caregiverUser: rajeshUser._id,
        service: nightDutyService._id,
        serviceName: nightDutyService.name,
        serviceCategory: nightDutyService.category,
        hourlyRate,
        totalHours: 12,
        totalAmount,
        currency: 'INR',
        startDateTime: futureDate,
        endDateTime: futureEnd,
        timezone: 'Asia/Kolkata',
        location: {
          addressLine: 'B-703, Hiranandani Gardens',
          city: 'Mumbai',
          area: 'Powai',
          pincode: '400076',
          careSetting: 'Home Care',
        },
        patientDetails: {
          name: 'Radhika Sharma',
          age: 74,
          gender: 'Female',
          specialInstructions: 'Overnight assistance with washroom visits and vitals check.',
        },
        status: 'confirmed',
        acceptedAt: new Date(),
      });
    }
  }

  console.log('[Full Seed] Comprehensive test data seeding completed successfully.');
  return {
    success: true,
    caregiversCount: 1 + extraCaregiversCreated,
    servicesCount: allServices.length,
  };
}

// Direct CLI invocation
if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    console.error('[Full Seed Error] MONGODB_URI missing.');
    process.exit(1);
  }

  console.log('[Full Seed] Connecting to MongoDB...');
  await mongoose.connect(uri, { serverSelectionTimeoutMS: 5000 });

  try {
    const res = await seedFullTestData({
      allowSeed: 'true',
      adminPassword: process.env.ADMIN_PASSWORD || 'bystander123',
      demoUserPassword: process.env.DEMO_USER_PASSWORD || 'bystander123',
    });
    console.log('[Full Seed Done]', res);
  } catch (err) {
    console.error('[Full Seed Failed]:', err);
    process.exit(1);
  } finally {
    await mongoose.disconnect();
    console.log('[Full Seed] Disconnected.');
  }
}
