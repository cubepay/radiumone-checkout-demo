# AGENTS.md — Context for AI-assisted development

This file gives your AI coding assistant the context it needs to help you use this demo as a reference for integrating RadiumOne Checkout HPP into your own shopping cart.

---

## What this repo is

A minimal, working reference implementation of the **merchant side** of the RadiumOne Checkout HPP redirect flow. It is not a real store — the cart is intentionally skeletal. The purpose is to show exactly what server code and what frontend code a merchant needs to write.

The HPP itself (the payment page the customer sees) is hosted by RadiumOne. You never build that. You build everything else.

---

## The four things every merchant must implement

All integration logic in this repo traces back to these four touchpoints:

### 1. Create a checkout session (server-side)

Your server calls the HPP API to get a `checkout_url`, then redirects the customer there.

| Example | File |
|---|---|
| html-vanilla | `examples/html-vanilla/server.mjs` → `handleCheckoutPost()` |
| react-nextjs | `examples/react-nextjs/src/app/api/checkout/route.ts` |
| Typed API client | `examples/react-nextjs/src/lib/radiumone-client.ts` |

Key behaviours to replicate:
- Use `X-Api-Key: <RADIUMONE_SECRET_KEY>` header — never the publishable key for auth.
- Required body fields: `amount`, `currency`, `order_reference`, `success_url`, `cancel_url`. Optional: `description`, `line_items`, `adjustments`, `metadata`, `customer.email`, `customer.name`, `mode`, `locale`, `ttl_minutes`, `branding_profile_id`.
- **Do NOT** send `publishable_key` in the session-create body — it is not a session-create field. The HPP resolves it from the gateway during create.
- `amount` is the final charge: `sum(line_items[i].quantity × unit_amount) + sum(adjustments[j].amount) === amount`. HPP rejects mismatches with `400 validation:line_items_mismatch`.
- `adjustments` is order-level only. `kind ∈ {discount, tax, shipping, fee}`. `discount.amount` must be ≤ 0; the other three must be ≥ 0.
- `line_items` have no per-item currency — currency is order-level only.
- Generate `order_reference` server-side (not from the client).
- Construct `success_url`/`cancel_url` server-side from your own domain — never accept them from the browser.
- Recompute the amount from your cart/database server-side — never trust the client-supplied amount.

### 2. Redirect the customer to the HPP

After creating the session, redirect the browser to `checkout_url`.

| Example | File |
|---|---|
| html-vanilla | `examples/html-vanilla/public/checkout.js` → `handleRealOverviewCheckout()` / `handleRealItemizedCheckout()` |
| react-nextjs | `examples/react-nextjs/src/app/checkout-buttons.tsx` |

### 3. Verify the return (server-side, nonce-based)

When the HPP redirects back to your `success_url`, it appends `?checkout_id=…` (plus `&state=…` if you supplied a `state` on create). This demo verifies the return is genuine by checking a **one-shot nonce that the merchant itself baked into `success_url` / `cancel_url`** at session-create time — no shared secret required. The HPP also supports an optional `sig` HMAC layer (enabled per-merchant via a `redirect_secret` in the merchant portal) for HPP-attested returns; the demo does not use it.

Steps:

1. **At session-create:** mint a random nonce. Append it (plus your own `order_ref`) to the URLs you hand to the HPP:
   `success_url = "https://merchant.example/return?order_ref=…&nonce=…"`. Persist `{ checkout_id → nonce }` in your order store.
2. **On return:** look up `nonce` for the inbound `checkout_id`. If it matches the `?nonce=` on the URL, the return is authentic. Consume (delete) the entry to prevent replay.
3. **(Optional UX) Read the session back:** `GET /api/v1/checkout/sessions/{checkout_id}` is **public** (no auth) and returns current status. Useful for rendering "Paid" vs "Pending" on the return page without waiting for the webhook.

| Example | File |
|---|---|
| html-vanilla | `examples/html-vanilla/server.mjs` → `consumeNonce()` + `handleReturnVerify()` |
| react-nextjs | `examples/react-nextjs/src/lib/return-nonce-store.ts` + `src/app/success/page.tsx` |

Demo stores nonces in process memory (a `Map`). Real merchants use their order/session database.

### 4. Handle the webhook (reference receiver included)

For reliable order fulfilment, fulfil from the RadiumOne **Gateway** webhook — don't rely solely on the redirect. A customer can close the browser before the redirect fires. Both examples include a reference receiver at `POST /api/webhook`: verify the HMAC-SHA256 signature (`shared/webhook/verify-webhook-signature.mjs`), dedup + discard stale/unordered events (`shared/webhook/webhook-event-processor.mjs`), fulfil idempotently, respond `2xx` fast. Set `RADIUMONE_WEBHOOK_SECRET` to enable it; register your endpoint via CubePay support. See [docs/integration-guide.md → Step 4](docs/integration-guide.md#step-4--fulfil-from-the-gateway-webhook).

---

## What NOT to copy from this demo

