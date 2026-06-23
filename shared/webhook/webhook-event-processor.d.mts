// Type declarations for webhook-event-processor.mjs (consumed by the Next.js example).

export type TransactionStatus =
  | 'AUTHORIZED' | 'CAPTURED' | 'FAILED' | 'VOIDED'
  | 'REVERSED' | 'REFUNDED' | 'REFUND_FAILED' | 'UNKNOWN';

export interface OrderState {
  transactionId?: string;
  status: TransactionStatus | string;
  amountMinorUnits?: number;
  currency?: string;
  lastEventId?: string;
  lastEventType?: string;
  lastCreatedAtMs?: number;
  fulfilled: boolean;
}

export interface ReduceEventInput {
  event: unknown;
  alreadySeen: boolean;
  order?: OrderState;
}

export interface ReduceEventResult {
  action: 'duplicate' | 'stale' | 'applied';
  fulfill?: boolean;
  status?: string;
  nextOrder?: OrderState;
}

export function statusForEvent(type: string): string | null;
export const FULFILL_EVENTS: Set<string>;
export function reduceEvent(input: ReduceEventInput): ReduceEventResult;
