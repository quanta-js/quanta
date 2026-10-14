import { afterEach, describe, expect, it, vi } from 'vitest';
import {
    Logger,
    LogLevel,
    isBrowserEnvironment,
    isNodeEnvironment,
    isWebWorkerEnvironment,
} from '../services/logger-service';

/**
 * The logger's fallbacks are the branches that keep logging from ever throwing
 * into application code. They are reachable only by replacing globals or by
 * calling the internals directly, so this file does exactly that and restores
 * both the global `console` and every spy after each test.
 */
type LoggerInternals = {
    getLevelName(level: LogLevel): string;
    getColorCode(level: LogLevel): string;
    getResetCode(): string;
    getTimestamp(): string;
    formatMessage(level: LogLevel, message: string): string;
    safeConsoleCall(
        method: 'log' | 'warn' | 'error' | 'debug',
        message: string,
        ...args: unknown[]
    ): void;
    hasConsole: boolean;
    isNode: boolean;
};

const internals = (logger: Logger): LoggerInternals =>
    logger as unknown as LoggerInternals;

const quiet = () => ({
    level: LogLevel.DEBUG,
    timestamp: false,
    colors: false,
});

describe('Logger fallbacks', () => {
    afterEach(() => {
        vi.unstubAllGlobals();
        vi.restoreAllMocks();
    });

    describe('level filtering', () => {
        it('drops warn when the configured level is above WARN', () => {
            const logger = new Logger({ ...quiet(), level: LogLevel.ERROR });
            const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
            const error = vi
                .spyOn(console, 'error')
                .mockImplementation(() => {});

            logger.warn('dropped');
            logger.error('kept');

            expect(warn).not.toHaveBeenCalled();
            expect(error).toHaveBeenCalledTimes(1);
        });

        it('drops every level when the configured level is SILENT', () => {
            const logger = new Logger({ ...quiet(), level: LogLevel.SILENT });
            const log = vi.spyOn(console, 'log').mockImplementation(() => {});

            logger.debug('d');
            logger.info('i');
            logger.warn('w');
            logger.error('e');

            expect(log).not.toHaveBeenCalled();
        });
    });

    describe('level names', () => {
        it('labels a known level with its name', () => {
            const logger = new Logger(quiet());

            expect(internals(logger).getLevelName(LogLevel.DEBUG)).toBe(
                'DEBUG',
            );
            expect(internals(logger).getLevelName(LogLevel.INFO)).toBe('INFO');
            expect(internals(logger).getLevelName(LogLevel.WARN)).toBe('WARN');
            expect(internals(logger).getLevelName(LogLevel.ERROR)).toBe(
                'ERROR',
            );
        });

        it('labels an unknown level LOG', () => {
            const logger = new Logger(quiet());

            expect(internals(logger).getLevelName(LogLevel.SILENT)).toBe('LOG');
        });

        it('formats an unknown level as [LOG] in the output', () => {
            const logger = new Logger(quiet());
            const log = vi.spyOn(console, 'log').mockImplementation(() => {});

            internals(logger).formatMessage(LogLevel.SILENT, 'quiet');

            expect(log).not.toHaveBeenCalled();
            expect(internals(logger).formatMessage(LogLevel.SILENT, 'x')).toBe(
                '[LOG] x',
            );
        });
    });

    describe('timestamp', () => {
        it('prefixes the message with an ISO timestamp when enabled', () => {
            const logger = new Logger({ ...quiet(), timestamp: true });

            expect(internals(logger).getTimestamp()).toMatch(
                /^\[\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z\] $/,
            );
        });

        it('returns an empty prefix when timestamps are disabled', () => {
            const logger = new Logger(quiet());

            expect(internals(logger).getTimestamp()).toBe('');
        });

        it('returns an empty prefix when formatting the date throws', () => {
            const logger = new Logger({ ...quiet(), timestamp: true });
            const realDate = Date;
            vi.stubGlobal(
                'Date',
                class extends realDate {
                    toISOString(): string {
                        throw new Error('clock unavailable');
                    }
                },
            );

            expect(internals(logger).getTimestamp()).toBe('');
        });
    });

    describe('colours', () => {
        it('wraps the message in colour codes when enabled in Node', () => {
            const logger = new Logger({ ...quiet(), colors: true });

            const message = internals(logger).formatMessage(
                LogLevel.INFO,
                'hello',
            );

            expect(message.startsWith('\x1b[32m')).toBe(true);
            expect(message.endsWith('\x1b[0m')).toBe(true);
        });

        it('emits no escape codes when colours are disabled', () => {
            const logger = new Logger({ ...quiet(), colors: false });

            const message = internals(logger).formatMessage(
                LogLevel.ERROR,
                'plain',
            );

            expect(message).toBe('[ERROR] plain');
            expect(message).not.toContain('\x1b');
            expect(internals(logger).getResetCode()).toBe('');
        });

        it('has no colour code for a level outside the palette', () => {
            const logger = new Logger({ ...quiet(), colors: true });

            expect(internals(logger).getColorCode(LogLevel.SILENT)).toBe('');
        });

        it('skips colours outside Node', () => {
            const logger = new Logger({ ...quiet(), colors: true });
            const realProcess = process;
            vi.stubGlobal('process', { ...realProcess, versions: {} });

            const notNode = new Logger({ ...quiet(), colors: true });

            expect(internals(notNode).isNode).toBe(false);
            expect(internals(notNode).getColorCode(LogLevel.INFO)).toBe('');
            expect(internals(notNode).getResetCode()).toBe('');
            expect(internals(logger).isNode).toBe(true);
        });
    });

    describe('missing console', () => {
        it('logs nothing and throws nothing when console has no log method', () => {
            vi.stubGlobal('console', {});
            const logger = new Logger(quiet());

            expect(internals(logger).hasConsole).toBe(false);
            expect(() => logger.log('nowhere')).not.toThrow();
            expect(() => logger.error('nowhere')).not.toThrow();
        });

        it('logs nothing and throws nothing when console is undefined', () => {
            vi.stubGlobal('console', undefined);
            const logger = new Logger(quiet());

            expect(internals(logger).hasConsole).toBe(false);
            expect(() => logger.debug('nowhere')).not.toThrow();
        });
    });

    describe('failing console methods', () => {
        it('falls back to console.log when the level method throws', () => {
            const log = vi.fn();
            vi.stubGlobal('console', {
                log,
                warn: () => {
                    throw new Error('warn is broken');
                },
            });
            const logger = new Logger(quiet());

            logger.warn('still visible', 42);

            expect(log).toHaveBeenCalledTimes(1);
            expect(log).toHaveBeenCalledWith('[WARN] still visible', 42);
        });

        it('swallows the error when the fallback throws too', () => {
            vi.stubGlobal('console', {
                log: () => {
                    throw new Error('log is broken');
                },
            });
            const logger = new Logger(quiet());

            expect(() => logger.log('gone')).not.toThrow();
        });

        it('drops the message when the console method is not a function', () => {
            // `console[method] || console.log` only falls back when the method
            // is missing, so a truthy non-function (e.g. a stubbed string)
            // silently swallows the call instead of reaching console.log.
            const log = vi.fn();
            vi.stubGlobal('console', { log, debug: 'not a function' });
            const logger = new Logger(quiet());

            expect(() => logger.debug('via log')).not.toThrow();
            expect(log).not.toHaveBeenCalled();
        });
    });

    describe('environment detection', () => {
        it('reports Node when process.versions.node exists', () => {
            expect(isNodeEnvironment()).toBe(true);
        });

        it('reports a non-Node environment when process is missing', () => {
            vi.stubGlobal('process', undefined);

            expect(isNodeEnvironment()).toBe(false);
        });

        it('reports a non-Node environment when process has no node version', () => {
            vi.stubGlobal('process', { ...process, versions: {} });

            expect(isNodeEnvironment()).toBe(false);
        });

        it('reports a browser only when both window and document exist', () => {
            expect(isBrowserEnvironment()).toBe(false);

            vi.stubGlobal('window', {});
            expect(isBrowserEnvironment()).toBe(false);

            vi.stubGlobal('document', {});
            expect(isBrowserEnvironment()).toBe(true);
        });

        it('reports a web worker only when self exists without window or document', () => {
            expect(isWebWorkerEnvironment()).toBe(false);

            vi.stubGlobal('self', {});
            vi.stubGlobal('window', undefined);
            vi.stubGlobal('document', undefined);
            expect(isWebWorkerEnvironment()).toBe(true);
        });
    });
});
