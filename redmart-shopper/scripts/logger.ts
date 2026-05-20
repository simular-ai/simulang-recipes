let _verbose = false

export function initLogger(verbose: boolean): void {
  _verbose = verbose
}

const C = {
  reset:  '\x1b[0m',
  dim:    '\x1b[2m',
  bold:   '\x1b[1m',
  green:  '\x1b[32m',
  yellow: '\x1b[33m',
  red:    '\x1b[31m',
}

export const log = {
  info:  (msg: string) => console.log(msg),
  ok:    (msg: string) => console.log(`${C.green}${msg}${C.reset}`),
  warn:  (msg: string) => console.log(`${C.yellow}${msg}${C.reset}`),
  error: (msg: string) => console.error(`${C.red}${msg}${C.reset}`),
  // only printed with --verbose
  debug: (msg: string) => { if (_verbose) console.log(`${C.dim}  ${msg}${C.reset}`) },
  rule:  () => console.log(`${C.dim}${'─'.repeat(36)}${C.reset}`),
}
