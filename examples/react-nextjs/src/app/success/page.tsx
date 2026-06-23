import Link from 'next/link';
import { consumeReturnNonce } from '@/lib/return-nonce-store';
import { getCheckoutSession } from '@/lib/radiumone-client';

interface PageProps {
  searchParams: Promise<Record<string, string>>;
}

// New return contract: the HPP appended only ?checkout_id=... to the URL we
// built. Our URL also carries the nonce + order_ref we attached at session-
// create. Verifying the nonce proves the return is for OUR session; the
// live session readback is purely for display. Authoritative fulfilment
// still comes from the webhook.

export default async function SuccessPage({ searchParams }: PageProps) {
  const { order_ref, nonce, checkout_id } = await searchParams;

  let verdict: 'mock' | 'verified' | 'failed' = 'mock';
  let status: string | undefined;

  if (checkout_id && nonce) {
    if (consumeReturnNonce(checkout_id, nonce)) {
      verdict = 'verified';
      const session = await getCheckoutSession(checkout_id);
      status = session?.status;
    } else {
      verdict = 'failed';
    }
  }

  return (
    <main>
      <header className="site-header">
        <h1>Demo Store &middot; payment return</h1>
      </header>

      {verdict === 'mock' && (
        <p className="result-ok">&#10003; Success (mock mode &mdash; no real session)</p>
      )}

      {verdict === 'verified' && (
        <div>
          <p className="result-ok">&#10003; Return verified</p>
          <p className="result-detail">
            Order reference: {order_ref ?? '—'}<br />
            Checkout ID: {checkout_id}<br />
            Session status (live readback): <strong>{status ?? 'unknown'}</strong>
          </p>
          <p className="result-note">
            Fulfil orders from the RadiumOne Gateway webhook, not this redirect.
            Contact RadiumOne support for webhook setup.
          </p>
        </div>
      )}

      {verdict === 'failed' && (
        <p className="result-fail">&#10007; Return verification failed &mdash; nonce mismatch, expired, or already consumed.</p>
      )}

      <p style={{ marginTop: '1.5rem' }}>
        <Link href="/">&larr; Back to cart</Link>
      </p>
    </main>
  );
}
