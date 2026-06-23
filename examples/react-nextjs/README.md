# react-nextjs — RadiumOne Checkout Demo

> Last verified: 2026-06-24

Next.js 15 App Router integration demo. Session creation runs server-side (route handler); return verification runs in a server component. No secret key ever reaches the browser.

Part of [radiumone-checkout-demo](../../README.md).

## Prerequisites

- Node ≥ 20
- pnpm ≥ 10
- A sandbox API key from the RadiumOne merchant dashboard

## Run

```bash
cp .env.example .env.local
# Edit .env.local — paste your r1sk_test_* secret key (sandbox host is pre-filled)
pnpm install
pnpm dev
# Open http://localhost:3000
```

## File map

```
src/
├── app/
│   ├── layout.tsx                # Root layout, loads globals.css
│   ├── page.tsx                  # Cart page (server component)
│   ├── globals.css               # Wireframe styles
│   ├── cart-app.tsx              # "use client" — owns editable cart state; wraps cart-view + checkout-buttons
│   ├── cart-view.tsx             # "use client" — editable cart (unit price / qty / discount toggle)
│   ├── checkout-buttons.tsx      # "use client" — POSTs the edited cart breakdown to /api/checkout
│   ├── api/checkout/route.ts     # POST handler — mints nonce + creates HPP session
│   ├── api/webhook/route.ts      # POST handler — verifies signature + fulfils (Step 4)
│   ├── success/page.tsx          # Server component — consumes nonce + reads session for live status
│   └── cancel/page.tsx           # Server component — same flow for the cancel path
└── lib/
    ├── env.ts                    # Asserts and freezes required env vars (server-only)
    ├── mock-cart.ts              # Thin re-export of the unified fixture at shared/cart/cart-fixture.mjs
    ├── radiumone-client.ts       # Typed fetch wrappers: createCheckoutSession + getCheckoutSession
    ├── return-nonce-store.ts     # In-memory Map<checkout_id, nonce> — DEMO ONLY (replace with your order DB)
    ├── webhook-verify.ts         # Re-exports shared signature verify + event reducer
    └── webhook-store.ts          # In-memory webhook state (dedup + order status) — DEMO ONLY
```

## What it does NOT do

- **Production-grade webhook handling** — a reference receiver IS included at `POST /api/webhook` (signature verify + idempotent, out-of-order-safe fulfil), but its state is in-memory and demo-grade. Set `RADIUMONE_WEBHOOK_SECRET` to enable it; test locally with `node ../../shared/webhook/send-test-webhook.mjs`. In production, fulfil from the webhook (not the redirect) and persist state in your DB. See [../../docs/integration-guide.md#step-4--fulfil-from-the-gateway-webhook](../../docs/integration-guide.md#step-4--fulfil-from-the-gateway-webhook).
- **Real cart or auth** — `MOCK_CART` seeds the editable cart; edits live in client state and reset on reload. A real integration would read the cart from your database and price it server-side. The demo route accepts the client-sent breakdown (DEMO ONLY) so the editable cart can drive the charge — production must not trust client prices/amounts.
- **Real nonce store** — the in-memory `Map` won't survive a process restart and won't scale across instances. Use your order/session DB in production.
- **Embedded mode** — redirect-mode only. Ask your RadiumOne contact about embedded-mode availability.

## Adapting to your own Next.js app

1. Copy `src/lib/radiumone-client.ts` into your project's `lib/` folder.
2. Replace `src/lib/return-nonce-store.ts` with reads/writes against your order or session DB. The contract is the same: store `{ checkout_id → nonce }` at create time; one-shot consume at return time.
3. Add the three env vars to your `.env.local` (`RADIUMONE_BASE_URL`, `RADIUMONE_SECRET_KEY`, `MERCHANT_BASE_URL`).
4. Drop `src/app/api/checkout/route.ts` into your API routes — but compute `amount` / `line_items` server-side from your real cart keyed by SKU. The demo derives them from the client-sent body so the editable cart works; a real merchant must never trust client prices or amounts.
5. In your success/cancel pages, call `consumeReturnNonce(checkout_id, nonce)` server-side and (optionally) `getCheckoutSession(checkout_id)` for live status display.

## Troubleshooting

See [../../docs/troubleshooting.md](../../docs/troubleshooting.md).

## Integration reference

- [Integration guide](../../docs/integration-guide.md) — the four steps, fields, amount format, errors, test cards
- [Architecture & data flow](../../docs/architecture.md)
- Webhook events / payloads: handled by the RadiumOne Gateway — contact RadiumOne support
