'use client';

import {
  MOCK_ADJUSTMENTS,
  CURRENCY,
  cartItemsSubtotalCents,
  cartFinalAmountCents,
  cartItemCount,
  activeAdjustments,
  formatCents,
} from '@/lib/mock-cart';
import type { CartItem } from '@/lib/mock-cart';

// Editable cart view. Mirrors the html-vanilla example's layout. The shopper can
// edit each item's unit price and quantity inline and toggle the welcome
// discount; line subtotals and the summary totals are computed automatically and
// are never directly editable. State is owned by the parent (cart-app.tsx) so the
// same values drive the checkout payload — what you see is what gets charged.

// cents -> dollars string for the unit-price input (e.g. 4900 -> "49.00").
const centsToDollars = (cents: number) => (cents / 100).toFixed(2);
// dollars string -> cents, clamped to >= 0.
const dollarsToCents = (val: string) => {
  const n = parseFloat(val);
  return Number.isFinite(n) ? Math.max(0, Math.round(n * 100)) : 0;
};
// quantity string -> integer, clamped to >= 1.
const clampQty = (val: string) => {
  const n = parseInt(val, 10);
  return Number.isFinite(n) ? Math.max(1, n) : 1;
};

type Props = {
  items: CartItem[];
  applyDiscount: boolean;
  onItemChange: (id: string, patch: Partial<CartItem>) => void;
  onToggleDiscount: (apply: boolean) => void;
};

export function CartView({ items, applyDiscount, onItemChange, onToggleDiscount }: Props) {
  const adjustments = activeAdjustments(MOCK_ADJUSTMENTS, applyDiscount);
  const subtotalCents = cartItemsSubtotalCents(items);
  const totalCents = cartFinalAmountCents(items, adjustments);
  const itemCount = cartItemCount(items);

  return (
    <section className="cart">
      <div className="cart__header">
        <h2 className="cart__title">Your cart</h2>
        <span className="cart__count">{itemCount} item{itemCount === 1 ? '' : 's'}</span>
      </div>

      <ul className="cart__items">
        {items.map((item) => {
          const lineSubtotal = item.unitAmountCents * item.quantity;
          return (
            <li key={item.id} className="cart-row">
              <div className="cart-row__thumb" aria-hidden="true" />
              <div className="cart-row__info">
                <div className="cart-row__name">{item.name}</div>
                <div className="cart-row__desc">{item.description}</div>
              </div>
              <div className="cart-row__qty" aria-label="Quantity">
                <button
                  className="qty-btn"
                  type="button"
                  aria-label="Decrease quantity"
                  onClick={() => onItemChange(item.id, { quantity: Math.max(1, item.quantity - 1) })}
                >
                  &minus;
                </button>
                <input
                  className="qty-input"
                  type="number"
                  min={1}
                  step={1}
                  aria-label="Quantity"
                  value={item.quantity}
                  onChange={(e) => onItemChange(item.id, { quantity: clampQty(e.target.value) })}
                />
                <button
                  className="qty-btn"
                  type="button"
                  aria-label="Increase quantity"
                  onClick={() => onItemChange(item.id, { quantity: item.quantity + 1 })}
                >
                  +
                </button>
              </div>
              <div className="cart-row__unit">
                <span className="input-prefix">{CURRENCY}</span>
                {/* Uncontrolled: defaultValue avoids re-formatting (toFixed) the
                    field on every keystroke, which would fight the caret. Totals
                    still update live via onChange -> parent state. */}
                <input
                  className="unit-input"
                  type="number"
                  min={0}
                  step={0.01}
                  aria-label="Unit price"
                  defaultValue={centsToDollars(item.unitAmountCents)}
                  onChange={(e) => onItemChange(item.id, { unitAmountCents: dollarsToCents(e.target.value) })}
                />
              </div>
              <div className="cart-row__subtotal">{CURRENCY} {formatCents(lineSubtotal)}</div>
              <button className="cart-row__remove" disabled aria-label="Remove item">&times;</button>
            </li>
          );
        })}
      </ul>

      <div className="cart__summary">
        <div className="summary-row">
          <span>Subtotal</span>
          <span>{CURRENCY} {formatCents(subtotalCents)}</span>
        </div>

        {MOCK_ADJUSTMENTS.map((adj, i) => {
          // Discount rows get a checkbox so the shopper can choose not to apply them.
          if (adj.kind === 'discount') {
            return (
              <div
                key={`${adj.kind}-${i}`}
                className={`summary-row summary-row--adjustment summary-row--toggle${applyDiscount ? '' : ' summary-row--disabled'}`}
              >
                <label className="summary-toggle">
                  <input
                    type="checkbox"
                    checked={applyDiscount}
                    onChange={(e) => onToggleDiscount(e.target.checked)}
                  />
                  <span>{adj.label}<span className="summary-row__kind"> ({adj.kind})</span></span>
                </label>
                <span>{CURRENCY} {formatCents(adj.amount)}</span>
              </div>
            );
          }
          return (
            <div key={`${adj.kind}-${i}`} className="summary-row summary-row--adjustment">
              <span>{adj.label}<span className="summary-row__kind"> ({adj.kind})</span></span>
              <span>{CURRENCY} {formatCents(adj.amount)}</span>
            </div>
          );
        })}

        <div className="summary-row summary-row--total">
          <span>Total</span>
          <span>{CURRENCY} {formatCents(totalCents)}</span>
        </div>
      </div>
    </section>
  );
}
