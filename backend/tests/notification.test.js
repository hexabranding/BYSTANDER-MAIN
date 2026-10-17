import test from 'node:test';
import assert from 'node:assert/strict';
import mongoose from 'mongoose';
import { Notification, User, Booking, Message, SosIncident, CustomerProfile } from '../src/models/index.js';
import * as notificationService from '../src/services/notificationService.js';
import * as messageService from '../src/services/messageService.js';
import * as sosService from '../src/services/sosService.js';
import {
  validateGetNotifications,
  validateNotificationId,
} from '../src/middleware/validateNotification.js';
import { authenticate } from '../src/middleware/auth.js';

// Helper to simulate Express req, res, next
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

// -----------------------------------------------------------------------------
// Test 1: Notification Model Defaults & Field Validations
// -----------------------------------------------------------------------------
test('Step 10C - 1: Notification model enforces required fields, defaults, and type enum', async () => {
  const recipientId = new mongoose.Types.ObjectId();

  // 1. Valid notification instance
  const validDoc = new Notification({
    recipient: recipientId,
    type: 'message_received',
    title: 'New Message',
    message: 'You have a new shift update',
  });

  assert.equal(validDoc.read, false);
  assert.equal(validDoc.readAt, null);
  assert.deepEqual(validDoc.metadata, {});
  assert.equal(validDoc.idempotencyKey, null);

  // 2. Missing recipient -> validation error
  const missingRecipient = new Notification({
    type: 'system',
    title: 'System Notice',
    message: 'Maintenance window tonight',
  });
  const err1 = missingRecipient.validateSync();
  assert.ok(err1?.errors['recipient']);

  // 3. Invalid type -> validation error
  const invalidType = new Notification({
    recipient: recipientId,
    type: 'unknown_type',
    title: 'Notice',
    message: 'Test message',
  });
  const err2 = invalidType.validateSync();
  assert.ok(err2?.errors['type']);
});

// -----------------------------------------------------------------------------
// Test 2: Input Validation Middleware for Notification Routes
// -----------------------------------------------------------------------------
test('Step 10C - 2: validateGetNotifications and validateNotificationId enforce parameter bounds', () => {
  const validId = new mongoose.Types.ObjectId().toString();

  // 1. validateGetNotifications: negative page -> 400
  const { req: r1, res: res1, next: n1, getNextCalled: c1, getNextError: e1 } = createMockReqRes({
    query: { page: '-1' },
  });
  validateGetNotifications(r1, res1, n1);
  assert.equal(c1(), true);
  assert.equal(e1()?.statusCode, 400);

  // 2. validateGetNotifications: zero or invalid limit -> 400
  const { req: r2, res: res2, next: n2, getNextCalled: c2, getNextError: e2 } = createMockReqRes({
    query: { limit: '0' },
  });
  validateGetNotifications(r2, res2, n2);
  assert.equal(c2(), true);
  assert.equal(e2()?.statusCode, 400);

  // 3. validateGetNotifications: valid pagination -> passes
  const { req: r3, res: res3, next: n3, getNextCalled: c3, getNextError: e3 } = createMockReqRes({
    query: { page: '2', limit: '25' },
  });
  validateGetNotifications(r3, res3, n3);
  assert.equal(c3(), true);
  assert.equal(e3(), null);

  // 4. validateNotificationId: malformed ID -> 400
  const { req: r4, res: res4, next: n4, getNextCalled: c4, getNextError: e4 } = createMockReqRes({
    params: { id: 'bad-id' },
  });
  validateNotificationId(r4, res4, n4);
  assert.equal(c4(), true);
  assert.equal(e4()?.statusCode, 400);

  // 5. validateNotificationId: valid ID -> sets req.validatedNotificationId
  const { req: r5, res: res5, next: n5, getNextCalled: c5, getNextError: e5 } = createMockReqRes({
    params: { id: validId },
  });
  validateNotificationId(r5, res5, n5);
  assert.equal(c5(), true);
  assert.equal(e5(), null);
  assert.equal(r5.validatedNotificationId, validId);
});

