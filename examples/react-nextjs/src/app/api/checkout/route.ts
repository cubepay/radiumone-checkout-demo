import { randomBytes } from 'node:crypto';
import { NextRequest, NextResponse } from 'next/server';
import { createCheckoutSession } from '@/lib/radiumone-client';
import { storeReturnNonce } from '@/lib/return-nonce-store';
import {
  CURRENCY,
  cartOverviewDescription,
  toHppLineItems,
  toHppAdjustments,
} from '@/lib/mock-cart';
import { env } from '@/lib/env';

// Two checkout patterns wired through the same endpoint, switched by ?mode=.
// The handlers are kept as straight-line code so the integration shape is
// unambiguous when reading the source.
//
// HPP enforces:  sum(line_items) + sum(adjustments) === amount
// So `adjustments` is only meaningful alongside `line_items` — sending it on
// its own makes the HPP treat line_items as 0 and reject with 400
// (validation:line_items_mismatch). Overview mode therefore sends neither:
// just `amount` as the FINAL CHARGE, no breakdown.
//
// Return contract: we mint a one-shot nonce and bake it into success_url +
// cancel_url BEFORE handing them to the HPP. On return the HPP appends only
// ?checkout_id=...; our return handler verifies the nonce against the in-
// memory store keyed by that checkout_id. (Real merchants use their order DB.)

export async function POST(req: NextRequest) {
  const mode = req.nextUrl.searchParams.get('mode') === 'itemized' ? 'itemized' : 'overview';

  // The browser posts the (editable) cart breakdown. We fall back to the fixture
  // when fields are absent. DEMO ONLY: this trusts the client-sent unit prices so
  // the editable demo cart can drive the charge — a production merchant must look
  // up authoritative prices server-side by SKU and never accept client amounts.
  const body = await req.json().catch(() => ({}));
  const lineItems = Array.isArray(body.line_items) ? body.line_items : toHppLineItems();
  const adjustments = Array.isArray(body.adjustments) ? body.adjustments : toHppAdjustments();
  const description = typeof body.description === 'string' ? body.description : cartOverviewDescription();

  try {
    // Recompute the amount server-side from the breakdown so the HPP invariant
    // sum(line_items) + sum(adjustments) === amount always holds, regardless of
    // any client-sent `amount`.
    const amount =
      lineItems.reduce((s: number, li: { unit_amount: number; quantity: number }) => s + li.unit_amount * li.quantity, 0) +
      adjustments.reduce((s: number, a: { amount: number }) => s + a.amount, 0);
    const orderRef = `DEMO-${Date.now()}-${randomBytes(3).toString('hex')}`;
    const nonce = randomBytes(16).toString('hex');

    const returnQuery = `order_ref=${encodeURIComponent(orderRef)}&nonce=${nonce}`;
    const base = {
      amount,
      currency: CURRENCY,
      order_reference: orderRef,
      success_url: `${env.MERCHANT_BASE_URL}/success?${returnQuery}`,
      cancel_url: `${env.MERCHANT_BASE_URL}/cancel?${returnQuery}`,
      description,
    };

    const session = mode === 'itemized'
      ? await createCheckoutSession({
          ...base,
          line_items: lineItems,
          adjustments,
        })
      : await createCheckoutSession(base);

    storeReturnNonce(session.checkout_id, nonce);

    return NextResponse.json({ checkout_url: session.checkout_url });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
