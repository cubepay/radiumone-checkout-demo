// Thin re-export of the unified cart fixture shared across all examples.
// The actual fixture lives at /shared/cart/cart-fixture.mjs at the repo root.
// Types come from the sibling .d.mts.
//
// This file exists only so the rest of the Next.js example can `import from '@/lib/mock-cart'`
// without leaking the relative path to the shared folder everywhere.

export {
  CURRENCY,
  MOCK_CART,
  MOCK_ADJUSTMENTS,
  cartItemsSubtotalCents,
  cartAdjustmentsTotalCents,
  activeAdjustments,
  cartFinalAmountCents,
  cartItemCount,
  toHppLineItems,
  toHppAdjustments,
  cartOverviewDescription,
  formatCents,
} from '../../../../shared/cart/cart-fixture.mjs';

export type {
  CartItem,
  Adjustment,
  AdjustmentKind,
  HppLineItem,
  HppAdjustment,
} from '../../../../shared/cart/cart-fixture.mjs';
