import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { createContainer } from '@quantajs/core';
import { QuantaProvider, QuantaDevTools } from '@quantajs/react';
import App from './App';

// An explicit container, not the ambient one. A client-only app *could* rely
// on the ambient container, but modeling the explicit form here is the
// pattern that also works unchanged under SSR, where the ambient container
// is unsafe (shared across every request).
const container = createContainer('react-vite-app');

// StrictMode stays on permanently: it double-mounts every component in
// development, which is exactly what surfaces a hook that leaks state or
// breaks on remount (that class of bug has hit `useComputed` before).
createRoot(document.getElementById('root')!).render(
    <StrictMode>
        <QuantaProvider container={container}>
            <App />
            <QuantaDevTools visible />
        </QuantaProvider>
    </StrictMode>,
);
