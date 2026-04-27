// Email forensics orchestrator. Drives parse → auth-results → spoof checks
// → phishing score → CaseModeResult.

import type { CaseModeResult, ModeFinding, ModeProgress } from "../common/types";
import { sortFindings } from "../common/types";
import { parseEml, type EmlParsed } from "./eml-parse";
import { summarizeAuth, type AuthSummary } from "./auth-results";
import { checkSpoof, type SpoofFinding } from "./spoof-checks";
import { extractIOCs } from "../iocs";

export interface EmailPayload {
  parsed: EmlParsed;
  auth: AuthSummary;
  spoofFindings: SpoofFinding[];
  phishingScore: number;
  verdict: "benign" | "suspicious" | "phishing" | "highly_phishing";
  scoreBreakdown: Array<{ label: string; weight: number }>;
  iocs: ReturnType<typeof extractIOCs>;
  domains: string[];
  ips: string[];
}

const URGENCY_RE = /\b(verify|reset|expir|suspend|locked|invoice|urgent|immediately|action required|password)\b/i;
const SHORTENERS = [
  "bit.ly",
  "tinyurl.com",
  "t.co",
  "goo.gl",
  "ow.ly",
  "is.gd",
  "buff.ly",
  "cutt.ly",
  "rebrand.ly",
];

function urlsHostMatch(urls: string[], allow: Set<string>): { good: number; bad: number; badList: string[] } {
  let good = 0;
  let bad = 0;
  const badList: string[] = [];
  for (const u of urls) {
    try {
      const host = new URL(u).hostname.toLowerCase();
      if (Array.from(allow).some((a) => host === a || host.endsWith(`.${a}`))) {
        good++;
      } else {
        bad++;
        badList.push(host);
      }
    } catch {
      // ignore
    }
  }
  return { good, bad, badList };
}

