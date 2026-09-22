/**
 * @vitest-environment happy-dom
 */
import { describe, it, expect, afterEach } from 'vitest';
import { StrictMode, useLayoutEffect, useState } from 'react';
import { render, screen, act, cleanup } from '@testing-library/react';
import { createContainer, defineStore } from '@quantajs/core';
import { QuantaProvider } from '../components/QuantaProvider';
import { useQuantaValue } from '../hooks/useStore';

afterEach(() => cleanup());

let uid = 0;
const counter = () =>
    defineStore(`commit_${++uid}`, {
        state: () => ({ a: 0, b: 0 }),
        actions: {
            setA(n: number) {
                this.a = n;
            },
            setB(n: number) {
                this.b = n;
            },
        },
    });

describe('useQuantaSelector commit-phase tracking', () => {
    it('picks up a change made after render but before subscribing', () => {
        const def = counter();
        const container = createContainer();
        const Reader = () => (
            <i data-testid="a">{useQuantaValue(def, (s) => s.a)}</i>
        );
        const Writer = () => {
            useLayoutEffect(() => {
                def(container).setA(5);
            }, []);
            return null;
        };

        render(
            <QuantaProvider container={container}>
                <Reader />
                <Writer />
            </QuantaProvider>,
        );

        expect(screen.getByTestId('a').textContent).toBe('5');
    });

    it('tracks the selector of the latest committed render', () => {
        const def = counter();
        const container = createContainer();
        let setField: (f: 'a' | 'b') => void = () => {};
        const Reader = () => {
            const [field, set] = useState<'a' | 'b'>('a');
            setField = set;
            return (
                <i data-testid="v">{useQuantaValue(def, (s) => s[field])}</i>
            );
        };
        render(
            <StrictMode>
                <QuantaProvider container={container}>
                    <Reader />
                </QuantaProvider>
            </StrictMode>,
        );

        act(() => setField('b'));
        act(() => def(container).setB(7));
        expect(screen.getByTestId('v').textContent).toBe('7');

        act(() => def(container).setA(9)); // no longer selected
        expect(screen.getByTestId('v').textContent).toBe('7');
    });

    it('shows the new selection in the same commit as the selector change', () => {
        const def = counter();
        const container = createContainer();
        def(container).setB(3);
        const seen: number[] = [];
        let setField: (f: 'a' | 'b') => void = () => {};
        const Reader = () => {
            const [field, set] = useState<'a' | 'b'>('a');
            setField = set;
            const value = useQuantaValue(def, (s) => s[field]);
            seen.push(value);
            return null;
        };
        render(
            <QuantaProvider container={container}>
                <Reader />
            </QuantaProvider>,
        );

        seen.length = 0;
        act(() => setField('b'));

        expect(seen).toEqual([3]);
    });
});
