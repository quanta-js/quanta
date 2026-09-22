#!/usr/bin/env node
/**
 * Type-check every ```ts / ```tsx block in the READMEs against the built
 * packages, so the documented API cannot drift from the shipped one.
 *
 * A block whose first line is a path comment (`// stores/cart.ts`) is written
 * to that path, so later blocks in the same README can import it.
 *
 * Run after `pnpm build`.
 */

import { execFileSync } from 'node:child_process';
import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(fileURLToPath(new URL('.', import.meta.url)), '..');
const READMES = [
    'readme.md',
    'packages/core/readme.md',
    'packages/react/readme.md',
    'packages/devtools/readme.md',
];

// Inside packages/react so node resolution finds react, @types/react and the
// workspace-linked @quantajs/core and @quantajs/devtools.
const WORK = join(ROOT, 'packages', 'react', '.readme-check');
const dist = (p) => join(ROOT, 'packages', p);

const tsconfig = {
    compilerOptions: {
        target: 'ES2022',
        module: 'ESNext',
        moduleResolution: 'Bundler',
        jsx: 'react-jsx',
        strict: true,
        noEmit: true,
        skipLibCheck: true,
        lib: ['ES2022', 'DOM', 'DOM.Iterable'],
        types: ['node'],
        paths: {
            '@quantajs/react': [dist('react/dist/index.d.ts')],
            '@quantajs/react/devtools': [dist('react/dist/devtools.d.ts')],
        },
    },
    include: ['**/*.ts', '**/*.tsx'],
};

function extract(markdown) {
    const blocks = [];
    const fence = /^```(ts|tsx)\n([\s\S]*?)^```$/gm;
    let match;
    while ((match = fence.exec(markdown)) !== null) {
        blocks.push({ lang: match[1], code: match[2] });
    }
    return blocks;
}

function fileFor(block, index) {
    const first = block.code.split('\n', 1)[0];
    const named = /^\/\/\s*([\w./-]+\.tsx?)\b/.exec(first);
    return named ? named[1] : `snippet-${index + 1}.${block.lang}`;
}

let failed = false;
try {
    for (const readme of READMES) {
        const blocks = extract(readFileSync(join(ROOT, readme), 'utf8'));
        if (blocks.length === 0) continue;

        rmSync(WORK, { recursive: true, force: true });
        mkdirSync(WORK, { recursive: true });
        writeFileSync(join(WORK, 'tsconfig.json'), JSON.stringify(tsconfig));
        blocks.forEach((block, i) => {
            const file = join(WORK, fileFor(block, i));
            mkdirSync(dirname(file), { recursive: true });
            writeFileSync(file, block.code);
        });

        try {
            execFileSync(
                join(ROOT, 'node_modules', '.bin', 'tsc'),
                ['-p', join(WORK, 'tsconfig.json')],
                { encoding: 'utf8', stdio: 'pipe' },
            );
            console.log(`ok    ${readme} (${blocks.length} blocks)`);
        } catch (error) {
            failed = true;
            console.log(`FAIL  ${readme}`);
            console.log(
                String(error.stdout || error.message).replaceAll(
                    WORK + '/',
                    '  ',
                ),
            );
        }
    }
} finally {
    rmSync(WORK, { recursive: true, force: true });
}

process.exit(failed ? 1 : 0);
