// Type declarations for verify-webhook-signature.mjs (consumed by the Next.js example).

export interface VerifyWebhookOptions {
  /** Replay tolerance in seconds. Default 300 (±5 min). */
  toleranceSeconds?: number;
  /** Override "now" in milliseconds (for tests / known-answer vectors). */
  nowMs?: number;
}

export interface VerifyWebhookResult {
  ok: boolean;
  /** Failure cause when ok === false. */
  reason?:
    | 'missing_signature'
    | 'malformed_signature'
    | 'timestamp_out_of_window'
    | 'bad_secret'
    | 'signature_mismatch';
}

export function verifyWebhookSignature(
  rawBody: Buffer | string,
  signatureHeader: string | null | undefined,
  whsec: string | undefined,
  options?: VerifyWebhookOptions,
): VerifyWebhookResult;
