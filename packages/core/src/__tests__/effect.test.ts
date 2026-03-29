import { describe, it, expect, vi } from 'vitest';
import { track, trigger, batchEffects, reactiveEffect } from '../core/effect';
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

            reactiveEffect(() => {
                track(target, 'x');
            });

            expect(() => {
                batchEffects(() => {
                    trigger(target, 'x');
                    throw new Error('test error');
                });
            }).toThrow('test error');
        });
    });
});

describe('Dependency', () => {
    it('should add and notify subscribers', () => {
        const dep = new Dependency();
        const callback = vi.fn();

        dep.depend(callback);
        dep.notify();

        expect(callback).toHaveBeenCalledOnce();
    });

    it('should handle null callback gracefully', () => {
        const dep = new Dependency();
        expect(() => dep.depend(null)).not.toThrow();
    });

    it('should remove subscribers', () => {
        const dep = new Dependency();
        const callback = vi.fn();

        dep.depend(callback);
        dep.remove(callback);
        dep.notify();

        expect(callback).not.toHaveBeenCalled();
    });

    it('should clear all subscribers', () => {
        const dep = new Dependency();
        const cb1 = vi.fn();
        const cb2 = vi.fn();

        dep.depend(cb1);
        dep.depend(cb2);
        dep.clear();
        dep.notify();

        expect(cb1).not.toHaveBeenCalled();
        expect(cb2).not.toHaveBeenCalled();
    });

    it('should return internal subscriber set (ReadonlySet)', () => {
        const dep = new Dependency();
        const cb = vi.fn();

        dep.depend(cb);
        const subs = dep.getSubscribers;
        // getSubscribers now returns the internal Set (ReadonlySet)
        expect(subs.size).toBe(1);
        expect(subs.has(cb)).toBe(true);
    });

    it('should isolate subscriber errors', () => {
        const dep = new Dependency();
        const badCb = vi.fn(() => {
            throw new Error('boom');
        });
        const goodCb = vi.fn();

        dep.depend(badCb);
        dep.depend(goodCb);

        // Should not throw — isolated via try/catch
        expect(() => dep.notify()).not.toThrow();
        expect(goodCb).toHaveBeenCalled();
    });

    it('should not add duplicate subscribers (Set behavior)', () => {
        const dep = new Dependency();
        const cb = vi.fn();

        dep.depend(cb);
        dep.depend(cb);
        dep.notify();

        expect(cb).toHaveBeenCalledOnce();
    });
});
