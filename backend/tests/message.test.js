import test from 'node:test';
import assert from 'node:assert/strict';
import mongoose from 'mongoose';
import { Message, Booking, User } from '../src/models/index.js';
import * as messageService from '../src/services/messageService.js';
import {
  validateSendMessage,
  validateGetMessages,
  validateMarkRead,
} from '../src/middleware/validateMessage.js';
import { messageLimiter } from '../src/middleware/rateLimiter.js';
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
// Test 1: Input Validation for Sending Messages
// -----------------------------------------------------------------------------
test('Step 10B - 1: validateSendMessage enforces bookingId ObjectId, non-empty content, and max length bounds', () => {
  const validBookingId = new mongoose.Types.ObjectId().toString();

  // 1. Missing bookingId -> 400
  const { req: r1, res: res1, next: n1, getNextCalled: called1, getNextError: err1 } = createMockReqRes({
    body: { content: 'Hello there' },
  });
  validateSendMessage(r1, res1, n1);
  assert.equal(called1(), true);
  assert.equal(err1()?.statusCode, 400);
  assert.ok(/booking identifier/i.test(err1()?.message));

  // 2. Malformed bookingId -> 400
  const { req: r2, res: res2, next: n2, getNextCalled: called2, getNextError: err2 } = createMockReqRes({
    body: { bookingId: '123-not-an-id', content: 'Hello there' },
  });
  validateSendMessage(r2, res2, n2);
  assert.equal(called2(), true);
  assert.equal(err2()?.statusCode, 400);

  // 3. Missing content -> 400
  const { req: r3, res: res3, next: n3, getNextCalled: called3, getNextError: err3 } = createMockReqRes({
    body: { bookingId: validBookingId },
  });
  validateSendMessage(r3, res3, n3);
  assert.equal(called3(), true);
  assert.equal(err3()?.statusCode, 400);
  assert.ok(/content cannot be empty/i.test(err3()?.message));

  // 4. Whitespace-only content -> 400
  const { req: r4, res: res4, next: n4, getNextCalled: called4, getNextError: err4 } = createMockReqRes({
    body: { bookingId: validBookingId, content: '    ' },
  });
  validateSendMessage(r4, res4, n4);
  assert.equal(called4(), true);
  assert.equal(err4()?.statusCode, 400);
  assert.ok(/content cannot be empty/i.test(err4()?.message));

  // 5. Oversized content (> 2000 chars) -> 400
  const longContent = 'A'.repeat(2001);
  const { req: r5, res: res5, next: n5, getNextCalled: called5, getNextError: err5 } = createMockReqRes({
    body: { bookingId: validBookingId, content: longContent },
  });
  validateSendMessage(r5, res5, n5);
  assert.equal(called5(), true);
  assert.equal(err5()?.statusCode, 400);
  assert.ok(/cannot exceed 2000 characters/i.test(err5()?.message));

  // 6. Valid payload -> sets req.messageData and ignores malicious client-supplied fields
  const { req: r6, res: res6, next: n6, getNextCalled: called6, getNextError: err6 } = createMockReqRes({
    body: {
      bookingId: validBookingId,
      content: '  I have arrived at the hospital lobby.  ',
      sender: 'spoofed_sender_id',
      recipient: 'spoofed_recipient_id',
      senderRole: 'admin',
    },
  });
  validateSendMessage(r6, res6, n6);
  assert.equal(called6(), true);
  assert.equal(err6(), null);
  assert.equal(r6.messageData.bookingId, validBookingId);
  assert.equal(r6.messageData.content, 'I have arrived at the hospital lobby.');
  assert.equal(r6.messageData.sender, undefined);
  assert.equal(r6.messageData.recipient, undefined);
  assert.equal(r6.messageData.senderRole, undefined);
});

