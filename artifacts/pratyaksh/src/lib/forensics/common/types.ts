// Shared types for the multi-mode Cyber Lab. Each mode produces a
// `CaseModeResult` payload that drives both the on-screen UI and the per-mode
// PDF section. Keeping the shape stable means the PDF generator can render
// a clean section per mode without knowing internal details.

export type CyberMode =
  | "static"
  | "disk"
  | "malware"
  | "pcap"
  | "memlog"
  | "email"
  | "sqlite";

export interface ModeProgress {
  (label: string, frac: number): void;
}

export interface ModeFinding {
  /** Short headline e.g. "Brute-force burst from 10.0.0.42". */
  title: string;
  /** Free-text detail; one or two sentences. */
  detail?: string;
  /**
   * Severity classification used for sorting + PDF colour coding.
   * `info` is purely informational; `low/med/high/crit` denote risk.
   */
  severity: "info" | "low" | "med" | "high" | "crit";
  /** Optional source location, e.g. file path inside an image, byte offset, etc. */
  where?: string;
}

export interface CaseModeResult<TPayload = unknown> {
  mode: CyberMode;
  /** Display label for the mode, used in section headers. */
  modeLabel: string;
  /** Wall-clock duration in milliseconds. */
  durationMs: number;
  /** Top-line headline used by the assistant + report cover. */
  headline: string;
  /** Sorted list of findings; `crit` first, `info` last. */
  findings: ModeFinding[];
  /** Mode-specific payload; the per-mode UI + PDF renderer interprets it. */
  payload: TPayload;
  /** Free-form bullet list of how this analysis was performed. */
  methodology: string[];
}

/** Convenience helper used by every engine. */
export function severityRank(s: ModeFinding["severity"]): number {
  switch (s) {
    case "crit":
      return 0;
    case "high":
      return 1;
    case "med":
      return 2;
    case "low":
      return 3;
    default:
      return 4;
  }
}

export function sortFindings(f: ModeFinding[]): ModeFinding[] {
  return [...f].sort((a, b) => severityRank(a.severity) - severityRank(b.severity));
}
