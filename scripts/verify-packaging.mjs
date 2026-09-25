#!/usr/bin/env node
/**
 * Build a throwaway app against the *packed tarballs*, with the optional peers
 * deliberately absent.
 *
 * ## Why this exists
 *
 * Everything in `examples/` resolves `@quantajs/*` through the pnpm workspace,
 * so every optional peer is always present and every entry point resolves to
 * source. That makes the examples blind to an entire class of defect — the one
 * that only appears once a real consumer installs from the registry.
 *
 * Three shipped bugs were invisible to the workspace and caught only by an
 * outside consumer:
 *
 *   - 2.0.0: `require('@quantajs/core')` returned `{}` (UMD emitted as `.js`
 *     inside a `"type": "module"` package).
 *   - 2.0.0: `@quantajs/react` shipped `export { }` as its type declarations.
 *   - 2.1.0: `@quantajs/react` failed to build in any app without
 *     `@quantajs/devtools`, because the panel's `import('@quantajs/devtools')`
 *     sat in the package barrel and bundlers resolve that statically.
 *
 * This script reproduces the shape all three had in common: install the
 * tarball, import the package the way a user would, and see what happens.
 *
 * It runs `npm install` against file: tarballs rather than pnpm, because npm's
 * resolution of `peerDependenciesMeta.optional` is what a typical consumer hits.
 *
 * Packing runs `scripts/resolve-workspace-protocols.mjs` first — the same step
 * the publish workflow runs — so the tarballs carry real semver ranges instead
 * of `workspace:*`, which npm cannot install. Reusing that script rather than
 * reimplementing the rewrite means a bug in it fails here too. It edits
 * package.json in place, so the originals are snapshotted and restored.
 */