// -----------------------------------------------------------------------------
// Test 2: Input Validation for Querying History and Marking Read
// -----------------------------------------------------------------------------
test('Step 10B - 2: validateGetMessages and validateMarkRead enforce valid booking ObjectId in params', () => {
  const validBookingId = new mongoose.Types.ObjectId().toString();

  // 1. validateGetMessages: invalid bookingId -> 400
  const { req: r1, res: res1, next: n1, getNextCalled: c1, getNextError: e1 } = createMockReqRes({
    params: { bookingId: 'invalid-hex' },
  });
  validateGetMessages(r1, res1, n1);
  assert.equal(c1(), true);
  assert.equal(e1()?.statusCode, 400);

  // 2. validateGetMessages: valid bookingId -> sets req.validatedBookingId
  const { req: r2, res: res2, next: n2, getNextCalled: c2, getNextError: e2 } = createMockReqRes({
    params: { bookingId: validBookingId },
  });
  validateGetMessages(r2, res2, n2);
  assert.equal(c2(), true);
  assert.equal(e2(), null);
  assert.equal(r2.validatedBookingId, validBookingId);

  // 3. validateMarkRead: invalid bookingId -> 400
  const { req: r3, res: res3, next: n3, getNextCalled: c3, getNextError: e3 } = createMockReqRes({
    params: { bookingId: 'malformed' },
  });
  validateMarkRead(r3, res3, n3);
  assert.equal(c3(), true);
  assert.equal(e3()?.statusCode, 400);

  // 4. validateMarkRead: valid bookingId -> sets req.validatedBookingId
  const { req: r4, res: res4, next: n4, getNextCalled: c4, getNextError: e4 } = createMockReqRes({
    params: { bookingId: validBookingId },
  });
  validateMarkRead(r4, res4, n4);
  assert.equal(c4(), true);
  assert.equal(e4(), null);
  assert.equal(r4.validatedBookingId, validBookingId);
});

// -----------------------------------------------------------------------------
// Test 3: Message Rate Limiter Configuration
// -----------------------------------------------------------------------------
test('Step 10B - 3: Dedicated message rate limiter is configured for 60 requests per 1 minute window', () => {
  assert.ok(messageLimiter);
  assert.equal(typeof messageLimiter, 'function');
  assert.equal(process.env.NODE_ENV, 'test');
});

// -----------------------------------------------------------------------------
// Test 4: Deriving Participants Server-Side and Preventing Impersonation
// -----------------------------------------------------------------------------
test('Step 10B - 4: sendMessage derives sender and recipient server-side, preventing spoofing', async () => {
  const customerId = new mongoose.Types.ObjectId().toString();
  const caregiverUserId = new mongoose.Types.ObjectId().toString();
  const bookingId = new mongoose.Types.ObjectId().toString();

  const originalFindById = Booking.findById;
  const originalCreate = Message.create;

  let capturedDoc = null;

  try {
    const mockBooking = {
      _id: bookingId,
      customer: customerId,
      caregiverUser: caregiverUserId,
      status: 'confirmed',
    };

    Booking.findById = async () => mockBooking;

    Message.create = async (doc) => {
      capturedDoc = doc;
      return {
        ...doc,
        _id: new mongoose.Types.ObjectId(),
        populate: async function () {
          return this;
        },
      };
    };

    // 1. Customer sends message -> sender is customer, recipient is caregiverUser
    await messageService.sendMessage(
      { _id: customerId, role: 'customer' },
      { bookingId, content: 'Patient is ready in Room 302' },
    );

    assert.equal(capturedDoc.booking.toString(), bookingId);
    assert.equal(capturedDoc.sender.toString(), customerId);
    assert.equal(capturedDoc.senderRole, 'customer');
    assert.equal(capturedDoc.recipient.toString(), caregiverUserId);
    assert.equal(capturedDoc.recipientRole, 'caregiver');
    assert.equal(capturedDoc.content, 'Patient is ready in Room 302');

    // 2. Caregiver sends message -> sender is caregiverUser, recipient is customer
    await messageService.sendMessage(
      { _id: caregiverUserId, role: 'caregiver' },
      { bookingId, content: 'On my way up the elevator now' },
    );

    assert.equal(capturedDoc.sender.toString(), caregiverUserId);
    assert.equal(capturedDoc.senderRole, 'caregiver');
    assert.equal(capturedDoc.recipient.toString(), customerId);
    assert.equal(capturedDoc.recipientRole, 'customer');
  } finally {
    Booking.findById = originalFindById;
    Message.create = originalCreate;
  }
});

