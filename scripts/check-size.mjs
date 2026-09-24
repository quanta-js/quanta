#!/usr/bin/env node
/**
 * Fail if what an app pays for QuantaJS grows past its budget.
 *
 * Each scenario is bundled from the built packages the way an application's
 * bundler would: a production app build, minified, with the framework
 * external and the packages' `sideEffects` honoured. Licence comments are
 * removed before measuring, since apps collect or strip them.
 *
 * The budgets sit a few percent above the current sizes. When a change grows
 * one on purpose, raise its budget in the same pull request and say why.
 *
 * Run after `pnpm build`.
 */
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { gzipSync } from 'node:zlib';
import { build } from 'vite';

const ROOT = resolve(fileURLToPath(new URL('.', import.meta.url)), '..');
const dist = (pkg, file) => join(ROOT, 'packages', pkg, 'dist', file);

const ALIASES = {
    '@quantajs/core': dist('core', 'index.mjs'),
    '@quantajs/react': dist('react', 'index.js'),
    '@quantajs/vue': dist('vue', 'index.js'),
    '@quantajs/svelte': dist('svelte', 'index.js'),
};

/** Gzip bytes. Each entry keeps its imports alive by assigning them. */
const SCENARIOS = [
    {
        name: 'reactive + effect',
        budget: 4_550,
        code: `import { reactive, effect } from '@quantajs/core';
globalThis.keep = [reactive, effect];`,
    },
    {
        name: 'defineStore',
        budget: 8_950,
        code: `import { defineStore } from '@quantajs/core';
globalThis.keep = [defineStore];`,
    },
    {
        name: 'React: defineStore + useQuanta + useQuantaValue',
        budget: 9_500,
        code: `import { defineStore } from '@quantajs/core';
import { useQuanta, useQuantaValue } from '@quantajs/react';
globalThis.keep = [defineStore, useQuanta, useQuantaValue];`,
    },
    {
        name: 'Vue: defineStore + useQuanta + useQuantaValue',
        budget: 9_200,
        code: `import { defineStore } from '@quantajs/core';
import { useQuanta, useQuantaValue } from '@quantajs/vue';
globalThis.keep = [defineStore, useQuanta, useQuantaValue];`,
    },
    {
        name: 'Svelte: defineStore + useQuanta + useQuantaValue',
        budget: 9_100,
        code: `import { defineStore } from '@quantajs/core';
import { useQuanta, useQuantaValue } from '@quantajs/svelte';
globalThis.keep = [defineStore, useQuanta, useQuantaValue];`,
    },
];

const LICENCE = /\/\*![\s\S]*?\*\//g;

async function measure(dir, scenario, index) {
    const entry = join(dir, `entry-${index}.js`);
    writeFileSync(entry, scenario.code);
    const result = await build({
        configFile: false,
        logLevel: 'silent',
        root: dir,
        resolve: { alias: ALIASES },
        define: { 'process.env.NODE_ENV': '"production"' },
        build: {
            write: false,
            minify: true,
            modulePreload: false,
            rollupOptions: {
                input: entry,
                external: [
                    /^react(\/|$)/,
                    /^react-dom/,
                    /^vue(\/|$)/,
                    /^svelte(\/|$)/,
                ],
            },
        },
    });
    const outputs = (Array.isArray(result) ? result : [result]).flatMap(
        (r) => r.output,
    );
    const code = outputs
        .filter((o) => o.type === 'chunk')
        .map((o) => o.code.replace(LICENCE, ''))
        .join('');
    return gzipSync(code, { level: 9 }).length;
}

const dir = mkdtempSync(join(tmpdir(), 'quanta-size-'));
let failed = false;
try {
    process.stdout.write(
        '| Scenario | gzip | Budget |\n| --- | ---: | ---: |\n',
    );
    for (const [i, scenario] of SCENARIOS.entries()) {
        const bytes = await measure(dir, scenario, i);
        const over = bytes > scenario.budget;
        if (over) failed = true;
        process.stdout.write(
            `| ${scenario.name} | ${bytes.toLocaleString('en')} B | ${scenario.budget.toLocaleString('en')} B${over ? ' ✗' : ''} |\n`,
        );
    }
} finally {
    rmSync(dir, { recursive: true, force: true });
}

if (failed) {
    process.stderr.write(
        '\nA scenario is over its size budget. If the growth is intended, raise the budget in scripts/check-size.mjs and explain why in the pull request.\n',
    );
    process.exitCode = 1;
}