// -----------------------------------------------------------------------------
// Test 3: Authentication Enforcement
// -----------------------------------------------------------------------------
test('Step 10C - 3: Notification endpoints reject unauthenticated requests with 401', async () => {
  const { req, res, next } = createMockReqRes({
    headers: {},
    cookies: {},
  });

  await authenticate(req, res, next);
  assert.equal(res.statusCode, 401);
  assert.equal(res.jsonData.error, 'Unauthorized');
});

// -----------------------------------------------------------------------------
// Test 4: Recipient Isolation for Notification Queries
// -----------------------------------------------------------------------------
test('Step 10C - 4: getNotifications scopes query strictly to authenticated user', async () => {
  const userA = new mongoose.Types.ObjectId().toString();
  const userB = new mongoose.Types.ObjectId().toString();

  const originalFind = Notification.find;
  const originalCount = Notification.countDocuments;

  let capturedFilter = null;

  try {
    Notification.find = (filter) => {
      capturedFilter = filter;
      return {
        sort: () => ({
          skip: () => ({
            limit: async () => [{ _id: new mongoose.Types.ObjectId(), title: 'User A Notice' }],
          }),
        }),
      };
    };
    Notification.countDocuments = async () => 1;

    // User A query
    await notificationService.getNotifications({ _id: userA, role: 'customer' });
    assert.equal(capturedFilter.recipient.toString(), userA);
    assert.notEqual(capturedFilter.recipient.toString(), userB);

    // Filter by unreadOnly
    await notificationService.getNotifications({ _id: userA, role: 'customer' }, { unreadOnly: 'true' });
    assert.equal(capturedFilter.read, false);
  } finally {
    Notification.find = originalFind;
    Notification.countDocuments = originalCount;
  }
});

// -----------------------------------------------------------------------------
// Test 5: Bounded Pagination and Descending Chronological Ordering
// -----------------------------------------------------------------------------
test('Step 10C - 5: getNotifications clamps limit to 50 and sorts newest first', async () => {
  const userId = new mongoose.Types.ObjectId().toString();

  const originalFind = Notification.find;
  const originalCount = Notification.countDocuments;

  let capturedSort = null;
  let capturedSkip = null;
  let capturedLimit = null;

  try {
    Notification.find = () => ({
      sort: (s) => {
        capturedSort = s;
        return {
          skip: (sk) => {
            capturedSkip = sk;
            return {
              limit: async (lim) => {
                capturedLimit = lim;
                return [{ _id: new mongoose.Types.ObjectId(), title: 'Alert' }];
              },
            };
          },
        };
      },
    });
    Notification.countDocuments = async () => 75;

    // Page 2 with excessive limit 100 -> should clamp limit to 50
    const result = await notificationService.getNotifications(
      { _id: userId, role: 'customer' },
      { page: 2, limit: 100 },
    );

    assert.deepEqual(capturedSort, { createdAt: -1 }); // Newest first
    assert.equal(capturedLimit, 50); // Clamped from 100
    assert.equal(capturedSkip, 50); // (page 2 - 1) * 50 = 50
    assert.equal(result.pagination.total, 75);
    assert.equal(result.pagination.pages, 2);
    assert.equal(result.pagination.page, 2);
  } finally {
    Notification.find = originalFind;
    Notification.countDocuments = originalCount;
  }
});

// -----------------------------------------------------------------------------
// Test 6: Unread Notification Count
// -----------------------------------------------------------------------------
test('Step 10C - 6: getUnreadCount returns count of unread notifications for recipient', async () => {
  const userId = new mongoose.Types.ObjectId().toString();

  const originalCount = Notification.countDocuments;

  try {
    Notification.countDocuments = async (filter) => {
      assert.equal(filter.recipient.toString(), userId);
      assert.equal(filter.read, false);
      return 7;
    };

    const res = await notificationService.getUnreadCount({ _id: userId, role: 'customer' });
    assert.equal(res.unreadCount, 7);
  } finally {
    Notification.countDocuments = originalCount;
  }
});

