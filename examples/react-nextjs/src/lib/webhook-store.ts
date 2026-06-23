import 'server-only';
import { reduceEvent } from '@/lib/webhook-verify';
import type { OrderState, ReduceEventResult } from '@/lib/webhook-verify';

// In-memory webhook state. DEMO ONLY: a real merchant persists seen event IDs
// and order state in their database (so dedup/ordering survive restarts and
// scale across instances). Webhooks are at-least-once and unordered — the
// reducer in webhook-event-processor.mjs encodes the dedup + stale-discard rules.

// Hot-reload safety in dev: keep the maps on globalThis so they survive Next.js
// module reloads (otherwise every edit would forget which events we'd seen).
declare global {
  var __webhookSeen: Set<string> | undefined;
  var __webhookOrders: Map<string, OrderState> | undefined;
}
const seenEventIds = (globalThis.__webhookSeen ??= new Set<string>());
const ordersByTxn = (globalThis.__webhookOrders ??= new Map<string, OrderState>());

// Verify the event, persist the resulting state, and (idempotently) fulfil.
// Returns the reducer outcome so the route can report it.
export function processWebhookEvent(event: {
  id?: string;
  type?: string;
  data?: { transaction_id?: string };
}): ReduceEventResult {
  const txnId = event?.data?.transaction_id ?? '';
  const outcome = reduceEvent({
    event,
    alreadySeen: seenEventIds.has(event?.id ?? ''),
    order: ordersByTxn.get(txnId),
  });

  if (outcome.action === 'applied' && outcome.nextOrder) {
    ordersByTxn.set(txnId, outcome.nextOrder);
    if (outcome.fulfill) console.log(`[webhook] ✓ FULFIL order for ${txnId} (${event.type})`);
    else console.log(`[webhook] ✓ ${event.type} → ${outcome.status} for ${txnId}`);
  } else {
    console.log(`[webhook] • ${outcome.action} event ${event?.id} (${event?.type})`);
  }
  seenEventIds.add(event?.id ?? '');

  return outcome;
}
