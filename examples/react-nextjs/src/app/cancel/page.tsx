import Link from 'next/link';
import { consumeReturnNonce } from '@/lib/return-nonce-store';
import { getCheckoutSession } from '@/lib/radiumone-client';

interface PageProps {
  searchParams: Promise<Record<string, string>>;
}

export default async function CancelPage({ searchParams }: PageProps) {
  const { order_ref, nonce, checkout_id, reason } = await searchParams;

  // Cancel is non-authoritative — nothing gets fulfilled — but we still
  // verify the nonce as an authenticity check so the page never trusts
  // an arbitrary inbound checkout_id.
  let status: string | undefined;
  let verified = false;
  if (checkout_id && nonce && consumeReturnNonce(checkout_id, nonce)) {
    verified = true;
    const session = await getCheckoutSession(checkout_id);
    status = session?.status;
  }

  return (
    <main>
      <header className="site-header">
        <h1>Demo Store &middot; payment return</h1>
      </header>

      {reason === 'timeout' && (
        <p className="result-fail">Your session timed out &mdash; please try again.</p>
      )}

      {reason !== 'timeout' && verified && (
        <div>
          <p className="result-fail">Payment cancelled</p>
          <p className="result-detail">
            Order reference: {order_ref ?? '—'}<br />
            Checkout ID: {checkout_id}<br />
            Session status (live readback): <strong>{status ?? 'unknown'}</strong>
          </p>
        </div>
      )}

      {reason !== 'timeout' && !verified && (
        <p className="result-fail">Payment cancelled (mock mode &mdash; no real session)</p>
      )}

      <p style={{ marginTop: '1.5rem' }}>
        <Link href="/">&larr; Back to cart</Link>
      </p>
    </main>
  );
}
