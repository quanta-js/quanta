import { Suspense, lazy, useState } from 'react';
import {
    useQuanta,
    useQuantaValue,
    useQuantaActions,
    useLocalStore,
    useComputed,
    useWatch,
} from '@quantajs/react';
import { useCartStore, useWizardStore } from './stores';

const Heavy = lazy(() => import('./Heavy'));

/** `useQuanta`: the whole store, subscribed to every change. */
function CartSummary() {
    const cart = useQuanta(useCartStore);
    return (
        <ul>
            {cart.items.map((item) => (
                <li key={item.id}>
                    {item.name} — ${item.price}{' '}
                    <button onClick={() => cart.remove(item.id)}>remove</button>
                </li>
            ))}
        </ul>
    );
}

/** `useQuantaValue`: subscribes only to what the selector reads. */
function ItemCount() {
    const count = useQuantaValue(useCartStore, (s) => s.items.length);
    return <p>{count} item(s) in cart</p>;
}

/**
 * `useComputed`: a cached derivation, recomputed only when its inputs
 * change. Resolves the store via `useQuantaActions` (no whole-store
 * subscription) and lets `useComputed` own the fine-grained one instead —
 * the store must still come from the nearest provider's container, never
 * from calling the definition directly, or this would read a *different*
 * container's cart than the rest of the page.
 */
function TaxTotal() {
    const cart = useQuantaActions(useCartStore);
    const total = useComputed(cart, (s) => s.total * 1.0825);
    return <p>total incl. tax: ${total.toFixed(2)}</p>;
}

/** `useQuantaActions`: resolves the store without subscribing — this
 * component calls actions but never reads state, so it never re-renders on
 * a cart change. */
function AddItemForm() {
    const cart = useQuantaActions(useCartStore);
    return (
        <button onClick={() => cart.add('Widget', 9.99)}>Add a widget — $9.99</button>
    );
}

/**
 * Exercises an async action's `pending` / `error` / `abort()`.
 *
 * Reads them through `useQuantaValue` selectors rather than off a
 * `useQuanta`-resolved store: `pending`/`error` live on a separate reactive
 * object from the store's own `state`, and `useQuanta`'s whole-store
 * subscription only wakes on a `state` change. A selector tracks its read
 * directly, so it reacts to the two independently — reading them off
 * `useQuanta`'s store here would appear to work only by coincidence,
 * whenever a state write happens to land near the same tick.
 */
function CheckoutButton() {
    const cart = useQuantaActions(useCartStore);
    const pending = useQuantaValue(useCartStore, (s) => s.checkout.pending);
    const error = useQuantaValue(useCartStore, (s) => s.checkout.error);
    return (
        <p>
            <button
                onClick={() => {
                    // The action rethrows so a caller can react specially to
                    // one call; this component doesn't need to, since
                    // `error` above already reflects it — an unawaited
                    // rejection with nothing catching it would otherwise
                    // surface as an unhandled rejection in the console.
                    cart.checkout().catch(() => {});
                }}
                disabled={pending}
            >
                {pending ? 'Checking out…' : 'Checkout'}
            </button>
            {pending && <button onClick={() => cart.checkout.abort()}>Cancel</button>}
            {error && <span> error: {error.message}</span>}
        </p>
    );
}

/** `useWatch`: a side effect that runs when the watched value changes. */
function CartToast() {
    const cart = useQuanta(useCartStore);
    const [toast, setToast] = useState<string | null>(null);

    useWatch(
        cart,
        (s) => s.items.length,
        (count) => setToast(count === 0 ? null : `cart has ${count} item(s)`),
    );

    return toast ? <p className="toast">{toast}</p> : null;
}

/** `useLocalStore`: a container scoped to this component instance — two
 * `<Wizard>`s never share a step. */
function Wizard() {
    const wizard = useLocalStore(useWizardStore);
    return (
        <p>
            step {wizard.step}/3{' '}
            <button onClick={() => wizard.back()}>back</button>{' '}
            <button onClick={() => wizard.next()}>next</button>
        </p>
    );
}

export default function App() {
    const [showHeavy, setShowHeavy] = useState(false);

    return (
        <main>
            <h1>QuantaJS + React + Vite</h1>

            <section>
                <h2>Cart</h2>
                <AddItemForm />
                <ItemCount />
                <CartSummary />
                <TaxTotal />
                <CheckoutButton />
                <CartToast />
            </section>

            <section>
                <h2>Two independent wizards (useLocalStore)</h2>
                <Wizard />
                <Wizard />
            </section>

            <section>
                <h2>Code-split panel</h2>
                <button onClick={() => setShowHeavy((v) => !v)}>
                    {showHeavy ? 'Hide' : 'Load'} heavy panel
                </button>
                {showHeavy && (
                    <Suspense fallback={<p>Loading…</p>}>
                        <Heavy />
                    </Suspense>
                )}
            </section>
        </main>
    );
}
