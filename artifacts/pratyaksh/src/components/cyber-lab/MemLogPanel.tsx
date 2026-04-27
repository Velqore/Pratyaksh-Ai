import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { MemoryStick } from "lucide-react";
import { EvidenceUploader } from "./EvidenceUploader";
import { ModeProgressBar } from "./ProgressBar";
import { CaseActions } from "./CaseActions";
import { FindingsList } from "./FindingsList";
import { analyzeMemLog, type MemLogPayload } from "@/lib/forensics/memlog";
import type { CaseModeResult } from "@/lib/forensics/common/types";
import { toast } from "sonner";

interface Props {
  onResult: (file: File, r: CaseModeResult<MemLogPayload>) => void;
  onExport: () => void;
  onSave: () => void;
  result: CaseModeResult<MemLogPayload> | null;
}

export function MemLogPanel({ onResult, onExport, onSave, result }: Props) {
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState({ label: "", frac: 0 });

  const run = async () => {
    if (!file) return;
    setBusy(true);
    try {
      const r = await analyzeMemLog(file, (label, frac) => setProgress({ label, frac }));
      onResult(file, r);
      toast.success(`Detected: ${r.payload.kind}`);
    } catch (e) {
      toast.error(`Memory/log analysis failed: ${(e as Error).message}`);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-4">
      <Card className="bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-gray-900 dark:text-white">
            <MemoryStick className="w-5 h-5 text-purple-600" />
            Memory & Logs
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <EvidenceUploader
            file={file}
            hint="Memory dumps (.raw / .mem), Windows Event Logs (.evtx), syslog, auth.log, or HTTP access logs. Auto-detected from content."
            onFile={setFile}
            disabled={busy}
            testId="memlog-uploader"
          />
          <Button
            onClick={run}
            disabled={!file || busy}
            className="bg-purple-600 hover:bg-purple-700 text-white w-full"
            data-testid="button-run-memlog"
          >
            {busy ? "Analyzing…" : "Analyze"}
          </Button>
          <ModeProgressBar visible={busy} label={progress.label} fraction={progress.frac} />
        </CardContent>
      </Card>

      {result && (
        <Card className="bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700">
          <CardHeader>
            <CardTitle className="text-gray-900 dark:text-white text-base flex items-center justify-between">
              <span>{result.headline}</span>
              <Badge variant="outline" className="font-mono uppercase">{result.payload.kind}</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {result.payload.auth && (
              <>
                <Section title="Top failed-login source IPs">
                  <Table
                    head={["IP", "Failures", "Targeted users"]}
                    rows={result.payload.auth.failedByIp.slice(0, 10).map((r) => [
                      r.ip,
                      String(r.count),
                      r.users.slice(0, 5).join(", "),
                    ])}
                  />
                </Section>
                {result.payload.auth.bursts.length > 0 && (
                  <Section title="Brute-force bursts">
                    <Table
                      head={["IP", "Count", "Window (s)", "Started"]}
                      rows={result.payload.auth.bursts.slice(0, 10).map((b) => [
                        b.ip,
                        String(b.count),
                        String(b.windowSeconds),
                        new Date(b.firstAt * 1000).toISOString(),
                      ])}
                    />
                  </Section>
                )}
              </>
            )}

            {result.payload.access && (
              <>
                <Section title="Top client IPs">
                  <Table
                    head={["IP", "Requests"]}
                    rows={result.payload.access.topIps.slice(0, 10).map((t) => [t.ip, String(t.count)])}
                  />
                </Section>
                <Section title="Status histogram">
                  <Table
                    head={["Status", "Count"]}
                    rows={result.payload.access.statusHistogram.slice(0, 10).map((s) => [
                      String(s.status),
                      String(s.count),
                    ])}
                  />
                </Section>
              </>
            )}

            {result.payload.evtx && (
              <Section title="EVTX summary">
                <div className="text-xs font-mono">
                  Chunks: {result.payload.evtx.chunks} · Records: {result.payload.evtx.totalRecords}
                </div>
                {result.payload.evtx.eventIdHistogram.length > 0 && (
                  <Table
                    head={["EventID", "Count"]}
                    rows={result.payload.evtx.eventIdHistogram.slice(0, 15).map((e) => [
                      String(e.id),
                      String(e.count),
                    ])}
                  />
                )}
              </Section>
            )}

            {result.payload.memory && (
              <>
                <Section title="Memory IOCs">
                  <div className="text-xs font-mono">
                    {result.payload.memory.iocSummary.length === 0
                      ? "No IOCs surfaced."
                      : result.payload.memory.iocSummary.join(" · ")}
                  </div>
                </Section>
                <Section title="Longest extracted strings">
                  <Table
                    head={["Encoding", "Offset", "Text"]}
                    rows={result.payload.memory.longest.slice(0, 20).map((s) => [
                      s.encoding,
                      `0x${s.offset.toString(16)}`,
                      s.text.length > 80 ? `${s.text.slice(0, 77)}…` : s.text,
                    ])}
                  />
                </Section>
              </>
            )}

            {result.payload.syslog && (
              <Section title="Syslog process histogram">
                <Table
                  head={["Process", "Lines"]}
                  rows={result.payload.syslog.processes.slice(0, 12).map((p) => [p.name, String(p.count)])}
                />
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

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h4 className="text-sm font-semibold text-gray-900 dark:text-white mb-2">{title}</h4>
      {children}
    </div>
  );
}

function Table({ head, rows }: { head: string[]; rows: string[][] }) {
  if (rows.length === 0)
    return (
      <div className="text-xs italic text-gray-500 dark:text-gray-400">
        Nothing to show.
      </div>
    );
  return (
    <div className="border border-gray-200 dark:border-gray-700 rounded-md overflow-auto max-h-64">
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
