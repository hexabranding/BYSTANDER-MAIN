import test from 'node:test';
import assert from 'node:assert/strict';
import mongoose from 'mongoose';
import { PlatformSettings } from '../src/models/PlatformSettings.js';
import { User } from '../src/models/User.js';
import { adminSettingsService } from '../src/services/adminSettingsService.js';
import { adminSettingsController } from '../src/controllers/adminSettingsController.js';

const createMockReqRes = (options = {}) => {
  const req = {
    body: options.body || {},
    params: options.params || {},
    query: options.query || {},
    headers: options.headers || {},
    cookies: options.cookies || {},
    user: options.user || null,
  };

  const res = {
    statusCode: 200,
    status(code) {
      this.statusCode = code;
      return this;
    },
    jsonData: null,
    json(data) {
      this.jsonData = data;
      return this;
    },
  };

  let nextCalled = false;
  let nextError = null;
  const next = (err = null) => {
    nextCalled = true;
    nextError = err;
  };

  return { req, res, next, getNextCalled: () => nextCalled, getNextError: () => nextError };
};

test('Settings 1: PlatformSettings model initializes with authoritative defaults', () => {
  const settings = new PlatformSettings({});
  assert.equal(settings.general.platformName, 'Bystander');
  assert.equal(settings.general.supportEmail, 'support@bystander.care');
  assert.equal(settings.fees.commission, 12);
  assert.equal(settings.fees.platformFee, 49);
  assert.equal(settings.fees.gst, 18);
  assert.equal(settings.notifications.booking, true);
  assert.equal(settings.policy.police, true);
  assert.equal(settings.policy.validity, '12 months');
});

test('Settings 2: updatePlatformSettings updates fees, general, and policy fields', async () => {
  const originalFindOne = PlatformSettings.findOne;
  const mockDoc = new PlatformSettings({});
  let saved = false;
  mockDoc.save = async function () {
    saved = true;
    return this;
  };

  PlatformSettings.findOne = async () => mockDoc;

  try {
    const adminId = new mongoose.Types.ObjectId();
    const updated = await adminSettingsService.updatePlatformSettings(
      {
        general: { platformName: 'CareMate Elite', supportEmail: 'ops@caremate.in' },
        fees: { commission: 15, platformFee: 69, gst: 18 },
        policy: { autoFace: true, validity: '24 months' },
      },
      adminId
    );

    assert.equal(saved, true);
    assert.equal(updated.general.platformName, 'CareMate Elite');
    assert.equal(updated.general.supportEmail, 'ops@caremate.in');
    assert.equal(updated.fees.commission, 15);
    assert.equal(updated.fees.platformFee, 69);
    assert.equal(updated.policy.autoFace, true);
    assert.equal(updated.policy.validity, '24 months');
  } finally {
    PlatformSettings.findOne = originalFindOne;
  }
});

test('Settings 3: updatePlatformSettings rejects out-of-range commissions and negative fees', async () => {
  const originalFindOne = PlatformSettings.findOne;
  const mockDoc = new PlatformSettings({});
  mockDoc.save = async () => mockDoc;
  PlatformSettings.findOne = async () => mockDoc;

  try {
    await assert.rejects(
      async () => {
        await adminSettingsService.updatePlatformSettings({ fees: { commission: 150 } });
      },
      { message: /must be a valid number between 0% and 100%/ }
    );

    await assert.rejects(
      async () => {
        await adminSettingsService.updatePlatformSettings({ fees: { platformFee: -10 } });
      },
      { message: /cannot be negative/ }
    );
  } finally {
    PlatformSettings.findOne = originalFindOne;
  }
});

test('Settings 4: getSecurityTelemetry returns live system and cryptography status', () => {
  const telemetry = adminSettingsService.getSecurityTelemetry();
  assert.ok(telemetry.databaseStatus);
  assert.ok(telemetry.encryptionStandard.includes('AES-256'));
  assert.ok(telemetry.passwordAlgorithm.includes('Bcrypt'));
  assert.ok(telemetry.jwtProtection.includes('HS-256'));
  assert.ok(telemetry.uptime);
});

