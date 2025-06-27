/* eslint-disable @typescript-eslint/no-unsafe-function-type */
import { Dependency } from './dependency';

const targetMap = new WeakMap<object, Record<string | symbol, Dependency>>();
let activeEffect: Function | null = null;

let isBatching = false;
const effectQueue = new Set<Function>();
const effectStack: Function[] = [];

// Start and process batched effects
export function batchEffects(fn: Function) {
    isBatching = true;
    fn();
    isBatching = false;

    // Trigger all queued effects
    effectQueue.forEach((effect) => effect());
    effectQueue.clear();
}

// Updated trigger function with batching support
export function trigger(target: object, prop: string | symbol) {
    const depsMap = targetMap.get(target);
    if (depsMap && depsMap[prop]) {
        const effects = depsMap[prop].getSubscribers;
        effects.forEach((effect) => {
            if (isBatching) {
                effectQueue.add(effect); // Queue effects
            } else {
                if (effectStack.includes(effect)) {
                    console.error(
                        `Circular dependency detected: Effect "${effect}" triggered itself.`,
                    );
                    // Skip this effect to prevent infinite loop
                    return;
                }
                effect(); // Run immediately if not batching
            }
        });
    }
}

// Other existing methods remain unchanged
export function track(target: object, prop: string | symbol) {
    let depsMap = targetMap.get(target);
    if (!depsMap) {
        targetMap.set(target, (depsMap = {}));
    }

    if (!depsMap[prop]) {
        depsMap[prop] = new Dependency();
    }

    if (activeEffect) {
        depsMap[prop].depend(activeEffect);
    }
}

export function reactiveEffect(effect: Function) {
    const wrappedEffect = () => {
        if (effectStack.includes(effect)) {
            console.error(
                `Circular dependency detected: Effect "${effect}" triggered itself.`,
            );
            // Prevent circular invocation
            return;
        }

        try {
            effectStack.push(effect);
            activeEffect = effect;
            effect();
        } finally {
            effectStack.pop();
            activeEffect = effectStack[effectStack.length - 1] || null;
        }
    };

    wrappedEffect(); // Run the effect immediately
    return wrappedEffect;
}
