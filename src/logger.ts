import { ConfigDirectorLogger, ConfigDirectorLogMessageDecorator, ConfigDirectorLoggingLevel } from "./types";

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

class LogMessageDecorator implements ConfigDirectorLogMessageDecorator {
  decorateMessage(message: string): string {
    return `[ConfigDirector:js-client-sdk] ${message}`;
  }
}

export class ConfigDirectorLoggerDecorator implements ConfigDirectorLogger {
  constructor(
    private readonly logger: ConfigDirectorLogger,
    private readonly decorator: ConfigDirectorLogMessageDecorator,
  ) {
    this.logger = logger;
    this.decorator = decorator;
  }

  debug(message: string, ...args: any): void {
    this.logger.debug(this.decorator.decorateMessage(message), ...args);
  }

  info(message: string, ...args: any): void {
    this.logger.info(this.decorator.decorateMessage(message), ...args);
  }

  warn(message: string, ...args: any): void {
    this.logger.warn(this.decorator.decorateMessage(message), ...args);
  }

  error(message: string, ...args: any): void {
    this.logger.error(this.decorator.decorateMessage(message), ...args);
  }
}

export const createDefaultLogger = (
  level?: ConfigDirectorLoggingLevel,
  messageDecorator?: ConfigDirectorLogMessageDecorator,
) => {
  return new ConfigDirectorLoggerDecorator(
    new DefaultConsoleLogger(level),
    messageDecorator ?? new LogMessageDecorator(),
  );
};
