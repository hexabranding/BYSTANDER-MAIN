import test from 'node:test';
import assert from 'node:assert/strict';
import bcrypt from 'bcryptjs';
import {
  DEFAULT_SERVICES,
  validateSeedConfig,
  seedServices,
  seedAdminUser,
  seedDemoUsers,
  seedDatabase,
} from '../src/scripts/seed.js';
import { Service } from '../src/models/Service.js';
import { User } from '../src/models/User.js';
import { CustomerProfile } from '../src/models/CustomerProfile.js';
import { CaregiverProfile } from '../src/models/CaregiverProfile.js';

// -----------------------------------------------------------------------------
// Test 1: Configuration Validation & Safe Refusal
// -----------------------------------------------------------------------------
test('Seed Security 1: validateSeedConfig rejects execution without explicit authorization flag', () => {
  // Missing ALLOW_SEED completely
  const res1 = validateSeedConfig({
    MONGODB_URI: 'mongodb://localhost:27017/test',
  });
  assert.equal(res1.isValid, false);
  assert.ok(res1.errors.some((e) => e.includes('ALLOW_SEED')));

  // ALLOW_SEED set to invalid value
  const res2 = validateSeedConfig({
    ALLOW_SEED: 'false',
    MONGODB_URI: 'mongodb://localhost:27017/test',
  });
  assert.equal(res2.isValid, false);
  assert.ok(res2.errors.some((e) => e.includes('ALLOW_SEED')));

  // Missing MONGODB_URI
  const res3 = validateSeedConfig({
    ALLOW_SEED: 'true',
    MONGODB_URI: '',
  });
  assert.equal(res3.isValid, false);
  assert.ok(res3.errors.some((e) => e.includes('MONGODB_URI')));

  // Valid development configuration passes
  const res4 = validateSeedConfig({
    ALLOW_SEED: 'true',
    MONGODB_URI: 'mongodb://localhost:27017/test',
    NODE_ENV: 'development',
  });
  assert.equal(res4.isValid, true);
  assert.equal(res4.errors.length, 0);
});

test('Seed Security 2: validateSeedConfig enforces extra production barrier', () => {
  // In production without ALLOW_PRODUCTION_SEED=true
  const res1 = validateSeedConfig({
    ALLOW_SEED: 'true',
    MONGODB_URI: 'mongodb+srv://user:pass@cluster.mongodb.net/prod',
    NODE_ENV: 'production',
  });
  assert.equal(res1.isValid, false);
  assert.ok(res1.errors.some((e) => e.includes('ALLOW_PRODUCTION_SEED')));

  // In production with ALLOW_PRODUCTION_SEED=true
  const res2 = validateSeedConfig({
    ALLOW_SEED: 'true',
    ALLOW_PRODUCTION_SEED: 'true',
    MONGODB_URI: 'mongodb+srv://user:pass@cluster.mongodb.net/prod',
    NODE_ENV: 'production',
  });
  assert.equal(res2.isValid, true);
});

// -----------------------------------------------------------------------------
// Test 2: Service Catalog Schema & Quality
// -----------------------------------------------------------------------------
test('Seed Catalog 1: DEFAULT_SERVICES contains all 9 core services and validates against Service schema', () => {
  assert.equal(DEFAULT_SERVICES.length, 9);

  const slugs = new Set();
  for (const item of DEFAULT_SERVICES) {
    // Unique slug check
    assert.ok(item.slug, `Service ${item.name} must have a slug`);
    assert.ok(!slugs.has(item.slug), `Duplicate slug detected: ${item.slug}`);
    slugs.add(item.slug);

    // Schema validation check without saving to DB
    const serviceDoc = new Service({
      name: item.name,
      slug: item.slug,
      category: item.category,
      description: item.description,
      features: item.features,
      baseHourlyRate: item.baseHourlyRate,
      minimumDurationHours: item.minimumDurationHours,
      isActive: true,
    });

    const validationError = serviceDoc.validateSync();
    assert.equal(validationError, undefined, `Service validation failed for ${item.name}: ${validationError?.message}`);
  }
});

// -----------------------------------------------------------------------------
// Test 3: Admin Credential Enforcement & Password Hashing
// -----------------------------------------------------------------------------
test('Seed Admin 1: seedAdminUser strictly rejects missing or short passwords when creating admin', async () => {
  // Mock User.findOne to simulate empty database (no existing admin)
  const originalFindOne = User.findOne;
  User.findOne = async () => null;

  try {
    // Missing password
    await assert.rejects(
      async () => {
        await seedAdminUser({ email: 'admin@caremate.in', password: '' });
      },
      (err) => {
        assert.ok(err.message.includes('ADMIN_PASSWORD'));
        assert.ok(err.message.includes('strictly forbidden'));
        return true;
      },
    );

    // Short password (< 8 chars)
    await assert.rejects(
      async () => {
        await seedAdminUser({ email: 'admin@caremate.in', password: 'short' });
      },
      (err) => {
        assert.ok(err.message.includes('at least 8 characters'));
        return true;
      },
    );
  } finally {
    User.findOne = originalFindOne;
  }
});

