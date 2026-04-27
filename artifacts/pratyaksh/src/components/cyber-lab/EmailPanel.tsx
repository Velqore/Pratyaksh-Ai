import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Mail } from "lucide-react";
import { EvidenceUploader } from "./EvidenceUploader";
import { ModeProgressBar } from "./ProgressBar";
import { CaseActions } from "./CaseActions";
import { FindingsList } from "./FindingsList";
import { analyzeEmail, type EmailPayload } from "@/lib/forensics/email";
import type { CaseModeResult } from "@/lib/forensics/common/types";
import { toast } from "sonner";

interface Props {
  onResult: (file: File, r: CaseModeResult<EmailPayload>) => void;
  onExport: () => void;
  onSave: () => void;
  result: CaseModeResult<EmailPayload> | null;
}

const VERDICT_COLOR: Record<string, string> = {
  benign: "bg-green-500",
  suspicious: "bg-amber-500",
  phishing: "bg-orange-600",
  highly_phishing: "bg-red-700",
};

export function EmailPanel({ onResult, onExport, onSave, result }: Props) {
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState({ label: "", frac: 0 });

  const run = async () => {
    if (!file) return;
    setBusy(true);
    try {
      const r = await analyzeEmail(file, (label, frac) => setProgress({ label, frac }));
      onResult(file, r);
      toast.success(`Verdict: ${r.payload.verdict}`);
    } catch (e) {
      toast.error(`Email analysis failed: ${(e as Error).message}`);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-4">
      <Card className="bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-gray-900 dark:text-white">
            <Mail className="w-5 h-5 text-purple-600" />
            Email Forensics
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <EvidenceUploader
            file={file}
            accept=".eml,message/rfc822"
            hint="Raw RFC 5322 .eml file. SPF/DKIM/DMARC verdicts, Reply-To and look-alike checks, phishing score."
            onFile={setFile}
            disabled={busy}
            testId="email-uploader"
          />
          <Button
            onClick={run}
            disabled={!file || busy}
            className="bg-purple-600 hover:bg-purple-700 text-white w-full"
            data-testid="button-run-email"
          >
            {busy ? "Parsing email…" : "Analyse email"}
          </Button>
          <ModeProgressBar visible={busy} label={progress.label} fraction={progress.frac} />
        </CardContent>
      </Card>

      {result && (
        <Card className="bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700">
          <CardHeader>
            <CardTitle className="text-gray-900 dark:text-white text-base flex items-center justify-between">
              <span>{result.headline}</span>
              <Badge className={`text-white ${VERDICT_COLOR[result.payload.verdict]}`} data-testid="email-verdict">
                {result.payload.verdict.toUpperCase()} · {result.payload.phishingScore}/100
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-2 text-xs">
              <Stat label="From" value={result.payload.parsed.from?.address ?? "—"} />
              <Stat label="Reply-To" value={result.payload.parsed.replyTo?.address ?? "—"} />
              <Stat label="Subject" value={result.payload.parsed.subject ?? "—"} />
            </div>

            <div className="grid grid-cols-3 gap-2 text-xs">
              <AuthBadge label="SPF" value={result.payload.auth.spf} />
              <AuthBadge label="DKIM" value={result.payload.auth.dkim} />
              <AuthBadge label="DMARC" value={result.payload.auth.dmarc} />
            </div>

            <Section title="Received chain">
              <ol className="text-xs font-mono space-y-1 max-h-48 overflow-auto">
                {result.payload.parsed.receivedChain.map((h, i) => (
                  <li key={i} className="border-l-2 border-purple-500 pl-2">
                    <div>
                      from <strong>{h.fromHost ?? "(unknown)"}</strong>{h.fromIp ? ` [${h.fromIp}]` : ""} by <strong>{h.byHost ?? "(unknown)"}</strong>
                    </div>
                    {h.receivedAt && <div className="text-gray-500">{h.receivedAt}</div>}
                  </li>
                ))}
                {result.payload.parsed.receivedChain.length === 0 && (
                  <li className="text-gray-500 italic">No Received headers</li>
                )}
              </ol>
            </Section>

            {result.payload.scoreBreakdown.length > 0 && (
              <Section title="Phishing score breakdown">
                <Table
                  head={["Indicator", "Weight"]}
                  rows={result.payload.scoreBreakdown.map((b) => [b.label, `+${b.weight}`])}
                />
              </Section>
            )}

            {result.payload.parsed.urls.length > 0 && (
              <Section title="Embedded URLs">
                <ul className="text-xs font-mono space-y-1 max-h-32 overflow-auto">
                  {result.payload.parsed.urls.map((u, i) => (
                    <li key={i} className="break-all">{u}</li>
                  ))}
                </ul>
              </Section>
            )}

            <div>
              <h4 className="text-sm font-semibold text-gray-900 dark:text-white mb-2">Findings</h4>
              <FindingsList findings={result.findings} />
            </div>

            <CaseActions onExport={onExport} onSave={onSave} />
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="p-2 bg-gray-50 dark:bg-gray-900 rounded border border-gray-200 dark:border-gray-700">
      <div className="text-gray-500">{label}</div>
      <div className="font-mono break-all">{value}</div>
    </div>
  );
}

function AuthBadge({ label, value }: { label: string; value: string }) {
  const color =
    value === "pass"
      ? "bg-green-500"
      : value === "fail"
        ? "bg-red-600"
        : value === "softfail"
          ? "bg-amber-500"
          : "bg-gray-400";
  return (
    <div className="flex flex-col items-center p-2 bg-gray-50 dark:bg-gray-900 rounded border border-gray-200 dark:border-gray-700">
      <div className="text-[10px] text-gray-500 uppercase">{label}</div>
      <Badge className={`text-white ${color} mt-1 uppercase font-mono`}>{value}</Badge>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h4 className="text-sm font-semibold text-gray-900 dark:text-white mb-2">{title}</h4>
      {children}
    </div>
  );
}

function Table({ head, rows }: { head: string[]; rows: string[][] }) {
  return (
    <div className="border border-gray-200 dark:border-gray-700 rounded-md overflow-auto max-h-48">
      <table className="w-full text-xs">
        <thead className="bg-gray-100 dark:bg-gray-900 sticky top-0">
          <tr>{head.map((h, i) => (<th key={i} className="text-left p-2">{h}</th>))}</tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i} className="border-t border-gray-200 dark:border-gray-700">
              {r.map((c, j) => (<td key={j} className="p-2 font-mono">{c}</td>))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
