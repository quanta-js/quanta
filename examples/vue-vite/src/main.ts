import { createApp, createSSRApp } from 'vue';
import type { ContainerSnapshot } from '@quantajs/core';
import { createQuanta } from '@quantajs/vue';
import App from './App.vue';

declare global {
    interface Window {
        /** Set by the server when it rendered this page. */
        __QUANTA__?: ContainerSnapshot;
    }
}

const snapshot = window.__QUANTA__;
const app = snapshot ? createSSRApp(App) : createApp(App);
app.use(createQuanta({ snapshot }));
app.mount('#app');
