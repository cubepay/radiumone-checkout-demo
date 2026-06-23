'use client';

import { useState } from 'react';
import {
  CURRENCY,
  MOCK_ADJUSTMENTS,
  activeAdjustments,
  cartFinalAmountCents,
  cartOverviewDescription,
  toHppLineItems,
  toHppAdjustments,
} from '@/lib/mock-cart';
import type { CartItem } from '@/lib/mock-cart';

// Two-buttons-side-by-side variant. Each button POSTs the same endpoint with
// a different `mode` so the server can route to the matching HPP payload
// shape. The handlers are intentionally near-duplicates rather than a
// switch-on-mode — diffing them is the integration takeaway.
//
// The edited cart (items + discount toggle) is computed into a payload and sent
// in the request body, so the charge reflects the shopper's edits. The route
// recomputes the amount server-side from this breakdown.

type CheckoutMode = 'overview' | 'itemized';

// Build the full breakdown once; the route forwards line_items/adjustments only
// in itemized mode but always derives the amount from them.
function buildPayload(items: CartItem[], applyDiscount: boolean) {
  const adjustments = activeAdjustments(MOCK_ADJUSTMENTS, applyDiscount);
  return {
    amount: cartFinalAmountCents(items, adjustments),
    currency: CURRENCY,
    description: cartOverviewDescription(items),
    line_items: toHppLineItems(items),
    adjustments: toHppAdjustments(adjustments),
  };
}

function useCheckout(mode: CheckoutMode, items: CartItem[], applyDiscount: boolean) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function go() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/checkout?mode=${mode}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(buildPayload(items, applyDiscount)),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? `HTTP ${res.status}`);
      window.location.href = data.checkout_url;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Request failed');
      setLoading(false);
    }
  }

  return { loading, error, go };
}

type Props = { items: CartItem[]; applyDiscount: boolean };

export function CheckoutButtons({ items, applyDiscount }: Props) {
  const overview = useCheckout('overview', items, applyDiscount);
  const itemized = useCheckout('itemized', items, applyDiscount);
  const error = overview.error ?? itemized.error;

  return (
    <section className="checkout-panel">
      <p className="checkout-panel__hint">
        Two integration patterns &mdash; same total, different payload shape.
        Click either to see what each sends to the HPP.
      </p>

      <div className="checkout-actions">
        <button
          className="checkout-btn"
          onClick={overview.go}
          disabled={overview.loading || itemized.loading}
        >
          <span className="checkout-btn__label">
            {overview.loading ? 'Creating session…' : 'Checkout'}
          </span>
          <span className="checkout-btn__sub">amount + description only</span>
        </button>

        <button
          className="checkout-btn checkout-btn--alt"
          onClick={itemized.go}
          disabled={overview.loading || itemized.loading}
        >
          <span className="checkout-btn__label">
            {itemized.loading ? 'Creating session…' : 'Checkout'}
          </span>
          <span className="checkout-btn__sub">with line items</span>
        </button>
      </div>

      {error && <p className="checkout-error">{error}</p>}
    </section>
  );
}
