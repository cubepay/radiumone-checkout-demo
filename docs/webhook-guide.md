# Webhook Guide — a sample approach

> Last verified: 2026-06-24

The browser redirect is a **UX signal, not a fulfilment trigger** — a customer
can close the tab before it fires. Authoritative order fulfilment comes from the
RadiumOne **Gateway webhook**. This demo ships a small **reference receiver** so
you have a working starting point; this guide is the sample approach to build on.

> This is a demo-grade receiver (in-memory state). It shows the *shape* of a
> correct integration; the [production hardening](#adapting-for-production)
> section lists what to add before going live.

---

## What the demo provides

| File | Role |
|---|---|
| `shared/webhook/verify-webhook-signature.mjs` | HMAC-SHA256 signature verification + replay window. Pure, shared, tested. |
| `shared/webhook/webhook-event-processor.mjs` | The at-least-once / unordered event reducer (dedup, stale-discard, fulfil-once). |
| `shared/webhook/webhook.test.mjs` | `node --test` suite, incl. the consumer guide's known-answer vector. |
| `shared/webhook/send-test-webhook.mjs` | Signs and POSTs a sample event to a local receiver (no internet needed). |
| `examples/html-vanilla/server.mjs` → `handleWebhook()` | The vanilla receiver at `POST /api/webhook`. |
| `examples/react-nextjs/src/app/api/webhook/route.ts` (+ `lib/webhook-store.ts`) | The Next.js receiver. |

The verification and ordering logic is **shared** so the two examples can't drift
— a merchant copies those two `shared/webhook/*.mjs` files plus one receiver.

---

## The receiver flow

Every delivery follows the same five steps (see either receiver):

1. **Verify the signature first.** HMAC-SHA256 over the *raw* body, with a
   ±5-minute replay window. Reject (`401`) before trusting any field.
2. **Parse** the JSON body (only after verifying). Reject malformed bodies `400`.
3. **Deduplicate** by event `id` — deliveries are *at-least-once*.
4. **Order-guard**: treat each event as a state assertion keyed by
   `transaction_id`; discard transitions older than the newest `created_at` you've
   applied — deliveries are *unordered*.
5. **Fulfil idempotently** on the first `payment.captured` / `payment.completed`,
   then **respond `2xx` within ~10s** so the Gateway doesn't retry.

```js
const verdict = verifyWebhookSignature(rawBody, signatureHeader, whsec);
if (!verdict.ok) return reject(401, verdict.reason);
const event = JSON.parse(rawBody.toString('utf8'));
const outcome = reduceEvent({ event, alreadySeen, order });   // duplicate | stale | applied
// persist outcome.nextOrder; if outcome.fulfill → fulfil once
return ok(200);
```

---

## Enable it

Set the signing secret (issued by CubePay support when you register an endpoint):

```bash
RADIUMONE_WEBHOOK_SECRET=whsec_<hex>
```

Until it's set, the receiver returns `503` (it can't verify deliveries).

---

## Test it locally

A sandbox delivery comes from the internet, but your dev receiver runs on
`localhost`. Two ways to bridge that gap:

### 1. No internet — sign and POST locally (fastest)

With a receiver running (`node server.mjs` or `pnpm dev`):

```bash
RADIUMONE_WEBHOOK_SECRET=whsec_<hex> node shared/webhook/send-test-webhook.mjs
# optional args: [url] [event-type]
node shared/webhook/send-test-webhook.mjs http://localhost:3000/api/webhook payment.completed
```

This exercises the full **verify → dedup → fulfil** path with no tunnel. Watch the
server console for `✓ FULFIL order …`. Run it twice with the same secret to see
the signature accepted; edit the secret to see a `401`.

### 2. Real sandbox deliveries — expose localhost with a tunnel

```bash
ngrok http 3000
# or: cloudflared tunnel --url http://localhost:3000
```

Give CubePay support the resulting **HTTPS** URL (`https://…/api/webhook`) as your
endpoint. Production endpoints must be a stable, publicly reachable HTTPS URL
(no private IPs).

---

## Event types (v1)

| Event | Asserts status | Demo fulfils? |
|---|---|---|
| `payment.authorized` | `AUTHORIZED` | no |
| `payment.captured` / `payment.completed` | `CAPTURED` | **yes (once)** |
| `payment.failed` | `FAILED` | no |
| `payment.voided` / `payment.reversed` | `VOIDED` / `REVERSED` | no |
| `refund.succeeded` / `refund.failed` | `REFUNDED` / `REFUND_FAILED` | no |

Unknown/future event types are handled gracefully (status left unchanged).

---

## Adapting for production

The demo keeps everything in memory and logs instead of fulfilling. Before going
live, replace those demo shortcuts:

- **Persist** seen event IDs and order state in your database — the in-memory
  `Map`/`Set` won't survive a restart or scale across instances.
- **Keep the handler fast** (`<10s`). Verify + record + enqueue, then return `2xx`;
  do heavy work (emails, ERP sync) in a background job.
- **Idempotent side-effects.** The same event can arrive more than once — never
  double-charge, double-ship, or double-notify.
- **Rotate the secret** if it may be exposed; only future deliveries use the new
  one. Request a fresh `whsec_` from CubePay support.

See [integration-guide.md → Step 4](./integration-guide.md#step-4--fulfil-from-the-gateway-webhook)
for the inline version, and ask RadiumOne support for the full Webhook Consumer Guide.
