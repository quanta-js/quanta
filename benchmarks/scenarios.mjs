/**
 * Benchmark scenarios. Each takes the @quantajs/core module and returns
 * `{ setup, run }`: `setup()` builds fresh state, `run(ctx, n)` performs the
 * measured operation `n` times.
 */

const chain = (depth) => {
    const root = {};
    let node = root;
    for (let i = 0; i < depth; i++) {
        node.n = {};
        node = node.n;
    }
    node.v = 0;
    return root;
};

const leaf = (root, depth) => {
    let node = root;
    for (let i = 0; i < depth; i++) node = node.n;
    return node;
};

let storeId = 0;

export const scenarios = {
    'write, 1 effect': (Q) => ({
        iterations: 50_000,
        setup() {
            const s = Q.reactive({ c: 0 });
            Q.effect(() => void s.c);
            return s;
        },
        run(s, n) {
            for (let i = 0; i < n; i++) s.c++;
        },
    }),

    'write, 100 effects': (Q) => ({
        iterations: 2_000,
        setup() {
            const s = Q.reactive({ c: 0 });
            for (let i = 0; i < 100; i++) Q.effect(() => void s.c);
            return s;
        },
        run(s, n) {
            for (let i = 0; i < n; i++) s.c++;
        },
    }),

    'write, effect with 100 deps': (Q) => ({
        iterations: 2_000,
        setup() {
            const s = Q.reactive(
                Object.fromEntries(
                    Array.from({ length: 100 }, (_, i) => [`k${i}`, i]),
                ),
            );
            const keys = Object.keys(s);
            Q.effect(() => {
                for (const k of keys) void s[k];
            });
            return s;
        },
        run(s, n) {
            for (let i = 0; i < n; i++) s.k0++;
        },
    }),

    'nested write, depth 5': (Q) => ({
        iterations: 10_000,
        setup() {
            const s = Q.reactive(chain(5));
            Q.effect(() => void leaf(s, 5).v);
            return leaf(s, 5);
        },
        run(node, n) {
            for (let i = 0; i < n; i++) node.v++;
        },
    }),

    'computed over 1000 items': (Q) => ({
        iterations: 200,
        setup() {
            const s = Q.reactive({
                items: Array.from({ length: 1000 }, (_, i) => i),
            });
            const sum = Q.computed(() => s.items.reduce((a, b) => a + b, 0));
            void sum.value;
            return { s, sum };
        },
        run({ s, sum }, n) {
            for (let i = 0; i < n; i++) {
                s.items[0]++;
                void sum.value;
            }
        },
    }),

    'filter over 1000 objects': (Q) => ({
        iterations: 200,
        setup() {
            const s = Q.reactive({
                todos: Array.from({ length: 1000 }, (_, i) => ({
                    id: i,
                    done: i % 2 === 0,
                })),
            });
            const open = Q.computed(
                () => s.todos.filter((t) => !t.done).length,
            );
            void open.value;
            return { s, open };
        },
        run({ s, open }, n) {
            for (let i = 0; i < n; i++) {
                s.todos[0].done = !s.todos[0].done;
                void open.value;
            }
        },
    }),

    '100 writes in a batch': (Q) => ({
        iterations: 1_000,
        setup() {
            const s = Q.reactive({ c: 0 });
            Q.effect(() => void s.c);
            return s;
        },
        run(s, n) {
            for (let i = 0; i < n; i++) {
                Q.batchEffects(() => {
                    for (let j = 0; j < 100; j++) s.c++;
                });
            }
        },
    }),

    'store action, 1 subscriber': (Q) => ({
        iterations: 20_000,
        setup() {
            const store = Q.defineStore(`bench_${++storeId}`, {
                state: () => ({ count: 0 }),
                actions: {
                    inc() {
                        this.count++;
                    },
                },
            })(Q.createContainer());
            store.subscribe(() => {});
            return store;
        },
        run(store, n) {
            for (let i = 0; i < n; i++) store.inc();
        },
    }),

    'create and destroy a store': (Q) => ({
        iterations: 2_000,
        setup() {
            return Q.createContainer();
        },
        run(container, n) {
            for (let i = 0; i < n; i++) {
                const store = Q.defineStore(`bench_${++storeId}`, {
                    state: () => ({ a: 0, b: '', c: [] }),
                    getters: { double: (s) => s.a * 2 },
                    actions: {
                        inc() {
                            this.a++;
                        },
                    },
                })(container);
                store.$destroy();
            }
        },
    }),
};
