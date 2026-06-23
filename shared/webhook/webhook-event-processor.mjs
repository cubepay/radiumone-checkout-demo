// Shared webhook event-handling logic for both examples.
//
// The Gateway delivers events AT-LEAST-ONCE and OUT OF ORDER. The consumer guide
// prescribes three defences, all encoded here as a pure reducer so the two demos
// can't drift:
//   1. Deduplicate by event `id`.
//   2. Discard stale transitions using `created_at` (ignore anything older than
//      the newest event already applied for that transaction).
//   3. Treat each event as a state assertion keyed by `transaction_id`.
//
// reduceEvent() does NO I/O — the caller owns the seen-id set and the order map.
// This keeps the tricky ordering logic identical across the Node-stdlib server
// and the Next.js route, which store state differently.

// Map an event type to the transaction status it asserts.
export function statusForEvent(type) {
  switch (type) {
    case 'payment.authorized': return 'AUTHORIZED';
    case 'payment.captured':
    case 'payment.completed': return 'CAPTURED';
    case 'payment.failed':    return 'FAILED';
    case 'payment.voided':    return 'VOIDED';
    case 'payment.reversed':  return 'REVERSED';
    case 'refund.succeeded':  return 'REFUNDED';
    case 'refund.failed':     return 'REFUND_FAILED';
    default:                  return null; // unknown/forward-compat event
  }
}

// Events that mean "money captured → fulfil the order". Fulfilment must be
// idempotent: only the FIRST such event per transaction triggers it.
export const FULFILL_EVENTS = new Set(['payment.captured', 'payment.completed']);

/**
 * Decide what to do with an incoming event given prior state.
 * @param {{ event: any, alreadySeen: boolean, order?: any }} input
 *   - event: parsed webhook body ({ id, type, created_at, data:{ transaction_id, amount, ... } })
 *   - alreadySeen: has this event.id been processed before?
 *   - order: prior persisted state for this transaction, or undefined
 * @returns {{ action: 'duplicate'|'stale'|'applied', fulfill?: boolean, status?: string, nextOrder?: any }}
 */
export function reduceEvent({ event, alreadySeen, order }) {
  if (alreadySeen) return { action: 'duplicate' };

  const createdAtMs = Date.parse(event?.created_at);
  // Out-of-order guard: ignore transitions older than the newest we've applied.
  if (order?.lastCreatedAtMs && Number.isFinite(createdAtMs) && createdAtMs < order.lastCreatedAtMs) {
    return { action: 'stale' };
  }

  const data = event?.data ?? {};
  const status = statusForEvent(event?.type) ?? order?.status ?? 'UNKNOWN';
  const fulfill = FULFILL_EVENTS.has(event?.type) && !order?.fulfilled;

  const nextOrder = {
    transactionId: data.transaction_id ?? order?.transactionId,
    status,
    amountMinorUnits: data.amount?.minor_units ?? order?.amountMinorUnits,
    currency: data.amount?.currency ?? order?.currency,
    lastEventId: event?.id,
    lastEventType: event?.type,
    lastCreatedAtMs: Number.isFinite(createdAtMs) ? createdAtMs : order?.lastCreatedAtMs,
    fulfilled: Boolean(order?.fulfilled) || fulfill,
  };

  return { action: 'applied', fulfill, status, nextOrder };
}
