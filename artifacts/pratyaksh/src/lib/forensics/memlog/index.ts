// Memory & log analysis orchestrator. Detects whether the upload looks like a
// memory dump, EVTX file, syslog/auth.log text, or web access log and runs
// the appropriate analyser.

import { readChunks } from "../common/byte-reader";
import type { CaseModeResult, ModeFinding, ModeProgress } from "../common/types";
import { sortFindings } from "../common/types";
import { extractMemoryStrings, type MemStrings } from "./mem-strings";
import { summarizeEvtx, type EvtxSummary } from "./evtx";
import {
  parseAuthLine,
  parseAccessLine,
  parseSyslogLine,
  type AuthEvent,
  type AccessEntry,
} from "./syslog";
import { detectBursts, parseSyslogTimestamp, type Burst } from "./bruteforce";

export type MemLogKind = "memory" | "evtx" | "auth" | "access" | "syslog" | "unknown";

export interface MemLogPayload {
  kind: MemLogKind;
  /** Filled when kind === "memory". */
  memory?: MemStrings;
  /** Filled when kind === "evtx". */
  evtx?: EvtxSummary;
  /** Filled when kind === "auth". */
  auth?: {
    events: AuthEvent[];
    failedByIp: Array<{ ip: string; count: number; users: string[] }>;
    successByIp: Array<{ ip: string; count: number; users: string[] }>;
    bursts: Burst[];
  };
  /** Filled when kind === "access". */
  access?: {
    rows: AccessEntry[];
    topIps: Array<{ ip: string; count: number }>;
    topPaths: Array<{ path: string; count: number }>;
    statusHistogram: Array<{ status: number; count: number }>;
    fourxxIps: Array<{ ip: string; count: number }>;
  };
  /** Filled when kind === "syslog". */
  syslog?: {
    rows: Array<{ host?: string; process?: string; message: string; raw: string; timestamp?: string }>;
    processes: Array<{ name: string; count: number }>;
  };
}

