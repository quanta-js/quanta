import { createSSRApp } from 'vue';
import { renderToString } from 'vue/server-renderer';
import { createQuanta } from '@quantajs/vue';
import App from './App.vue';
import { useTodos } from './stores';

/** Render the page for one request, in a container of its own. */
export async function render(owner: string, delay = 0) {
    const app = createSSRApp(App);
    const quanta = createQuanta();
    app.use(quanta);

    await useTodos(quanta.container).load(owner, delay);
    const html = await renderToString(app);
    const snapshot = quanta.container.dehydrate();
    quanta.container.dispose();
    return { html, snapshot };
}
