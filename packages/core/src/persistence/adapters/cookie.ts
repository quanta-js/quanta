import { logger } from '../../services/logger-service';
import { __DEV__ } from '../../utils/env';
import type { PersistenceAdapter } from '../../type/persistence-types';

export interface CookieAdapterOptions {
    path?: string;
    /** Lifetime in seconds. Defaults to 30 days. */
    maxAge?: number;
    sameSite?: 'Lax' | 'Strict' | 'None';
    secure?: boolean;
    domain?: string;
}

/**
 * Persist serialized state in a browser cookie. Reads null and does nothing
 * without a document; server-side request cookies must be read by the app.
 * Cookies have no storage event, so this adapter does not provide cross-tab sync.
 */
export class CookieAdapter implements PersistenceAdapter {
    private readonly options: Required<Omit<CookieAdapterOptions, 'domain'>> &
        Pick<CookieAdapterOptions, 'domain'>;

    constructor(
        public key: string,
        options: CookieAdapterOptions = {},
    ) {
        this.options = {
            path: options.path ?? '/',
            maxAge: options.maxAge ?? 60 * 60 * 24 * 30,
            sameSite: options.sameSite ?? 'Lax',
            secure: options.secure ?? false,
            domain: options.domain,
        };
    }

    read(): string | null {
        if (typeof document === 'undefined') return null;
        try {
            const prefix = `${encodeURIComponent(this.key)}=`;
            const cookie = document.cookie
                .split(';')
                .map((part) => part.trim())
                .find((part) => part.startsWith(prefix));
            return cookie
                ? decodeURIComponent(cookie.slice(prefix.length))
                : null;
        } catch {
            this.warn('read failed');
            return null;
        }
    }

    write(data: string): void {
        if (typeof document === 'undefined') return;
        this.setCookie(encodeURIComponent(data), this.options.maxAge);
    }

    remove(): void {
        if (typeof document === 'undefined') return;
        try {
            this.setCookie('', 0);
        } catch {
            this.warn('remove failed');
        }
    }

    private setCookie(value: string, maxAge: number): void {
        const { path, domain, sameSite, secure } = this.options;
        // Attribute values must not inject additional cookie attributes. ASCII
        // also makes the complete serialized length an exact byte count.
        if (
            !this.key ||
            !path.startsWith('/') ||
            /[^\x20-\x7e]|;/.test(path) ||
            (domain !== undefined && !/^\.?[a-zA-Z0-9.-]+$/.test(domain)) ||
            !Number.isSafeInteger(maxAge) ||
            !['Lax', 'Strict', 'None'].includes(sameSite) ||
            (sameSite === 'None' && !secure)
        ) {
            throw new Error('CookieAdapter: invalid cookie options.');
        }
        let cookie = `${encodeURIComponent(this.key)}=${value}; Path=${path}; Max-Age=${maxAge}; SameSite=${sameSite}`;
        if (domain !== undefined) cookie += `; Domain=${domain}`;
        if (secure) cookie += '; Secure';
        if (cookie.length > 4096) {
            throw new Error(
                'CookieAdapter: cookie exceeds 4096 bytes; reduce the persisted slice.',
            );
        }
        try {
            document.cookie = cookie;
        } catch {
            throw new Error(
                'CookieAdapter: write failed; cookie access may be blocked.',
            );
        }
    }

    private warn(message: string): void {
        if (__DEV__) logger.warn(`CookieAdapter: ${message}.`);
    }
}
