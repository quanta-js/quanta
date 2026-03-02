import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { debounce } from '../utils/debounce';

describe('debounce', () => {
    beforeEach(() => {
        vi.useFakeTimers();
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    it('should delay function invocation', () => {
        const fn = vi.fn();
        const debounced = debounce(fn, 100);

        debounced('a');
        expect(fn).not.toHaveBeenCalled();

        vi.advanceTimersByTime(100);
        expect(fn).toHaveBeenCalledWith('a');
    });

    it('should reset timer on subsequent calls', () => {
        const fn = vi.fn();
        const debounced = debounce(fn, 100);

        debounced('first');
        vi.advanceTimersByTime(80);
        debounced('second');
        vi.advanceTimersByTime(80);

        expect(fn).not.toHaveBeenCalled();

        vi.advanceTimersByTime(20);
        expect(fn).toHaveBeenCalledWith('second');
        expect(fn).toHaveBeenCalledOnce();
    });

    it('should support flush to execute immediately', () => {
        const fn = vi.fn();
        const debounced = debounce(fn, 100);

        debounced('value');
        debounced.flush();

        expect(fn).toHaveBeenCalledWith('value');
    });

    it('should support cancel', () => {
        const fn = vi.fn();
        const debounced = debounce(fn, 100);

        debounced('value');
        debounced.cancel();

        vi.advanceTimersByTime(200);
        expect(fn).not.toHaveBeenCalled();
    });

    it('should handle flush with no pending call', () => {
        const fn = vi.fn();
        const debounced = debounce(fn, 100);

        debounced.flush();
        expect(fn).not.toHaveBeenCalled();
    });

    it('should handle cancel with no pending call', () => {
        const fn = vi.fn();
        const debounced = debounce(fn, 100);

        expect(() => debounced.cancel()).not.toThrow();
    });

    it('should pass correct arguments', () => {
        const fn = vi.fn();
        const debounced = debounce(fn, 100);

        debounced(1, 'a', true);
        vi.advanceTimersByTime(100);

        expect(fn).toHaveBeenCalledWith(1, 'a', true);
    });

    it('should handle zero delay', () => {
        const fn = vi.fn();
        const debounced = debounce(fn, 0);

        debounced('value');
        vi.advanceTimersByTime(0);

        expect(fn).toHaveBeenCalledWith('value');
    });
});
