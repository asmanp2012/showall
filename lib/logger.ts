// logger.ts
// Logger class for showall project

export class Logger {
  colors = {
    ORANGE: '\x1b[38;5;208m',
    PURPLE: '\x1b[38;5;129m',
    TEAL: '\x1b[38;5;37m',
    LIME: '\x1b[38;5;154m',
    RED: '\x1b[31m',
    GREEN: '\x1b[32m',
    YELLOW: '\x1b[33m',
    BLUE: '\x1b[34m',
    CYAN: '\x1b[36m',
    MAGENTA: '\x1b[35m',
    NC: '\x1b[0m',
    BOLD: '\x1b[1m'
  };

  private quiet: boolean = false;
  private verbose_: boolean = false;
  private logFile?: string;

  set verbose(v: boolean) {
    this.verbose_ = v;
  }

  get verbose(): boolean
  {
    return this.verbose_;
  }

  constructor(options?: { quiet?: boolean; verbose?: boolean; logFile?: string }) {
    this.quiet = options?.quiet ?? false;
    this.verbose_ = options?.verbose ?? false;
    this.logFile = options?.logFile;
  }

  setQuiet(quiet: boolean) {
    this.quiet = quiet;
  }

  setLogFile(logFile: string) {
    this.logFile = logFile;
  }

  private async writeToLog(level: string, message: string) {
    if (this.logFile) {
      const logEntry = `[${new Date().toISOString()}] [${level}] ${message}\n`;
      try {
        await Bun.write(this.logFile, logEntry, { append: true });
      } catch (err) {
        // Silently fail if can't write to log
      }
    }
  }

  private format(level: string, color: string, msg: string): string {
    return `${color}[${level}]${this.colors.NC} ${msg}`;
  }

  log(msg: string = '', ...args: any[]) {
    if (!this.quiet) {
      console.log(msg, ...args);
      this.writeToLog('LOG', msg);
    }
  }

  newLine(count: number = 1) {
    if (this.quiet) return;
    for (let i = 0; i < count; i++) {
      this.log(`${this.colors.NC}`);
    }
  }

  info(msg: string, ...args: any[]) {
    if (!this.quiet) {
      this.log(this.format('INFO', this.colors.BLUE, msg), ...args);
      this.writeToLog('INFO', msg);
    }
  }

  vinfo(msg: string, ...args: any[]) {
    if (this.verbose_) {
      this.log(this.format('INFO', this.colors.BLUE, msg), ...args);
      this.writeToLog('INFO', msg);
    }
  }

  success(msg: string, ...args: any[]) {
    if (!this.quiet) {
      this.log(this.format('SUCCESS', this.colors.GREEN, msg), ...args);
      this.writeToLog('SUCCESS', msg);
    }
  }

  warning(msg: string, ...args: any[]) {
    if (!this.quiet) {
      this.log(this.format('WARNING', this.colors.YELLOW, msg), ...args);
      this.writeToLog('WARNING', msg);
    }
  }

  error(msg: string, ...args: any[]) {
    console.error(this.format('ERROR', this.colors.RED, msg), ...args);
    this.writeToLog('ERROR', msg);
  }

  debug(msg: string, ...args: any[]) {
    if (this.verbose_) {
      this.log(this.format('DEBUG', this.colors.MAGENTA, msg), ...args);
      this.writeToLog('DEBUG', msg);
    }
  }

  header() {
    if (!this.quiet) {
      this.log(`${this.colors.CYAN}════════════════════════════════════════${this.colors.NC}`);
    }
  }

  headerWithTitle(title: string) {
    if (!this.quiet) {
      this.log(`${this.colors.CYAN}════════════════════════════════════════${this.colors.NC}`);
      this.log(`${this.colors.CYAN}${title}${this.colors.NC}`);
      this.log(`${this.colors.CYAN}════════════════════════════════════════${this.colors.NC}`);
    }
  }

  bold(text: string): string {
    return `${this.colors.BOLD}${text}${this.colors.NC}`;
  }

  color(text: string, color: keyof typeof this.colors): string {
    return `${this.colors[color]}${text}${this.colors.NC}`;
  }

  progress(current: number, total: number, prefix: string = 'Progress') {
    if (this.quiet) return;

    const percent = Math.round((current / total) * 100);
    const barLength = 30;
    const filledLength = Math.round((barLength * current) / total);
    const emptyLength = barLength - filledLength;

    const filled = '█'.repeat(filledLength);
    const empty = '░'.repeat(emptyLength);

    process.stdout.write(
      `\r${prefix}: [${filled}${empty}] ${percent}% (${current}/${total})`
    );

    if (current === total) {
      process.stdout.write('\n');
    }
  }

  async withSpinner<T>(message: string, fn: () => Promise<T>): Promise<T> {
    if (this.quiet) {
      return await fn();
    }

    const frames = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'];
    let i = 0;

    const spinner = setInterval(() => {
      process.stdout.write(`\r${this.colors.CYAN}${frames[i]}${this.colors.NC} ${message}...`);
      i = (i + 1) % frames.length;
    }, 80);

    try {
      const result = await fn();
      clearInterval(spinner);
      process.stdout.write(`\r${this.colors.GREEN}✓${this.colors.NC} ${message}... ${this.colors.GREEN}done.\n`);
      return result;
    } catch (error) {
      clearInterval(spinner);
      process.stdout.write(`\r${this.colors.RED}✗${this.colors.NC} ${message}... ${this.colors.RED}failed.\n`);
      throw error;
    }
  }

  table(data: Record<string, any>[], columns?: string[]) {
    if (this.quiet || data.length === 0) return;

    const colWidths: Record<string, number> = {};
    const keys = columns || Object.keys(data[0]);

    keys.forEach(key => {
      colWidths[key] = Math.max(
        key.length,
        ...data.map(row => String(row[key] || '').length)
      );
    });

    const separator = '+' + keys.map(k => '─'.repeat(colWidths[k] + 2)).join('+') + '+';

    this.log(separator);
    this.log('|' + keys.map(k =>
      ` ${k.padEnd(colWidths[k])} `
    ).join('|') + '|');
    this.log(separator);

    data.forEach(row => {
      this.log('|' + keys.map(k =>
        ` ${String(row[k] || '').padEnd(colWidths[k])} `
      ).join('|') + '|');
    });

    this.log(separator);
  }

  group(label: string, collapsed: boolean = false) {
    if (this.quiet) return;

    if (collapsed) {
      console.groupCollapsed(label);
    } else {
      console.group(label);
    }
  }

  groupEnd() {
    if (this.quiet) return;
    console.groupEnd();
  }

  clear() {
    if (this.quiet) return;
    console.clear();
  }

  time(label: string) {
    if (this.quiet) return;
    console.time(label);
  }

  timeEnd(label: string) {
    if (this.quiet) return;
    console.timeEnd(label);
  }

  divider(char: string = '─', length: number = 50) {
    if (this.quiet) return;
    this.log(char.repeat(length));
  }

  box(msg: string, title?: string) {
    if (this.quiet) return;

    const lines = msg.split('\n');
    const width = Math.max(...lines.map(l => l.length), title?.length || 0) + 4;

    this.log(`┌${'─'.repeat(width)}┐`);

    if (title) {
      this.log(`│ ${title.padEnd(width - 2)} │`);
      this.log(`├${'─'.repeat(width)}┤`);
    }

    lines.forEach(line => {
      this.log(`│ ${line.padEnd(width - 2)} │`);
    });

    this.log(`└${'─'.repeat(width)}┘`);
  }
}