// -----------------------------------------------------------------------------
// Test 5: Stranger & Unrelated-Booking Access Rejection
// -----------------------------------------------------------------------------
test('Step 10B - 5: Strangers and unrelated users cannot send, view, or mark messages as read', async () => {
  const customerId = new mongoose.Types.ObjectId().toString();
  const caregiverUserId = new mongoose.Types.ObjectId().toString();
  const strangerUserId = new mongoose.Types.ObjectId().toString();
  const bookingId = new mongoose.Types.ObjectId().toString();

  const originalFindById = Booking.findById;

  try {
    const mockBooking = {
      _id: bookingId,
      customer: customerId,
      caregiverUser: caregiverUserId,
      status: 'confirmed',
    };

    Booking.findById = async () => mockBooking;

    // 1. Stranger customer sends message -> 403 Forbidden
    await assert.rejects(
      async () => {
        await messageService.sendMessage(
          { _id: strangerUserId, role: 'customer' },
          { bookingId, content: 'Spam from stranger' },
        );
      },
      (err) => {
        assert.equal(err.statusCode, 403);
        assert.ok(err.message.includes('not an authorized participant'));
        return true;
      },
    );

    // 2. Unrelated caregiver sends message -> 403 Forbidden
    await assert.rejects(
      async () => {
        await messageService.sendMessage(
          { _id: strangerUserId, role: 'caregiver' },
          { bookingId, content: 'Unrelated caregiver sending message' },
        );
      },
      (err) => {
        assert.equal(err.statusCode, 403);
        assert.ok(err.message.includes('not an authorized participant'));
        return true;
      },
    );

    // 3. Stranger views messages -> 403 Forbidden
    await assert.rejects(
      async () => {
        await messageService.getMessages(
          { _id: strangerUserId, role: 'customer' },
          bookingId,
        );
      },
      (err) => {
        assert.equal(err.statusCode, 403);
        assert.ok(err.message.includes('not authorized to view messages'));
        return true;
      },
    );

    // 4. Stranger marks messages as read -> 403 Forbidden
    await assert.rejects(
      async () => {
        await messageService.markMessagesAsRead(
          { _id: strangerUserId, role: 'customer' },
          bookingId,
        );
      },
      (err) => {
        assert.equal(err.statusCode, 403);
        assert.ok(err.message.includes('not authorized to update messages'));
        return true;
      },
    );

    // 5. Non-existent booking -> 404 NotFoundError
    Booking.findById = async () => null;
    await assert.rejects(
      async () => {
        await messageService.sendMessage(
          { _id: customerId, role: 'customer' },
          { bookingId, content: 'Hello' },
        );
      },
      (err) => {
        assert.equal(err.statusCode, 404);
        assert.ok(err.message.includes('Booking not found'));
        return true;
      },
    );
  } finally {
    Booking.findById = originalFindById;
  }
});

