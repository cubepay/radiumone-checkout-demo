import 'server-only';

// Single-process in-memory map for return-URL nonces.
// DEMO ONLY: a real merchant uses their order or session database. The nonce
// proves the return hit OUR session-create step — the HPP simply forwards
// whatever success_url / cancel_url we built. Authoritative fulfilment
// continues to come from the webhook.

const NONCE_TTL_MS = 30 * 60 * 1000; // 30 min, matches HPP session ceiling

interface Entry { nonce: string; expiresAt: number }
const noncesByCheckoutId = new Map<string, Entry>();

export function storeReturnNonce(checkoutId: string, nonce: string): void {
  noncesByCheckoutId.set(checkoutId, { nonce, expiresAt: Date.now() + NONCE_TTL_MS });
}

// One-shot verification. Returns true once for a matching pair; subsequent
// calls return false (whether due to mismatch, expiry, or prior consumption).
export function consumeReturnNonce(checkoutId: string, presentedNonce: string): boolean {
  const entry = noncesByCheckoutId.get(checkoutId);
  if (!entry) return false;
  if (Date.now() > entry.expiresAt) {
    noncesByCheckoutId.delete(checkoutId);
    return false;
  }
  if (entry.nonce !== presentedNonce) return false;
  noncesByCheckoutId.delete(checkoutId);
  return true;
}

// Periodic GC so the map doesn't grow unbounded across long-lived dev sessions.
// Only schedule once (Node hot-reload safety not needed in production).
declare global {
  var __returnNonceGcStarted: boolean | undefined;
}
if (!globalThis.__returnNonceGcStarted) {
  globalThis.__returnNonceGcStarted = true;
  setInterval(() => {
    const now = Date.now();
    for (const [id, entry] of noncesByCheckoutId) {
      if (now > entry.expiresAt) noncesByCheckoutId.delete(id);
    }
  }, 60 * 1000).unref();
}
