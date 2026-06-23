// Two checkout handlers shown side-by-side so a merchant can diff them:
//
//   handleOverviewCheckout()  -> sends { amount, currency, description }
//   handleItemizedCheckout()  -> sends { amount, currency, description, adjustments, line_items }
//
// The branching lives only in the UI wiring; each handler is straight-line
// code so the integration shape is unambiguous when reading the source.
//
// Why no adjustments in overview mode: HPP enforces
//   sum(line_items) + sum(adjustments) === amount
// so sending adjustments without line_items breaks validation (the HPP treats
// missing line_items as 0). Overview mode is the bare "trust amount" pattern.
// `cartFinalAmountCents()` still computes the correct final charge either way.

import {
  CURRENCY,
  cartFinalAmountCents,
  cartOverviewDescription,
  toHppLineItems,
  toHppAdjustments,
} from '/shared/cart/cart-fixture.mjs';
import { cartState, currentAdjustments } from './cart-state.mjs';

let isRealMode = false;

async function detectMode() {
  try {
    const res = await fetch('/api/checkout', { method: 'OPTIONS' });
    isRealMode = res.status === 204;
  } catch {
    isRealMode = false;
  }
  const banner = document.getElementById('mode-banner');
  if (!banner) return;
  banner.textContent = isRealMode
    ? 'Real mode — API calls enabled'
    : 'Mock mode — server has no API credentials';
  banner.className = isRealMode ? 'banner real' : 'banner mock';
}

function setBtnLoading(btn, loading, label) {
  btn.disabled = loading;
  btn.dataset.label ??= btn.querySelector('.checkout-btn__label')?.textContent ?? btn.textContent;
  const labelEl = btn.querySelector('.checkout-btn__label');
  if (labelEl) labelEl.textContent = loading ? 'Creating session…' : (label ?? btn.dataset.label);
  else btn.textContent = loading ? 'Creating session…' : (label ?? btn.dataset.label);
}

// Formats an HPP error envelope into a single human-friendly string. The HPP
// (and proxies in front of it) may return any of several shapes:
//   • RFC 7807 problem+json:   { type, title, status, detail }
//   • Simple envelope:         { error, code }
//   • Plain text:              passed through as { error: "<text>" } by the server
// We pull whichever fields exist and fall back to the raw JSON so nothing is hidden.
function formatHppError(status, statusText, data) {
  const head = `HTTP ${status}${statusText ? ' ' + statusText : ''}`;
  if (data == null || typeof data !== 'object') return `${head}: ${String(data ?? '')}`;
  const code    = data.code    ?? data.type   ?? null;
  const message = data.detail  ?? data.message ?? data.error ?? data.title ?? null;
  if (code && message) return `${head}: ${code} — ${message}`;
  if (code)            return `${head}: ${code}`;
  if (message)         return `${head}: ${message}`;
  return `${head}: ${JSON.stringify(data)}`;
}

async function postCheckout(payload) {
  const res = await fetch('/api/checkout', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(formatHppError(res.status, res.statusText, data));
  return data;
}

// ─── Real-mode handlers: one per pattern ─────────────────────────────────────

async function handleRealOverviewCheckout(btn) {
  setBtnLoading(btn, true);
  try {
    const { checkout_url } = await postCheckout({
      mode: 'overview',
      amount: cartFinalAmountCents(cartState.items, currentAdjustments()),
      currency: CURRENCY,
      description: cartOverviewDescription(cartState.items),
    });
    window.location.href = checkout_url;
  } catch (err) {
    setBtnLoading(btn, false);
    alert(err.message);
  }
}

async function handleRealItemizedCheckout(btn) {
  setBtnLoading(btn, true);
  try {
    const { checkout_url } = await postCheckout({
      mode: 'itemized',
      amount: cartFinalAmountCents(cartState.items, currentAdjustments()),
      currency: CURRENCY,
      description: cartOverviewDescription(cartState.items),
      adjustments: toHppAdjustments(currentAdjustments()),
      line_items: toHppLineItems(cartState.items),
    });
    window.location.href = checkout_url;
  } catch (err) {
    setBtnLoading(btn, false);
    alert(err.message);
  }
}

// ─── Mock-mode handler: shows the curl + payload that WOULD be sent ──────────
// No redirect — the demo intentionally stops here. There's no long-lived
// sandbox session to land on, so showing the payload is the whole point.

function handleMockCheckout(mode) {
  const payload = {
    amount: cartFinalAmountCents(cartState.items, currentAdjustments()),
    currency: CURRENCY,
    description: cartOverviewDescription(cartState.items),
    ...(mode === 'itemized'
      ? { line_items: toHppLineItems(cartState.items), adjustments: toHppAdjustments(currentAdjustments()) }
      : {}),
  };

  const curlCmd =
    `curl -X POST "$RADIUMONE_BASE_URL/api/v1/checkout/sessions" \\\n` +
    `  -H "X-Api-Key: $RADIUMONE_SECRET_KEY" \\\n` +
    `  -H "Content-Type: application/json" \\\n` +
    `  -d '${JSON.stringify(payload, null, 2)}'`;

  const modal = document.getElementById('mock-modal');
  document.getElementById('mock-curl').textContent = curlCmd;
  document.getElementById('mock-mode-label').textContent =
    mode === 'itemized' ? 'Itemized (with line_items)' : 'Overview (no line_items)';
  modal.style.display = 'flex';

  navigator.clipboard?.writeText(curlCmd).catch(() => {});
}

document.addEventListener('DOMContentLoaded', async () => {
  document.querySelectorAll('[data-cart-total]').forEach((el) => {
    el.textContent = `${CURRENCY} ${(cartFinalAmountCents(cartState.items, currentAdjustments()) / 100).toFixed(2)}`;
  });
  document.querySelectorAll('[data-cart-itemcount]').forEach((el) => {
    el.textContent = String(cartState.items.length);
  });

  await detectMode();

  document.getElementById('checkout-overview-btn')?.addEventListener('click', (e) => {
    isRealMode ? handleRealOverviewCheckout(e.currentTarget) : handleMockCheckout('overview');
  });

  document.getElementById('checkout-itemized-btn')?.addEventListener('click', (e) => {
    isRealMode ? handleRealItemizedCheckout(e.currentTarget) : handleMockCheckout('itemized');
  });

  document.getElementById('mock-modal-close')?.addEventListener('click', () => {
    document.getElementById('mock-modal').style.display = 'none';
  });
});
