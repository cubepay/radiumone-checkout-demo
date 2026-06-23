// Runs under `node --test`. No deps. Covers the security-critical verifier
// (against the consumer guide's known-answer vector) and the ordering reducer.

import test from 'node:test';
import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import { verifyWebhookSignature } from './verify-webhook-signature.mjs';
import { reduceEvent, statusForEvent } from './webhook-event-processor.mjs';

// ─── Known-answer test vector (from the Webhook Consumer Guide) ──────────────
const KAT = {
  keyHex: '000102030405060708090a0b0c0d0e0f1011121314151617181920212223',
  t: 1234567890,
  body: '{"id": "evt_123", "type": "payment.captured"}',
  v1: '8f115e9fc9aa3fa6df43f016f7fe1b736a1fe626c01ed09f8990202579ad9177',
};
// The vector's timestamp is in 2009, so pin `now` to it to pass the replay window.
const katNowMs = KAT.t * 1000;
const katHeader = `t=${KAT.t},v1=${KAT.v1}`;

test('KAT: valid signature verifies', () => {
  const r = verifyWebhookSignature(KAT.body, katHeader, KAT.keyHex, { nowMs: katNowMs });
  assert.equal(r.ok, true);
});

test('KAT: whsec_ prefix is stripped before decoding', () => {
  const r = verifyWebhookSignature(KAT.body, katHeader, `whsec_${KAT.keyHex}`, { nowMs: katNowMs });
  assert.equal(r.ok, true);
});

test('tampered body fails', () => {
  const r = verifyWebhookSignature(KAT.body + ' ', katHeader, KAT.keyHex, { nowMs: katNowMs });
  assert.equal(r.ok, false);
  assert.equal(r.reason, 'signature_mismatch');
});

test('wrong secret fails', () => {
  const r = verifyWebhookSignature(KAT.body, katHeader, '00'.repeat(30), { nowMs: katNowMs });
  assert.equal(r.ok, false);
});

test('timestamp outside window is rejected', () => {
  // Same body/sig but evaluate "now" far from the vector's timestamp.
  const r = verifyWebhookSignature(KAT.body, katHeader, KAT.keyHex, { nowMs: Date.now() });
  assert.equal(r.ok, false);
  assert.equal(r.reason, 'timestamp_out_of_window');
});

test('missing / malformed header rejected', () => {
  assert.equal(verifyWebhookSignature(KAT.body, null, KAT.keyHex).reason, 'missing_signature');
  assert.equal(verifyWebhookSignature(KAT.body, 'garbage', KAT.keyHex).reason, 'malformed_signature');
});

test('freshly signed body round-trips', () => {
  const t = Math.floor(Date.now() / 1000);
  const body = JSON.stringify({ id: 'evt_x', type: 'payment.completed' });
  const sig = createHmac('sha256', Buffer.from(KAT.keyHex, 'hex'))
    .update(`${t}.${body}`)
    .digest('hex');
  const r = verifyWebhookSignature(body, `t=${t},v1=${sig}`, KAT.keyHex);
  assert.equal(r.ok, true);
});

// ─── Ordering / idempotency reducer ──────────────────────────────────────────
const evt = (over) => ({
  id: 'evt_1', type: 'payment.captured', created_at: '2026-06-21T14:30:45Z',
  data: { transaction_id: 'txn_1', amount: { minor_units: 9452, currency: 'SGD' } },
  ...over,
});

test('first capture applies and fulfils', () => {
  const r = reduceEvent({ event: evt(), alreadySeen: false, order: undefined });
  assert.equal(r.action, 'applied');
  assert.equal(r.fulfill, true);
  assert.equal(r.status, 'CAPTURED');
  assert.equal(r.nextOrder.fulfilled, true);
});

test('duplicate event id is deduped', () => {
  const r = reduceEvent({ event: evt(), alreadySeen: true });
  assert.equal(r.action, 'duplicate');
});

test('stale (older created_at) is discarded', () => {
  const order = { status: 'CAPTURED', fulfilled: true, lastCreatedAtMs: Date.parse('2026-06-21T14:30:45Z') };
  const older = evt({ id: 'evt_0', type: 'payment.authorized', created_at: '2026-06-21T14:00:00Z' });
  assert.equal(reduceEvent({ event: older, alreadySeen: false, order }).action, 'stale');
});

test('second fulfil event does not re-fulfil', () => {
  const order = { status: 'CAPTURED', fulfilled: true, lastCreatedAtMs: Date.parse('2026-06-21T14:30:45Z') };
  const later = evt({ id: 'evt_2', type: 'payment.completed', created_at: '2026-06-21T15:00:00Z' });
  const r = reduceEvent({ event: later, alreadySeen: false, order });
  assert.equal(r.action, 'applied');
  assert.equal(r.fulfill, false);
});

test('statusForEvent maps known + unknown types', () => {
  assert.equal(statusForEvent('refund.succeeded'), 'REFUNDED');
  assert.equal(statusForEvent('payment.future_event'), null);
});
