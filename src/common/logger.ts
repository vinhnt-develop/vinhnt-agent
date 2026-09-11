import chalk from 'chalk';

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

const LEVELS: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

const COLORS: Record<LogLevel, typeof chalk.red> = {
  debug: chalk.gray,
  info: chalk.cyan,
  warn: chalk.yellow,
  error: chalk.red,
};

class Logger {
  private level: LogLevel = 'info';

  setLevel(level: LogLevel) {
    this.level = level;
  }

  private log(level: LogLevel, ...args: unknown[]) {
    if (LEVELS[level] < LEVELS[this.level]) return;
    const color = COLORS[level];
    const prefix = color(`[${level.toUpperCase()}]`);
    console.log(prefix, ...args);
  }

  debug(...args: unknown[]) {
    this.log('debug', ...args);
  }

  info(...args: unknown[]) {
    this.log('info', ...args);
  }

  warn(...args: unknown[]) {
    this.log('warn', ...args);
  }

  error(...args: unknown[]) {
    this.log('error', ...args);
  }
}

export const logger = new Logger();
