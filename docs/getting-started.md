# Getting Started

> Last verified: 2026-06-24

This guide walks you through running either demo example against the RadiumOne sandbox so you can see the full checkout flow end-to-end before writing a single line of your own code.

---

## Before you begin

You'll need:

- **Node.js 20 or later** — check with `node -v`. Both examples require it. Download at [nodejs.org](https://nodejs.org).
- **pnpm 10 or later** — only needed for the Next.js example. Install with `npm i -g pnpm`.
- **Sandbox API credentials** — your secret key (`r1sk_test_*`), from the RadiumOne merchant dashboard under **API keys**.

You need one value from the dashboard:

| What | Where in the dashboard | Env var |
|---|---|---|
| Secret key | API keys → Secret key | `RADIUMONE_SECRET_KEY` (starts with `r1sk_test_`) |

The sandbox host (`RADIUMONE_BASE_URL`) is public and already set in `.env.example` to `https://checkout-sandbox.radiumone.com` — no need to change it for sandbox testing. For the production host, ask your RadiumOne contact.

> **Tip:** to drive a real payment to completion in the sandbox, use a [test card](./integration-guide.md#testing-sandbox-only) such as `4242 4242 4242 4242`.

> Notes on fields you may have seen in older docs:
> - **Publishable key (`r1pk_test_*`)** — not required by this demo. It's not a session-create field; the HPP resolves it internally. You'll only need it if you later integrate the browser SDK or embedded mode.
> - **Redirect signing secret** — not used by this demo. The demo verifies returns with a self-minted nonce baked into the success/cancel URLs, so no shared secret is required. The HPP *does* support an optional `sig` HMAC (enabled per-merchant via `redirect_secret`) if you want HPP-attested returns — see [integration-guide.md → Step 3](./integration-guide.md#step-3--verify-the-return-server-side).

---

## Option 1 — HTML/JS example (quickest)

### Mock mode — no credentials needed

Run the bundled server (no `.env`, no `pnpm install`):

```bash
cd examples/html-vanilla
node server.mjs
# Open http://localhost:3000
```

You'll see the wireframe cart. Click either **Checkout** button — the modal shows the curl + JSON payload that *would* be sent to the HPP. Two patterns are demonstrated side by side: *overview* (just `amount` + `description`) and *itemized* (with `line_items` and `adjustments`). The HPP enforces `sum(line_items) + sum(adjustments) === amount`, so `adjustments` is only sent in itemized mode where it can balance.

> Why not just open the HTML file in your browser? It loads ES modules and a shared cart fixture from `/shared/cart/`, which browsers block over `file://`. A local server is required even for mock mode.

### Real API mode

```bash
cd examples/html-vanilla
cp .env.example .env
```

Open `.env` and fill in your secret key (`RADIUMONE_SECRET_KEY`). Leave `RADIUMONE_BASE_URL` (sandbox) and `MERCHANT_BASE_URL` as-is for local development.

```bash
node --env-file=.env server.mjs
```

Open [http://localhost:3000](http://localhost:3000). Click **Checkout** — the server creates a real HPP session and redirects your browser to the RadiumOne sandbox checkout page. After completing (or cancelling) the payment, you'll land back on `/success` or `/cancel` with a return-verified badge (the demo's one-shot nonce check).

---

## Option 2 — Next.js example

```bash
cd examples/react-nextjs
cp .env.example .env.local
```

Open `.env.local` and fill in your credentials.

```bash
pnpm install
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000). The flow is identical to the HTML example — same session creation, same redirect, same nonce-based return verification — but implemented with Next.js App Router patterns you'd use in a production TypeScript codebase.

---

## What you'll see

1. A wireframe cart with placeholder product images, two adjustments (discount + tax), and the final total. Unit price, quantity, and the welcome-discount toggle are editable inline — line subtotals and totals recompute automatically and drive the checkout payload.
2. Clicking either **Checkout** button calls your local server, which mints a one-shot nonce, creates an HPP session, and redirects to the RadiumOne sandbox. Two patterns are shown: *overview* (no `line_items`) and *itemized* (with `line_items`).
3. After completing or cancelling the payment on the HPP, you're redirected back to `/success` or `/cancel` — the HPP appends only `?checkout_id=…`.
4. The return page looks up the nonce by `checkout_id`, one-shot-consumes it, and (optionally) reads back the live session via `GET /api/v1/checkout/sessions/{id}` to display the current status.

---

## What the demos don't include

These are intentional omissions — each one links to where the full documentation lives:

- **Production webhook infrastructure** — both demos include a reference webhook receiver at `POST /api/webhook` (signature verify + idempotent, out-of-order-safe fulfil). What's left to you for production: persistent state (DB-backed dedup/order status instead of in-memory) and registering your endpoint with CubePay support. See [webhook-guide.md](./webhook-guide.md) and [integration-guide.md → Step 4](./integration-guide.md#step-4--fulfil-from-the-gateway-webhook).
- **Embedded (iframe) mode** — These demos use redirect mode only. Ask your RadiumOne contact about embedded mode availability.
- **Full session API fields** — The demos pass only the common fields. For the complete request/response reference (including `metadata`, `customer`, `ttl_minutes`, `locale`), see [integration-guide.md → Step 1](./integration-guide.md#step-1--create-a-checkout-session-server-side).
