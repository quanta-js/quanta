import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
    Logger,
    LogLevel,
    createLogger,
    logger,
    isNodeEnvironment,
    isBrowserEnvironment,
} from '../services/logger-service';

describe('Logger', () => {
    let testLogger: Logger;

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
    });
});
