import { hydrate, mount } from 'svelte';
import type { ContainerSnapshot } from '@quantajs/core';
import App from './App.svelte';

declare global {
    interface Window {
        /** Set by the server when it rendered this page. */
        __QUANTA__?: ContainerSnapshot;
    }
}

const target = document.getElementById('app')!;
const snapshot = window.__QUANTA__;
if (snapshot) hydrate(App, { target, props: { snapshot } });
else mount(App, { target });
