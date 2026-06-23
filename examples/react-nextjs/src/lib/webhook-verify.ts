// Thin re-export of the shared webhook helpers (signature verification +
// the unordered/at-least-once event reducer). Mirrors mock-cart.ts so the rest
// of the app imports from '@/lib/...' without the relative path to /shared.

export { verifyWebhookSignature } from '../../../../shared/webhook/verify-webhook-signature.mjs';
export { reduceEvent, statusForEvent, FULFILL_EVENTS } from '../../../../shared/webhook/webhook-event-processor.mjs';

export type {
  VerifyWebhookOptions,
  VerifyWebhookResult,
} from '../../../../shared/webhook/verify-webhook-signature.mjs';
export type {
  OrderState,
  ReduceEventInput,
  ReduceEventResult,
} from '../../../../shared/webhook/webhook-event-processor.mjs';
