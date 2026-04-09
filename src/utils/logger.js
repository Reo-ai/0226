const COLORS = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
  gray: '\x1b[90m',
};

function timestamp() {
  return new Date().toISOString().replace('T', ' ').slice(0, 19);
}

function format(level, color, ...args) {
  const msg = args.map(a => (typeof a === 'object' ? JSON.stringify(a, null, 2) : a)).join(' ');
  return `${COLORS.gray}[${timestamp()}]${COLORS.reset} ${color}${level}${COLORS.reset} ${msg}`;
}

export const logger = {
  info:    (...args) => console.log(format('INFO ', COLORS.blue, ...args)),
  success: (...args) => console.log(format('OK   ', COLORS.green, ...args)),
  warn:    (...args) => console.warn(format('WARN ', COLORS.yellow, ...args)),
  error:   (...args) => console.error(format('ERROR', COLORS.red, ...args)),
  step:    (...args) => console.log(format('STEP ', COLORS.cyan, ...args)),
  debug:   (...args) => process.env.DEBUG && console.log(format('DEBUG', COLORS.gray, ...args)),
  section: (title) => {
    console.log();
    console.log(`${COLORS.bright}${COLORS.magenta}═══ ${title} ═══${COLORS.reset}`);
  },
};
