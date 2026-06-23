// Single source of truth for the demo cart, shared across all examples.
// Plain ES module — served as a static file by html-vanilla, imported by Next.js.
// Keep this file framework-free. Renderers live next to their example.
//
// Schema notes (per HPP team):
//   • amount = items subtotal + sum(adjustments). HPP rejects mismatches with 400.
//   • line_items have NO per-item currency — currency is order-level only.
//   • adjustments are order-level only. kind ∈ {discount, tax, shipping, fee}.
//       discount.amount MUST be ≤ 0; the other three MUST be ≥ 0.
//   • description is optional in the API; the demo always passes it as good practice.

export const CURRENCY = 'SGD';

export const MOCK_CART = [
  {
    id: 'sku-widget-pro',
    name: 'Demo Widget Pro',
    description: 'A demo product (not a real SKU).',
    quantity: 1,
    unitAmountCents: 4900,
  },
  {
    id: 'sku-addon',
    name: 'Sample Add-on',
    description: 'Optional add-on, quantity > 1 for line-item demo.',
    quantity: 2,
    unitAmountCents: 1200,
  },
  {
    id: 'sku-setup-fee',
    name: 'Setup Fee',
    description: 'One-off charge.',
    quantity: 1,
    unitAmountCents: 500,
  },
];

// Order-level adjustments. The fixture shows a discount + a tax so the cart
// summary reads like a real one. Other valid kinds ('shipping', 'fee') are
// omitted to keep the demo UI compact — extend MOCK_ADJUSTMENTS to add them.
export const MOCK_ADJUSTMENTS = [
  { kind: 'discount', label: 'WELCOME10', amount: -780 }, // 10% off the 7800 subtotal
  { kind: 'tax',      label: 'GST 9%',    amount:  632 }, // 9% on the post-discount 7020
];

export function cartItemsSubtotalCents(items = MOCK_CART) {
  return items.reduce((sum, it) => sum + it.unitAmountCents * it.quantity, 0);
}

export function cartAdjustmentsTotalCents(adjustments = MOCK_ADJUSTMENTS) {
  return adjustments.reduce((sum, a) => sum + a.amount, 0);
}

// The adjustments currently in effect. The demo cart lets the shopper switch the
// welcome discount off; when applyDiscount is false, discount-kind rows are
// dropped so they're excluded from BOTH the displayed total and the amount sent
// to the HPP — keeping sum(items) + sum(adjustments) === amount intact.
export function activeAdjustments(adjustments = MOCK_ADJUSTMENTS, applyDiscount = true) {
  return applyDiscount ? adjustments.slice() : adjustments.filter((a) => a.kind !== 'discount');
}

// The value that goes into the top-level `amount` field on session create.
// HPP enforces: sum(items × qty) + sum(adjustments) === amount.
export function cartFinalAmountCents(items = MOCK_CART, adjustments = MOCK_ADJUSTMENTS) {
  return cartItemsSubtotalCents(items) + cartAdjustmentsTotalCents(adjustments);
}

export function cartItemCount(items = MOCK_CART) {
  return items.reduce((sum, it) => sum + it.quantity, 0);
}

// Shape sent to HPP under `line_items`. No per-item currency — that's order-level.
export function toHppLineItems(items = MOCK_CART) {
  return items.map((it) => ({
    name: it.name,
    description: it.description,
    quantity: it.quantity,
    unit_amount: it.unitAmountCents,
  }));
}

// Shape sent to HPP under `adjustments`. Pass through as-is.
export function toHppAdjustments(adjustments = MOCK_ADJUSTMENTS) {
  return adjustments.map((a) => ({ kind: a.kind, label: a.label, amount: a.amount }));
}

export function cartOverviewDescription(items = MOCK_CART) {
  const count = cartItemCount(items);
  return `${count} item${count === 1 ? '' : 's'} from Demo Store`;
}

export function formatCents(cents) {
  const sign = cents < 0 ? '-' : '';
  return sign + (Math.abs(cents) / 100).toFixed(2);
}
