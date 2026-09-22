#!/usr/bin/env node
/**
 * Benchmark @quantajs/core at HEAD, optionally against a base ref, on the
 * same machine in the same job. Base and head run in alternating child
 * processes over several rounds, and each scenario keeps its fastest round.
 *
 *   node benchmarks/compare.mjs                 # head only
 *   node benchmarks/compare.mjs --base master   # head vs master; exits 1 on a regression
 */

import { execFileSync } from 'node:child_process';
import { appendFileSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { build } from 'esbuild';

const ROOT = resolve(fileURLToPath(new URL('.', import.meta.url)), '..');
const ROUNDS = 3;
/** A scenario fails if head is this much slower than base… */
const MAX_RATIO = 1.3;
/** …and by at least this many nanoseconds, so tiny timings can't flake. */
const MIN_DELTA_NS = 50;

const baseIndex = process.argv.indexOf('--base');
const baseRef = baseIndex > -1 ? process.argv[baseIndex + 1] : null;

const work = mkdtempSync(join(tmpdir(), 'quanta-bench-'));

const bundle = async (srcRoot, out) => {
    await build({
        entryPoints: [join(srcRoot, 'packages/core/src/index.ts')],
        bundle: true,
        format: 'esm',
        platform: 'node',
        define: { 'process.env.NODE_ENV': '"production"' },
        outfile: out,
        logLevel: 'warning',
    });
    return out;
};

const measure = (file) =>
    JSON.parse(
        execFileSync(
            process.execPath,
            ['--expose-gc', join(ROOT, 'benchmarks/run.mjs'), file],
            { encoding: 'utf8' },
        ),
    );

const fmt = (ns) =>
    ns >= 1e6
        ? `${(ns / 1e6).toFixed(2)} ms`
        : ns >= 1e3
          ? `${(ns / 1e3).toFixed(2)} µs`
          : `${ns.toFixed(0)} ns`;

let worktree = null;
let failed = false;
try {
    const head = await bundle(ROOT, join(work, 'head.mjs'));
    let base = null;
    if (baseRef) {
        worktree = join(work, 'base');
        execFileSync(
            'git',
            ['worktree', 'add', '--detach', worktree, baseRef],
            {
                cwd: ROOT,
                stdio: 'pipe',
            },
        );
        base = await bundle(worktree, join(work, 'base.mjs'));
    }

    const best = { head: {}, base: {} };
    const keep = (side, results) => {
        for (const [name, ns] of Object.entries(results)) {
            best[side][name] = Math.min(best[side][name] ?? Infinity, ns);
        }
    };
    for (let round = 0; round < ROUNDS; round++) {
        // Alternate which side goes first so neither always runs warm.
        const order = round % 2 === 0 ? ['base', 'head'] : ['head', 'base'];
        for (const side of order) {
            if (side === 'base' && !base) continue;
            keep(side, measure(side === 'base' ? base : head));
        }
    }

    const lines = base
        ? [
              `### Benchmarks vs \`${baseRef}\``,
              '',
              '| Scenario | Base | Head | Change |',
              '| --- | ---: | ---: | ---: |',
          ]
        : [
              '### Benchmarks',
              '',
              '| Scenario | Time per op |',
              '| --- | ---: |',
          ];

    for (const [name, headNs] of Object.entries(best.head)) {
        if (!base) {
            lines.push(`| ${name} | ${fmt(headNs)} |`);
            continue;
        }
        const baseNs = best.base[name];
        if (baseNs === undefined) {
            lines.push(`| ${name} | — | ${fmt(headNs)} | new |`);
            continue;
        }
        const ratio = headNs / baseNs;
        const regressed = ratio > MAX_RATIO && headNs - baseNs > MIN_DELTA_NS;
        if (regressed) failed = true;
        const change = `${ratio >= 1 ? '+' : ''}${((ratio - 1) * 100).toFixed(0)}%`;
        lines.push(
            `| ${name} | ${fmt(baseNs)} | ${fmt(headNs)} | ${regressed ? `**${change}** ✗` : change} |`,
        );
    }
    if (failed) {
        lines.push(
            '',
            `A scenario is more than ${Math.round((MAX_RATIO - 1) * 100)}% slower than \`${baseRef}\`.`,
        );
    }

    const report = lines.join('\n');
    console.log(report);
    if (process.env.GITHUB_STEP_SUMMARY) {
        appendFileSync(process.env.GITHUB_STEP_SUMMARY, `${report}\n`);
    }
} finally {
    if (worktree) {
        execFileSync('git', ['worktree', 'remove', '--force', worktree], {
            cwd: ROOT,
            stdio: 'pipe',
        });
    }
    rmSync(work, { recursive: true, force: true });
}

process.exit(failed ? 1 : 0);
