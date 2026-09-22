// Regression test for "the React package bundles Preact into every app that
// imports it": build this app for real, then inspect the output.
//
// `QuantaDevTools` loads `@quantajs/devtools` (and the Preact it depends on)
// through a dynamic `import()`, and `App.tsx` loads `./Heavy` the same way.
// If either collapses back into the main entry chunk — e.g. because
// `@quantajs/react`'s build stops externalizing `preact` — the chunk count
// below drops and this fails.
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const dir = path.dirname(fileURLToPath(import.meta.url));
const distDir = path.join(dir, 'dist');
const assetsDir = path.join(distDir, 'assets');

const indexHtml = readFileSync(path.join(distDir, 'index.html'), 'utf8');
const entryMatch = indexHtml.match(
    /<script[^>]*type="module"[^>]*src="\/(assets\/[^"]+\.js)"/,
);
assert.ok(entryMatch, 'dist/index.html has no module entry script tag');
const entryFile = entryMatch[1].split('/').pop();

const jsFiles = readdirSync(assetsDir).filter((f) => f.endsWith('.js'));
assert.ok(
    jsFiles.includes(entryFile),
    `entry chunk ${entryFile} missing from dist/assets`,
);

const nonEntryChunks = jsFiles.filter((f) => f !== entryFile);
// One chunk for the lazily-loaded `./Heavy`, one for the dynamically
// imported `@quantajs/devtools` (which pulls in Preact).
assert.ok(
    nonEntryChunks.length >= 2,
    `expected at least 2 code-split chunks besides the entry, found ${nonEntryChunks.length}: ${jsFiles.join(', ')}`,
);

// The DevTools panel's shadow-host id: a string literal that survives
// minification and exists only in @quantajs/devtools.
const DEVTOOLS_MARKER = 'quanta-devtools-shadow-host';

const entryContent = readFileSync(path.join(assetsDir, entryFile), 'utf8');
assert.ok(
    !entryContent.includes(DEVTOOLS_MARKER),
    'the main entry chunk contains the DevTools panel — DevTools/Preact leaked into the main bundle instead of staying in its own dynamically-imported chunk',
);

const devtoolsChunk = nonEntryChunks.find((f) =>
    readFileSync(path.join(assetsDir, f), 'utf8').includes(DEVTOOLS_MARKER),
);
assert.ok(
    devtoolsChunk,
    'no separate chunk contains the DevTools panel — expected the QuantaDevTools dynamic import to produce one',
);

console.log(
    `[verify-build] OK — entry: ${entryFile}, ${nonEntryChunks.length} split chunk(s), DevTools isolated in ${devtoolsChunk}`,
);
