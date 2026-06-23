import 'server-only';

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing required env var: ${name}`);
  return value;
}

// Lazy getters — assertions fire at request time, not module-load time.
// This allows `next build` to succeed without env vars present.
//
// NB: there is no RADIUMONE_PUBLISHABLE_KEY here. Despite older docs suggesting
// otherwise, the publishable key is NOT a session-create field — the HPP
// resolves it from the gateway during create. The merchant only needs it
// client-side when integrating the browser SDK or embedded mode (not used
// in this demo).
//
// There is also no REDIRECT_SIGNING_SECRET. The current return contract has
// the HPP append only `?checkout_id=...` to redirect URLs; verification is
// done by matching a server-minted nonce we baked into the URL ourselves,
// not by HMAC-verifying a sig from the HPP.
export const env = {
  get RADIUMONE_BASE_URL() { return requireEnv('RADIUMONE_BASE_URL'); },
  get RADIUMONE_SECRET_KEY() { return requireEnv('RADIUMONE_SECRET_KEY'); },
  get MERCHANT_BASE_URL() { return requireEnv('MERCHANT_BASE_URL'); },
} as const;
