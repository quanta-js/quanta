import { reactiveEffect } from '../core/effect';

const watch = <T>(source: () => T, callback: (value: T) => void) => {
    reactiveEffect(() => {
        const value = source();
        callback(value); // Run callback when source changes
    });
};

export default watch;