export async function analyzeEmail(
  file: File,
  onProgress?: ModeProgress,
): Promise<CaseModeResult<EmailPayload>> {
  const t0 = performance.now();
  onProgress?.("Parsing MIME", 0.1);
  const parsed = await parseEml(file);
  onProgress?.("Reading auth headers", 0.4);
  const auth = summarizeAuth(parsed.authenticationResults, parsed.dkim);
  const spoofFindings = checkSpoof(parsed.from, parsed.replyTo);

  const fromDomain = parsed.from?.address?.split("@")[1]?.toLowerCase();
  const allow = new Set<string>();
  if (fromDomain) allow.add(fromDomain);
  const hostMatch = urlsHostMatch(parsed.urls, allow);

  // Phishing scoring
  const breakdown: Array<{ label: string; weight: number }> = [];
  let score = 0;
  const add = (label: string, w: number) => {
    score += w;
    breakdown.push({ label, weight: w });
  };
  if (auth.spf === "fail" || auth.spf === "softfail") add("SPF fail/softfail", 20);
  if (auth.dkim === "fail" || auth.dkim === "missing") add("DKIM fail/missing", 15);
  if (auth.dmarc === "fail") add("DMARC fail", 25);
  for (const f of spoofFindings) {
    if (f.kind === "display_name_spoof") add("Display-name spoof", 25);
    else if (f.kind === "reply_to_mismatch") add("Reply-To domain mismatch", 15);
    else if (f.kind === "lookalike_brand") add(`Look-alike brand: ${f.similar}`, 30);
    else if (f.kind === "punycode_domain") add("Punycode (xn--) domain", 20);
    else if (f.kind === "subdomain_brand") add("Brand label in foreign zone", 15);
  }
  if (URGENCY_RE.test((parsed.subject ?? "") + " " + (parsed.textBody ?? "")))
    add("Urgency keyword in subject/body", 10);
  if (hostMatch.bad > 0) {
    const shortenerHit = hostMatch.badList.find((h) => SHORTENERS.includes(h));
    if (shortenerHit) add(`URL shortener (${shortenerHit})`, 15);
    if (hostMatch.bad >= 5) add(`${hostMatch.bad} off-domain URLs`, 10);
  }
  if (parsed.attachments.some((a) => /\.(exe|js|vbs|scr|hta|iso|jar)$/i.test(a.filename)))
    add("Executable attachment", 30);
  if (parsed.attachments.some((a) => /\.(docm|xlsm|pptm)$/i.test(a.filename)))
    add("Macro-enabled Office attachment", 20);

  score = Math.min(100, score);
  let verdict: EmailPayload["verdict"];
  if (score >= 75) verdict = "highly_phishing";
  else if (score >= 45) verdict = "phishing";
  else if (score >= 20) verdict = "suspicious";
  else verdict = "benign";

  const allText =
    (parsed.subject ?? "") +
    "\n" +
    (parsed.textBody ?? "") +
    "\n" +
    parsed.urls.join("\n") +
    "\n" +
    parsed.receivedChain.map((h) => h.raw).join("\n");
  const iocs = extractIOCs(allText);

  const findings: ModeFinding[] = [];
  if (auth.spf !== "pass")
    findings.push({
      title: `SPF: ${auth.spf}`,
      severity: auth.spf === "fail" ? "high" : auth.spf === "softfail" ? "med" : "low",
    });
  if (auth.dkim !== "pass")
    findings.push({
      title: `DKIM: ${auth.dkim}`,
      severity: auth.dkim === "fail" ? "high" : "med",
    });
  if (auth.dmarc !== "pass")
    findings.push({
      title: `DMARC: ${auth.dmarc}`,
      severity: auth.dmarc === "fail" ? "high" : "med",
    });
  for (const f of spoofFindings) {
    findings.push({
      title: f.detail,
      severity: f.kind === "lookalike_brand" || f.kind === "display_name_spoof" ? "high" : "med",
    });
  }
  if (hostMatch.bad > 0) {
    findings.push({
      title: `${hostMatch.bad} URL(s) point off-domain`,
      severity: "med",
      detail: hostMatch.badList.slice(0, 5).join(", "),
    });
  }
  if (parsed.attachments.length > 0) {
    findings.push({
      title: `${parsed.attachments.length} attachment(s)`,
      severity: parsed.attachments.some((a) =>
        /\.(exe|js|vbs|scr|hta|iso|jar|docm|xlsm|pptm)$/i.test(a.filename),
      )
        ? "high"
        : "info",
      detail: parsed.attachments.map((a) => `${a.filename} (${a.mimeType})`).join(", "),
    });
  }

  const t1 = performance.now();
  onProgress?.("Done", 1);
  return {
    mode: "email",
    modeLabel: "Email Forensics",
    durationMs: Math.round(t1 - t0),
    headline: `${verdict} — score ${score}/100, ${parsed.receivedChain.length} hop(s)`,
    findings: sortFindings(findings),
    payload: {
      parsed,
      auth,
      spoofFindings,
      phishingScore: score,
      verdict,
      scoreBreakdown: breakdown,
      iocs,
      domains: iocs.domains,
      ips: [...iocs.ipv4, ...iocs.ipv6],
    },
    methodology: [
      "Parse MIME via postal-mime; preserve raw header values for Received chain reconstruction.",
      "Extract SPF, DKIM, DMARC, ARC verdicts from Authentication-Results.",
      "Compare display name against envelope address domain (display-name spoof).",
      "Compare Reply-To domain against From domain.",
      "Compare From domain against a built-in brand list using Levenshtein distance ≤2 (look-alike).",
      "Check for Punycode domains and brand labels appearing as subdomains of unrelated zones.",
      "Inspect URL hostnames in body for off-domain links and known URL shorteners.",
      "Add weights for executable / macro attachments and for urgency keywords in the subject/body.",
      "Sum weights into a 0–100 phishing score (capped) and classify verdict.",
    ],
  };
}
