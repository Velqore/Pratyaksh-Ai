// RFC 3164 / RFC 5424 syslog parser + Linux auth.log + Apache/nginx access
// log parsers. All implemented as line iterators so the same chunked read
// loop works regardless of input size.

export interface SyslogEntry {
  raw: string;
  timestamp?: string;
  host?: string;
  process?: string;
  pid?: number;
  message: string;
}

const SYSLOG_RE =
  /^(?:<\d+>)?([A-Z][a-z]{2}\s+\d{1,2}\s\d{2}:\d{2}:\d{2})\s+(\S+)\s+([^\s\[]+)(?:\[(\d+)\])?:\s*(.*)$/;
const RFC5424_RE =
  /^<\d+>\d\s+(\S+)\s+(\S+)\s+(\S+)\s+(\S+)\s+\S+\s+\S+\s*(.*)$/;

export function parseSyslogLine(line: string): SyslogEntry | null {
  if (!line.trim()) return null;
  let m = RFC5424_RE.exec(line);
  if (m) {
    return {
      raw: line,
      timestamp: m[1],
      host: m[2],
      process: m[3],
      pid: m[4] ? parseInt(m[4], 10) : undefined,
      message: m[5] ?? "",
    };
  }
  m = SYSLOG_RE.exec(line);
  if (m) {
    return {
      raw: line,
      timestamp: m[1],
      host: m[2],
      process: m[3],
      pid: m[4] ? parseInt(m[4], 10) : undefined,
      message: m[5],
    };
  }
  return { raw: line, message: line };
}

// auth.log specific patterns
const SSH_FAIL = /Failed password for (?:invalid user )?(\S+) from (\S+) port (\d+)/;
const SSH_OK = /Accepted password for (\S+) from (\S+) port (\d+)/;
const SSH_KEY = /Accepted publickey for (\S+) from (\S+) port (\d+)/;
const SUDO = /sudo:\s+(\S+)\s+:\s+TTY=\S+\s+;\s+PWD=(\S+)\s+;\s+USER=(\S+)\s+;\s+COMMAND=(.+)$/;

export interface AuthEvent {
  kind: "ssh_fail" | "ssh_ok" | "ssh_key" | "sudo" | "other";
  user?: string;
  ip?: string;
  port?: number;
  command?: string;
  raw: string;
  timestamp?: string;
}

export function parseAuthLine(line: string): AuthEvent | null {
  const sys = parseSyslogLine(line);
  if (!sys) return null;
  const msg = sys.message;
  let m = SSH_FAIL.exec(msg);
  if (m) return { kind: "ssh_fail", user: m[1], ip: m[2], port: parseInt(m[3], 10), raw: line, timestamp: sys.timestamp };
  m = SSH_OK.exec(msg);
  if (m) return { kind: "ssh_ok", user: m[1], ip: m[2], port: parseInt(m[3], 10), raw: line, timestamp: sys.timestamp };
  m = SSH_KEY.exec(msg);
  if (m) return { kind: "ssh_key", user: m[1], ip: m[2], port: parseInt(m[3], 10), raw: line, timestamp: sys.timestamp };
  m = SUDO.exec(msg);
  if (m) return { kind: "sudo", user: m[1], command: m[4], raw: line, timestamp: sys.timestamp };
  return null;
}

// Apache / nginx Combined Log Format
const ACCESS_RE =
  /^(\S+)\s+\S+\s+\S+\s+\[([^\]]+)\]\s+"(\S+)\s+(\S+)\s+(HTTP\/\d\.\d)"\s+(\d+)\s+(\d+|-)(?:\s+"([^"]*)"\s+"([^"]*)")?/;

export interface AccessEntry {
  ip: string;
  timestamp: string;
  method: string;
  path: string;
  status: number;
  bytes: number;
  referer?: string;
  userAgent?: string;
}

export function parseAccessLine(line: string): AccessEntry | null {
  const m = ACCESS_RE.exec(line);
  if (!m) return null;
  return {
    ip: m[1],
    timestamp: m[2],
    method: m[3],
    path: m[4],
    status: parseInt(m[6], 10),
    bytes: m[7] === "-" ? 0 : parseInt(m[7], 10),
    referer: m[8] && m[8] !== "-" ? m[8] : undefined,
    userAgent: m[9] && m[9] !== "-" ? m[9] : undefined,
  };
}
