// Checks the built app, then renders it on the server for two requests at
// once. The first to start finishes last, so if the two shared any state,
// one page would show the other's todos.
import assert from 'node:assert/strict';
import { existsSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const dir = path.dirname(fileURLToPath(import.meta.url));

const assets = path.join(dir, 'dist', 'assets');
assert.ok(existsSync(path.join(dir, 'dist', 'index.html')), 'no client build');
assert.ok(
    readdirSync(assets).some((f) => f.endsWith('.js')),
    'the client build has no JavaScript',
);

const { render } = await import(
    path.join(dir, 'dist-server', 'entry-server.js')
);
const [ada, bob] = await Promise.all([render('ada', 30), render('bob', 5)]);

for (const [owner, other, page] of [
    ['ada', 'bob', ada],
    ['bob', 'ada', bob],
]) {
    assert.match(page.html, new RegExp(`data-owner[^>]*>${owner}<`));
    assert.match(page.html, /data-remaining[^>]*>1 left</);
    assert.ok(
        !page.html.includes(`${other}:`),
        `${owner}'s page shows ${other}'s todos`,
    );
    assert.equal(page.snapshot.todos.owner, owner);
    assert.equal(page.snapshot.todos.items.length, 2);
}

console.log(
    '[verify] OK — client built; two concurrent server renders kept their state apart',
);
