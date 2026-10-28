import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { User } from '../models/User.js';
import { Service } from '../models/Service.js';
import { CustomerProfile } from '../models/CustomerProfile.js';
import { CaregiverProfile } from '../models/CaregiverProfile.js';
import { hashPassword } from '../utils/auth.js';
import { slugify } from '../utils/slugify.js';

/**
 * Standard baseline services catalog aligned with CareMate CARE_TYPES and frontend catalog.
 * Seeded idempotently using unique service slug identifiers.
 */
export const DEFAULT_SERVICES = Object.freeze([
  {
    name: 'Patient Monitoring',
    slug: 'patient-monitoring',
    category: 'Clinical',
    description:
      'A trained caretaker tracks blood pressure, pulse, sugar levels, oxygen saturation and medication response, and keeps the family updated with structured daily reports.',
    features: ['Vitals check', 'Daily reports', 'Post-discharge observation', 'Sugar & BP monitoring'],
    baseHourlyRate: 449,
    minimumDurationHours: 2,
    isActive: true,
  },
  {
    name: 'Feeding & Hygiene Support',
    slug: 'feeding-hygiene-support',
    category: 'Daily Care',
    description:
      'Compassionate assistance with feeding plans, tube feeding coordination, bathing, dressing, diaper changes and infection-safe hygiene routines for patients with limited mobility.',
    features: ['Assisted feeding', 'Bathing & grooming', 'Diaper care', 'Oral hygiene'],
    baseHourlyRate: 399,
    minimumDurationHours: 2,
    isActive: true,
  },
  {
    name: 'Post-Surgery Care',
    slug: 'post-surgery-care',
    category: 'Clinical',
    description:
      'Specialised post-operative support including dressing changes under guidance, drain management, pain monitoring, mobilisation and coordination with the treating hospital.',
    features: ['Wound dressing', 'Drain tracking', 'Mobility support', 'Pain observation'],
    baseHourlyRate: 599,
    minimumDurationHours: 2,
    isActive: true,
  },
  {
    name: 'Companionship',
    slug: 'companionship',
    category: 'Elder Care',
    description:
      'Warm, patient companionship for seniors living alone — conversation, reading, light exercises, temple or park walks, and regular family updates.',
    features: ['Conversation & reading', 'Light walks', 'Mental wellness', 'Family check-in notes'],
    baseHourlyRate: 329,
    minimumDurationHours: 2,
    isActive: true,
  },
  {
    name: 'Medication Reminders',
    slug: 'medication-reminders',
    category: 'Daily Care',
    description:
      'Strict timetable-based medicine reminders, refill alerts, prescription logging and escalation to the family if a dose is missed.',
    features: ['Prescription logging', 'Dose alerts', 'Refill tracking', 'Escalation to family'],
    baseHourlyRate: 299,
    minimumDurationHours: 2,
    isActive: true,
  },
  {
    name: 'Mobility Assistance',
    slug: 'mobility-assistance',
    category: 'Mobility',
    description:
      'Trained handling for bed-to-wheelchair transfers, walking support, fall prevention, brace and prosthesis care, and assisted physiotherapy routines.',
    features: ['Transfer support', 'Fall prevention', 'Physio routines', 'Wheelchair assistance'],
    baseHourlyRate: 479,
    minimumDurationHours: 2,
    isActive: true,
  },
  {
    name: 'Dementia & Alzheimer’s Support',
    slug: 'dementia-alzheimers-support',
    category: 'Memory Care',
    description:
      'Calm, structured support for memory-care patients — orientation cues, wandering prevention, safe nutrition, behavioural de-escalation and caretaker respite.',
    features: ['Memory cues', 'Wandering prevention', 'Behavioural support', 'Respite relief'],
    baseHourlyRate: 649,
    minimumDurationHours: 2,
    isActive: true,
  },
  {
    name: 'Bedridden Patient Care',
    slug: 'bedridden-patient-care',
    category: 'Specialized Care',
    description:
      'Specialised bed care including 2-hourly turning schedules for bed sore prevention, sponge baths, back care, catheter care and passive range-of-motion movements.',
    features: ['2-hourly turning schedule', 'Bed baths', 'Bed sore prevention', 'Catheter hygiene'],
    baseHourlyRate: 699,
    minimumDurationHours: 2,
    isActive: true,
  },
  {
    name: 'Night-Duty Care',
    slug: 'night-duty-care',
    category: 'Overnight',
    description:
      '12-hour overnight bedside care to assist with washroom visits, night vitals, hydration, emergency response and peaceful sleep for patients and families.',
    features: ['12-hour overnight shift', 'Night vitals observation', 'Washroom assistance', 'Emergency alerts'],
    baseHourlyRate: 749,
    minimumDurationHours: 2,
    isActive: true,
  },
]);

