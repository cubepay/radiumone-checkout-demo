import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { join, extname, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { randomBytes } from 'node:crypto';
import { verifyWebhookSignature } from '../../shared/webhook/verify-webhook-signature.mjs';
import { reduceEvent } from '../../shared/webhook/webhook-event-processor.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PUBLIC_DIR = join(__dirname, 'public');
const SHARED_DIR = resolve(__dirname, '..', '..', 'shared');
const PORT = 3000;
const NONCE_TTL_MS = 30 * 60 * 1000; // 30 min, matches HPP session ceiling

// Assert required env vars; exit loudly on missing keys
const {
  RADIUMONE_BASE_URL,
  RADIUMONE_SECRET_KEY,
  MERCHANT_BASE_URL,
  RADIUMONE_WEBHOOK_SECRET, // optional — only needed to verify Gateway webhooks
} = process.env;

const REAL_MODE = Boolean(RADIUMONE_BASE_URL && RADIUMONE_SECRET_KEY && MERCHANT_BASE_URL);

if (!REAL_MODE) {
  console.warn('[server] One or more env vars missing — real API endpoints disabled. Set up .env to enable.');
}

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js':   'application/javascript; charset=utf-8',
  '.mjs':  'application/javascript; charset=utf-8',
  '.css':  'text/css; charset=utf-8',
  '.ico':  'image/x-icon',
};

// ─── Nonce store ──────────────────────────────────────────────────────────
// Single-process in-memory map. DEMO ONLY: a real merchant uses their order
// or session database. The nonce proves the return hit OUR session-create
// step — the HPP simply forwards whatever success_url / cancel_url we built.
// Authoritative fulfilment continues to come from the webhook.

const noncesByCheckoutId = new Map(); // checkout_id -> { nonce, expiresAt }

function storeNonce(checkoutId, nonce) {
  noncesByCheckoutId.set(checkoutId, { nonce, expiresAt: Date.now() + NONCE_TTL_MS });
}

function consumeNonce(checkoutId, presentedNonce) {
  const entry = noncesByCheckoutId.get(checkoutId);
  if (!entry) return false;
  if (Date.now() > entry.expiresAt) {
    noncesByCheckoutId.delete(checkoutId);
    return false;
  }
  if (entry.nonce !== presentedNonce) return false;
  noncesByCheckoutId.delete(checkoutId); // one-shot
  return true;
}

// Periodic GC so the map doesn't grow unbounded across long-lived dev sessions.
setInterval(() => {
  const now = Date.now();
  for (const [id, entry] of noncesByCheckoutId) {
    if (now > entry.expiresAt) noncesByCheckoutId.delete(id);
  }
}, 60 * 1000).unref();

async function readJsonBody(req) {
  let body = '';
  for await (const chunk of req) body += chunk;
  return body ? JSON.parse(body) : {};
}

// Webhook signatures are computed over the RAW bytes, so read them unparsed.
async function readRawBody(req) {
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  return Buffer.concat(chunks);
}

// Tolerant JSON parser for upstream HPP responses. The HPP usually returns
// application/json — but errors from proxies, CDNs, or 5xx pages can arrive
// as plain text (e.g. "Internal Server Error"). Naively calling response.json()
// then crashes with an unhelpful "Unexpected token 'I'" syntax error and the
// caller loses the actual upstream message. This reads as text first, attempts
// JSON, and falls back to an { error } envelope carrying the raw body so the
// browser sees something diagnosable.
async function parseUpstream(response) {
  const text = await response.text();
  if (!text) return {};
  try {
    return JSON.parse(text);
  } catch {
    return { error: `HPP returned non-JSON (status ${response.status}): ${text.slice(0, 500)}` };
  }
}

