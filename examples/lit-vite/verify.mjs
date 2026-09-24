// The build step type-checks the app, which proves the controllers infer
// store and selection types. This checks the build output exists and that
// every element made it into the bundle.
import assert from 'node:assert/strict';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const dir = path.dirname(fileURLToPath(import.meta.url));
const assets = path.join(dir, 'dist', 'assets');
assert.ok(existsSync(path.join(dir, 'dist', 'index.html')), 'no build');
const bundle = readdirSync(assets)
    .filter((f) => f.endsWith('.js'))
    .map((f) => readFileSync(path.join(assets, f), 'utf8'))
    .join('\n');

for (const name of [
    'todo-app',
    'todo-summary',
    'todo-list',
    'todo-actions',
    'local-counter',
]) {
    assert.ok(bundle.includes(name), `${name} is missing from the bundle`);
}

console.log('[verify] OK — typed build with every @quantajs/lit controller');
