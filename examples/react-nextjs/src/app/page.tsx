import { CartApp } from './cart-app';

export default function CartPage() {
  return (
    <main>
      <header className="site-header">
        <h1>Demo Store &middot; mock cart</h1>
        <span className="banner real">Next.js — API calls always live</span>
      </header>

      <CartApp />
    </main>
  );
}