/**
 * Validates required configuration before allowing any seed execution.
 * Fails fast if explicit authorization or required credentials are missing.
 *
 * @param {Object} [env=process.env]
 * @returns {{ isValid: boolean, errors: string[] }}
 */
export function validateSeedConfig(env = process.env) {
  const errors = [];

  // Safeguard 1: Explicit authorization flag is mandatory
  if (env.ALLOW_SEED !== 'true') {
    errors.push('Explicit authorization required: Set ALLOW_SEED=true to authorize database seeding.');
  }

  // Safeguard 2: Database URI must be specified
  if (!env.MONGODB_URI || !String(env.MONGODB_URI).trim()) {
    errors.push('MONGODB_URI environment variable is missing or empty.');
  }

  // Safeguard 3: Production safety barrier
  if (env.NODE_ENV === 'production' && env.ALLOW_PRODUCTION_SEED !== 'true') {
    errors.push('Production safety block: Seeding in production requires ALLOW_PRODUCTION_SEED=true.');
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
}

/**
 * Seeds core service catalog idempotently.
 * Checks each service by unique slug; existing services are preserved without mutation.
 *
 * @param {Object} [options={}]
 * @returns {Promise<{ created: number, skipped: number, services: Array }>}
 */
export async function seedServices(options = {}) {
  const catalog = options.catalog || DEFAULT_SERVICES;
  let created = 0;
  let skipped = 0;
  const allServices = [];

  for (const item of catalog) {
    const slug = slugify(item.slug || item.name);
    const existing = await Service.findOne({ slug });

    if (existing) {
      skipped++;
      allServices.push(existing);
      continue;
    }

    const newService = await Service.create({
      name: item.name,
      slug,
      category: item.category,
      description: item.description,
      features: item.features || [],
      baseHourlyRate: item.baseHourlyRate,
      minimumDurationHours: item.minimumDurationHours || 1,
      isActive: item.isActive !== undefined ? item.isActive : true,
    });

    created++;
    allServices.push(newService);
  }

  return { created, skipped, services: allServices };
}

/**
 * Seeds the initial administrator account idempotently using environment-supplied credentials.
 * If an admin user with the target email already exists, their account and password are preserved.
 *
 * @param {Object} options
 * @param {string} options.email - Admin email
 * @param {string} [options.password] - Plaintext admin password (required if admin does not exist)
 * @param {string} [options.fullName] - Admin display name
 * @param {string} [options.phone] - Admin phone number
 * @returns {Promise<{ created: boolean, user: Object }>}
 */
export async function seedAdminUser(options = {}) {
  const adminEmail = (options.email || 'admin@caremate.in').trim().toLowerCase();
  const existing = await User.findOne({ email: adminEmail });

  if (existing) {
    return { created: false, user: existing };
  }

  const password = options.password;
  if (!password || typeof password !== 'string' || password.trim().length < 8) {
    throw new Error(
      `Cannot create initial admin (${adminEmail}): ADMIN_PASSWORD environment variable with at least 8 characters is required. Hardcoding or generating fallback passwords is strictly forbidden.`,
    );
  }

  const passwordHash = await hashPassword(password.trim());

  const user = await User.create({
    fullName: options.fullName || 'Operations Administrator',
    email: adminEmail,
    phone: options.phone || '+919811100022',
    passwordHash,
    role: 'admin',
    status: 'active',
    isEmailVerified: true,
    isPhoneVerified: true,
  });

  return { created: true, user };
}

/**
 * Seeds optional synthetic QA demo accounts (customer and caregiver) if DEMO_USER_PASSWORD is provided.
 * Uses synthetic names, addresses, and profiles; preserves existing accounts without mutation.
 *
 * @param {Object} options
 * @param {string} [options.password] - Plaintext demo user password
 * @param {Array} [options.services=[]] - List of active Service documents to associate with caregiver
 * @returns {Promise<{ createdUsers: number, skippedUsers: number, customerUser: Object|null, caregiverUser: Object|null }>}
 */
export async function seedDemoUsers(options = {}, services = []) {
  const password = options.password;
  if (!password || typeof password !== 'string' || password.trim().length < 6) {
    return { createdUsers: 0, skippedUsers: 0, customerUser: null, caregiverUser: null, skippedReason: 'DEMO_USER_PASSWORD_NOT_PROVIDED' };
  }

  const passwordHash = await hashPassword(password.trim());
  let createdUsers = 0;
  let skippedUsers = 0;

  // 1. Synthetic QA Demo Customer
  const customerEmail = (options.customerEmail || 'priya.sharma@example.com').trim().toLowerCase();
  let customerUser = await User.findOne({ email: customerEmail });

  if (customerUser) {
    skippedUsers++;
  } else {
    customerUser = await User.create({
      fullName: 'Priya Sharma (QA Demo)',
      email: customerEmail,
      phone: '+919820441127',
      passwordHash,
      role: 'customer',
      status: 'active',
      isEmailVerified: true,
      isPhoneVerified: true,
    });
    createdUsers++;

    const existingCustomerProfile = await CustomerProfile.findOne({ user: customerUser._id });
    if (!existingCustomerProfile) {
      await CustomerProfile.create({
        user: customerUser._id,
        emergencyContact: {
          name: 'Vikram Sharma',
          phone: '+919820199001',
          relation: 'Brother',
        },
        defaultAddress: {
          street: 'B-703, Hiranandani Gardens',
          city: 'Mumbai',
          state: 'MH',
          zip: '400076',
        },
        patients: [
          {
            name: 'Radhika Sharma (QA Synthetic)',
            age: 74,
            gender: 'Female',
            relation: 'Mother',
            condition: 'Post hip-replacement recovery, mild hypertension',
            medicalNotes: 'Requires assistance with mobility and morning medication routines.',
          },
        ],
      });
    }
  }

  // 2. Synthetic QA Demo Caregiver
  const caregiverEmail = (options.caregiverEmail || 'ananya.deshmukh@example.com').trim().toLowerCase();
  let caregiverUser = await User.findOne({ email: caregiverEmail });

  if (caregiverUser) {
    skippedUsers++;
  } else {
    caregiverUser = await User.create({
      fullName: 'Ananya Deshmukh (QA Demo)',
      email: caregiverEmail,
      phone: '+919821930044',
      passwordHash,
      role: 'caregiver',
      status: 'active',
      isEmailVerified: true,
      isPhoneVerified: true,
    });
    createdUsers++;

    const existingCaregiverProfile = await CaregiverProfile.findOne({ user: caregiverUser._id });
    if (!existingCaregiverProfile) {
      const serviceIds = services.slice(0, 4).map((s) => s._id);
      const serviceNames = services.slice(0, 4).map((s) => s.name);

      await CaregiverProfile.create({
        user: caregiverUser._id,
        avatar: 'https://randomuser.me/api/portraits/women/44.jpg',
        qualification: 'BSc Nursing',
        nursingRegNo: 'MH-NUR-2018-4471',
        experienceYears: 9,
        bio: 'Dedicated registered nurse with extensive experience in bedside recovery, vitals monitoring, and post-operative elder care.',
        languages: ['English', 'Hindi', 'Marathi'],
        city: 'Mumbai, MH',
        area: 'Powai',
        maxDistanceKm: 20,
        hourlyRate: 649,
        servicesOffered: serviceIds,
        services: serviceNames,
        careSettings: ['Home Care', 'Hospital Care'],
        availabilityStatus: 'Available Now',
        verificationStatus: 'verified',
        rating: { average: 4.9, count: 128 },
        trustScore: 94,
        completedJobs: 112,
        badges: ['ID Verified', 'Background Checked', 'Nursing Council Registered'],
      });
    }
  }

  return { createdUsers, skippedUsers, customerUser, caregiverUser };
}

/**
 * Orchestrates complete idempotent database seeding.
 *
 * @param {Object} options
 * @returns {Promise<Object>} Execution summary statistics
 */
export async function seedDatabase(options = {}) {
  // 1. Seed Service Catalog
  const serviceResult = await seedServices(options);

  // 2. Seed Administrator Account
  const adminResult = await seedAdminUser({
    email: options.adminEmail,
    password: options.adminPassword,
    fullName: options.adminFullName,
    phone: options.adminPhone,
  });

  // 3. Seed Demo Users (if password provided)
  const demoResult = await seedDemoUsers(
    {
      password: options.demoUserPassword,
      customerEmail: options.customerEmail,
      caregiverEmail: options.caregiverEmail,
    },
    serviceResult.services,
  );

  return {
    success: true,
    summary: {
      services: {
        created: serviceResult.created,
        skipped: serviceResult.skipped,
        total: serviceResult.services.length,
      },
      admin: {
        email: options.adminEmail || 'admin@caremate.in',
        created: adminResult.created,
        preserved: !adminResult.created,
      },
      demoUsers: {
        created: demoResult.createdUsers,
        skipped: demoResult.skippedUsers,
        configured: Boolean(options.demoUserPassword),
      },
    },
  };
}

/**
 * CLI Runner for explicit invocation: `npm run seed` or `node src/scripts/seed.js`.
 * Loads .env, enforces safeguards, executes seedDatabase, logs sanitized summary, and exits safely.
 */
export async function runSeedCli() {
  dotenv.config();

  console.log('[Seed] Verifying seed configuration and authorization...');
  const validation = validateSeedConfig(process.env);

  if (!validation.isValid) {
    console.error('[Seed Refused] Execution blocked due to configuration errors:');
    validation.errors.forEach((err) => console.error(`  - ${err}`));
    process.exit(1);
  }

  const rawUri = process.env.MONGODB_URI;
  const sanitizedUri = rawUri.replace(/\/\/[^:]+:[^@]+@/, '//***:***@');
  console.log(`[Seed] Connecting to target database: ${sanitizedUri}`);

  await mongoose.connect(rawUri, { serverSelectionTimeoutMS: 5000 });

  try {
    const result = await seedDatabase({
      adminEmail: process.env.ADMIN_EMAIL,
      adminPassword: process.env.ADMIN_PASSWORD,
      adminFullName: process.env.ADMIN_NAME,
      adminPhone: process.env.ADMIN_PHONE,
      demoUserPassword: process.env.DEMO_USER_PASSWORD,
      customerEmail: process.env.DEMO_CUSTOMER_EMAIL,
      caregiverEmail: process.env.DEMO_CAREGIVER_EMAIL,
    });

    console.log('[Seed Complete] Idempotent database seeding finished successfully:');
    console.log(`  - Services catalog: ${result.summary.services.created} created, ${result.summary.services.skipped} existing preserved`);
    console.log(`  - Admin user (${result.summary.admin.email}): ${result.summary.admin.created ? 'Created' : 'Existing preserved without modification'}`);

    if (result.summary.demoUsers.configured) {
      console.log(`  - Demo QA accounts: ${result.summary.demoUsers.created} created, ${result.summary.demoUsers.skipped} existing preserved`);
    } else {
      console.log('  - Demo QA accounts: Skipped (DEMO_USER_PASSWORD environment variable not set)');
    }
  } finally {
    await mongoose.disconnect();
    console.log('[Seed] Database connection closed.');
  }
}

// Auto-run if executed directly as a script (e.g. node src/scripts/seed.js or npm run seed)
if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  runSeedCli().catch((err) => {
    console.error(`[Seed Fatal Error] ${err.message}`);
    process.exit(1);
  });
}
