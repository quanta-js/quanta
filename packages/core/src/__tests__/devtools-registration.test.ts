import { describe, it, expect, afterEach } from 'vitest';
import {
    devtools,
    enableDevTools,
    disableDevTools,
    type DevToolsEvent,
} from '../devtools';
import { createContainer } from '../core/container';
import { defineStore } from '../core/define-store';
import { isProxy } from '../state/reactive';

let uid = 0;
const unique = (prefix: string) => `reg_${prefix}_${++uid}`;

function record() {
    const events: DevToolsEvent[] = [];
    const unsubscribe = devtools.subscribe((event) => events.push(event));
    return { events, unsubscribe };
}

afterEach(() => disableDevTools());

describe('stores created before enableDevTools()', () => {
    it('are replayed to a listener and report their changes', () => {
        const name = unique('early');
        const store = defineStore(name, { state: () => ({ count: 0 }) })(
            createContainer(),
        );

        enableDevTools();
        const { events, unsubscribe } = record();
        store.count = 1;
        unsubscribe();

        expect(
            events.some(
                (e) => e.type === 'STORE_INIT' && e.payload.name === name,
            ),
        ).toBe(true);
        expect(
            events.some(
                (e) =>
                    e.type === 'STATE_CHANGE' &&
                    e.payload.storeName === name &&
                    e.payload.path === 'count',
            ),
        ).toBe(true);
    });

    it('emit nothing while DevTools is disabled', () => {
        const { events, unsubscribe } = record();
        const store = defineStore(unique('quiet'), {
            state: () => ({ count: 0 }),
        })(createContainer());
        store.count = 1;
        unsubscribe();

        expect(events.some((e) => e.type === 'STATE_CHANGE')).toBe(false);
    });
});

describe('snapshot()', () => {
    it('returns plain data with redacted paths masked', () => {
        const name = unique('snap');
        defineStore(name, {
            state: () => ({
                user: { name: 'ada', token: 'secret' },
                items: [{ token: 'also-secret' }],
            }),
            getters: { token: (s) => s.user.token, label: (s) => s.user.name },
        })(createContainer());
        enableDevTools({ redact: ['token'] });

        const snap = devtools.snapshot(name)!;
        const state = snap.state as {
            user: { name: string; token: string };
            items: { token: string }[];
        };

        expect(isProxy(state)).toBe(false);
        expect(isProxy(state.user)).toBe(false);
        expect(state.user.name).toBe('ada');
        expect(state.user.token).toBe('[redacted]');
        expect(state.items[0].token).toBe('[redacted]');
        expect(snap.getters).toEqual({ token: '[redacted]', label: 'ada' });
    });

    it('returns undefined for an unknown store', () => {
        expect(devtools.snapshot(unique('missing'))).toBeUndefined();
    });
});

describe('redaction of changed values', () => {
    it('masks matching keys nested inside an assigned object', () => {
        const store = defineStore(unique('nested'), {
            state: () => ({ user: null as null | { ssn: string; id: number } }),
        })(createContainer());
        enableDevTools({ redact: ['ssn'] });
        const { events, unsubscribe } = record();

        store.user = { ssn: '123-45-6789', id: 1 };
        unsubscribe();

        const change = events.find((e) => e.type === 'STATE_CHANGE') as
            Extract<DevToolsEvent, { type: 'STATE_CHANGE' }> | undefined;
        expect(change?.payload.value).toEqual({ ssn: '[redacted]', id: 1 });
    });
});

describe('same store name in two containers', () => {
    it('destroying one keeps the other registered', () => {
        const name = unique('shared');
        const useStore = defineStore(name, { state: () => ({ n: 0 }) });
        const first = useStore(createContainer());
        useStore(createContainer());

        first.$destroy();

        expect(devtools.snapshot(name)).toBeDefined();
    });
});

describe('enabling and disabling', () => {
    it('stops reporting after disableDevTools()', () => {
        const store = defineStore(unique('off'), {
            state: () => ({ n: 0 }),
        })(createContainer());
        enableDevTools();
        const { events, unsubscribe } = record();
        disableDevTools();

        store.n = 1;
        unsubscribe();

        expect(events.some((e) => e.type === 'STATE_CHANGE')).toBe(false);
    });

    it('reports again, including stores created meanwhile, after re-enabling', () => {
        enableDevTools();
        disableDevTools();
        const name = unique('meanwhile');
        const store = defineStore(name, { state: () => ({ n: 0 }) })(
            createContainer(),
        );
        enableDevTools();
        const { events, unsubscribe } = record();

        store.n = 1;
        unsubscribe();

        expect(
            events.some(
                (e) =>
                    e.type === 'STATE_CHANGE' && e.payload.storeName === name,
            ),
        ).toBe(true);
    });

    it('devtools.unregisterStore(name) still removes a store by name', () => {
        const name = unique('byname');
        defineStore(name, { state: () => ({ n: 0 }) })(createContainer());
        enableDevTools();

        devtools.unregisterStore(name);

        expect(devtools.snapshot(name)).toBeUndefined();
    });
});
