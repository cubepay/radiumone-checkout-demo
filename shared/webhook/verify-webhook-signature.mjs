// RadiumOne Gateway webhook signature verification — shared by both examples.
//
// Server-only (uses node:crypto). Never imported in the browser. Implements the
// contract from the Webhook Consumer Guide:
//   • Header `X-RadiumOne-Signature: t=<unix>,v1=<hex>`
//   • signing_input = `{t}.` (UTF-8) + the RAW request body bytes (whitespace-exact)
//   • signature = HMAC-SHA256(key = raw bytes of the whsec hex, msg = signing_input)
//   • constant-time compare against v1
//   • reject timestamps outside ±toleranceSeconds (replay protection)
//
// Pure function, no I/O — returns { ok, reason } so callers can log the reason.

import { createHmac, timingSafeEqual } from 'node:crypto';

// Parse "t=<unix>,v1=<hex>" tolerantly (any order, stray spaces). Returns null
// if either field is missing/unparseable.
function parseSignatureHeader(header) {
  const fields = {};
  for (const part of String(header).split(',')) {
    const idx = part.indexOf('=');
    if (idx === -1) continue;
    fields[part.slice(0, idx).trim()] = part.slice(idx + 1).trim();
  }
  const t = Number.parseInt(fields.t, 10);
  if (!Number.isFinite(t) || !fields.v1) return null;
  return { t, v1: fields.v1 };
}

/**
 * Verify a RadiumOne webhook delivery.
 * @param {Buffer|string} rawBody Raw request body (bytes preferred — re-serialized JSON breaks the HMAC).
 * @param {string|null|undefined} signatureHeader The X-RadiumOne-Signature header value.
 * @param {string|undefined} whsec The signing secret (whsec_<hex>) issued at endpoint creation.
 * @param {{ toleranceSeconds?: number, nowMs?: number }} [options]
 * @returns {{ ok: boolean, reason?: string }}
 */
export function verifyWebhookSignature(rawBody, signatureHeader, whsec, options = {}) {
  const toleranceSeconds = options.toleranceSeconds ?? 300; // ±5 min
  const nowMs = options.nowMs ?? Date.now();

  if (!signatureHeader) return { ok: false, reason: 'missing_signature' };
  const parsed = parseSignatureHeader(signatureHeader);
  if (!parsed) return { ok: false, reason: 'malformed_signature' };

  // Replay window: reject stale or far-future timestamps.
  if (Math.abs(Math.floor(nowMs / 1000) - parsed.t) > toleranceSeconds) {
    return { ok: false, reason: 'timestamp_out_of_window' };
  }

  // whsec is display hex (whsec_<hex>); the signing key is the raw decoded bytes.
  const secretHex = whsec && whsec.startsWith('whsec_') ? whsec.slice(6) : whsec;
  let secretBytes;
  try {
    secretBytes = Buffer.from(String(secretHex), 'hex');
  } catch {
    return { ok: false, reason: 'bad_secret' };
  }
  if (secretBytes.length === 0) return { ok: false, reason: 'bad_secret' };

  // signing_input = "{t}." + raw body bytes. Use bytes exactly as received.
  const body = Buffer.isBuffer(rawBody) ? rawBody : Buffer.from(String(rawBody));
  const signingInput = Buffer.concat([Buffer.from(`${parsed.t}.`), body]);
  const expected = createHmac('sha256', secretBytes).update(signingInput).digest('hex');

  // Constant-time compare. timingSafeEqual requires equal lengths, so guard first.
  const a = Buffer.from(expected);
  const b = Buffer.from(parsed.v1);
  if (a.length !== b.length || !timingSafeEqual(a, b)) {
    return { ok: false, reason: 'signature_mismatch' };
  }
  return { ok: true };
}
