// Starts the built server and requests the page for two users at once, the
// first to start finishing last. Each page's islands, snapshot and cookie
// must show only its own user. Then checks the prerendered page.
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const dir = path.dirname(fileURLToPath(import.meta.url));
const PORT = 4391;
const base = `http://127.0.0.1:${PORT}`;

const server = spawn(process.execPath, ['dist/server/entry.mjs'], {
    cwd: dir,
    env: { ...process.env, HOST: '127.0.0.1', PORT: String(PORT) },
    stdio: ['ignore', 'ignore', 'inherit'],
});

async function waitForServer() {
    for (let i = 0; i < 100; i++) {
        try {
            await fetch(base);
            return;
        } catch {
            await new Promise((r) => setTimeout(r, 100));
        }
    }
    throw new Error('the server did not start');
}

/** Evaluate the snapshot script the way the browser would. */
function snapshotOf(page) {
    const match = /<script data-astro-rerun>(.*?)<\/script>/s.exec(page);
    assert.ok(match, 'the page has no snapshot script');
    const window = {};
    new Function('window', match[1])(window);
    return window.__QUANTA__;
}

try {
    await waitForServer();
    const [ada, bob] = await Promise.all(
        [
            ['ada', 40],
            ['bob', 5],
        ].map(async ([user, delay]) => {
            const res = await fetch(`${base}/?user=${user}&delay=${delay}`);
            return { user, res, page: await res.text() };
        }),
    );

    for (const [{ user, res, page }, other] of [
        [ada, 'bob'],
        [bob, 'ada'],
    ]) {
        for (const framework of ['React', 'Vue', 'Svelte']) {
            assert.match(
                page,
                new RegExp(`${framework}:\\s*(<!--[^>]*-->)?\\s*${user}`),
                `the ${framework} island on ${user}'s page did not render ${user}`,
            );
        }
        assert.ok(!page.includes(other), `${user}'s page mentions ${other}`);
        const snapshot = snapshotOf(page);
        assert.equal(snapshot.cart.user, user);
        assert.deepEqual(snapshot.cart.items, [`${user}'s first item`]);
        assert.match(
            res.headers.get('set-cookie') ?? '',
            new RegExp(`seen=${user}`),
        );
    }

    const staticPage = readFileSync(
        path.join(dir, 'dist/client/static/index.html'),
        'utf8',
    );
    assert.equal(snapshotOf(staticPage).cart.user, 'static');

    const assets = path.join(dir, 'dist/client/_astro');
    assert.ok(existsSync(assets), 'no client assets');
    const scripts = readdirSync(assets, { recursive: true })
        .filter((f) => f.endsWith('.js'))
        .map((f) => readFileSync(path.join(assets, f), 'utf8'));
    assert.ok(
        scripts.some((code) => code.includes('__QUANTA__')),
        'the client script that adopts the snapshot is not bundled',
    );
    // Islands share state only if the browser loads QuantaJS once: exactly one
    // file may hold the container code, which only it can contain.
    assert.equal(
        scripts.filter((code) => code.includes('after dispose()')).length,
        1,
        'the islands do not share one copy of @quantajs/core',
    );

    console.log(
        '[verify] OK — concurrent requests kept apart in every island; static page and client script in place',
    );
} finally {
    server.kill();
}
