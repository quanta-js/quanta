import { render as renderSvelte } from 'svelte/server';
import { createContainer } from '@quantajs/core';
import App from './App.svelte';
import { useTodos } from './stores';

/** Render the page for one request, in a container of its own. */
export async function render(owner: string, delay = 0) {
    const container = createContainer(`request:${owner}`);
    await useTodos(container).load(owner, delay);
    const { body } = renderSvelte(App, { props: { container } });
    const snapshot = container.dehydrate();
    container.dispose();
    return { html: body, snapshot };
}