import { execFileSync } from 'node:child_process';
import {
    mkdtempSync,
    writeFileSync,
    readFileSync,
    mkdirSync,
    rmSync,
    readdirSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import vm from 'node:vm';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(fileURLToPath(new URL('.', import.meta.url)), '..');
const PACKAGES = ['core', 'react', 'devtools', 'vue', 'svelte', 'lit', 'astro'];

const run = (cmd, args, cwd) =>
    execFileSync(cmd, args, { cwd, encoding: 'utf8', stdio: 'pipe' });

const log = (msg) => process.stdout.write(`${msg}\n`);

/** Every package.json the resolver may rewrite, so they can be put back. */
const MANIFESTS = readdirSync(join(ROOT, 'packages')).map((name) =>
    join(ROOT, 'packages', name, 'package.json'),
);

let workdir;
const snapshots = new Map();
try {
    workdir = mkdtempSync(join(tmpdir(), 'quanta-packaging-'));
    log(`workdir: ${workdir}`);

    /* ---------------------------------------------------------------- *
     * 1. Pack the tarballs, exactly as the publish workflow does
     * ---------------------------------------------------------------- */
    for (const file of MANIFESTS) snapshots.set(file, readFileSync(file, 'utf8'));
    run('node', [join(ROOT, 'scripts', 'resolve-workspace-protocols.mjs')], ROOT);

    const tarballs = {};
    for (const name of PACKAGES) {
        const dir = join(ROOT, 'packages', name);
        const [packed] = JSON.parse(
            run('npm', ['pack', '--json', '--pack-destination', workdir], dir),
        );
        const file = packed?.filename;
        if (!file) throw new Error(`npm pack produced no tarball for ${name}`);

        // The npm page renders the README, and MIT requires the notice to
        // travel with the code.
        const shipped = packed.files.map((f) => f.path.toLowerCase());
        for (const required of ['readme.md', 'license']) {
            if (!shipped.includes(required)) {
                throw new Error(`@quantajs/${name} tarball has no ${required}`);
            }
        }
        const manifest = JSON.parse(
            readFileSync(join(dir, 'package.json'), 'utf8'),
        );
        if (manifest.repository?.directory !== `packages/${name}`) {
            throw new Error(
                `@quantajs/${name}: repository.directory must be packages/${name}`,
            );
        }

        tarballs[name] = join(workdir, file);
        log(`packed @quantajs/${name} -> ${file}`);
    }

    /* ---------------------------------------------------------------- *
     * 2. A consumer with NO @quantajs/devtools installed
     * ---------------------------------------------------------------- */
    const app = join(workdir, 'app');
    mkdirSync(app);

    writeFileSync(
        join(app, 'package.json'),
        JSON.stringify(
            {
                name: 'packaging-fixture',
                private: true,
                version: '0.0.0',
                type: 'module',
                dependencies: {
                    '@quantajs/core': `file:${tarballs.core}`,
                    '@quantajs/react': `file:${tarballs.react}`,
                    react: '^19.0.0',
                    'react-dom': '^19.0.0',
                },
                devDependencies: { vite: '^7.0.0', typescript: '^5.0.0' },
            },
            null,
            2,
        ),
    );

    log('installing (no @quantajs/devtools — that is the point)...');
    run('npm', ['install', '--no-audit', '--no-fund'], app);

    const installed = readdirSync(join(app, 'node_modules', '@quantajs'));
    if (installed.includes('devtools')) {
        throw new Error(
            'fixture invalid: @quantajs/devtools got installed, so this run ' +
                'cannot prove the optional peer is genuinely optional',
        );
    }

    /* ---------------------------------------------------------------- *
     * 3. CJS require() must return the real module
     * ---------------------------------------------------------------- */
    writeFileSync(
        join(app, 'cjs-check.cjs'),
        `const core = require('@quantajs/core');
const missing = ['defineStore', 'createContainer', 'reactive', 'computed']
    .filter((k) => typeof core[k] !== 'function');
if (missing.length) {
    throw new Error('require("@quantajs/core") is missing: ' + missing.join(', '));
}
if (typeof globalThis.QuantaJS !== 'undefined') {
    throw new Error('importing @quantajs/core wrote to globalThis.QuantaJS');
}
console.log('cjs require: ok');
`,
    );
    log(run('node', ['cjs-check.cjs'], app).trim());

    /* ---------------------------------------------------------------- *
     * 4. Types must actually exist
     * ---------------------------------------------------------------- */
    writeFileSync(
        join(app, 'types-check.ts'),
        `import { defineStore } from '@quantajs/core';
import { useQuanta } from '@quantajs/react';

const useCounter = defineStore('counter', {
    state: () => ({ count: 0 }),
    getters: { doubled: (s) => s.count * 2 },
    actions: { inc() { this.count++; } },
});

// Fails to compile if the declarations are empty or the inference is broken.
const n: number = useCounter().doubled;
export const hook: typeof useQuanta = useQuanta;
export default n;
`,
    );
    writeFileSync(
        join(app, 'tsconfig.json'),
        JSON.stringify(
            {
                compilerOptions: {
                    strict: true,
                    noEmit: true,
                    module: 'esnext',
                    target: 'es2022',
                    moduleResolution: 'bundler',
                    jsx: 'react-jsx',
                    lib: ['es2022', 'dom'],
                    skipLibCheck: true,
                },
                include: ['types-check.ts'],
            },
            null,
            2,
        ),
    );
    run('npx', ['tsc', '-p', 'tsconfig.json'], app);
    log('type declarations: ok');

    /* ---------------------------------------------------------------- *
     * 5. A bundler must resolve the main entry without the optional peer
     *
     * This is the 2.1.0 regression. `import('@quantajs/devtools')` in the
     * barrel is a static specifier, so the bundler resolves it at build time
     * and fails — even for an app that never mentions DevTools.
     * ---------------------------------------------------------------- */
    mkdirSync(join(app, 'src'));
    writeFileSync(
        join(app, 'src/main.ts'),
        `import { defineStore } from '@quantajs/core';
import { useQuanta, useQuantaValue } from '@quantajs/react';

export const useCounter = defineStore('counter', {
    state: () => ({ count: 0 }),
    actions: { inc() { this.count++; } },
});

export { useQuanta, useQuantaValue };
`,
    );
    writeFileSync(
        join(app, 'vite.config.js'),
        `export default {
    build: {
        lib: { entry: 'src/main.ts', formats: ['es'], fileName: 'out' },
        rollupOptions: { external: ['react', 'react-dom', /^react\\//] },
    },
};
`,
    );

    try {
        run('npx', ['vite', 'build'], app);
    } catch (error) {
        const output = `${error.stdout ?? ''}${error.stderr ?? ''}`;
        if (output.includes('@quantajs/devtools')) {
            throw new Error(
                'REGRESSION: the main entry of @quantajs/react still pulls in ' +
                    '@quantajs/devtools, so every consumer without that optional ' +
                    'peer fails to build.\n\n' +
                    output,
            );
        }
        throw new Error(`bundler build failed:\n${output}`);
    }
    log('bundler build without the optional peer: ok');

    /* ---------------------------------------------------------------- *
     * 5b. A production app build must turn development diagnostics off
     *
     * The dev check reads `process.env.NODE_ENV` so that an app's bundler
     * replaces it. When it read `import.meta` through a variable instead,
     * production browser bundles fell back to development and printed
     * warnings. Build an app that triggers a dev-only warning and run it with
     * no `process`, as a browser would.
     * ---------------------------------------------------------------- */
    const prod = join(app, 'prod');
    mkdirSync(prod);
    writeFileSync(
        join(prod, 'index.html'),
        '<script type="module" src="./main.ts"></script>\n',
    );
    writeFileSync(
        join(prod, 'main.ts'),
        `import { createStore } from '@quantajs/core';

// A getter named like a state key: warned about only in development.
createStore('shadow', { state: () => ({ a: 1 }), getters: { a: (s) => s.a } });
`,
    );
    writeFileSync(
        join(prod, 'vite.config.js'),
        // A classic script, so it runs in a plain vm context below.
        "export default { build: { modulePreload: false, rollupOptions: { output: { format: 'iife' } } } };\n",
    );
    run('npx', ['vite', 'build', 'prod'], app);
    const assets = join(prod, 'dist', 'assets');
    const bundle = readFileSync(
        join(assets, readdirSync(assets).find((f) => f.endsWith('.js'))),
        'utf8',
    );
    if (bundle.includes('process.env.NODE_ENV')) {
        throw new Error(
            'REGRESSION: the app bundler left process.env.NODE_ENV in place, so ' +
                'the dev check cannot be resolved at build time',
        );
    }
    const warnings = [];
    const silent = () => {};
    vm.runInNewContext(bundle, {
        console: {
            warn: (...args) => warnings.push(args.join(' ')),
            error: (...args) => warnings.push(args.join(' ')),
            log: silent,
            info: silent,
            debug: silent,
        },
        window: {},
        document: {},
    });
    if (warnings.length > 0) {
        throw new Error(
            'REGRESSION: a production build prints development warnings:\n' +
                warnings.join('\n'),
        );
    }
    log('production build is quiet: ok');

    /* ---------------------------------------------------------------- *
     * 6. The main entry must not reference an optional peer at all
     *
     * Belt to the bundler's braces. Bundlers disagree about how hard to fail
     * on an unresolvable import — Rollup warns, Turbopack errors — so the
     * invariant is asserted directly against the shipped files rather than
     * inferred from whichever bundler this fixture happens to run.
     *
     * String occurrences are fine (the deprecation warning names the package);
     * only `import(...)` and `require(...)` of it are the defect.
     * ---------------------------------------------------------------- */
    const OPTIONAL_PEERS = ['@quantajs/devtools', 'preact'];
    const reactDist = join(app, 'node_modules', '@quantajs', 'react', 'dist');

    // Every specifier form the built output uses, static and dynamic.
    const SPECIFIER = /(?:from|import|require)\s*\(?\s*["'`]([^"'`]+)["'`]/g;

    /**
     * Walk the module graph from an entry, following relative imports.
     *
     * Scanning the entry file alone is not enough, and that is not a
     * hypothetical: with two build entries, Rollup puts a module shared by both
     * into its own chunk, so the offending `import('@quantajs/devtools')` sits
     * one hop away in `QuantaDevTools-<hash>.js` and `index.js` merely imports
     * that chunk. An entry-only check reports clean against the exact bug it
     * was written for.
     */
    const reachableBareImports = (entry) => {
        const seen = new Set();
        const bare = new Set();
        const queue = [entry];

        while (queue.length) {
            const file = queue.pop();
            if (seen.has(file)) continue;
            seen.add(file);

            let source;
            try {
                source = readFileSync(file, 'utf8');
            } catch {
                continue; // an external we do not ship
            }

            for (const [, spec] of source.matchAll(SPECIFIER)) {
                if (spec.startsWith('.')) {
                    queue.push(resolve(join(file, '..'), spec));
                } else {
                    bare.add(spec);
                }
            }
        }
        return bare;
    };

    for (const file of ['index.js', 'index.cjs']) {
        const imported = reachableBareImports(join(reactDist, file));
        for (const peer of OPTIONAL_PEERS) {
            if (imported.has(peer)) {
                throw new Error(
                    `REGRESSION: @quantajs/react/dist/${file} reaches the optional ` +
                        `peer "${peer}". Bundlers resolve that specifier at build ` +
                        `time, so every consumer without it installed fails to ` +
                        `build — even one that never mentions DevTools. Keep it ` +
                        `behind the @quantajs/react/devtools subpath.`,
                );
            }
        }
    }
    log('main entry free of optional-peer imports: ok');

    // And the subpath must still genuinely reach it, or the check above is
    // passing for the wrong reason.
    if (!reachableBareImports(join(reactDist, 'devtools.js')).has('@quantajs/devtools')) {
        throw new Error(
            'the @quantajs/react/devtools entry does not reach @quantajs/devtools; ' +
                'the panel cannot work from there',
        );
    }
    log('devtools subpath still reaches the peer: ok');

    /* ---------------------------------------------------------------- *
     * 7. @quantajs/devtools must load under both require() and import
     *
     * Checked in its own fixture: the one above must not have it installed.
     * ---------------------------------------------------------------- */
    const devApp = join(workdir, 'devtools-app');
    mkdirSync(devApp);
    writeFileSync(
        join(devApp, 'package.json'),
        JSON.stringify({
            name: 'packaging-fixture-devtools',
            private: true,
            version: '0.0.0',
            dependencies: {
                '@quantajs/core': `file:${tarballs.core}`,
                '@quantajs/devtools': `file:${tarballs.devtools}`,
            },
        }),
    );
    run('npm', ['install', '--no-audit', '--no-fund'], devApp);
    writeFileSync(
        join(devApp, 'check.cjs'),
        `const cjs = require('@quantajs/devtools');
if (typeof cjs.mountDevTools !== 'function') {
    throw new Error('require("@quantajs/devtools") has no mountDevTools');
}
import('@quantajs/devtools').then((esm) => {
    if (typeof esm.mountDevTools !== 'function') {
        throw new Error('import("@quantajs/devtools") has no mountDevTools');
    }
    console.log('devtools require + import: ok');
});
`,
    );
    log(run('node', ['check.cjs'], devApp).trim());

    /* ---------------------------------------------------------------- *
     * 8. @quantajs/vue must load under both require() and import, with
     *    declarations that type a selector's ref
     * ---------------------------------------------------------------- */
    const vueApp = join(workdir, 'vue-app');
    mkdirSync(vueApp);
    writeFileSync(
        join(vueApp, 'package.json'),
        JSON.stringify({
            name: 'packaging-fixture-vue',
            private: true,
            version: '0.0.0',
            dependencies: {
                '@quantajs/core': `file:${tarballs.core}`,
                '@quantajs/vue': `file:${tarballs.vue}`,
                vue: '^3.5.0',
            },
            devDependencies: { typescript: '^5.0.0' },
        }),
    );
    run('npm', ['install', '--no-audit', '--no-fund'], vueApp);
    writeFileSync(
        join(vueApp, 'check.cjs'),
        `const cjs = require('@quantajs/vue');
if (typeof cjs.useQuantaValue !== 'function') {
    throw new Error('require("@quantajs/vue") has no useQuantaValue');
}
import('@quantajs/vue').then((esm) => {
    if (typeof esm.createQuanta !== 'function') {
        throw new Error('import("@quantajs/vue") has no createQuanta');
    }
    console.log('vue require + import: ok');
});
`,
    );
    log(run('node', ['check.cjs'], vueApp).trim());
    writeFileSync(
        join(vueApp, 'types-check.ts'),
        `import type { Ref } from 'vue';
import { defineStore } from '@quantajs/core';
import { useQuantaValue } from '@quantajs/vue';

const useCounter = defineStore('counter', {
    state: () => ({ count: 0 }),
    getters: { doubled: (s) => s.count * 2 },
});

// Fails to compile if the declarations are empty or the inference is broken.
export function setup(): Readonly<Ref<number>> {
    return useQuantaValue(useCounter, (s) => s.doubled);
}
`,
    );
    writeFileSync(
        join(vueApp, 'tsconfig.json'),
        JSON.stringify({
            compilerOptions: {
                strict: true,
                noEmit: true,
                module: 'esnext',
                target: 'es2022',
                moduleResolution: 'bundler',
                lib: ['es2022', 'dom'],
                skipLibCheck: true,
            },
            include: ['types-check.ts'],
        }),
    );
    run('npx', ['tsc', '-p', 'tsconfig.json'], vueApp);
    log('vue type declarations: ok');

    /* ---------------------------------------------------------------- *
     * 9. @quantajs/svelte must load under both require() and import, with
     *    declarations that type a selector's store
     * ---------------------------------------------------------------- */
    const svelteApp = join(workdir, 'svelte-app');
    mkdirSync(svelteApp);
    writeFileSync(
        join(svelteApp, 'package.json'),
        JSON.stringify({
            name: 'packaging-fixture-svelte',
            private: true,
            version: '0.0.0',
            dependencies: {
                '@quantajs/core': `file:${tarballs.core}`,
                '@quantajs/svelte': `file:${tarballs.svelte}`,
                svelte: '^5.0.0',
            },
            devDependencies: { typescript: '^5.0.0' },
        }),
    );
    run('npm', ['install', '--no-audit', '--no-fund'], svelteApp);
    writeFileSync(
        join(svelteApp, 'check.cjs'),
        `const cjs = require('@quantajs/svelte');
if (typeof cjs.useQuantaValue !== 'function') {
    throw new Error('require("@quantajs/svelte") has no useQuantaValue');
}
import('@quantajs/svelte').then((esm) => {
    if (typeof esm.setQuantaContainer !== 'function') {
        throw new Error('import("@quantajs/svelte") has no setQuantaContainer');
    }
    console.log('svelte require + import: ok');
});
`,
    );
    log(run('node', ['check.cjs'], svelteApp).trim());
    writeFileSync(
        join(svelteApp, 'types-check.ts'),
        `import type { Readable } from 'svelte/store';
import { defineStore } from '@quantajs/core';
import { useQuantaValue } from '@quantajs/svelte';

const useCounter = defineStore('counter', {
    state: () => ({ count: 0 }),
    getters: { doubled: (s) => s.count * 2 },
});

// Fails to compile if the declarations are empty or the inference is broken.
export const doubled: Readable<number> = useQuantaValue(
    useCounter,
    (s) => s.doubled,
);
`,
    );
    writeFileSync(
        join(svelteApp, 'tsconfig.json'),
        JSON.stringify({
            compilerOptions: {
                strict: true,
                noEmit: true,
                module: 'esnext',
                target: 'es2022',
                moduleResolution: 'bundler',
                lib: ['es2022', 'dom'],
                skipLibCheck: true,
            },
            include: ['types-check.ts'],
        }),
    );
    run('npx', ['tsc', '-p', 'tsconfig.json'], svelteApp);
    log('svelte type declarations: ok');

    /* ---------------------------------------------------------------- *
     * 10. @quantajs/lit must load under both require() and import, with
     *     declarations that type a controller's value
     * ---------------------------------------------------------------- */
    const litApp = join(workdir, 'lit-app');
    mkdirSync(litApp);
    writeFileSync(
        join(litApp, 'package.json'),
        JSON.stringify({
            name: 'packaging-fixture-lit',
            private: true,
            version: '0.0.0',
            dependencies: {
                '@quantajs/core': `file:${tarballs.core}`,
                '@quantajs/lit': `file:${tarballs.lit}`,
                lit: '^3.0.0',
            },
            devDependencies: { typescript: '^5.0.0' },
        }),
    );
    run('npm', ['install', '--no-audit', '--no-fund'], litApp);
    writeFileSync(
        join(litApp, 'check.cjs'),
        `const cjs = require('@quantajs/lit');
if (typeof cjs.QuantaValueController !== 'function') {
    throw new Error('require("@quantajs/lit") has no QuantaValueController');
}
import('@quantajs/lit').then((esm) => {
    if (typeof esm.provideQuantaContainer !== 'function') {
        throw new Error('import("@quantajs/lit") has no provideQuantaContainer');
    }
    console.log('lit require + import: ok');
});
`,
    );
    log(run('node', ['check.cjs'], litApp).trim());
    writeFileSync(
        join(litApp, 'types-check.ts'),
        `import { LitElement } from 'lit';
import { defineStore } from '@quantajs/core';
import { QuantaValueController } from '@quantajs/lit';

const useCounter = defineStore('counter', {
    state: () => ({ count: 0 }),
    getters: { doubled: (s) => s.count * 2 },
});

// Fails to compile if the declarations are empty or the inference is broken.
export class Doubled extends LitElement {
    doubled = new QuantaValueController(this, useCounter, (s) => s.doubled);
    get value(): number {
        return this.doubled.value;
    }
}
`,
    );
    writeFileSync(
        join(litApp, 'tsconfig.json'),
        JSON.stringify({
            compilerOptions: {
                strict: true,
                noEmit: true,
                module: 'esnext',
                target: 'es2022',
                moduleResolution: 'bundler',
                lib: ['es2022', 'dom'],
                skipLibCheck: true,
                useDefineForClassFields: false,
            },
            include: ['types-check.ts'],
        }),
    );
    run('npx', ['tsc', '-p', 'tsconfig.json'], litApp);
    log('lit type declarations: ok');

    /* ---------------------------------------------------------------- *
     * 11. @quantajs/astro: the integration and its middleware load as ES
     *     modules, and every entry point resolves. Installed without its
     *     `astro` peer, which it only needs for types.
     * ---------------------------------------------------------------- */
    const astroApp = join(workdir, 'astro-app');
    mkdirSync(astroApp);
    writeFileSync(
        join(astroApp, 'package.json'),
        JSON.stringify({
            name: 'packaging-fixture-astro',
            private: true,
            version: '0.0.0',
            type: 'module',
            dependencies: {
                '@quantajs/core': `file:${tarballs.core}`,
                '@quantajs/astro': `file:${tarballs.astro}`,
            },
        }),
    );
    run('npm', ['install', '--no-audit', '--no-fund', '--legacy-peer-deps'], astroApp);
    writeFileSync(
        join(astroApp, 'check.mjs'),
        `import quanta from '@quantajs/astro';
import { onRequest } from '@quantajs/astro/middleware';

const integration = quanta();
if (integration.name !== '@quantajs/astro') {
    throw new Error('the default export is not the integration');
}
if (typeof onRequest !== 'function') {
    throw new Error('@quantajs/astro/middleware has no onRequest');
}
// The client runs in a browser; here it only has to resolve.
import.meta.resolve('@quantajs/astro/client');
console.log('astro integration, middleware and client: ok');
`,
    );
    log(run('node', ['check.mjs'], astroApp).trim());

    log('\npackaging verification passed');
} catch (error) {
    process.stderr.write(`\npackaging verification FAILED\n\n${error.message}\n`);
    process.exitCode = 1;
} finally {
    // Restore before anything else — leaving resolved versions in the working
    // tree would quietly commit them.
    for (const [file, contents] of snapshots) writeFileSync(file, contents);
    if (workdir) rmSync(workdir, { recursive: true, force: true });
}
