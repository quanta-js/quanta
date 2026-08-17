import { describe, it, expect, vi } from 'vitest';
import {
    track,
    trigger,
    batchEffects,
    reactiveEffect,
    notifyDependency,
} from '../core/effect';
import { Dependency } from '../core/dependency';

describe('effect system', () => {
    describe('track and trigger', () => {
        it('should track dependencies and trigger effects', () => {
            const target = {};
            let ran = 0;

            reactiveEffect(() => {
                track(target, 'prop');
                ran++;
            });

            expect(ran).toBe(1);
            trigger(target, 'prop');
            expect(ran).toBe(2);
        });

        it('should not re-run for untracked properties', () => {
            const target = {};
            let ran = 0;

            reactiveEffect(() => {
                track(target, 'tracked');
                ran++;
            });

            expect(ran).toBe(1);
            trigger(target, 'untracked');
            expect(ran).toBe(1);
        });

        it('should handle multiple effects on same property', () => {
            const target = {};
            let ran1 = 0;
            let ran2 = 0;

            reactiveEffect(() => {
                track(target, 'shared');
                ran1++;
            });

            reactiveEffect(() => {
                track(target, 'shared');
                ran2++;
            });

            expect(ran1).toBe(1);
            expect(ran2).toBe(1);

            trigger(target, 'shared');
            expect(ran1).toBe(2);
            expect(ran2).toBe(2);
        });
    });

    describe('reactiveEffect', () => {
        it('should run the effect immediately', () => {
            let ran = false;
            reactiveEffect(() => {
                ran = true;
            });
            expect(ran).toBe(true);
        });

        it('should return the wrapped effect function', () => {
            const wrapped = reactiveEffect(() => {});
            expect(typeof wrapped).toBe('function');
        });

        it('should detect circular dependencies', () => {
            const target = {};
            expect(() => {
                reactiveEffect(() => {
                    track(target, 'x');
                    trigger(target, 'x'); // triggers itself
                });
            }).toThrow(/Circular dependency/);
        });
    });

    describe('effect disposal', () => {
        it('should stop effect from re-running after stop()', () => {
            const target = {};
            let ran = 0;
            const effect = reactiveEffect(() => {
                track(target, 'x');
                ran++;
            });
            expect(ran).toBe(1);
            effect.stop();
            trigger(target, 'x');
            expect(ran).toBe(1); // Should NOT have re-run
        });

        it('should clean up all dependency subscriptions on stop()', () => {
            const target = {};
            const effect = reactiveEffect(() => {
                track(target, 'a');
                track(target, 'b');
            });
            effect.stop();
            // Trigger should not throw or fire anything
            expect(() => {
                trigger(target, 'a');
                trigger(target, 'b');
            }).not.toThrow();
        });

        it('should be idempotent — multiple stop() calls are safe', () => {
            const effect = reactiveEffect(() => {});
            effect.stop();
            expect(() => effect.stop()).not.toThrow();
        });

        it('should prevent re-runs via wrappedEffect() after stop()', () => {
            let ran = 0;
            const effect = reactiveEffect(() => {
                ran++;
            });
            expect(ran).toBe(1);
            effect.stop();
            effect(); // Direct call after stop
            expect(ran).toBe(1); // Guard prevents execution
        });
    });

    describe('batchEffects', () => {
        it('should batch multiple triggers into single effect execution', () => {
            const target = {};
            let ran = 0;

            reactiveEffect(() => {
                track(target, 'a');
                track(target, 'b');
                ran++;
            });

            expect(ran).toBe(1);

            batchEffects(() => {
                trigger(target, 'a');
                trigger(target, 'b');
            });

            // Should only re-run once due to deduplication in Set
            expect(ran).toBe(2);
        });

        it('should clear queue on error', () => {
            const target = {};
            let ran = 0;

            reactiveEffect(() => {
                track(target, 'x');
                ran++;
            });

            expect(() => {
                batchEffects(() => {
                    trigger(target, 'x');
                    throw new Error('test error');
                });
            }).toThrow('test error');

            // Initial run only; queued batch execution must be discarded.
            expect(ran).toBe(1);
            trigger(target, 'x');
            expect(ran).toBe(2);
        });
    });
});

describe('Dependency', () => {
    /**
     * `Dependency` is a subscriber container only. Notification policy —
     * batching, schedulers, error collection — lives in `notifyDependency()`
     * in core/effect.ts, so that direct and bubbled triggers share one path.
     */
    const notify = (dep: Dependency) => {
        const errors: unknown[] = [];
        notifyDependency(dep, errors);
        if (errors.length > 0) throw errors[0];
    };

    it('notifies every subscriber', () => {
        const dep = new Dependency();
        const callback = vi.fn();

        dep.depend(callback);
        notify(dep);

        expect(callback).toHaveBeenCalledOnce();
    });

    it('ignores a null callback', () => {
        const dep = new Dependency();
        expect(() => dep.depend(null)).not.toThrow();
        expect(dep.size).toBe(0);
    });

    it('stops notifying a removed subscriber', () => {
        const dep = new Dependency();
        const callback = vi.fn();

        dep.depend(callback);
        dep.remove(callback);
        notify(dep);

        expect(callback).not.toHaveBeenCalled();
    });

    it('drops every subscriber on clear()', () => {
        const dep = new Dependency();
        const first = vi.fn();
        const second = vi.fn();

        dep.depend(first);
        dep.depend(second);
        dep.clear();
        notify(dep);

        expect(first).not.toHaveBeenCalled();
        expect(second).not.toHaveBeenCalled();
        expect(dep.size).toBe(0);
    });

    it('exposes its subscribers as a readonly set', () => {
        const dep = new Dependency();
        const callback = vi.fn();

        dep.depend(callback);

        expect(dep.getSubscribers.size).toBe(1);
        expect(dep.getSubscribers.has(callback)).toBe(true);
    });

    it('deduplicates a subscriber added twice', () => {
        const dep = new Dependency();
        const callback = vi.fn();

        dep.depend(callback);
        dep.depend(callback);
        notify(dep);

        expect(callback).toHaveBeenCalledOnce();
        expect(dep.size).toBe(1);
    });

    it('runs every subscriber even when one throws, then surfaces the error', () => {
        const dep = new Dependency();
        const failing = vi.fn(() => {
            throw new Error('boom');
        });
        const healthy = vi.fn();

        dep.depend(failing);
        dep.depend(healthy);

        const errors: unknown[] = [];
        notifyDependency(dep, errors);

        // A broken subscriber must not stop the others...
        expect(healthy).toHaveBeenCalledOnce();
        // ...but its failure must not be swallowed either.
        expect(errors).toHaveLength(1);
        expect((errors[0] as Error).message).toBe('boom');
    });

    it('tolerates a subscriber that unsubscribes itself mid-notify', () => {
        // Snapshot-before-iterate: mutating a Set while iterating it loops
        // forever per the ES spec, and re-tracking effects do exactly this.
        const dep = new Dependency();
        const order: string[] = [];

        const first = () => {
            order.push('first');
            dep.remove(second);
        };
        const second = () => order.push('second');

        dep.depend(first);
        dep.depend(second);
        notify(dep);

        expect(order).toEqual(['first', 'second']);
    });
});
