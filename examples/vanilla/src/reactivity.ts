import {
    reactive,
    computed,
    watch,
    effect,
    effectScope,
    batchEffects,
} from '@quantajs/core';

/**
 * The primitives `defineStore` is built on, used directly — no store, no
 * container. This is what "framework-agnostic" and "usable standalone"
 * actually mean.
 */
export function mountReactivityPlayground(root: HTMLElement) {
    const state = reactive({ a: 1, b: 2, nested: { c: 3 } });
    const sum = computed(() => state.a + state.b);

    root.innerHTML = `
        <p>a = <span data-a></span>, b = <span data-b></span>, sum (computed) = <span data-sum></span></p>
        <button data-bump-a>a++</button>
        <button data-bump-both>a++ and b++ (batched)</button>
        <button data-bump-nested>nested.c++ (deep watch)</button>
        <button data-stop-scope>stop effectScope</button>
        <p class="muted" data-log></p>
    `;

    const aEl = root.querySelector('[data-a]')!;
    const bEl = root.querySelector('[data-b]')!;
    const sumEl = root.querySelector('[data-sum]')!;
    const logEl = root.querySelector('[data-log]')!;
    const log: string[] = [];
    const pushLog = (line: string) => {
        log.unshift(line);
        logEl.textContent = log.slice(0, 4).join(' · ');
    };

    // `effect` re-runs synchronously whenever a value it read changes.
    let effectRuns = 0;
    effect(() => {
        aEl.textContent = String(state.a);
        bEl.textContent = String(state.b);
        sumEl.textContent = String(sum.value);
        effectRuns++;
    });

    // `watch` with `deep: true` fires on a change anywhere inside the
    // watched object, not just its top-level identity.
    watch(
        () => state.nested,
        () => pushLog('nested changed (deep watch)'),
        { deep: true },
    );

    root.querySelector('[data-bump-a]')!.addEventListener('click', () => {
        state.a++;
    });

    root.querySelector('[data-bump-both]')!.addEventListener('click', () => {
        // Without batchEffects, writing two dependencies of the same effect
        // would run it twice. Batched, it runs once after both land.
        const before = effectRuns;
        batchEffects(() => {
            state.a++;
            state.b++;
        });
        pushLog(`2 writes inside batchEffects → effect ran ${effectRuns - before} time(s)`);
    });

    // effectScope groups effects so they can all be torn down together —
    // the pattern a framework binding uses for "on unmount, stop everything
    // this component started."
    const scope = effectScope();
    let scopedRuns = 0;
    scope.run(() => {
        effect(() => {
            void state.nested.c;
            scopedRuns++;
        });
    });

    root.querySelector('[data-bump-nested]')!.addEventListener('click', () => {
        state.nested.c++;
        pushLog(`scoped effect has now run ${scopedRuns} time(s)`);
    });

    root.querySelector('[data-stop-scope]')!.addEventListener('click', () => {
        scope.stop();
        pushLog('scope stopped — nested.c++ will no longer move the counter above');
    });
}
