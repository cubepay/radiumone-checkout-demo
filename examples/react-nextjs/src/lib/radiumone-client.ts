import 'server-only';
import type { HppLineItem, HppAdjustment } from './mock-cart';
import { env } from './env';

// Minimal types — only fields this demo touches.
// Full field reference: https://docs.radiumone.io/api/checkout-sessions
//
// Schema notes (per HPP team):
//   • publishable_key is NOT a session-create field. The HPP resolves it from
//     the gateway during create. Sending it has no effect.
//   • amount is the FINAL CHARGE (after discounts, inclusive of taxes/shipping/fees).
//     HPP enforces: sum(line_items[i].quantity × unit_amount) + sum(adjustments[j].amount) === amount.
//   • description is optional, but the demo always passes one as good practice.
//   • adjustments are order-level only. kind ∈ {discount, tax, shipping, fee}.

export interface CreateSessionInput {
  amount: number;
  currency: string;
  order_reference: string;
  success_url: string;
  cancel_url: string;
  description?: string;
  line_items?: HppLineItem[];
  adjustments?: HppAdjustment[];
}

export interface CreateSessionResult {
  checkout_id: string;
  checkout_url: string;
}

// Possible error envelope fields, drawn from common conventions (RFC 7807
// problem+json + simple { error, code }). The HPP may use any combination.
interface GatewayError {
  error?: string;
  code?: string;
  type?: string;
  title?: string;
  detail?: string;
  message?: string;
}

// Tolerant JSON parser for upstream HPP responses. The HPP usually returns
// application/json — but errors from proxies, CDNs, or 5xx pages can arrive
// as plain text. Naively calling response.json() then crashes with an
// unhelpful syntax error and the caller loses the actual upstream message.
async function parseUpstreamJson(response: Response): Promise<unknown> {
  const text = await response.text();
  if (!text) return {};
  try {
    return JSON.parse(text);
  } catch {
    return { error: `HPP returned non-JSON (status ${response.status}): ${text.slice(0, 500)}` };
  }
}

// Formats an HPP error envelope into a single human-friendly string. Pulls
// whichever fields exist; falls back to the raw JSON so nothing is hidden.
function formatGatewayError(status: number, statusText: string, data: unknown): string {
  const head = `HTTP ${status}${statusText ? ' ' + statusText : ''}`;
  if (!data || typeof data !== 'object') return `${head}: ${String(data ?? '')}`;
  const e = data as GatewayError;
  const code    = e.code   ?? e.type    ?? null;
  const message = e.detail ?? e.message ?? e.error ?? e.title ?? null;
  if (code && message) return `${head}: ${code} — ${message}`;
  if (code)            return `${head}: ${code}`;
  if (message)         return `${head}: ${message}`;
  return `${head}: ${JSON.stringify(data)}`;
}

// Live status readback. The HPP team confirms GET /sessions/{id} is public
// (no auth) and intended for the merchant's return page to render current
// state. Real fulfilment must still come from the webhook — this is for UX.
export interface SessionReadback {
  checkout_id: string;
  status: string;
  amount?: number;
  currency?: string;
  order_reference?: string;
}

export async function getCheckoutSession(checkoutId: string): Promise<SessionReadback | null> {
  try {
    const r = await fetch(
      `${env.RADIUMONE_BASE_URL}/api/v1/checkout/sessions/${encodeURIComponent(checkoutId)}`,
      { cache: 'no-store' }
    );
    if (!r.ok) return null;
    const data = (await parseUpstreamJson(r)) as Partial<SessionReadback> & { error?: string };
    if (data.error || !data.checkout_id) return null;
    return data as SessionReadback;
  } catch {
    return null;
  }
}

export async function createCheckoutSession(
  input: CreateSessionInput
): Promise<CreateSessionResult> {
  let response: Response;
  try {
    response = await fetch(
      `${env.RADIUMONE_BASE_URL}/api/v1/checkout/sessions`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Api-Key': env.RADIUMONE_SECRET_KEY,
        },
        body: JSON.stringify(input),
      }
    );
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    throw new Error(`Could not reach HPP at ${env.RADIUMONE_BASE_URL}: ${msg}`);
  }

  const data = await parseUpstreamJson(response);

  if (!response.ok) {
    throw new Error(formatGatewayError(response.status, response.statusText, data));
  }

  return data as CreateSessionResult;
}
