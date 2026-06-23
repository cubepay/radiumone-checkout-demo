# Environment Variables

> Last verified: 2026-06-24

Copy the root [`.env.example`](../.env.example) into whichever example folder you're running:

- `html-vanilla` → save as `.env`
- `react-nextjs` → save as `.env.local` (Next.js loads this automatically)

Then fill in your values from the RadiumOne merchant dashboard.

---

## Variables

| Variable | What it's for | Where to get it | Keep it secret? |
|---|---|---|---|
| `RADIUMONE_BASE_URL` | The HPP API base URL. Sandbox is **public**: `https://checkout-sandbox.radiumone.com` (already set in `.env.example`). The **production** host is different — ask your RadiumOne contact. Test vs production is selected by the key prefix (`r1sk_test_*` vs `r1sk_prod_*`), not the host. | Sandbox: as-is · Production: your RadiumOne contact | No |
| `RADIUMONE_SECRET_KEY` | Authenticates your server's API calls to the HPP. Starts with `r1sk_test_`. | Merchant dashboard → API keys | **Yes — server only. Never expose to the browser.** |
| `MERCHANT_BASE_URL` | The base URL of your local server. The HPP uses this to build the `success_url` and `cancel_url` it redirects back to. | Set to `http://localhost:3000` for local development | No |
| `RADIUMONE_WEBHOOK_SECRET` | **Optional.** Signing secret (`whsec_<hex>`) used to verify Gateway webhook deliveries at `POST /api/webhook` (Step 4). Leave unset if you're not testing webhooks; the receiver returns `503` until it's set. | CubePay support, when you register a webhook endpoint | **Yes — server only.** |

> **Note on `RADIUMONE_PUBLISHABLE_KEY`:** Earlier versions of this demo passed a publishable key (`r1pk_*`) inside the session-create request body. That field is **not** part of the session-create schema — the HPP resolves the merchant's publishable key from the gateway during create. Don't include it in the POST body. You'll only need a publishable key in your code if you later integrate the browser SDK or embedded mode, neither of which this demo uses.

> **Note on `REDIRECT_SIGNING_SECRET`:** This demo doesn't use one. It verifies returns with a server-minted nonce baked into the success/cancel URLs at session-create, then matched on return — no shared secret required. The HPP *does* support an optional `sig` HMAC layer (enabled per-merchant via a `redirect_secret` set in the merchant portal) for HPP-attested returns; see [integration-guide.md → Step 3](./integration-guide.md#step-3--verify-the-return-server-side). Gateway webhooks use their own signing (`RADIUMONE_WEBHOOK_SECRET`, above); the demo's receiver verifies it — see [integration-guide.md → Step 4](./integration-guide.md#step-4--fulfil-from-the-gateway-webhook).

---

## Security reminders

- **Never commit `.env` or `.env.local`** — both files are listed in `.gitignore`. If you accidentally commit credentials, rotate your keys immediately from the merchant dashboard (**API keys**).
- **`RADIUMONE_SECRET_KEY` must stay on the server.** Both examples enforce this: the vanilla server never echoes it in responses, and the Next.js example uses a `server-only` import guard so it can't accidentally end up in a client component.
- **Update `MERCHANT_BASE_URL` when deploying.** For production, this should be your public domain (e.g. `https://yourstore.com`). The HPP won't be able to redirect back to `localhost` in a real environment.
