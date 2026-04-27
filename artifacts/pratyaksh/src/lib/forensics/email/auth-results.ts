// Authentication-Results header parser. Produces a structured view of the
// SPF / DKIM / DMARC verdicts that downstream phishing scoring consumes.

export interface AuthVerdict {
  method: "spf" | "dkim" | "dmarc" | string;
  result: "pass" | "fail" | "softfail" | "neutral" | "none" | "permerror" | "temperror" | string;
  /** Free-form details (selector, domain, etc). */
  detail?: string;
}

export function parseAuthenticationResults(raw: string | undefined): AuthVerdict[] {
  if (!raw) return [];
  // Authentication-Results lists are semicolon-separated tokens after the
  // initial host identifier.
  const out: AuthVerdict[] = [];
  const parts = raw.split(/;\s*/);
  for (const part of parts) {
    const m = /^(spf|dkim|dmarc|arc)\s*=\s*([a-z]+)(.*)$/i.exec(part.trim());
    if (m) {
      out.push({
        method: m[1].toLowerCase(),
        result: m[2].toLowerCase(),
        detail: m[3].trim() || undefined,
      });
    }
  }
  return out;
}

export interface AuthSummary {
  spf: "pass" | "fail" | "softfail" | "missing" | "other";
  dkim: "pass" | "fail" | "softfail" | "missing" | "other";
  dmarc: "pass" | "fail" | "softfail" | "missing" | "other";
  raw: AuthVerdict[];
}

function pick(
  verdicts: AuthVerdict[],
  method: string,
): "pass" | "fail" | "softfail" | "missing" | "other" {
  const v = verdicts.find((x) => x.method === method);
  if (!v) return "missing";
  if (v.result === "pass") return "pass";
  if (v.result === "fail" || v.result === "permerror" || v.result === "temperror")
    return "fail";
  if (v.result === "softfail") return "softfail";
  return "other";
}

export function summarizeAuth(raw: string | undefined, dkimHeader?: string): AuthSummary {
  const verdicts = parseAuthenticationResults(raw);
  const summary: AuthSummary = {
    spf: pick(verdicts, "spf"),
    dkim: pick(verdicts, "dkim"),
    dmarc: pick(verdicts, "dmarc"),
    raw: verdicts,
  };
  // If no DKIM verdict but a DKIM-Signature header exists, mark as "other"
  if (summary.dkim === "missing" && dkimHeader) summary.dkim = "other";
  // Map "softfail" → "fail" only for the final SPF column when DKIM also missing/failing
  return summary;
}
