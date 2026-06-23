// Safe-to-browser constants — never put secret keys here.
// Currency is shared with shared/cart/cart-fixture.mjs; this re-export is here
// only so other browser code can import currency without reaching across to
// /shared/* in places where only display formatting matters.
export { CURRENCY } from '/shared/cart/cart-fixture.mjs';
