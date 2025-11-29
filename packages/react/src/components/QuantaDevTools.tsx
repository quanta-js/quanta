import { useEffect } from 'react';
import { mountDevTools } from '@quantajs/devtools';

export interface QuantaDevToolsProps {
    /**
     * Whether to show the DevTools.
     * If not provided, it attempts to detect development environment.
     * Pass `true` to force show, `false` to force hide.
     */
    visible?: boolean;
}

export const QuantaDevTools = ({ visible }: QuantaDevToolsProps) => {
    useEffect(() => {
        const cleanup = mountDevTools({ visible });
        return cleanup;
    }, [visible]);

    return null;
};