// -----------------------------------------------------------------------------
// Test 7: Mark Single Notification as Read with Recipient Authorization
// -----------------------------------------------------------------------------
test('Step 10C - 7: markOneAsRead updates read status and rejects unauthorized users', async () => {
  const userA = new mongoose.Types.ObjectId().toString();
  const userB = new mongoose.Types.ObjectId().toString();
  const notificationId = new mongoose.Types.ObjectId().toString();

  const originalFindById = Notification.findById;

  try {
    const mockNotification = {
      _id: notificationId,
      recipient: userA,
      read: false,
      readAt: null,
      save: async function () {
        return this;
      },
    };

    Notification.findById = async () => mockNotification;

    // 1. User B attempts to mark User A's notification -> 403 Forbidden
    await assert.rejects(
      async () => {
        await notificationService.markOneAsRead(
          { _id: userB, role: 'customer' },
          notificationId,
        );
      },
      (err) => {
        assert.equal(err.statusCode, 403);
        assert.ok(err.message.includes('not authorized'));
        return true;
      },
    );

    // 2. User A marks their own notification -> success
    const updated = await notificationService.markOneAsRead(
      { _id: userA, role: 'customer' },
      notificationId,
    );
    assert.equal(updated.read, true);
    assert.ok(updated.readAt instanceof Date);

    // 3. Non-existent notification -> 404 NotFoundError
    Notification.findById = async () => null;
    await assert.rejects(
      async () => {
        await notificationService.markOneAsRead(
          { _id: userA, role: 'customer' },
          notificationId,
        );
      },
      (err) => {
        assert.equal(err.statusCode, 404);
        assert.ok(err.message.includes('Notification not found'));
        return true;
      },
    );
  } finally {
    Notification.findById = originalFindById;
  }
});

// -----------------------------------------------------------------------------
// Test 8: Bulk Mark All Notifications as Read
// -----------------------------------------------------------------------------
test('Step 10C - 8: markAllAsRead atomically updates all unread notifications for caller', async () => {
  const userId = new mongoose.Types.ObjectId().toString();

  const originalUpdateMany = Notification.updateMany;
  let capturedFilter = null;
  let capturedUpdate = null;

  try {
    Notification.updateMany = async (filter, update) => {
      capturedFilter = filter;
      capturedUpdate = update;
      return { modifiedCount: 12 };
    };

    const res = await notificationService.markAllAsRead({ _id: userId, role: 'customer' });
    assert.equal(res.modifiedCount, 12);
    assert.equal(capturedFilter.recipient.toString(), userId);
    assert.equal(capturedFilter.read, false);
    assert.equal(capturedUpdate.$set.read, true);
    assert.ok(capturedUpdate.$set.readAt instanceof Date);
  } finally {
    Notification.updateMany = originalUpdateMany;
  }
});

// -----------------------------------------------------------------------------
// Test 9: Idempotent Notification Creation
// -----------------------------------------------------------------------------
test('Step 10C - 9: createNotification returns existing document when idempotencyKey matches', async () => {
  const recipient = new mongoose.Types.ObjectId();
  const idempotencyKey = 'event-12345';

  const originalFindOne = Notification.findOne;
  const originalCreate = Notification.create;

  let createCalls = 0;

  try {
    const existingDoc = {
      _id: new mongoose.Types.ObjectId(),
      recipient,
      idempotencyKey,
      title: 'Original Notification',
    };

    // When document already exists for this idempotencyKey
    Notification.findOne = async (filter) => {
      if (filter.idempotencyKey === idempotencyKey) {
        return existingDoc;
      }
      return null;
    };

    Notification.create = async () => {
      createCalls += 1;
      return existingDoc;
    };

    const result = await notificationService.createNotification({
      recipient,
      type: 'system',
      title: 'Duplicate Event',
      message: 'This should not be duplicated',
      idempotencyKey,
    });

    assert.equal(result._id, existingDoc._id);
    assert.equal(createCalls, 0); // Did not attempt to create duplicate
  } finally {
    Notification.findOne = originalFindOne;
    Notification.create = originalCreate;
  }
});

// -----------------------------------------------------------------------------
// Test 10: Fail-Safe Event Dispatch Isolation
// -----------------------------------------------------------------------------
test('Step 10C - 10: safeDispatchNotification handles database errors without throwing', async () => {
  const originalCreate = Notification.create;
  const originalFindOne = Notification.findOne;

  try {
    Notification.findOne = async () => null;
    Notification.create = async () => {
      throw new Error('Database connection dropped temporarily');
    };

    // safeDispatchNotification must not throw!
    const result = await notificationService.safeDispatchNotification({
      recipient: new mongoose.Types.ObjectId(),
      type: 'system',
      title: 'Notice',
      message: 'Notice text',
    });

    assert.equal(result, null);
  } finally {
    Notification.create = originalCreate;
    Notification.findOne = originalFindOne;
  }
});

