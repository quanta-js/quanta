// Smoke-tests the *built* @quantajs/core package through its CJS entry
// point (package.json "exports" -> "require"). This is the direct
// regression test for the packaging bug where `require('@quantajs/core')`
// silently returned `{}` and every export was written onto `globalThis`
// instead: a UMD bundle emitted under `.js` was parsed as ESM because the
// package is `"type": "module"`, so `module.exports` was never reached.
const assert = require('node:assert/strict');
const quanta = require('@quantajs/core');

const expectedExports = [
    'reactive',
    'computed',
    'watch',
    'effect',
    'effectScope',
    'batchEffects',
    'defineStore',
    'createStore',
    'createContainer',
    'getDefaultContainer',
    'LocalStorageAdapter',
];
for (const name of expectedExports) {
    assert.equal(
        typeof quanta[name],
        'function',
        `@quantajs/core CJS export "${name}" is missing or not callable`,
    );
}
// The bug this guards against left `module.exports` as `{}` while quietly
// writing everything onto the global object instead — so also assert
// nothing leaked there.
assert.equal(
    globalThis.QuantaJS,
    undefined,
    '@quantajs/core must not leak its exports onto globalThis',
);

const { defineStore, createContainer } = quanta;

const useCounter = defineStore('cjs-counter', {
    state: () => ({ count: 0 }),
    getters: { doubled: (s) => s.count * 2 },
    actions: {
        increment() {
            this.count++;
        },
    },
});

const container = createContainer('verify-cjs');
const counter = useCounter(container);
counter.increment();
counter.increment();
counter.increment();
assert.equal(counter.count, 3, 'action mutated state');
assert.equal(counter.doubled, 6, 'getter derived from state');

const snapshot = container.dehydrate();
assert.deepEqual(snapshot['cjs-counter'], { count: 3 }, 'dehydrate() snapshot');

const client = createContainer('verify-cjs-client');
client.hydrate(snapshot);
const hydrated = useCounter(client);
assert.equal(hydrated.count, 3, 'hydrate() restored state before first read');

container.dispose();
client.dispose();

console.log('[verify-cjs] @quantajs/core CJS entry point OK');