test('Settings 5: inviteAdminMember validates name, email, and prevents duplicate admin accounts', async () => {
  const originalFindOne = User.findOne;
  const originalCreate = User.create;

  try {
    // 1. Rejects invalid name
    await assert.rejects(
      async () => {
        await adminSettingsService.inviteAdminMember({ name: '', email: 'admin@bystander.care' });
      },
      { message: /Full name is required/ }
    );

    // 2. Rejects invalid email
    await assert.rejects(
      async () => {
        await adminSettingsService.inviteAdminMember({ name: 'Aakash', email: 'not-an-email' });
      },
      { message: /valid email address/ }
    );

    // 3. Conflict on existing admin
    User.findOne = async () => ({ _id: new mongoose.Types.ObjectId(), role: 'admin' });
    await assert.rejects(
      async () => {
        await adminSettingsService.inviteAdminMember({ name: 'Rohit', email: 'existing@admin.com' });
      },
      { message: /administrator account with this email address already exists/ }
    );

    // 4. Rejects password shorter than 6 characters
    User.findOne = async () => null;
    await assert.rejects(
      async () => {
        await adminSettingsService.inviteAdminMember({
          name: 'Rohit',
          email: 'rohit@bystander.care',
          password: '123',
        });
      },
      { message: /Password must be at least 6 characters long/ }
    );

    // 5. Successful creation with custom password
    User.findOne = async () => null;
    let createdPasswordHash = null;
    User.create = async (doc) => {
      createdPasswordHash = doc.passwordHash;
      return {
        ...doc,
        _id: new mongoose.Types.ObjectId(),
        createdAt: new Date(),
      };
    };
    User.find = () => ({
      select: () => ({
        sort: async () => [
          {
            _id: new mongoose.Types.ObjectId(),
            fullName: 'Rohit Sharma',
            email: 'rohit@bystander.care',
            adminRole: 'Trust & safety',
            status: 'active',
            createdAt: new Date(),
          },
        ],
      }),
    });

    const res = await adminSettingsService.inviteAdminMember({
      name: 'Rohit Sharma',
      email: 'rohit@bystander.care',
      role: 'Trust & safety',
      password: 'SecureAdmin#2026',
    });

    assert.equal(res.created, true);
    assert.equal(res.member.name, 'Rohit Sharma');
    assert.equal(res.member.role, 'Trust & safety');
    assert.equal(res.team.length, 1);
    assert.ok(createdPasswordHash && createdPasswordHash.startsWith('$2'));
  } finally {
    User.findOne = originalFindOne;
    User.create = originalCreate;
  }
});

test('Settings 6: adminSettingsController endpoints handle GET, PATCH, and POST invite', async () => {
  const originalGetSettingsBundle = adminSettingsService.getSettingsBundle;
  const originalUpdate = adminSettingsService.updatePlatformSettings;
  const originalInvite = adminSettingsService.inviteAdminMember;

  try {
    // GET
    adminSettingsService.getSettingsBundle = async () => ({
      settings: { general: { platformName: 'Bystander' } },
      team: [],
      telemetry: {},
    });
    const { req: getReq, res: getRes, next: getNext } = createMockReqRes();
    await adminSettingsController.getSettings(getReq, getRes, getNext);
    assert.equal(getRes.statusCode, 200);
    assert.equal(getRes.jsonData.success, true);
    assert.equal(getRes.jsonData.data.settings.general.platformName, 'Bystander');

    // PATCH
    adminSettingsService.updatePlatformSettings = async () => ({
      general: { platformName: 'Updated Bystander' },
    });
    const { req: patchReq, res: patchRes, next: patchNext } = createMockReqRes({
      body: { general: { platformName: 'Updated Bystander' } },
      user: { _id: new mongoose.Types.ObjectId() },
    });
    await adminSettingsController.updateSettings(patchReq, patchRes, patchNext);
    assert.equal(patchRes.statusCode, 200);
    assert.equal(patchRes.jsonData.success, true);
    assert.equal(patchRes.jsonData.data.general.platformName, 'Updated Bystander');

    // POST Invite
    adminSettingsService.inviteAdminMember = async () => ({
      created: true,
      member: { name: 'Kavya Raman' },
      team: [],
    });
    const { req: postReq, res: postRes, next: postNext } = createMockReqRes({
      body: { name: 'Kavya Raman', email: 'kavya@bystander.care', role: 'Operations lead' },
    });
    await adminSettingsController.inviteAdmin(postReq, postRes, postNext);
    assert.equal(postRes.statusCode, 201);
    assert.equal(postRes.jsonData.success, true);
  } finally {
    adminSettingsService.getSettingsBundle = originalGetSettingsBundle;
    adminSettingsService.updatePlatformSettings = originalUpdate;
    adminSettingsService.inviteAdminMember = originalInvite;
  }
});
