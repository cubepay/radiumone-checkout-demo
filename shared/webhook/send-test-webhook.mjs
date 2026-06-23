// Local webhook tester. Signs a sample event with your RADIUMONE_WEBHOOK_SECRET
// and POSTs it to a running receiver — so you can exercise the endpoint on
// localhost WITHOUT a public tunnel or a real sandbox delivery.
//
// Usage:
//   RADIUMONE_WEBHOOK_SECRET=whsec_<hex> node shared/webhook/send-test-webhook.mjs [url] [event-type]
//   (Windows PowerShell)  $env:RADIUMONE_WEBHOOK_SECRET="whsec_<hex>"; node shared/webhook/send-test-webhook.mjs
//
// Defaults: url=http://localhost:3000/api/webhook, event-type=payment.completed
// The secret here must match the one your receiver is configured with.

import { createHmac } from 'node:crypto';

const url = process.argv[2] || 'http://localhost:3000/api/webhook';
const eventType = process.argv[3] || 'payment.completed';
const whsec = process.env.RADIUMONE_WEBHOOK_SECRET;

if (!whsec) {
  console.error('Set RADIUMONE_WEBHOOK_SECRET (whsec_<hex>) first — it must match the receiver.');
  process.exit(1);
}

// A minimal v1 event body, mirroring the consumer guide's schema.
const event = {
  id: `evt_${Date.now()}`,
  type: eventType,
  created_at: new Date().toISOString(),
  payload_version: 'v1',
  data: {
    transaction_id: 'txn_demo_123',
    merchant_id: 'merchant_demo',
    transaction_type: 'PURCHASE',
    status: eventType.startsWith('refund') ? 'REFUNDED' : 'CAPTURED',
    response_code: '00',
    amount: { minor_units: 9452, currency: 'SGD' },
    request_id: 'req_demo',
  },
};

// Sign exactly as the Gateway does: HMAC-SHA256 over `{t}.` + raw body bytes.
const rawBody = Buffer.from(JSON.stringify(event));
const t = Math.floor(Date.now() / 1000);
const secretBytes = Buffer.from(whsec.startsWith('whsec_') ? whsec.slice(6) : whsec, 'hex');
const v1 = createHmac('sha256', secretBytes).update(Buffer.concat([Buffer.from(`${t}.`), rawBody])).digest('hex');

const res = await fetch(url, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'X-RadiumOne-Signature': `t=${t},v1=${v1}`,
    'X-RadiumOne-Event-Id': event.id,
    'X-RadiumOne-Event-Type': event.type,
  },
  body: rawBody,
});

console.log(`→ POST ${url}  (${eventType})`);
console.log(`← ${res.status} ${res.statusText}: ${await res.text()}`);
