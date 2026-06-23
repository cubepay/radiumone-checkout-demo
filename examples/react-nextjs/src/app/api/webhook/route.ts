import { NextRequest, NextResponse } from 'next/server';
import { verifyWebhookSignature } from '@/lib/webhook-verify';
import { processWebhookEvent } from '@/lib/webhook-store';

// Gateway webhook receiver (Step 4 — authoritative order fulfilment).
//
// The webhook, not the browser redirect, is the source of truth: the customer
// may never return to success_url. Deliveries are signed (HMAC-SHA256),
// at-least-once, and unordered — so we verify, then dedup + discard stale
// transitions in the store. Respond 2xx fast or the Gateway retries.

// Never cache; always read the fresh request body.
export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  const secret = process.env.RADIUMONE_WEBHOOK_SECRET;
  if (!secret) {
    return NextResponse.json(
      { error: 'RADIUMONE_WEBHOOK_SECRET not set — cannot verify deliveries.' },
      { status: 503 },
    );
  }

  // Signature is over the RAW bytes — read them exactly, don't re-serialize JSON.
  const rawBody = Buffer.from(await req.arrayBuffer());
  const signature = req.headers.get('x-radiumone-signature');

  const verdict = verifyWebhookSignature(rawBody, signature, secret);
  if (!verdict.ok) {
    console.warn('[webhook] ✗ rejected:', verdict.reason);
    return NextResponse.json({ error: 'invalid_signature', reason: verdict.reason }, { status: 401 });
  }

  let event;
  try {
    event = JSON.parse(rawBody.toString('utf8'));
  } catch {
    return NextResponse.json({ error: 'malformed_json' }, { status: 400 });
  }

  try {
    const outcome = processWebhookEvent(event);
    return NextResponse.json({ received: true, action: outcome.action }, { status: 200 });
  } catch (err) {
    // Return 500 so the Gateway retries this delivery later.
    console.error('[webhook] processing error:', err instanceof Error ? err.message : err);
    return NextResponse.json({ error: 'processing_error' }, { status: 500 });
  }
}
