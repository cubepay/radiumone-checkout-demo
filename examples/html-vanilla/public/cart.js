// Renders the shared cart fixture into a typical-shopping-cart layout, now
// EDITABLE: the shopper can change each item's unit price and quantity inline,
// and switch the welcome discount on/off. Line subtotals and the summary totals
// are computed automatically and are never directly editable.
//
// Layout (wireframe greyscale, conventional cart structure):
//   thumbnail | name+description | qty controls | unit price | line subtotal | remove
// plus a summary panel below with subtotal, each adjustment on its own row, and
// a final total.
//
// Edits mutate the shared `cartState` (cart-state.mjs); checkout.js reads the
// same state when building the HPP payload, so what you see is what gets charged.
// The remove button stays disabled — removing items is out of scope for the demo.

import {
  MOCK_ADJUSTMENTS,
  CURRENCY,
  cartItemsSubtotalCents,
  cartFinalAmountCents,
  cartItemCount,
  formatCents,
} from '/shared/cart/cart-fixture.mjs';
import { cartState, currentAdjustments } from './cart-state.mjs';

// cents -> dollars string for the unit-price input (e.g. 4900 -> "49.00").
const centsToDollars = (cents) => (cents / 100).toFixed(2);
// dollars string -> cents, clamped to >= 0 (e.g. "49.5" -> 4950).
const dollarsToCents = (val) => {
  const n = parseFloat(val);
  return Number.isFinite(n) ? Math.max(0, Math.round(n * 100)) : 0;
};
// quantity string -> integer, clamped to >= 1.
const clampQty = (val) => {
  const n = parseInt(val, 10);
  return Number.isFinite(n) ? Math.max(1, n) : 1;
};

function renderItemRow(item) {
  const lineSubtotal = item.unitAmountCents * item.quantity;
  return `
    <li class="cart-row">
      <div class="cart-row__thumb" aria-hidden="true"></div>
      <div class="cart-row__info">
        <div class="cart-row__name">${item.name}</div>
        <div class="cart-row__desc">${item.description}</div>
      </div>
      <div class="cart-row__qty" aria-label="Quantity">
        <button class="qty-btn" type="button" data-qty-dec="${item.id}" aria-label="Decrease quantity">&minus;</button>
        <input class="qty-input" type="number" min="1" step="1"
               data-qty="${item.id}" value="${item.quantity}" aria-label="Quantity" />
        <button class="qty-btn" type="button" data-qty-inc="${item.id}" aria-label="Increase quantity">+</button>
      </div>
      <div class="cart-row__unit">
        <span class="input-prefix">${CURRENCY}</span>
        <input class="unit-input" type="number" min="0" step="0.01"
               data-unit="${item.id}" value="${centsToDollars(item.unitAmountCents)}" aria-label="Unit price" />
      </div>
      <div class="cart-row__subtotal" data-subtotal="${item.id}">${CURRENCY} ${formatCents(lineSubtotal)}</div>
      <button class="cart-row__remove" disabled aria-label="Remove item">&times;</button>
    </li>`;
}

function renderAdjustmentRow(adj) {
  // Discounts are stored as negative amounts (HPP contract). formatCents
  // already renders the leading minus, so the amount span works for all kinds.
  // The discount row gets a checkbox so the shopper can choose not to apply it.
  if (adj.kind === 'discount') {
    return `
    <div class="summary-row summary-row--adjustment summary-row--toggle" data-adjustment-row="discount">
      <label class="summary-toggle">
        <input type="checkbox" data-discount-toggle ${cartState.applyDiscount ? 'checked' : ''} />
        <span>${adj.label}<span class="summary-row__kind"> (${adj.kind})</span></span>
      </label>
      <span>${CURRENCY} ${formatCents(adj.amount)}</span>
    </div>`;
  }
  return `
    <div class="summary-row summary-row--adjustment">
      <span>${adj.label}<span class="summary-row__kind"> (${adj.kind})</span></span>
      <span>${CURRENCY} ${formatCents(adj.amount)}</span>
    </div>`;
}

