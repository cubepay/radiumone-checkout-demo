'use client';

import { useState, useCallback } from 'react';
import { MOCK_CART } from '@/lib/mock-cart';
import type { CartItem } from '@/lib/mock-cart';
import { CartView } from './cart-view';
import { CheckoutButtons } from './checkout-buttons';

// Client island that owns the editable cart state and shares it with both the
// cart view (which mutates it) and the checkout buttons (which send it to the
// HPP). Seeded from the shared fixture; per-item copies so edits don't mutate it.

export function CartApp() {
  const [items, setItems] = useState<CartItem[]>(() => MOCK_CART.map((it) => ({ ...it })));
  const [applyDiscount, setApplyDiscount] = useState(true);

  const updateItem = useCallback((id: string, patch: Partial<CartItem>) => {
    setItems((prev) => prev.map((it) => (it.id === id ? { ...it, ...patch } : it)));
  }, []);

  return (
    <>
      <CartView
        items={items}
        applyDiscount={applyDiscount}
        onItemChange={updateItem}
        onToggleDiscount={setApplyDiscount}
      />
      <CheckoutButtons items={items} applyDiscount={applyDiscount} />
    </>
  );
}
