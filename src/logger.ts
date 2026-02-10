import { ConfigDirectorLogger, ConfigDirectorLoggingLevel } from "./types";

const LEVELS: Record<ConfigDirectorLoggingLevel, number> = {
  off: -1,
  error: 0,
  warn: 1,
  info: 2,
  debug: 3,
};

export class DefaultConsoleLogger implements ConfigDirectorLogger {
  private level: ConfigDirectorLoggingLevel;

  constructor(level?: ConfigDirectorLoggingLevel) {
    this.level = level ?? "warn";
  }

  debug(message: string, ...args: any): void {
    this.log(console.debug, "debug", message, ...args);
  }

  info(message: string, ...args: any): void {
    this.log(console.info, "info", message, ...args);
  }

  warn(message: string, ...args: any): void {
    this.log(console.warn, "warn", message, ...args);
  }

  error(message: string, ...args: any): void {
    this.log(console.error, "error", message, ...args);
  }

  private log(loggerFunction: (...args: any) => void, level: ConfigDirectorLoggingLevel, ...args: any) {
    if (LEVELS[this.level] >= LEVELS[level]) {
      loggerFunction(...args);
    }
  }
}

export class ConfigDirectorLoggerDecorator implements ConfigDirectorLogger {
  constructor(private readonly logger: ConfigDirectorLogger) {
    this.logger = logger;
  }

  debug(message: string, ...args: any): void {
    this.logger.debug(this.decorateMessage(message), ...args);
  }

  info(message: string, ...args: any): void {
    this.logger.info(this.decorateMessage(message), ...args);
  }

  warn(message: string, ...args: any): void {
    this.logger.warn(this.decorateMessage(message), ...args);
  }

  error(message: string, ...args: any): void {
    this.logger.error(this.decorateMessage(message), ...args);
  }

  private decorateMessage(message: string): string {
    return `[ConfigDirector:js-client-sdk] ${message}`;
  }
}

export const createDefaultLogger = (level?: ConfigDirectorLoggingLevel) => {
  return new ConfigDirectorLoggerDecorator(new DefaultConsoleLogger(level));
};