// Recompute every derived value from cartState and write it back into the DOM.
// Inputs are left untouched (they hold the source values); only computed cells
// — line subtotals, summary subtotal/total, item count, discount row state —
// are updated, so editing never steals focus or resets the caret.
function recompute(root) {
  for (const item of cartState.items) {
    const cell = root.querySelector(`[data-subtotal="${item.id}"]`);
    if (cell) cell.textContent = `${CURRENCY} ${formatCents(item.unitAmountCents * item.quantity)}`;
  }

  const subtotalCents = cartItemsSubtotalCents(cartState.items);
  const totalCents = cartFinalAmountCents(cartState.items, currentAdjustments());
  const itemCount = cartItemCount(cartState.items);

  root.querySelector('[data-summary="subtotal"]').textContent = `${CURRENCY} ${formatCents(subtotalCents)}`;
  root.querySelector('[data-summary="total"]').textContent = `${CURRENCY} ${formatCents(totalCents)}`;
  root.querySelector('.cart__count').textContent = `${itemCount} item${itemCount === 1 ? '' : 's'}`;

  const discountRow = root.querySelector('[data-adjustment-row="discount"]');
  if (discountRow) discountRow.classList.toggle('summary-row--disabled', !cartState.applyDiscount);
}

function wireEvents(root) {
  const itemById = (id) => cartState.items.find((it) => it.id === id);

  // Unit-price edits.
  root.querySelectorAll('[data-unit]').forEach((input) => {
    input.addEventListener('input', () => {
      const item = itemById(input.dataset.unit);
      if (item) item.unitAmountCents = dollarsToCents(input.value);
      recompute(root);
    });
  });

  // Quantity typed directly.
  root.querySelectorAll('[data-qty]').forEach((input) => {
    input.addEventListener('input', () => {
      const item = itemById(input.dataset.qty);
      if (item) item.quantity = clampQty(input.value);
      recompute(root);
    });
  });

  // Quantity +/- buttons mutate state and sync the matching input.
  const stepQty = (id, delta) => {
    const item = itemById(id);
    if (!item) return;
    item.quantity = Math.max(1, item.quantity + delta);
    const input = root.querySelector(`[data-qty="${id}"]`);
    if (input) input.value = String(item.quantity);
    recompute(root);
  };
  root.querySelectorAll('[data-qty-dec]').forEach((btn) =>
    btn.addEventListener('click', () => stepQty(btn.dataset.qtyDec, -1)));
  root.querySelectorAll('[data-qty-inc]').forEach((btn) =>
    btn.addEventListener('click', () => stepQty(btn.dataset.qtyInc, +1)));

  // Welcome-discount toggle.
  const discountToggle = root.querySelector('[data-discount-toggle]');
  if (discountToggle) {
    discountToggle.addEventListener('change', () => {
      cartState.applyDiscount = discountToggle.checked;
      recompute(root);
    });
  }
}

export function renderCart(targetEl) {
  const subtotalCents = cartItemsSubtotalCents(cartState.items);
  const totalCents = cartFinalAmountCents(cartState.items, currentAdjustments());
  const itemCount = cartItemCount(cartState.items);

  targetEl.innerHTML = `
    <section class="cart">
      <div class="cart__header">
        <h2 class="cart__title">Your cart</h2>
        <span class="cart__count">${itemCount} item${itemCount === 1 ? '' : 's'}</span>
      </div>

      <ul class="cart__items">${cartState.items.map(renderItemRow).join('')}</ul>

      <div class="cart__summary">
        <div class="summary-row">
          <span>Subtotal</span>
          <span data-summary="subtotal">${CURRENCY} ${formatCents(subtotalCents)}</span>
        </div>
        ${MOCK_ADJUSTMENTS.map(renderAdjustmentRow).join('')}
        <div class="summary-row summary-row--total">
          <span>Total</span>
          <span data-summary="total">${CURRENCY} ${formatCents(totalCents)}</span>
        </div>
      </div>
    </section>
  `;

  wireEvents(targetEl);
  recompute(targetEl);
}
