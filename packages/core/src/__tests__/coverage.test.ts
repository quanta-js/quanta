import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createStore } from '../core/create-store';
import { flattenStore } from '../utils/flattenStore';
import { Dependency } from '../core/dependency';
import { batchEffects, reactiveEffect } from '../core/effect';
import { logger } from '../services/logger-service';

vi.mock('../services/logger-service', () => ({
    logger: {
        error: vi.fn(),
        warn: vi.fn(),
        info: vi.fn(),
        debug: vi.fn(),
        setLevel: vi.fn(),
    },
}));

describe('Coverage & Error Boundaries', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe('flattenStore', () => {
        it('should handle getting action properties', () => {
            const store = {
                state: {},
                getters: {},
                actions: { myAction: () => 'actionResult' },
                $reset: () => {},
                $destroy: () => {},
            };

            const flat = flattenStore(store);
            expect(flat.myAction()).toBe('actionResult');
        });

        it('should throw and log when get trap fails', () => {
            const store = {
                get state() {
                    throw new Error('state get error');
                },
                getters: {},
                actions: {},
                $reset: () => {},
                $destroy: () => {},
            } as any;

            const flat = flattenStore(store);
            expect(() => flat.prop).toThrow('state get error');
            expect(logger.error).toHaveBeenCalled();
        });

        it('should throw and log when set trap fails', () => {
            const store = {
                get state() {
                    throw new Error('state set error');
                },
                getters: {},
                actions: {},
                $reset: () => {},
                $destroy: () => {},
            };

            const flat = flattenStore(store);
            expect(() => {
                flat.prop = 123;
            }).toThrow('state set error');
            expect(logger.error).toHaveBeenCalled();
        });
    });

    describe('Dependency & Effects', () => {
        it('should log warning when subscriber throws during notify', () => {
            const dep = new Dependency();
            const badEffect = () => {
                throw new Error('bad subscriber');
            };
            dep.depend(badEffect);

            expect(() => dep.notify()).not.toThrow();
            expect(logger.warn).toHaveBeenCalledWith(
                expect.stringContaining('Subscriber callback failed'),
            );
        });

        it('batchEffects should capture queued effect errors', () => {
            expect(() => {
                batchEffects(() => {
                    throw new Error('batch inner error');
                });
            }).toThrow('batch inner error');
        });

        it('reactiveEffect should log on initial execution failure', () => {
            expect(() => {
                reactiveEffect(() => {
                    throw new Error('effect init fail');
                });
            }).toThrow('effect init fail');
            expect(logger.error).toHaveBeenCalled();
        });
    });

    describe('createStore', () => {
        it('should handle missing options gracefully and throw', () => {
            expect(() =>
                createStore(`fail_${Date.now()}`, null as any),
            ).toThrow();
            expect(logger.error).toHaveBeenCalled();
        });

        it('should handle state init failure', () => {
            expect(() => {
                createStore(`state_fail_${Date.now()}`, {
                    state: () => {
                        throw new Error('state init error');
                    },
                });
            }).toThrow('state init error');
            expect(logger.error).toHaveBeenCalled();
        });
    });
});
