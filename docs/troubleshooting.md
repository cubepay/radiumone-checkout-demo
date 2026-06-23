# Troubleshooting

> Last verified: 2026-06-24

Common problems when running the demo examples. For integration details see the [integration guide](./integration-guide.md); for HPP-level issues (payment methods, merchant account configuration, etc.), contact RadiumOne support.

---

## Session creation fails with 401 or "auth_failed"

**Most likely cause:** Your `RADIUMONE_SECRET_KEY` is wrong, missing, or you've used the publishable key (`r1pk_test_*`) instead of the secret key (`r1sk_test_*`).

Re-copy the secret key from your merchant dashboard and make sure it starts with `r1sk_test_`. Then restart the server — env file changes don't hot-reload.

---

## The success page shows "Return verification failed ✗"

**Most likely causes:**
- The nonce store was cleared because the server restarted between session-create and the return (the demo stores nonces in process memory).
- The session took longer than 30 minutes to complete, so the nonce expired (matches the HPP session ceiling).
- You opened the success page directly without going through a real session.

If the failure is reproducible, check the server logs around the time you started checkout — the session-create should log the minted nonce and the return-verify should log the consume attempt. A mismatch points at a TTL or restart issue.

---

## Mock mode banner appears even though I started the server

The server falls back to mock mode when any required env var is missing. Check the terminal output — it logs which mode it started in.

Confirm that:
1. Your `.env` file is inside the `examples/html-vanilla/` folder (not the repo root).
2. All three variables are present and non-empty (`RADIUMONE_BASE_URL`, `RADIUMONE_SECRET_KEY`, `MERCHANT_BASE_URL`).
3. You started the server with `node --env-file=.env server.mjs` (not just `node server.mjs`).

---

## "–-env-file is not recognised" error

This flag requires Node 20 or later. Check your version with `node -v`.

If upgrading isn't an option right now, set the variables manually and run without the flag:

```bash
# macOS / Linux
export RADIUMONE_SECRET_KEY=r1sk_test_...
export RADIUMONE_BASE_URL=https://checkout-sandbox.radiumone.com
export MERCHANT_BASE_URL=http://localhost:3000
node server.mjs

# Windows PowerShell
$env:RADIUMONE_SECRET_KEY="r1sk_test_..."
# (repeat for each variable)
node server.mjs
```

---

## `pnpm install` fails on the Next.js example

Check that you have Node 20+ (`node -v`) and pnpm 10+ (`pnpm -v`). Upgrade as needed, then try again.

---

## Webhook returns 503 or 401 (invalid_signature)

- **503** — `RADIUMONE_WEBHOOK_SECRET` isn't set, so the receiver can't verify deliveries. Set it and restart. See the [webhook guide](./webhook-guide.md).
- **401 `invalid_signature`** — the most common causes: the secret doesn't match the one used to sign, the timestamp is outside the ±5-minute replay window, or the raw body was altered before verifying (never re-serialize JSON before checking the HMAC). When testing locally, make sure the **same** `RADIUMONE_WEBHOOK_SECRET` is set for both the server and `shared/webhook/send-test-webhook.mjs`.

---

## HPP loads but no payment methods are shown

This is a merchant account configuration issue on the HPP side — not something in this demo. Contact RadiumOne support.

---

## Mock mode doesn't redirect anywhere

That's intentional. Mock mode shows the curl + JSON request body that *would* be sent to the HPP and stops there — there is no long-lived sandbox session to land on (HPP sessions have a 1–60 minute TTL). To exercise a real HPP redirect, switch to real mode by setting `.env` and running `node --env-file=.env server.mjs`.