| Demo code | Why to ignore it |
|---|---|
| `MOCK_CART` / `MOCK_ADJUSTMENTS` / `renderCart()` | Hardcoded placeholder — replace with your real cart data |
| `shared/cart/cart-fixture.mjs` | The unified fixture exists only to keep the two demo examples consistent — not part of a real integration |
| Mock mode detection (`OPTIONS /api/checkout`) | Demo convenience — not part of the HPP protocol |
| Skeleton wireframe CSS | Intentionally plain — use your own design system |
| `start:no-env` script | Development fallback only |

---

## Security patterns to keep

These are not demo shortcuts — they are required for a correct and secure integration:

- **Secret key stays on the server.** It must never appear in a browser bundle, API response, or log line.
- **Reconstruct the cart total server-side.** The demo ignores any client-supplied amount and recomputes from its own data source. Do the same with your real cart.
- **Build `success_url` and `cancel_url` on the server.** If you accept these from the client, an attacker can redirect successful payments to a URL they control.
- **Mint a one-shot nonce per session and verify it on return.** The demo uses a `Map<checkout_id, nonce>`; you'd use your order/session DB. Consume on first match — never re-verify the same nonce.
- **Don't trust the redirect for fulfilment.** The return page is for showing the customer a status; actual order fulfilment must come from the webhook (reference receiver at `/api/webhook`).

---

## Adapting to your stack

### If you're using Next.js

Copy these files and adjust as noted:

1. `src/lib/env.ts` — add or remove vars as your integration requires.
2. `src/lib/radiumone-client.ts` — extend `CreateSessionInput` with any additional session fields you need (see [docs/integration-guide.md → Step 1](./docs/integration-guide.md#step-1--create-a-checkout-session-server-side)).
3. `src/lib/return-nonce-store.ts` — **replace with your order/session DB**. The in-memory `Map` is demo-only and won't survive a process restart or scale across instances.
4. `src/app/api/checkout/route.ts` — mints the nonce + creates the session.
5. `src/app/success/page.tsx` and `src/app/cancel/page.tsx` — verify the nonce + optional session readback.

Replace the mock cart lookup with a real DB query.

### If you're using another framework (Express, Fastify, Django, Laravel, etc.)

The logic in `examples/html-vanilla/server.mjs` is framework-agnostic stdlib Node.js. Port these two functions:

- `handleCheckoutPost()` → your POST `/checkout` route handler. Mint a nonce, store it keyed by `checkout_id`, and bake it into the `success_url` / `cancel_url` you pass to the HPP.
- `handleReturnVerify()` → a utility called by your success/cancel page handlers. Looks up the nonce by `checkout_id`, one-shot-consumes it, optionally fetches the session for live status display.

The fetch calls and Map-based nonce store map directly to any language's standard library + your order DB.

---

## Environment variables

All required vars with descriptions: [docs/env-config.md](./docs/env-config.md)

Quick reference:

```
RADIUMONE_BASE_URL          HPP API base URL — sandbox https://checkout-sandbox.radiumone.io (prod: ask your RadiumOne contact)
RADIUMONE_SECRET_KEY        r1sk_test_… — server only, never browser
MERCHANT_BASE_URL           Your app's base URL (used to build redirect URLs)
```

> Notes on fields you may have seen in older docs:
> - `RADIUMONE_PUBLISHABLE_KEY` (`r1pk_test_*`) is **not** required by this demo — it's not a session-create field. Only needed if you later integrate the browser SDK or embedded mode.
> - `REDIRECT_SIGNING_SECRET` is **not used by this demo** — its return contract is nonce-based (see step 3 above). The HPP does support an optional `sig` HMAC layer (per-merchant `redirect_secret` set in the portal) if you want HPP-attested returns. Gateway webhooks use their own HMAC signing (`RADIUMONE_WEBHOOK_SECRET`); the demo's `/api/webhook` receiver verifies it.

---

## Key files at a glance

```
shared/
└── cart/
    ├── cart-fixture.mjs            ← unified cart/adjustments fixture (used by both examples)
    └── cart-fixture.d.mts          ← types for the TS consumer

examples/
├── html-vanilla/
│   ├── server.mjs                  ← session creation + nonce store + return-verify (Node stdlib)
│   └── public/
│       ├── checkout.js             ← frontend redirect logic (two patterns)
│       ├── cart.js                 ← cart renderer
│       └── config.public.js        ← browser-safe constants only
└── react-nextjs/
    └── src/
        ├── lib/
        │   ├── radiumone-client.ts ← createCheckoutSession + getCheckoutSession (server-only)
        │   ├── return-nonce-store.ts ← in-memory nonce store (DEMO; replace with DB)
        │   ├── mock-cart.ts        ← thin re-export of shared/cart/cart-fixture
        │   └── env.ts              ← server-only env assertion
        └── app/
            ├── api/checkout/route.ts ← POST handler (mint nonce + create session)
            ├── checkout-buttons.tsx  ← client component (two redirect triggers)
            ├── cart-view.tsx         ← cart renderer
            ├── success/page.tsx      ← server component (consume nonce + readback)
            └── cancel/page.tsx       ← server component (same flow, cancel path)
```
