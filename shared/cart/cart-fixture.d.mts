// Type declarations for cart-fixture.mjs. Consumed by Next.js example via
// relative import: `../../../../shared/cart/cart-fixture.mjs`.

export interface CartItem {
  id: string;
  name: string;
  description: string;
  quantity: number;
  unitAmountCents: number;
}

export type AdjustmentKind = 'discount' | 'tax' | 'shipping' | 'fee';

export interface Adjustment {
  kind: AdjustmentKind;
  label: string;
  // Signed minor units. discount MUST be <= 0; tax/shipping/fee MUST be >= 0.
  amount: number;
}

// Shape sent on the wire to HPP under `line_items`. No per-item currency.
export interface HppLineItem {
  name: string;
  description: string;
  quantity: number;
  unit_amount: number;
}

// Shape sent on the wire to HPP under `adjustments`.
export interface HppAdjustment {
  kind: AdjustmentKind;
  label: string;
  amount: number;
}

export const CURRENCY: string;
export const MOCK_CART: CartItem[];
export const MOCK_ADJUSTMENTS: Adjustment[];

export function cartItemsSubtotalCents(items?: CartItem[]): number;
export function cartAdjustmentsTotalCents(adjustments?: Adjustment[]): number;
export function activeAdjustments(adjustments?: Adjustment[], applyDiscount?: boolean): Adjustment[];
export function cartFinalAmountCents(items?: CartItem[], adjustments?: Adjustment[]): number;
export function cartItemCount(items?: CartItem[]): number;
export function toHppLineItems(items?: CartItem[]): HppLineItem[];
export function toHppAdjustments(adjustments?: Adjustment[]): HppAdjustment[];
export function cartOverviewDescription(items?: CartItem[]): string;
export function formatCents(cents: number): string;