test('Seed Admin 2: seedAdminUser creates admin with bcrypt hash and safe active status', async () => {
  const originalFindOne = User.findOne;
  const originalCreate = User.create;

  let createdPayload = null;
  User.findOne = async () => null;
  User.create = async (payload) => {
    createdPayload = payload;
    return { ...payload, _id: '6711a1b2c3d4e5f6a7b8c999' };
  };

  try {
    const res = await seedAdminUser({
      email: 'admin@caremate.in',
      password: 'StrongAdminPassword!2026',
      fullName: 'Head of Operations',
      phone: '+919811100022',
    });

    assert.equal(res.created, true);
    assert.ok(createdPayload);
    assert.equal(createdPayload.email, 'admin@caremate.in');
    assert.equal(createdPayload.role, 'admin');
    assert.equal(createdPayload.status, 'active');
    assert.equal(createdPayload.isEmailVerified, true);
    assert.equal(createdPayload.isPhoneVerified, true);

    // Verify password was hashed and plaintext is NOT saved
    assert.notEqual(createdPayload.passwordHash, 'StrongAdminPassword!2026');
    const isMatch = await bcrypt.compare('StrongAdminPassword!2026', createdPayload.passwordHash);
    assert.equal(isMatch, true);
  } finally {
    User.findOne = originalFindOne;
    User.create = originalCreate;
  }
});

test('Seed Admin 3: seedAdminUser preserves existing admin without resetting password (Idempotency)', async () => {
  const originalFindOne = User.findOne;
  const originalCreate = User.create;

  const existingAdmin = {
    _id: '6711a1b2c3d4e5f6a7b8c999',
    email: 'admin@caremate.in',
    role: 'admin',
    passwordHash: '$2a$12$existingHashedPassword1234567890',
  };

  let createCalled = false;
  User.findOne = async ({ email }) => (email === 'admin@caremate.in' ? existingAdmin : null);
  User.create = async () => {
    createCalled = true;
  };

  try {
    const res = await seedAdminUser({
      email: 'admin@caremate.in',
      password: 'DifferentPassword!2026',
    });

    assert.equal(res.created, false);
    assert.equal(createCalled, false);
    assert.equal(res.user.passwordHash, '$2a$12$existingHashedPassword1234567890');
  } finally {
    User.findOne = originalFindOne;
    User.create = originalCreate;
  }
});

// -----------------------------------------------------------------------------
// Test 4: Service Seeding Idempotency
// -----------------------------------------------------------------------------
test('Seed Services: seedServices creates missing services and skips existing ones without mutation', async () => {
  const originalFindOne = Service.findOne;
  const originalCreate = Service.create;

  const existingSlug = 'patient-monitoring';
  const existingService = { _id: 'svc-001', name: 'Patient Monitoring', slug: existingSlug };
  const createdSlugs = [];

  Service.findOne = async ({ slug }) => (slug === existingSlug ? existingService : null);
  Service.create = async (doc) => {
    createdSlugs.push(doc.slug);
    return { ...doc, _id: `svc-${createdSlugs.length}` };
  };

  try {
    const res = await seedServices({
      catalog: [
        { name: 'Patient Monitoring', slug: 'patient-monitoring', category: 'Clinical', baseHourlyRate: 449, description: 'Test desc 1' },
        { name: 'Feeding & Hygiene Support', slug: 'feeding-hygiene-support', category: 'Daily Care', baseHourlyRate: 399, description: 'Test desc 2' },
        { name: 'Post-Surgery Care', slug: 'post-surgery-care', category: 'Clinical', baseHourlyRate: 599, description: 'Test desc 3' },
      ],
    });

    assert.equal(res.created, 2);
    assert.equal(res.skipped, 1);
    assert.deepEqual(createdSlugs, ['feeding-hygiene-support', 'post-surgery-care']);
  } finally {
    Service.findOne = originalFindOne;
    Service.create = originalCreate;
  }
});

// -----------------------------------------------------------------------------
// Test 5: Demo Users Seeding & Idempotency
// -----------------------------------------------------------------------------
test('Seed Demo Users: seedDemoUsers skips when password not supplied, creates when supplied, and never duplicates', async () => {
  const originalUserFindOne = User.findOne;
  const originalUserCreate = User.create;
  const originalCustFindOne = CustomerProfile.findOne;
  const originalCustCreate = CustomerProfile.create;
  const originalCareFindOne = CaregiverProfile.findOne;
  const originalCareCreate = CaregiverProfile.create;

  try {
    // 1. Password omitted -> gracefully skips
    const skipRes = await seedDemoUsers({}, []);
    assert.equal(skipRes.createdUsers, 0);
    assert.equal(skipRes.skippedReason, 'DEMO_USER_PASSWORD_NOT_PROVIDED');

    // 2. Password supplied and users do not exist -> creates user and profile
    const createdUsers = [];
    User.findOne = async () => null;
    User.create = async (doc) => {
      createdUsers.push(doc);
      return { ...doc, _id: `usr-${createdUsers.length}` };
    };
    CustomerProfile.findOne = async () => null;
    CustomerProfile.create = async (doc) => doc;
    CaregiverProfile.findOne = async () => null;
    CaregiverProfile.create = async (doc) => doc;

    const createRes = await seedDemoUsers(
      { password: 'DemoPassword123' },
      [{ _id: 'svc-1', name: 'Patient Monitoring' }],
    );

    assert.equal(createRes.createdUsers, 2);
    assert.equal(createRes.skippedUsers, 0);
    assert.equal(createdUsers.some((u) => u.role === 'customer'), true);
    assert.equal(createdUsers.some((u) => u.role === 'caregiver'), true);

    // 3. Re-run when users already exist -> preserves without creating
    User.findOne = async ({ email }) => ({ _id: 'existing-id', email });
    const rerunRes = await seedDemoUsers(
      { password: 'DemoPassword123' },
      [{ _id: 'svc-1', name: 'Patient Monitoring' }],
    );

    assert.equal(rerunRes.createdUsers, 0);
    assert.equal(rerunRes.skippedUsers, 2);
  } finally {
    User.findOne = originalUserFindOne;
    User.create = originalUserCreate;
    CustomerProfile.findOne = originalCustFindOne;
    CustomerProfile.create = originalCustCreate;
    CaregiverProfile.findOne = originalCareFindOne;
    CaregiverProfile.create = originalCareCreate;
  }
});
