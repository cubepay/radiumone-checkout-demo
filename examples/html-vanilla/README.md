# html-vanilla — RadiumOne Checkout Demo

> Last verified: 2026-06-24

Zero-dependency HTML/JS integration demo. Same source files run in two modes — no install required for either.

Part of [radiumone-checkout-demo](../../README.md).

## Fastest path (mock mode)

Requires Node ≥ 20. No npm install, no `.env` needed.

```bash
node server.mjs
# Open http://localhost:3000
```

Click either **Checkout** button to see the would-be API request (curl + JSON payload, copied to clipboard). The page shows two side-by-side patterns — *overview* (bare `amount` + `description`) and *itemized* (with `line_items` + `adjustments`). The HPP enforces `sum(line_items) + sum(adjustments) === amount`, so the demo only sends `adjustments` in itemized mode where it has line items to balance against.

> Why not just open `index.html` directly? The cart loads ES modules (and the shared cart fixture at `/shared/cart/cart-fixture.mjs`), which browsers block over `file://`. A local server is required even for mock mode.

## Real API mode

```bash
cp .env.example .env
# Edit .env — paste your r1sk_test_* secret key (sandbox host is pre-filled)
node --env-file=.env server.mjs
# Open http://localhost:3000
```

The server detects missing env vars and falls back to mock mode rather than crashing. The mode banner in the header reflects which mode you're in.

## What the code does

| File | Role |
|---|---|
| `server.mjs` | Node stdlib HTTP server. Serves `public/` and `/shared/*`, handles `POST /api/checkout` (mint nonce + create session), `GET /api/return-verify` (consume nonce + optional session readback), and `POST /api/webhook` (verify signature + fulfil — Step 4). In-memory `Map`s for the nonce store and webhook state — DEMO ONLY. No npm deps. |
| `public/cart.js` | Imports the shared fixture from `/shared/cart/cart-fixture.mjs` and renders the wireframe cart layout. Inline-editable: unit price, quantity, and a welcome-discount toggle; line subtotals and totals recompute automatically. |
| `public/cart-state.mjs` | Mutable client-side cart state (an editable copy of the fixture + discount flag), shared by `cart.js` and `checkout.js` so edits flow into the checkout payload. |
| `public/checkout.js` | Mode detection via `OPTIONS /api/checkout`. Two handlers: `handleRealOverviewCheckout` and `handleRealItemizedCheckout`. Reads the edited cart from `cart-state.mjs`. Mock-mode fallback shows the curl + payload. |
| `public/config.public.js` | Re-exports `CURRENCY` from the shared fixture. Browser-safe — no secrets. |
| `public/index.html` | Cart page with mode banner and two side-by-side checkout buttons. |
| `public/success.html` | Calls `/api/return-verify`, renders verified status + live session readback. |
| `public/cancel.html` | Same as success but for the cancel return path. |
| `../../shared/cart/cart-fixture.mjs` | Unified cart fixture shared with the Next.js example (items, adjustments, payload helpers). |
| `../../shared/webhook/*.mjs` | Shared webhook signature verification + the at-least-once/unordered event reducer (with a known-answer test). `send-test-webhook.mjs` signs and POSTs a sample event to a local receiver. |

## What's NOT real

- **Cart**: seeded from a hardcoded 3-item array + 2 adjustments. Unit price, quantity, and the welcome discount are editable inline and drive the checkout payload, but the cart isn't backed by a real product catalog and isn't persisted (edits reset on reload).
- **Mock mode**: shows the request that *would* be sent and stops there. There is no long-lived sandbox session to land on, so the modal closes without a redirect.
- **Webhook handling**: a reference receiver IS included at `POST /api/webhook` (signature verify + idempotent fulfil), but it's in-memory and demo-grade — set `RADIUMONE_WEBHOOK_SECRET` to enable it, and test it locally with `node ../../shared/webhook/send-test-webhook.mjs`. See [../../docs/integration-guide.md#step-4--fulfil-from-the-gateway-webhook](../../docs/integration-guide.md#step-4--fulfil-from-the-gateway-webhook).

## Troubleshooting

See [../../docs/troubleshooting.md](../../docs/troubleshooting.md).

**Node < 20 — `--env-file` unsupported:**
```bash
# Set vars manually, then run without --env-file
export RADIUMONE_SECRET_KEY=r1sk_test_...
export RADIUMONE_BASE_URL=https://checkout-sandbox.radiumone.com
export MERCHANT_BASE_URL=http://localhost:3000
node server.mjs
# or: npm run start:no-env  (after setting env manually)
```

## Integration reference

- [Integration guide](../../docs/integration-guide.md) — the four steps, fields, amount format, errors, test cards
- [Architecture & data flow](../../docs/architecture.md)
- Webhook events / payloads: handled by the RadiumOne Gateway — contact RadiumOne support
