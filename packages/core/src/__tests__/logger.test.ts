import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
    Logger,
    LogLevel,
    createLogger,
    logger,
    isNodeEnvironment,
    isBrowserEnvironment,
    isWebWorkerEnvironment,
} from '../services/logger-service';

describe('Logger', () => {
    let testLogger: Logger;

    afterEach(() => {
        vi.restoreAllMocks();
        vi.unstubAllGlobals();
    });

    beforeEach(() => {
        testLogger = new Logger({
            level: LogLevel.DEBUG,
            timestamp: false,
            colors: false,
        });
    });

    describe('log levels', () => {
        it('should log at DEBUG level', () => {
            const spy = vi.spyOn(console, 'debug').mockImplementation(() => {});
            testLogger.debug('debug message');
            expect(spy).toHaveBeenCalled();
            spy.mockRestore();
        });

        it('should log at INFO level', () => {
            const spy = vi.spyOn(console, 'log').mockImplementation(() => {});
            testLogger.log('info message');
            expect(spy).toHaveBeenCalled();
            spy.mockRestore();
        });

        it('should log at WARN level', () => {
            const spy = vi.spyOn(console, 'warn').mockImplementation(() => {});
            testLogger.warn('warn message');
            expect(spy).toHaveBeenCalled();
            spy.mockRestore();
        });

        it('should log at ERROR level', () => {
            const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
            testLogger.error('error message');
            expect(spy).toHaveBeenCalled();
            spy.mockRestore();
        });

        it('should not log below configured level', () => {
            const warnLogger = new Logger({
                level: LogLevel.WARN,
                timestamp: false,
                colors: false,
            });
            const debugSpy = vi
                .spyOn(console, 'debug')
                .mockImplementation(() => {});
            const logSpy = vi
                .spyOn(console, 'log')
                .mockImplementation(() => {});

            warnLogger.debug('should not appear');
            warnLogger.log('should not appear');

            expect(debugSpy).not.toHaveBeenCalled();
            expect(logSpy).not.toHaveBeenCalled();

            debugSpy.mockRestore();
            logSpy.mockRestore();
        });

        it('should be silent at SILENT level', () => {
            const silent = new Logger({
                level: LogLevel.SILENT,
                timestamp: false,
                colors: false,
            });
            const errorSpy = vi
                .spyOn(console, 'error')
                .mockImplementation(() => {});

            silent.error('should not appear');
            expect(errorSpy).not.toHaveBeenCalled();

            errorSpy.mockRestore();
        });
    });

    describe('configuration', () => {
        it('should support setLevel', () => {
            testLogger.setLevel(LogLevel.ERROR);
            expect(testLogger.getLevel()).toBe(LogLevel.ERROR);
        });

        it('should support configure', () => {
            testLogger.configure({ level: LogLevel.WARN });
            expect(testLogger.getLevel()).toBe(LogLevel.WARN);
        });

        it('should support prefix', () => {
            const logger = new Logger({
                prefix: 'MyApp',
                timestamp: false,
                colors: false,
            });
            const spy = vi.spyOn(console, 'log').mockImplementation(() => {});

            logger.log('test');
            expect(spy).toHaveBeenCalledWith(
                expect.stringContaining('[MyApp]'),
            );

            spy.mockRestore();
        });
    });

    describe('child loggers', () => {
        it('should create child with concatenated prefix', () => {
            const parent = new Logger({
                prefix: 'App',
                timestamp: false,
                colors: false,
            });
            const child = parent.child('Module');
            const spy = vi.spyOn(console, 'log').mockImplementation(() => {});

            child.log('test');
            expect(spy).toHaveBeenCalledWith(
                expect.stringContaining('[App:Module]'),
            );

            spy.mockRestore();
        });

        it('should create child without parent prefix', () => {
            const parent = new Logger({ timestamp: false, colors: false });
            const child = parent.child('Child');
            const spy = vi.spyOn(console, 'log').mockImplementation(() => {});

            child.log('test');
            expect(spy).toHaveBeenCalledWith(
                expect.stringContaining('[Child]'),
            );

            spy.mockRestore();
        });
    });

    describe('info alias', () => {
        it('should alias info to log', () => {
            const spy = vi.spyOn(console, 'log').mockImplementation(() => {});
            testLogger.info('info message');
            expect(spy).toHaveBeenCalled();
            spy.mockRestore();
        });
    });

    describe('default logger and factory', () => {
        it('should export a default logger instance', () => {
            expect(logger).toBeInstanceOf(Logger);
        });

        it('should create logger with createLogger', () => {
            const custom = createLogger({ level: LogLevel.ERROR });
            expect(custom).toBeInstanceOf(Logger);
            expect(custom.getLevel()).toBe(LogLevel.ERROR);
        });
    });

    describe('environment detection', () => {
        it('should detect Node environment', () => {
            expect(typeof isNodeEnvironment()).toBe('boolean');
        });

        it('should detect browser environment', () => {
            expect(typeof isBrowserEnvironment()).toBe('boolean');
        });

        it('recognizes a worker without window or document globals', () => {
            vi.stubGlobal('self', {});
            vi.stubGlobal('window', undefined);
            vi.stubGlobal('document', undefined);
            expect(isWebWorkerEnvironment()).toBe(true);

            vi.stubGlobal('window', {});
            expect(isWebWorkerEnvironment()).toBe(false);

            vi.stubGlobal('window', undefined);
            vi.stubGlobal('document', {});
            expect(isWebWorkerEnvironment()).toBe(false);

            vi.stubGlobal('self', undefined);
            vi.stubGlobal('document', undefined);
            expect(isWebWorkerEnvironment()).toBe(false);
        });
    });

    describe('fallback behavior', () => {
        it('drops warnings when the configured level is ERROR', () => {
            const warnSpy = vi
                .spyOn(console, 'warn')
                .mockImplementation(() => {});
            const errorOnly = new Logger({
                level: LogLevel.ERROR,
                timestamp: false,
                colors: false,
            });

            errorOnly.warn('suppressed');
            expect(warnSpy).not.toHaveBeenCalled();
        });

        it('uses LOG as the label for an unknown log level', () => {
            // Public methods use known levels; exercise the formatter fallback.
            const formatter = testLogger as unknown as {
                formatMessage: (level: LogLevel, message: string) => string;
            };

            expect(formatter.formatMessage(99 as LogLevel, 'unexpected')).toBe(
                '[LOG] unexpected',
            );
        });

        it('omits ANSI color for an unknown log level', () => {
            const colorLogger = new Logger({
                level: LogLevel.DEBUG,
                timestamp: false,
                colors: true,
            });
            const formatter = colorLogger as unknown as {
                formatMessage: (level: LogLevel, message: string) => string;
            };

            expect(
                formatter.formatMessage(99 as LogLevel, 'unknown level'),
            ).toContain('[LOG] unknown level');
        });

        it('omits a timestamp if Date.toISOString throws', () => {
            vi.spyOn(Date.prototype, 'toISOString').mockImplementation(() => {
                throw new Error('clock unavailable');
            });
            const logSpy = vi
                .spyOn(console, 'log')
                .mockImplementation(() => {});
            const timestampLogger = new Logger({
                level: LogLevel.INFO,
                timestamp: true,
                colors: false,
            });

            expect(() => timestampLogger.log('still works')).not.toThrow();
            expect(logSpy).toHaveBeenCalledWith('[INFO] still works');
        });

        it('uses timestamps and color codes when enabled', () => {
            vi.spyOn(Date.prototype, 'toISOString').mockReturnValue(
                '2026-01-01T00:00:00.000Z',
            );
            const logSpy = vi
                .spyOn(console, 'log')
                .mockImplementation(() => {});
            const coloredLogger = new Logger({
                level: LogLevel.INFO,
                timestamp: true,
                colors: true,
            });

            coloredLogger.log('colored message');
            expect(logSpy).toHaveBeenCalledWith(
                expect.stringContaining(
                    '[2026-01-01T00:00:00.000Z] [INFO] colored message',
                ),
            );
        });

        it('does not throw when console is unavailable', () => {
            vi.stubGlobal('console', undefined);
            try {
                const noConsole = new Logger({
                    level: LogLevel.DEBUG,
                    timestamp: false,
                    colors: false,
                });

                expect(() => noConsole.warn('unavailable')).not.toThrow();
            } finally {
                vi.unstubAllGlobals();
            }
        });

        it('falls back to console.log when the preferred method is missing', () => {
            const log = vi.fn();
            vi.stubGlobal('console', { log });
            try {
                const fallbackLogger = new Logger({
                    level: LogLevel.DEBUG,
                    timestamp: false,
                    colors: false,
                });

                fallbackLogger.warn('missing warn');
                expect(log).toHaveBeenCalledWith('[WARN] missing warn');
            } finally {
                vi.unstubAllGlobals();
            }
        });

        it('falls back to console.log when a console method throws', () => {
            const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {
                throw new Error('console.warn unavailable');
            });
            const logSpy = vi
                .spyOn(console, 'log')
                .mockImplementation(() => {});

            expect(() => testLogger.warn('recover')).not.toThrow();
            expect(warnSpy).toHaveBeenCalledOnce();
            expect(logSpy).toHaveBeenCalledWith('[WARN] recover');
        });

        it('swallows failures when both console methods throw', () => {
            vi.spyOn(console, 'warn').mockImplementation(() => {
                throw new Error('console.warn unavailable');
            });
            vi.spyOn(console, 'log').mockImplementation(() => {
                throw new Error('console.log unavailable');
            });

            expect(() => testLogger.warn('do not crash')).not.toThrow();
        });
    });
});
