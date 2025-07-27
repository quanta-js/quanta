import React from 'react';
import { QuantaProvider, useStore } from '@quantajs/react';
import { createStore } from '@quantajs/core';

// Create a counter store
const counterStore = createStore('counter', {
    state: () => ({
        count: 0,
        step: 1,
    }),
    getters: {
        doubleCount: (state) => state.count * 2,
        isEven: (state) => state.count % 2 === 0,
    },
    actions: {
        increment() {
            this.count += this.step;
        },
        decrement() {
            this.count -= this.step;
        },
        reset() {
            this.count = 0;
        },
        setStep(step: number) {
            this.step = step;
        },
    },
});

// Counter component
function Counter() {
    const store = useStore();

    return (
        <div
            style={{
                padding: '20px',
                border: '1px solid #ccc',
                borderRadius: '8px',
            }}
        >
            <h2>Counter Example</h2>
            <p>Count: {store.count}</p>
            <p>Double Count: {store.doubleCount}</p>
            <p>Is Even: {store.isEven ? 'Yes' : 'No'}</p>
            <p>Step: {store.step}</p>

            <div style={{ marginTop: '10px' }}>
                <button onClick={() => store.increment()}>
                    Increment (+{store.step})
                </button>
                <button
                    onClick={() => store.decrement()}
                    style={{ marginLeft: '10px' }}
                >
                    Decrement (-{store.step})
                </button>
                <button
                    onClick={() => store.reset()}
                    style={{ marginLeft: '10px' }}
                >
                    Reset
                </button>
            </div>

            <div style={{ marginTop: '10px' }}>
                <label>
                    Step:
                    <input
                        type="number"
                        value={store.step}
                        onChange={(e) => store.setStep(Number(e.target.value))}
                        style={{ marginLeft: '5px', width: '60px' }}
                    />
                </label>
            </div>
        </div>
    );
}

// App component
function CounterApp() {
    return (
        <QuantaProvider store={counterStore}>
            <div style={{ padding: '20px' }}>
                <h1>QuantaJS React Counter Example</h1>
                <Counter />
            </div>
        </QuantaProvider>
    );
}

export default CounterApp;
