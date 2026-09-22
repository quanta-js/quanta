#!/usr/bin/env node
/**
 * Run every scenario against one build of @quantajs/core and print
 * `{ scenario: nsPerOp }` as JSON. Each scenario reports the fastest of
 * several trials, the estimate least affected by noise.
 *
 *   node --expose-gc benchmarks/run.mjs <path-to-core-bundle.mjs>
 */

import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';
import { scenarios } from './scenarios.mjs';

const TRIALS = 7;
const Q = await import(pathToFileURL(resolve(process.argv[2])).href);
Q.logger?.setLevel?.(Q.LogLevel?.SILENT ?? 4);

const results = {};
for (const [name, make] of Object.entries(scenarios)) {
    const { iterations, setup, run } = make(Q);
    let best = Infinity;
    for (let t = 0; t < TRIALS; t++) {
        const ctx = setup();
        run(ctx, Math.max(1, Math.floor(iterations / 10))); // warm up
        globalThis.gc?.();
        const start = process.hrtime.bigint();
        run(ctx, iterations);
        const ns = Number(process.hrtime.bigint() - start) / iterations;
        if (ns < best) best = ns;
    }
    results[name] = best;
}
process.stdout.write(JSON.stringify(results));