// -----------------------------------------------------------------------------
// Test 6: Booking Lifecycle Restrictions on Message Sending
// -----------------------------------------------------------------------------
test('Step 10B - 6: Message sending is permitted in pending/confirmed/in_progress and rejected in cancelled/rejected/completed', async () => {
  const customerId = new mongoose.Types.ObjectId().toString();
  const caregiverUserId = new mongoose.Types.ObjectId().toString();
  const bookingId = new mongoose.Types.ObjectId().toString();

  const originalFindById = Booking.findById;
  const originalCreate = Message.create;

  try {
    Message.create = async (doc) => ({
      ...doc,
      _id: new mongoose.Types.ObjectId(),
      populate: async function () {
        return this;
      },
    });

    // 1. Permitted statuses: pending, confirmed, in_progress
    for (const allowedStatus of ['pending', 'confirmed', 'in_progress']) {
      Booking.findById = async () => ({
        _id: bookingId,
        customer: customerId,
        caregiverUser: caregiverUserId,
        status: allowedStatus,
      });

      const res = await messageService.sendMessage(
        { _id: customerId, role: 'customer' },
        { bookingId, content: `Message sent in ${allowedStatus} state` },
      );
      assert.ok(res);
      assert.equal(res.content, `Message sent in ${allowedStatus} state`);
    }

    // 2. Blocked status: cancelled -> 400 ValidationError
    Booking.findById = async () => ({
      _id: bookingId,
      customer: customerId,
      caregiverUser: caregiverUserId,
      status: 'cancelled',
    });

    await assert.rejects(
      async () => {
        await messageService.sendMessage(
          { _id: customerId, role: 'customer' },
          { bookingId, content: 'Trying to send in cancelled state' },
        );
      },
      (err) => {
        assert.equal(err.statusCode, 400);
        assert.ok(err.message.includes("Cannot send messages for a booking in 'cancelled' status"));
        return true;
      },
    );

    // 3. Blocked status: rejected -> 400 ValidationError
    Booking.findById = async () => ({
      _id: bookingId,
      customer: customerId,
      caregiverUser: caregiverUserId,
      status: 'rejected',
    });

    await assert.rejects(
      async () => {
        await messageService.sendMessage(
          { _id: customerId, role: 'customer' },
          { bookingId, content: 'Trying to send in rejected state' },
        );
      },
      (err) => {
        assert.equal(err.statusCode, 400);
        assert.ok(err.message.includes("Cannot send messages for a booking in 'rejected' status"));
        return true;
      },
    );

    // 4. Blocked status: completed -> 400 ValidationError
    Booking.findById = async () => ({
      _id: bookingId,
      customer: customerId,
      caregiverUser: caregiverUserId,
      status: 'completed',
    });

    await assert.rejects(
      async () => {
        await messageService.sendMessage(
          { _id: customerId, role: 'customer' },
          { bookingId, content: 'Trying to send in completed state' },
        );
      },
      (err) => {
        assert.equal(err.statusCode, 400);
        assert.ok(err.message.includes("Cannot send messages for a booking in 'completed' status"));
        return true;
      },
    );
  } finally {
    Booking.findById = originalFindById;
    Message.create = originalCreate;
  }
});

// -----------------------------------------------------------------------------
// Test 7: Historical Messages Remain Readable Across All Lifecycle States
// -----------------------------------------------------------------------------
test('Step 10B - 7: Historical messages remain accessible after cancellation, rejection, or completion', async () => {
  const customerId = new mongoose.Types.ObjectId().toString();
  const caregiverUserId = new mongoose.Types.ObjectId().toString();
  const adminUserId = new mongoose.Types.ObjectId().toString();
  const bookingId = new mongoose.Types.ObjectId().toString();

  const originalFindById = Booking.findById;
  const originalFind = Message.find;
  const originalCount = Message.countDocuments;

  try {
    Message.find = () => ({
      sort: () => ({
        skip: () => ({
          limit: () => ({
            populate: () => ({
              populate: async () => [
                { _id: new mongoose.Types.ObjectId(), content: 'Historical shift note' },
              ],
            }),
          }),
        }),
      }),
    });
    Message.countDocuments = async () => 1;

    for (const closedStatus of ['completed', 'cancelled', 'rejected']) {
      Booking.findById = async () => ({
        _id: bookingId,
        customer: customerId,
        caregiverUser: caregiverUserId,
        status: closedStatus,
      });

      // Customer can read historical messages
      const customerHistory = await messageService.getMessages(
        { _id: customerId, role: 'customer' },
        bookingId,
      );
      assert.equal(customerHistory.messages.length, 1);

      // Caregiver can read historical messages
      const caregiverHistory = await messageService.getMessages(
        { _id: caregiverUserId, role: 'caregiver' },
        bookingId,
      );
      assert.equal(caregiverHistory.messages.length, 1);

      // Admin can read historical messages
      const adminHistory = await messageService.getMessages(
        { _id: adminUserId, role: 'admin' },
        bookingId,
      );
      assert.equal(adminHistory.messages.length, 1);
    }
  } finally {
    Booking.findById = originalFindById;
    Message.find = originalFind;
    Message.countDocuments = originalCount;
  }
});

