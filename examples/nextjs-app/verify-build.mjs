// `next build` succeeding at all is most of the value here — nothing else in
// this repo builds a real Next.js App Router app, so it's the only thing
// that can catch a `'use client'` banner getting dropped or mangled by
// @quantajs/react's build, or an SSR/hydration path that only worked under
// happy-dom.
//
// On top of that, confirm Next actually recognized a client/server split:
// if `app/providers.tsx` were ever rendered as a Server Component (the
// directive lost), no client-reference-manifest would exist at all.
import assert from 'node:assert/strict';
import { existsSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const dir = path.dirname(fileURLToPath(import.meta.url));
const nextDir = path.join(dir, '.next');
assert.ok(
    existsSync(nextDir),
    '.next build output missing — run `next build` before `verify`',
);

const serverDir = path.join(nextDir, 'server');
assert.ok(
    existsSync(serverDir),
    '.next/server missing — the App Router server build did not run',
);

function findFiles(root, predicate, found = []) {
    for (const entry of readdirSync(root)) {
        const full = path.join(root, entry);
        if (statSync(full).isDirectory()) findFiles(full, predicate, found);
        else if (predicate(entry)) found.push(full);
    }
    return found;
}

const clientReferenceManifests = findFiles(serverDir, (name) =>
    name.includes('client-reference-manifest'),
);
assert.ok(
    clientReferenceManifests.length > 0,
    'no client-reference-manifest found in .next/server — Next.js did not see a ' +
        '"use client" boundary. If @quantajs/react ever drops or mis-banners its ' +
        '"use client" directive, this is what breaks.',
);

console.log(
    `[verify-build] OK — next build succeeded, ${clientReferenceManifests.length} client-reference-manifest file(s) found`,
);