async function classifyFile(file: File): Promise<MemLogKind> {
  const head = new Uint8Array(await file.slice(0, 4096).arrayBuffer());
  // EVTX magic
  if (
    head[0] === 0x45 && head[1] === 0x6c && head[2] === 0x66 && head[3] === 0x46 &&
    head[4] === 0x69 && head[5] === 0x6c && head[6] === 0x65
  )
    return "evtx";
  // Decide text vs binary by scanning for printable ratio
  let printable = 0;
  for (let i = 0; i < head.length; i++) {
    const c = head[i];
    if (c === 0x09 || c === 0x0a || c === 0x0d || (c >= 0x20 && c < 0x7f)) printable++;
  }
  const printableRatio = printable / Math.max(1, head.length);
  if (printableRatio < 0.85) return "memory"; // looks binary-ish
  // Determine which text format
  const text = new TextDecoder().decode(head);
  if (/sshd\[\d+\]:|sudo:|pam_unix\(/.test(text)) return "auth";
  if (/^\d+\.\d+\.\d+\.\d+ - - \[/m.test(text)) return "access";
  if (/^[A-Z][a-z]{2}\s+\d{1,2}\s\d{2}:\d{2}:\d{2}\s/.test(text)) return "syslog";
  return "syslog"; // safe default for plain text
}

async function streamLines(
  file: File,
  cb: (line: string) => void,
  onProgress?: ModeProgress,
): Promise<void> {
  const decoder = new TextDecoder("utf-8", { fatal: false });
  let leftover = "";
  await readChunks(
    file,
    async (chunk) => {
      const text = leftover + decoder.decode(chunk, { stream: true });
      const lines = text.split(/\r?\n/);
      leftover = lines.pop() ?? "";
      for (const ln of lines) cb(ln);
    },
    {
      yieldEvery: 4,
      onProgress: (f) => onProgress?.("Reading log", f * 0.85),
    },
  );
  if (leftover) cb(leftover);
}

function topN<T extends string>(
  items: T[],
  n: number,
): Array<{ key: T; count: number }> {
  const m = new Map<T, number>();
  for (const x of items) m.set(x, (m.get(x) ?? 0) + 1);
  return Array.from(m.entries())
    .map(([key, count]) => ({ key, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, n);
}

export async function analyzeMemLog(
  file: File,
  onProgress?: ModeProgress,
): Promise<CaseModeResult<MemLogPayload>> {
  const t0 = performance.now();
  onProgress?.("Classifying input", 0.02);
  const kind = await classifyFile(file);
  onProgress?.(`Detected: ${kind}`, 0.06);

  const payload: MemLogPayload = { kind };
  const findings: ModeFinding[] = [];
  let headline = "";

  if (kind === "memory") {
    const mem = await extractMemoryStrings(file, onProgress);
    payload.memory = mem;
    findings.push({
      title: `${mem.totalAscii.toLocaleString()} ASCII + ${mem.totalUtf16.toLocaleString()} UTF-16 strings recovered`,
      severity: "info",
    });
    if (mem.iocSummary.length > 0) {
      findings.push({
        title: `IOCs surfaced from memory: ${mem.iocSummary.join(", ")}`,
        severity: "med",
      });
    }
    headline = `Memory image: ${(file.size / (1024 * 1024)).toFixed(1)} MiB, ${mem.iocSummary.length} IOC group(s)`;
  } else if (kind === "evtx") {
    const ev = await summarizeEvtx(file);
    payload.evtx = ev;
    findings.push({
      title: `EVTX: ${ev.chunks} chunk(s), ${ev.totalRecords} record(s)`,
      severity: "info",
    });
    const bad = ev.eventIdHistogram.find((e) => e.id === 4625);
    if (bad && bad.count >= 5)
      findings.push({
        title: `${bad.count} Windows logon failure events (EventID 4625)`,
        severity: bad.count >= 25 ? "high" : "med",
      });
    headline = `EVTX: ${ev.totalRecords} record(s), ${ev.eventIdHistogram.length} distinct event IDs`;
  } else if (kind === "auth") {
    const events: AuthEvent[] = [];
    const otherSyslog: number = 0;
    let lineNo = 0;
    await streamLines(
      file,
      (line) => {
        lineNo++;
        const e = parseAuthLine(line);
        if (e) events.push(e);
      },
      onProgress,
    );
    void otherSyslog;
    void lineNo;
    const failed = events.filter((e) => e.kind === "ssh_fail");
    const success = events.filter((e) => e.kind === "ssh_ok" || e.kind === "ssh_key");
    const groupBy = (arr: AuthEvent[]) => {
      const m = new Map<string, { ip: string; count: number; users: Set<string> }>();
      for (const e of arr) {
        if (!e.ip) continue;
        const r = m.get(e.ip) ?? { ip: e.ip, count: 0, users: new Set() };
        r.count++;
        if (e.user) r.users.add(e.user);
        m.set(e.ip, r);
      }
      return Array.from(m.values())
        .map((r) => ({ ip: r.ip, count: r.count, users: Array.from(r.users) }))
        .sort((a, b) => b.count - a.count);
    };
    const failedByIp = groupBy(failed);
    const successByIp = groupBy(success);
    const burstEvents = failed.map((e) => ({
      ip: e.ip!,
      user: e.user,
      epoch: parseSyslogTimestamp(e.timestamp),
    }));
    const bursts = detectBursts(burstEvents.filter((b) => b.epoch > 0), 5, 60);
    payload.auth = { events, failedByIp, successByIp, bursts };

    findings.push({
      title: `${failed.length} failed and ${success.length} successful SSH attempts`,
      severity: "info",
    });
    for (const b of bursts.slice(0, 5)) {
      findings.push({
        title: `Brute-force burst from ${b.ip}: ${b.count} failures in ${b.windowSeconds}s`,
        severity: b.count >= 25 ? "high" : "med",
        detail: b.users.length > 0 ? `Targets: ${b.users.slice(0, 8).join(", ")}` : undefined,
      });
    }
    // Look for failed-then-success from the same IP — possible breach
    for (const s of successByIp.slice(0, 20)) {
      const fIdx = failedByIp.find((f) => f.ip === s.ip);
      if (fIdx && fIdx.count >= 5) {
        findings.push({
          title: `${s.ip} succeeded after ${fIdx.count} failures — possible compromise`,
          severity: "high",
        });
      }
    }
    headline = `auth.log: ${failed.length} failures, ${success.length} successes, ${bursts.length} burst(s)`;
  } else if (kind === "access") {
    const rows: AccessEntry[] = [];
    await streamLines(
      file,
      (line) => {
        const r = parseAccessLine(line);
        if (r) rows.push(r);
      },
      onProgress,
    );
    const topIps = topN(rows.map((r) => r.ip), 25).map(({ key, count }) => ({ ip: key, count }));
    const topPaths = topN(rows.map((r) => r.path), 25).map(({ key, count }) => ({ path: key, count }));
    const statusHistogram = topN(
      rows.map((r) => String(r.status)),
      25,
    ).map(({ key, count }) => ({ status: parseInt(key, 10), count }));
    const fourxxIps = topN(
      rows.filter((r) => r.status >= 400 && r.status < 500).map((r) => r.ip),
      25,
    ).map(({ key, count }) => ({ ip: key, count }));
    payload.access = { rows: rows.slice(0, 5000), topIps, topPaths, statusHistogram, fourxxIps };

    findings.push({
      title: `${rows.length.toLocaleString()} HTTP requests from ${topIps.length} distinct client IP(s)`,
      severity: "info",
    });
    for (const ip of fourxxIps.slice(0, 5)) {
      if (ip.count >= 50) {
        findings.push({
          title: `${ip.ip} generated ${ip.count} 4xx responses — possible scanner / probe`,
          severity: "med",
        });
      }
    }
    headline = `Access log: ${rows.length} requests, ${topIps.length} IP(s)`;
  } else if (kind === "syslog") {
    const rows: NonNullable<MemLogPayload["syslog"]>["rows"] = [];
    await streamLines(
      file,
      (line) => {
        const e = parseSyslogLine(line);
        if (e) rows.push({ host: e.host, process: e.process, message: e.message, raw: line, timestamp: e.timestamp });
      },
      onProgress,
    );
    const processes = topN(
      rows.map((r) => r.process ?? "(unknown)"),
      25,
    ).map(({ key, count }) => ({ name: key, count }));
    payload.syslog = { rows: rows.slice(0, 5000), processes };
    findings.push({
      title: `Syslog: ${rows.length.toLocaleString()} lines parsed across ${processes.length} processes`,
      severity: "info",
    });
    headline = `Syslog: ${rows.length} lines, ${processes.length} processes`;
  }

  const t1 = performance.now();
  onProgress?.("Done", 1);
  return {
    mode: "memlog",
    modeLabel: "Memory & Logs",
    durationMs: Math.round(t1 - t0),
    headline,
    findings: sortFindings(findings),
    payload,
    methodology: [
      "Classify the upload from the first 4 KiB: EVTX magic, printable-byte ratio, and signature lines disambiguate memory dumps, Windows event logs, syslog, auth.log and HTTP access logs.",
      "Memory dumps: stream-extract printable ASCII + UTF-16 strings and run an IOC regex pass (URLs, IPs, domains, emails, registry keys, MITRE ATT&CK IDs).",
      "EVTX: count chunks (ElfChnk) and records (0x2A2A0000); pull EventIDs from binary-XML literal tokens.",
      "auth.log: regex-parse SSH success/failure + sudo events; bucket per IP; detect ≥5 failures inside any 60-second window.",
      "Access logs: parse Combined Log Format; surface top IPs / paths / status codes; flag IPs with ≥50 4xx responses as scanners.",
      "Syslog: surface a per-process histogram for triage.",
    ],
  };
}
