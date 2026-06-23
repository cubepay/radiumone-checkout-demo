// Mutable client-side cart state for the html-vanilla demo.
//
// The shared fixture (/shared/cart/cart-fixture.mjs) is the immutable seed; this
// module holds a working COPY the shopper can edit (unit price, quantity) plus a
// flag for whether the welcome discount is applied. cart.js mutates it from the
// UI; checkout.js reads it when building the HPP payload. Both import this SAME
// module instance (ES modules are singletons), so edits made in the cart flow
// straight into checkout with no extra wiring.

import { MOCK_CART, MOCK_ADJUSTMENTS, activeAdjustments } from '/shared/cart/cart-fixture.mjs';

export const cartState = {
  // Shallow per-item copies so edits don't mutate the shared fixture.
  items: MOCK_CART.map((it) => ({ ...it })),
  applyDiscount: true,
};

// Adjustments currently in effect, honoring the discount toggle.
export function currentAdjustments() {
  return activeAdjustments(MOCK_ADJUSTMENTS, cartState.applyDiscount);
}
