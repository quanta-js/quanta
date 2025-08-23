/**
 * logger utility that works across all JavaScript environments
 */

export enum LogLevel {
    DEBUG = 0,
    INFO = 1,
    WARN = 2,
    ERROR = 3,
    SILENT = 4,
}

export interface LoggerConfig {
    level: LogLevel;
    prefix?: string;
    timestamp?: boolean;
    colors?: boolean;
    formatters?: {
        [key: string]: (message: string, ...args: any[]) => string;
    };
}

class Logger {
    private config: LoggerConfig;
    private isNode: boolean;
    private hasConsole: boolean;

    constructor(config: Partial<LoggerConfig> = {}) {
        this.config = {
            level: LogLevel.INFO,
            prefix: '',
            timestamp: true,
            colors: true,
            ...config,
        };

        // Detect environment
        this.isNode = this.detectNodeEnvironment();
        this.hasConsole = this.detectConsole();
    }

    /**
     * Detect if running in Node.js environment
     */
    private detectNodeEnvironment(): boolean {
        return (
            typeof process !== 'undefined' &&
            !!process.versions &&
            !!process.versions.node
        );
    }

    /**
     * Detect if console is available
     */
    private detectConsole(): boolean {
        return (
            typeof console !== 'undefined' && typeof console.log === 'function'
        );
    }

    /**
     * Get timestamp string
     */
    private getTimestamp(): string {
        if (!this.config.timestamp) return '';

        try {
            const now = new Date();
            return `[${now.toISOString()}] `;
        } catch {
            return '';
        }
    }

    /**
     * Get color codes for different log levels (Node.js only)
     */
    private getColorCode(level: LogLevel): string {
        if (!this.config.colors || !this.isNode) return '';

        const colors: {
            [K in
                | LogLevel.DEBUG
                | LogLevel.INFO
                | LogLevel.WARN
                | LogLevel.ERROR]: string;
        } = {
            [LogLevel.DEBUG]: '\x1b[36m', // Cyan
            [LogLevel.INFO]: '\x1b[32m', // Green
            [LogLevel.WARN]: '\x1b[33m', // Yellow
            [LogLevel.ERROR]: '\x1b[31m', // Red
        };

        return (
            colors[
                level as
                    | LogLevel.DEBUG
                    | LogLevel.INFO
                    | LogLevel.WARN
                    | LogLevel.ERROR
            ] || ''
        );
    }

    /**
     * Reset color code (Node.js only)
     */
    private getResetCode(): string {
        return this.config.colors && this.isNode ? '\x1b[0m' : '';
    }

    /**
     * Get level name
     */
    private getLevelName(level: LogLevel): string {
        const names: Record<
            LogLevel.DEBUG | LogLevel.INFO | LogLevel.WARN | LogLevel.ERROR,
            string
        > = {
            [LogLevel.DEBUG]: 'DEBUG',
            [LogLevel.INFO]: 'INFO',
            [LogLevel.WARN]: 'WARN',
            [LogLevel.ERROR]: 'ERROR',
        };
        if (level in names) {
            return names[
                level as
                    | LogLevel.DEBUG
                    | LogLevel.INFO
                    | LogLevel.WARN
                    | LogLevel.ERROR
            ];
        }
        return 'LOG';
    }

    /**
     * Format message with prefix, timestamp, and colors
     */
    private formatMessage(level: LogLevel, message: string): string {
        const timestamp = this.getTimestamp();
        const prefix = this.config.prefix ? `[${this.config.prefix}] ` : '';
        const levelName = `[${this.getLevelName(level)}]`;
        const colorCode = this.getColorCode(level);
        const resetCode = this.getResetCode();

        return `${colorCode}${timestamp}${prefix}${levelName} ${message}${resetCode}`;
    }

    /**
     * Safe console method execution
     */
    private safeConsoleCall(
        method: 'log' | 'warn' | 'error' | 'debug',
        message: string,
        ...args: any[]
    ): void {
        if (!this.hasConsole) return;

        try {
            // Use specific console method if available, fallback to console.log
            const consoleMethod = console[method] || console.log;
            if (typeof consoleMethod === 'function') {
                consoleMethod(message, ...args);
            }
        } catch {
            // Silently fail or try fallback
            try {
                if (console.log && typeof console.log === 'function') {
                    console.log(message, ...args);
                }
            } catch {
                // Ultimate fallback - do nothing
            }
        }
    }

    /**
     * Check if logging is enabled for the given level
     */
    private shouldLog(level: LogLevel): boolean {
        return level >= this.config.level;
    }

    /**
     * Debug level logging
     */
    debug(message: string, ...args: any[]): void {
        if (!this.shouldLog(LogLevel.DEBUG)) return;

        const formattedMessage = this.formatMessage(LogLevel.DEBUG, message);
        this.safeConsoleCall('debug', formattedMessage, ...args);
    }

    /**
     * Info level logging (alias for log)
     */
    info(message: string, ...args: any[]): void {
        this.log(message, ...args);
    }

    /**
     * Standard logging
     */
    log(message: string, ...args: any[]): void {
        if (!this.shouldLog(LogLevel.INFO)) return;

        const formattedMessage = this.formatMessage(LogLevel.INFO, message);
        this.safeConsoleCall('log', formattedMessage, ...args);
    }

    /**
     * Warning level logging
     */
    warn(message: string, ...args: any[]): void {
        if (!this.shouldLog(LogLevel.WARN)) return;

        const formattedMessage = this.formatMessage(LogLevel.WARN, message);
        this.safeConsoleCall('warn', formattedMessage, ...args);
    }

    /**
     * Error level logging
     */
    error(message: string, ...args: any[]): void {
        if (!this.shouldLog(LogLevel.ERROR)) return;

        const formattedMessage = this.formatMessage(LogLevel.ERROR, message);
        this.safeConsoleCall('error', formattedMessage, ...args);
    }

    /**
     * Update logger configuration
     */
    configure(config: Partial<LoggerConfig>): void {
        this.config = { ...this.config, ...config };
    }

    /**
     * Set log level
     */
    setLevel(level: LogLevel): void {
        this.config.level = level;
    }

    /**
     * Get current log level
     */
    getLevel(): LogLevel {
        return this.config.level;
    }

    /**
     * Create a child logger with a prefix
     */
    child(prefix: string): Logger {
        const childPrefix = this.config.prefix
            ? `${this.config.prefix}:${prefix}`
            : prefix;

        return new Logger({
            ...this.config,
            prefix: childPrefix,
        });
    }
}

// Create default logger instance
export const logger = new Logger();

// Export the Logger class for custom instances
export { Logger };

// Convenience function to create a logger with specific config
export const createLogger = (config?: Partial<LoggerConfig>): Logger => {
    return new Logger(config);
};

// Environment detection utilities (exported for advanced usage)
export const isNodeEnvironment = (): boolean => {
    return (
        typeof process !== 'undefined' &&
        !!process.versions &&
        !!process.versions.node
    );
};

export const isBrowserEnvironment = (): boolean => {
    return typeof window !== 'undefined' && typeof document !== 'undefined';
};

export const isWebWorkerEnvironment = (): boolean => {
    return (
        typeof self !== 'undefined' &&
        typeof window === 'undefined' &&
        typeof document === 'undefined'
    );
};