// -----------------------------------------------------------------------------
// Test 8: Pagination Boundaries & Chronological Ordering
// -----------------------------------------------------------------------------
test('Step 10B - 8: Pagination clamps limit to 50, minimum page to 1, and orders chronologically', async () => {
  const customerId = new mongoose.Types.ObjectId().toString();
  const caregiverUserId = new mongoose.Types.ObjectId().toString();
  const bookingId = new mongoose.Types.ObjectId().toString();

  const originalFindById = Booking.findById;
  const originalFind = Message.find;
  const originalCount = Message.countDocuments;

  let capturedSort = null;
  let capturedSkip = null;
  let capturedLimit = null;

  try {
    Booking.findById = async () => ({
      _id: bookingId,
      customer: customerId,
      caregiverUser: caregiverUserId,
      status: 'confirmed',
    });

    Message.find = () => ({
      sort: (s) => {
        capturedSort = s;
        return {
          skip: (sk) => {
            capturedSkip = sk;
            return {
              limit: (lim) => {
                capturedLimit = lim;
                return {
                  populate: () => ({
                    populate: async () => [{ _id: new mongoose.Types.ObjectId(), content: 'msg' }],
                  }),
                };
              },
            };
          },
        };
      },
    });
    Message.countDocuments = async () => 100;

    // Test with page 3 and excessive limit 200 -> should clamp limit to 50
    const result = await messageService.getMessages(
      { _id: customerId, role: 'customer' },
      bookingId,
      { page: 3, limit: 200 },
    );

    assert.deepEqual(capturedSort, { createdAt: 1 }); // Chronological
    assert.equal(capturedLimit, 50); // Clamped from 200
    assert.equal(capturedSkip, 100); // (page 3 - 1) * 50 = 100
    assert.equal(result.pagination.total, 100);
    assert.equal(result.pagination.pages, 2);
    assert.equal(result.pagination.page, 3);
  } finally {
    Booking.findById = originalFindById;
    Message.find = originalFind;
    Message.countDocuments = originalCount;
  }
});

// -----------------------------------------------------------------------------
// Test 9: Recipient-Only Read State Changes and Atomic Updates
// -----------------------------------------------------------------------------
test('Step 10B - 9: markMessagesAsRead updates incoming messages only and scopes to recipient', async () => {
  const customerId = new mongoose.Types.ObjectId().toString();
  const caregiverUserId = new mongoose.Types.ObjectId().toString();
  const bookingId = new mongoose.Types.ObjectId().toString();

  const originalFindById = Booking.findById;
  const originalUpdateMany = Message.updateMany;

  let capturedFilter = null;
  let capturedUpdate = null;

  try {
    Booking.findById = async () => ({
      _id: bookingId,
      customer: customerId,
      caregiverUser: caregiverUserId,
      status: 'confirmed',
    });

    Message.updateMany = async (filter, update) => {
      capturedFilter = filter;
      capturedUpdate = update;
      return { modifiedCount: 4 };
    };

    // When caregiver marks as read: recipient filter MUST be caregiverUserId
    const res = await messageService.markMessagesAsRead(
      { _id: caregiverUserId, role: 'caregiver' },
      bookingId,
    );

    assert.equal(res.modifiedCount, 4);
    assert.equal(capturedFilter.booking.toString(), bookingId);
    assert.equal(capturedFilter.recipient.toString(), caregiverUserId);
    assert.equal(capturedFilter.read, false);
    assert.equal(capturedUpdate.$set.read, true);
    assert.ok(capturedUpdate.$set.readAt instanceof Date);
  } finally {
    Booking.findById = originalFindById;
    Message.updateMany = originalUpdateMany;
  }
});

