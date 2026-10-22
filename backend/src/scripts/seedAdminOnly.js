import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { User } from '../models/index.js';
import { hashPassword } from '../utils/auth.js';

dotenv.config();

/**
 * Seeds ONLY the single administrator account.
 * No demo caregivers, customers, bookings, or reviews are created.
 */
export async function seedAdminOnly(options = {}) {
  const adminEmail = (options.email || process.env.ADMIN_EMAIL || 'admin@caremate.in').trim().toLowerCase();
  const password = options.password || process.env.ADMIN_PASSWORD || 'caremate123';
  const fullName = options.fullName || 'Operations Administrator';
  const phone = options.phone || '+919811100022';

  if (!password || password.length < 8) {
    throw new Error('Admin password must be at least 8 characters long.');
  }

  const existing = await User.findOne({ email: adminEmail });
  if (existing) {
    console.log(`[Seed Admin] Admin account already exists (${adminEmail}). Preserving existing record.`);
    return { created: false, user: existing };
  }

  const passwordHash = await hashPassword(password);
  const user = await User.create({
    fullName,
    email: adminEmail,
    phone,
    passwordHash,
    role: 'admin',
    status: 'active',
    isEmailVerified: true,
    isPhoneVerified: true,
  });

  console.log(`[Seed Admin] Admin account created successfully: ${adminEmail}`);
  return { created: true, user };
}

// Direct CLI invocation
const uri = process.env.MONGODB_URI;
if (!uri) {
  console.error('[Seed Admin Error] MONGODB_URI is not set in environment.');
  process.exit(1);
}

try {
  await mongoose.connect(uri, { serverSelectionTimeoutMS: 5000 });
  const result = await seedAdminOnly();
  console.log('[Seed Admin Result]:', {
    email: result.user.email,
    role: result.user.role,
    fullName: result.user.fullName,
    created: result.created,
  });
} catch (err) {
  console.error('[Seed Admin Failed]:', err);
  process.exit(1);
} finally {
  await mongoose.disconnect();
  console.log('[Seed Admin] Disconnected from MongoDB.');
}