async function handleCheckoutPost(req, res) {
  if (!REAL_MODE) {
    res.writeHead(503, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Server running without API credentials. See README.' }));
    return;
  }

  const payload = await readJsonBody(req);
  const orderRef = `DEMO-${Date.now()}-${randomBytes(3).toString('hex')}`;
  const nonce = randomBytes(16).toString('hex');

  // Build redirect URLs WITH our own nonce + order_ref baked in. The HPP will
  // append &checkout_id=... on return; our handler then verifies the nonce
  // against the store keyed by that checkout_id.
  const successUrl = `${MERCHANT_BASE_URL}/success.html?order_ref=${encodeURIComponent(orderRef)}&nonce=${nonce}`;
  const cancelUrl  = `${MERCHANT_BASE_URL}/cancel.html?order_ref=${encodeURIComponent(orderRef)}&nonce=${nonce}`;

  // Overview mode = bare { amount, currency, description } only. Itemized adds
  // both line_items AND adjustments together — HPP requires they balance with
  // `amount`, so they're coupled. Never send adjustments without line_items.
  const sessionInput = {
    amount: payload.amount,
    currency: payload.currency,
    order_reference: orderRef,
    success_url: successUrl,
    cancel_url: cancelUrl,
    description: payload.description,
    ...(payload.mode === 'itemized'
      ? { line_items: payload.line_items, adjustments: payload.adjustments }
      : {}),
  };

  console.log('[server] → POST', `${RADIUMONE_BASE_URL}/api/v1/checkout/sessions`);
  console.log('[server]   body:', JSON.stringify(sessionInput, null, 2));

  let response;
  try {
    response = await fetch(`${RADIUMONE_BASE_URL}/api/v1/checkout/sessions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Api-Key': RADIUMONE_SECRET_KEY,
      },
      body: JSON.stringify(sessionInput),
    });
  } catch (err) {
    // Network-level failure (DNS, TLS, connection refused, etc.) before any
    // HTTP response. Surface a clear message rather than a generic 500.
    console.error('[server] ✗ fetch failed:', err.message);
    res.writeHead(502, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: `Could not reach HPP at ${RADIUMONE_BASE_URL}: ${err.message}` }));
    return;
  }

  const upstream = await parseUpstream(response);
  // HPP wraps success payloads in an envelope: { status, data: {...}, request_id }.
  // Unwrap `data` so the browser receives a flat { checkout_id, checkout_url, ... }.
  // On error, forward the raw body untouched so formatHppError can read its fields.
  const data = response.ok && upstream && typeof upstream.data === 'object'
    ? upstream.data
    : upstream;
  console.log('[server] ← HPP', response.status, response.statusText);
  if (!response.ok) console.log('[server]   body:', JSON.stringify(data, null, 2));
  if (response.ok && data.checkout_id) storeNonce(data.checkout_id, nonce);

  res.writeHead(response.status, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(data));
}

// New return-verify endpoint. Verifies the nonce, then (optionally) fetches
// the live session over the HPP's public GET endpoint so the success page
// can show the current state. Real fulfilment must come from the webhook.
async function handleReturnVerify(req, res) {
  const url = new URL(req.url, 'http://localhost');
  const checkoutId = url.searchParams.get('checkout_id');
  const nonce = url.searchParams.get('nonce');

  if (!checkoutId || !nonce) {
    res.writeHead(400, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ ok: false, reason: 'missing_params' }));
    return;
  }

  const ok = consumeNonce(checkoutId, nonce);
  if (!ok) {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ ok: false, reason: 'nonce_mismatch_or_expired' }));
    return;
  }

  // Optional readback for UX. Skip if no API base configured.
  let session = null;
  if (REAL_MODE) {
    try {
      const r = await fetch(`${RADIUMONE_BASE_URL}/api/v1/checkout/sessions/${encodeURIComponent(checkoutId)}`);
      if (r.ok) {
        const parsed = await parseUpstream(r);
        if (!parsed.error) session = (parsed && typeof parsed.data === 'object') ? parsed.data : parsed;
      }
    } catch (err) {
      console.warn('[server] session readback failed:', err.message);
    }
  }

  res.writeHead(200, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ ok: true, session }));
}

// ─── Webhook receiver (Step 4: fulfil from the Gateway webhook) ─────────────
// The webhook — not the browser redirect — is the authoritative fulfilment
// signal. Deliveries are at-least-once and unordered, so we dedup by event id
// and discard stale transitions by created_at (see webhook-event-processor.mjs).
// DEMO ONLY: state lives in memory; a real merchant uses their order database.

const seenEventIds = new Set();        // event.id -> processed (dedup)
const ordersByTxn = new Map();         // transaction_id -> order state

async function handleWebhook(req, res) {
  if (!RADIUMONE_WEBHOOK_SECRET) {
    res.writeHead(503, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'RADIUMONE_WEBHOOK_SECRET not set — cannot verify deliveries.' }));
    return;
  }

  const rawBody = await readRawBody(req);
  const signature = req.headers['x-radiumone-signature'];

  // 1. Verify BEFORE trusting anything in the body.
  const verdict = verifyWebhookSignature(rawBody, signature, RADIUMONE_WEBHOOK_SECRET);
  if (!verdict.ok) {
    console.warn('[webhook] ✗ rejected:', verdict.reason);
    res.writeHead(401, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'invalid_signature', reason: verdict.reason }));
    return;
  }

  let event;
  try {
    event = JSON.parse(rawBody.toString('utf8'));
  } catch {
    res.writeHead(400, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'malformed_json' }));
    return;
  }

  // 2. Apply the dedup / ordering rules, then 3. persist + (idempotently) fulfil.
  const txnId = event?.data?.transaction_id;
  const outcome = reduceEvent({
    event,
    alreadySeen: seenEventIds.has(event?.id),
    order: ordersByTxn.get(txnId),
  });

  if (outcome.action === 'applied') {
    ordersByTxn.set(txnId, outcome.nextOrder);
    if (outcome.fulfill) console.log(`[webhook] ✓ FULFIL order for ${txnId} (${event.type})`);
    else console.log(`[webhook] ✓ ${event.type} → ${outcome.status} for ${txnId}`);
  } else {
    console.log(`[webhook] • ${outcome.action} event ${event?.id} (${event?.type})`);
  }
  seenEventIds.add(event?.id);

  // 4. Acknowledge fast with 2xx so the Gateway doesn't retry.
  res.writeHead(200, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ received: true, action: outcome.action }));
}

async function serveStatic(req, res) {
  const rawPath = new URL(req.url, 'http://localhost').pathname;

  let baseDir, relPath;
  if (rawPath.startsWith('/shared/')) {
    baseDir = SHARED_DIR;
    relPath = rawPath.slice('/shared'.length);
  } else {
    baseDir = PUBLIC_DIR;
    relPath = rawPath === '/' ? '/index.html' : rawPath;
  }

  const filePath = join(baseDir, relPath);
  if (!filePath.startsWith(baseDir)) {
    res.writeHead(403);
    res.end('Forbidden');
    return;
  }

  try {
    const data = await readFile(filePath);
    const mime = MIME[extname(filePath)] ?? 'application/octet-stream';
    res.writeHead(200, { 'Content-Type': mime });
    res.end(data);
  } catch {
    res.writeHead(404, { 'Content-Type': 'text/plain' });
    res.end('Not found');
  }
}

const server = createServer(async (req, res) => {
  try {
    if (req.method === 'OPTIONS' && req.url === '/api/checkout') {
      res.writeHead(REAL_MODE ? 204 : 503);
      res.end();
    } else if (req.method === 'POST' && req.url === '/api/checkout') {
      await handleCheckoutPost(req, res);
    } else if (req.method === 'POST' && req.url === '/api/webhook') {
      await handleWebhook(req, res);
    } else if (req.method === 'GET' && req.url?.startsWith('/api/return-verify')) {
      await handleReturnVerify(req, res);
    } else {
      await serveStatic(req, res);
    }
  } catch (err) {
    console.error('[server] Unhandled error:', err.message);
    res.writeHead(500, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Internal server error' }));
  }
});

server.listen(PORT, () => {
  console.log(`[server] Listening on http://localhost:${PORT}`);
  console.log(`[server] Mode: ${REAL_MODE ? 'REAL (API calls enabled)' : 'MOCK (no .env loaded)'}`);
});
