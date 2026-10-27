import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'crypto';
import {
  createRazorpayOrder,
  verifyRazorpaySignature,
  initiateRazorpayRefund,
  getPublicRazorpayKey,
} from '../src/utils/paymentGateway.js';

describe('Step 15 — Razorpay Test Payment Gateway Integration', () => {
  it('1. Retrieves public Razorpay test key ID', () => {
    const keyId = getPublicRazorpayKey();
    assert.ok(typeof keyId === 'string' && keyId.length > 0);
  });

  it('2. Creates a Razorpay test order with correct paise calculation (1 INR = 100 paise)', async () => {
    const amountInRupees = 499;
    const order = await createRazorpayOrder({
      amount: amountInRupees,
      currency: 'INR',
      receipt: 'BK-TEST-1234',
      notes: { testNote: 'Bedside Care' },
    });

    assert.ok(order.id.startsWith('order_'));
    assert.equal(order.amount, 49900); // 499 * 100 paise
    assert.equal(order.currency, 'INR');
    assert.equal(order.receipt, 'BK-TEST-1234');
    assert.equal(order.status, 'created');
  });

  it('3. Cryptographically verifies genuine HMAC SHA-256 signature', () => {
    const orderId = 'order_test_abc123';
    const paymentId = 'pay_test_xyz789';
    const keySecret = process.env.RAZORPAY_KEY_SECRET || 'bystander_test_secret_sandbox_key_2026';

    const validSignature = crypto
      .createHmac('sha256', keySecret)
      .update(`${orderId}|${paymentId}`)
      .digest('hex');

    const result = verifyRazorpaySignature({
      orderId,
      paymentId,
      signature: validSignature,
    });

    assert.equal(result, true, 'Genuine HMAC SHA-256 signature must be verified as authentic');
  });

  it('4. Rejects tampered or invalid Razorpay signatures', () => {
    const orderId = 'order_test_abc123';
    const paymentId = 'pay_test_xyz789';
    const tamperedSignature = 'deadbeef0123456789abcdef0123456789abcdef0123456789abcdef01234567';

    const result = verifyRazorpaySignature({
      orderId,
      paymentId,
      signature: tamperedSignature,
    });

    assert.equal(result, false, 'Tampered signature must be rejected');
  });

  it('5. Rejects signature verification when parameters are missing or empty', () => {
    assert.equal(verifyRazorpaySignature({ orderId: '', paymentId: 'pay_123', signature: 'sig' }), false);
    assert.equal(verifyRazorpaySignature({ orderId: 'ord_123', paymentId: '', signature: 'sig' }), false);
    assert.equal(verifyRazorpaySignature({ orderId: null, paymentId: null, signature: null }), false);
  });

  it('6. Initiates simulated test refund with accurate paise amount', async () => {
    const refund = await initiateRazorpayRefund({
      paymentId: 'pay_test_refund123',
      amount: 1200,
      notes: { reason: 'Booking cancelled by customer' },
    });

    assert.ok(refund.id.startsWith('rfnd_'));
    assert.equal(refund.amount, 120000); // 1200 * 100 paise
    assert.equal(refund.status, 'processed');
  });
});