// -----------------------------------------------------------------------------
// Test 11: Structured External Provider Interfaces
// -----------------------------------------------------------------------------
test('Step 10C - 11: External provider interfaces report not_configured and delivered: false', async () => {
  const { sms, email, push } = notificationService.externalProviders;

  assert.equal(sms.status, 'not_configured');
  const smsResult = await sms.send({ to: '+919876543210', text: 'OTP code' });
  assert.equal(smsResult.delivered, false);
  assert.equal(smsResult.status, 'not_configured');

  assert.equal(email.status, 'not_configured');
  const emailResult = await email.send({ to: 'user@example.com', subject: 'Receipt', body: '...' });
  assert.equal(emailResult.delivered, false);
  assert.equal(emailResult.status, 'not_configured');

  assert.equal(push.status, 'not_configured');
  const pushResult = await push.send({ to: 'device_token', title: 'Alert', body: '...' });
  assert.equal(pushResult.delivered, false);
  assert.equal(pushResult.status, 'not_configured');
});

// -----------------------------------------------------------------------------
// Test 12: Event Integration with Messaging and SOS Workflows
// -----------------------------------------------------------------------------
test('Step 10C - 12: Sending a message and raising an SOS safely trigger in-app notification dispatch', async () => {
  const customerId = new mongoose.Types.ObjectId().toString();
  const caregiverUserId = new mongoose.Types.ObjectId().toString();
  const bookingId = new mongoose.Types.ObjectId().toString();

  const originalFindByIdBooking = Booking.findById;
  const originalFindOneCustomer = CustomerProfile.findOne;
  const originalCreateMessage = Message.create;
  const originalCreateSos = SosIncident.create;
  const originalCreateNotification = Notification.create;
  const originalFindOneNotification = Notification.findOne;

  let dispatchedNotifications = [];

  try {
    Booking.findById = async () => ({
      _id: bookingId,
      customer: customerId,
      caregiverUser: caregiverUserId,
      status: 'confirmed',
    });

    CustomerProfile.findOne = async () => null;

    Message.create = async (doc) => ({
      ...doc,
      _id: new mongoose.Types.ObjectId(),
      populate: async function () {
        return this;
      },
    });

    SosIncident.create = async (doc) => ({
      ...doc,
      _id: new mongoose.Types.ObjectId(),
      incidentNumber: 'SOS-20261017-12345',
      priority: 'Critical',
      populate: async function () {
        return this;
      },
    });

    Notification.findOne = async () => null;
    Notification.create = async (doc) => {
      dispatchedNotifications.push(doc);
      return { ...doc, _id: new mongoose.Types.ObjectId() };
    };

    // 1. Customer sends message -> triggers in-app notification to caregiverUser
    await messageService.sendMessage(
      { _id: customerId, role: 'customer' },
      { bookingId, content: 'Medicines have arrived' },
    );

    assert.equal(dispatchedNotifications.length, 1);
    assert.equal(dispatchedNotifications[0].recipient.toString(), caregiverUserId);
    assert.equal(dispatchedNotifications[0].type, 'message_received');
    assert.ok(dispatchedNotifications[0].idempotencyKey.startsWith('msg:'));

    // 2. Caregiver raises SOS -> triggers in-app notification to customer
    await sosService.raiseSos(
      { _id: caregiverUserId, role: 'caregiver' },
      { bookingId, summary: 'Patient feels weak and feverish', priority: 'High' },
    );

    assert.equal(dispatchedNotifications.length, 2);
    assert.equal(dispatchedNotifications[1].recipient.toString(), customerId);
    assert.equal(dispatchedNotifications[1].type, 'sos_raised');
    assert.ok(dispatchedNotifications[1].idempotencyKey.startsWith('sos:'));
  } finally {
    Booking.findById = originalFindByIdBooking;
    CustomerProfile.findOne = originalFindOneCustomer;
    Message.create = originalCreateMessage;
    SosIncident.create = originalCreateSos;
    Notification.create = originalCreateNotification;
    Notification.findOne = originalFindOneNotification;
  }
});
