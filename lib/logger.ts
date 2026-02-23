// logger.ts
// Logger class for showall project

export class Logger {
  private colors = {
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
  private verbose: boolean = false;
  private logFile?: string;

  constructor(options?: { quiet?: boolean; verbose?: boolean; logFile?: string }) {
    this.quiet = options?.quiet ?? false;
    this.verbose = options?.verbose ?? false;
    this.logFile = options?.logFile;
  }

  setQuiet(quiet: boolean) {
    this.quiet = quiet;
  }

  setVerbose(verbose: boolean) {
    this.verbose = verbose;
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

  info(msg: string, ...args: any[]) {
    if (!this.quiet) {
      console.log(this.format('INFO', this.colors.BLUE, msg), ...args);
      this.writeToLog('INFO', msg);
    }
  }

  success(msg: string, ...args: any[]) {
    if (!this.quiet) {
      console.log(this.format('SUCCESS', this.colors.GREEN, msg), ...args);
      this.writeToLog('SUCCESS', msg);
    }
  }

  warning(msg: string, ...args: any[]) {
    if (!this.quiet) {
      console.log(this.format('WARNING', this.colors.YELLOW, msg), ...args);
      this.writeToLog('WARNING', msg);
    }
  }

  error(msg: string, ...args: any[]) {
    console.error(this.format('ERROR', this.colors.RED, msg), ...args);
    this.writeToLog('ERROR', msg);
  }

  debug(msg: string, ...args: any[]) {
    if (this.verbose) {
      console.log(this.format('DEBUG', this.colors.MAGENTA, msg), ...args);
      this.writeToLog('DEBUG', msg);
    }
  }

  header() {
    if (!this.quiet) {
      console.log(`${this.colors.CYAN}════════════════════════════════════════${this.colors.NC}`);
    }
  }

  headerWithTitle(title: string) {
    if (!this.quiet) {
      console.log(`${this.colors.CYAN}════════════════════════════════════════${this.colors.NC}`);
      console.log(`${this.colors.CYAN}${title}${this.colors.NC}`);
      console.log(`${this.colors.CYAN}════════════════════════════════════════${this.colors.NC}`);
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
      process.stdout.write(`\r${this.colors.GREEN}✓${this.colors.NC} ${message}... done.\n`);
      return result;
    } catch (error) {
      clearInterval(spinner);
      process.stdout.write(`\r${this.colors.RED}✗${this.colors.NC} ${message}... failed.\n`);
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

    console.log(separator);
    console.log('|' + keys.map(k =>
      ` ${k.padEnd(colWidths[k])} `
    ).join('|') + '|');
    console.log(separator);

    data.forEach(row => {
      console.log('|' + keys.map(k =>
        ` ${String(row[k] || '').padEnd(colWidths[k])} `
      ).join('|') + '|');
    });

    console.log(separator);
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

  newLine(count: number = 1) {
    if (this.quiet) return;
    console.log('\n'.repeat(count - 1));
  }

  divider(char: string = '─', length: number = 50) {
    if (this.quiet) return;
    console.log(char.repeat(length));
  }

  box(msg: string, title?: string) {
    if (this.quiet) return;

    const lines = msg.split('\n');
    const width = Math.max(...lines.map(l => l.length), title?.length || 0) + 4;

    console.log(`┌${'─'.repeat(width)}┐`);

    if (title) {
      console.log(`│ ${title.padEnd(width - 2)} │`);
      console.log(`├${'─'.repeat(width)}┤`);
    }

    lines.forEach(line => {
      console.log(`│ ${line.padEnd(width - 2)} │`);
    });

    console.log(`└${'─'.repeat(width)}┘`);
  }
}