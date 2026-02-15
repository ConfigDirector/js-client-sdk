import { ConfigDirectorLogger, ConfigDirectorLogMessageDecorator, ConfigDirectorLoggingLevel } from "./types";

const LEVELS: Record<ConfigDirectorLoggingLevel, number> = {
  off: -1,
  error: 0,
  warn: 1,
  info: 2,
  debug: 3,
};

const buildDateFormatter = () => {
  const baseOptions: Intl.DateTimeFormatOptions = {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    timeZoneName: "short",
  };

  try {
    return new Intl.DateTimeFormat(
      undefined,
      { ...baseOptions, fractionalSecondDigits: 3 } as Intl.DateTimeFormatOptions,
    );
  } catch {
    return new Intl.DateTimeFormat(undefined, baseOptions);
  }
};

export class DefaultConsoleLogger implements ConfigDirectorLogger {
  private readonly dateFormatter;

  constructor(private readonly level: ConfigDirectorLoggingLevel, private readonly decorator: ConfigDirectorLogMessageDecorator) {
    this.level = level;
    this.decorator = decorator;
    this.dateFormatter = buildDateFormatter();
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

  private log(loggerFunction: (...args: any) => void, level: ConfigDirectorLoggingLevel, message: string, ...args: any) {
    if (LEVELS[this.level] >= LEVELS[level]) {
      loggerFunction(`[${this.dateFormatter.format(new Date())}] ${this.decorator?.decorateMessage(message)}`, ...args);
    }
  }
}

class LogMessageDecorator implements ConfigDirectorLogMessageDecorator {
  decorateMessage(message: string): string {
    return `[ConfigDirector:js-client-sdk] ${message}`;
  }
}

export const createDefaultLogger = (
  level?: ConfigDirectorLoggingLevel,
  messageDecorator?: ConfigDirectorLogMessageDecorator,
) => {
  return new DefaultConsoleLogger(level ?? "warn", messageDecorator ?? new LogMessageDecorator());
};