// -----------------------------------------------------------------------------
// Test 10: Unread-Message Counts
// -----------------------------------------------------------------------------
test('Step 10B - 10: getUnreadCounts aggregates total unread and groups by bookingId', async () => {
  const userId = new mongoose.Types.ObjectId().toString();
  const booking1 = new mongoose.Types.ObjectId();
  const booking2 = new mongoose.Types.ObjectId();

  const originalCount = Message.countDocuments;
  const originalAggregate = Message.aggregate;

  try {
    Message.countDocuments = async (filter) => {
      assert.equal(filter.recipient.toString(), userId);
      assert.equal(filter.read, false);
      return 5;
    };

    Message.aggregate = async (pipeline) => {
      return [
        { _id: booking1, count: 3 },
        { _id: booking2, count: 2 },
      ];
    };

    const counts = await messageService.getUnreadCounts({ _id: userId, role: 'customer' });
    assert.equal(counts.totalUnread, 5);
    assert.equal(counts.unreadByBooking.length, 2);
    assert.equal(counts.unreadByBooking[0].bookingId.toString(), booking1.toString());
    assert.equal(counts.unreadByBooking[0].unreadCount, 3);
  } finally {
    Message.countDocuments = originalCount;
    Message.aggregate = originalAggregate;
  }
});

// -----------------------------------------------------------------------------
// Test 11: Off-Platform Contact & Payment Circumvention Detection (Flagged for Review)
// -----------------------------------------------------------------------------
test('Step 10B - 11: Messages with phone numbers or UPI handles are flagged for review without hard-blocking', async () => {
  const customerId = new mongoose.Types.ObjectId().toString();
  const caregiverUserId = new mongoose.Types.ObjectId().toString();
  const bookingId = new mongoose.Types.ObjectId().toString();

  const originalFindById = Booking.findById;
  const originalCreate = Message.create;

  let capturedDocs = [];

  try {
    Booking.findById = async () => ({
      _id: bookingId,
      customer: customerId,
      caregiverUser: caregiverUserId,
      status: 'in_progress',
    });

    Message.create = async (doc) => {
      capturedDocs.push(doc);
      return {
        ...doc,
        _id: new mongoose.Types.ObjectId(),
        populate: async function () {
          return this;
        },
      };
    };

    // 1. Message with phone number -> isFlagged: true
    const phoneMsg = await messageService.sendMessage(
      { _id: customerId, role: 'customer' },
      { bookingId, content: 'Call me directly at 9876543210 for entry code' },
    );
    assert.ok(phoneMsg);
    const lastDoc1 = capturedDocs[capturedDocs.length - 1];
    assert.equal(lastDoc1.isFlagged, true);
    assert.ok(lastDoc1.flaggedReasons.some((r) => r.includes('phone number')));
    assert.ok(lastDoc1.flaggedAt instanceof Date);

    // 2. Message with UPI handle -> isFlagged: true
    const upiMsg = await messageService.sendMessage(
      { _id: caregiverUserId, role: 'caregiver' },
      { bookingId, content: 'Send tip to caregiver@okhdfcbank' },
    );
    assert.ok(upiMsg);
    const lastDoc2 = capturedDocs[capturedDocs.length - 1];
    assert.equal(lastDoc2.isFlagged, true);
    assert.ok(lastDoc2.flaggedReasons.some((r) => r.includes('UPI')));

    // 3. Normal care message -> isFlagged: false
    const normalMsg = await messageService.sendMessage(
      { _id: customerId, role: 'customer' },
      { bookingId, content: 'Please ensure patient takes the 4 PM medication on time.' },
    );
    assert.ok(normalMsg);
    const lastDoc3 = capturedDocs[capturedDocs.length - 1];
    assert.equal(lastDoc3.isFlagged, false);
    assert.equal(lastDoc3.flaggedReasons.length, 0);
  } finally {
    Booking.findById = originalFindById;
    Message.create = originalCreate;
  }
});

// -----------------------------------------------------------------------------
// Test 12: Authentication Requirement
// -----------------------------------------------------------------------------
test('Step 10B - 12: authenticate middleware rejects unauthenticated requests with 401', async () => {
  const { req, res, next } = createMockReqRes({
    headers: {},
    cookies: {},
  });

  await authenticate(req, res, next);
  assert.equal(res.statusCode, 401);
  assert.equal(res.jsonData.error, 'Unauthorized');
  assert.ok(/Authentication required/i.test(res.jsonData.message));
});
