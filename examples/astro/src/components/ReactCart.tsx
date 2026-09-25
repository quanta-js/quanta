import { useQuantaActions, useQuantaValue } from '@quantajs/react';
import { useCart } from '../stores';

export default function ReactCart() {
    const user = useQuantaValue(useCart, (s) => s.user);
    const count = useQuantaValue(useCart, (s) => s.count);
    const cart = useQuantaActions(useCart);
    return (
        <p data-island="react">
            React: {user} has {count}{' '}
            <button onClick={() => cart.add('from React')}>add</button>
        </p>
    );
}
