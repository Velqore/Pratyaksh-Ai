import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Network } from "lucide-react";
import { EvidenceUploader } from "./EvidenceUploader";
import { ModeProgressBar } from "./ProgressBar";
import { CaseActions } from "./CaseActions";
import { FindingsList } from "./FindingsList";
import { analyzePcap, type PcapSummaryPayload } from "@/lib/forensics/pcap";
import type { CaseModeResult } from "@/lib/forensics/common/types";
import { toast } from "sonner";

interface Props {
  onResult: (file: File, r: CaseModeResult<PcapSummaryPayload>) => void;
  onExport: () => void;
  onSave: () => void;
  result: CaseModeResult<PcapSummaryPayload> | null;
}

export function PcapPanel({ onResult, onExport, onSave, result }: Props) {
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState({ label: "", frac: 0 });

  const run = async () => {
    if (!file) return;
    setBusy(true);
    try {
      const r = await analyzePcap(file, (label, frac) => setProgress({ label, frac }));
      onResult(file, r);
      toast.success(`Parsed ${r.payload.totalPackets} packets`);
    } catch (e) {
      toast.error(`pcap parse failed: ${(e as Error).message}`);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-4">
      <Card className="bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-gray-900 dark:text-white">
            <Network className="w-5 h-5 text-purple-600" />
            Network / pcap
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <EvidenceUploader
            file={file}
            hint=".pcap or .pcapng. Streaming decoder for Ethernet → IP → TCP/UDP, with DNS, HTTP, TLS-SNI + JA3 enrichment."
            onFile={setFile}
            disabled={busy}
            testId="pcap-uploader"
          />
          <Button
            onClick={run}
            disabled={!file || busy}
            className="bg-purple-600 hover:bg-purple-700 text-white w-full"
            data-testid="button-run-pcap"
          >
            {busy ? "Decoding capture…" : "Decode pcap"}
          </Button>
          <ModeProgressBar visible={busy} label={progress.label} fraction={progress.frac} />
        </CardContent>
      </Card>

      {result && (
        <Card className="bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700">
          <CardHeader>
            <CardTitle className="text-gray-900 dark:text-white text-base">
              {result.headline}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-xs">
              <Stat label="Format" value={result.payload.format.toUpperCase()} />
              <Stat label="Packets" value={result.payload.totalPackets.toLocaleString()} />
              <Stat label="Bytes" value={`${(result.payload.totalBytes / 1024).toFixed(1)} KiB`} />
              <Stat label="DNS queries" value={String(result.payload.dnsQueries.length)} />
            </div>

            <Section title="Top talkers">
              <Table
                head={["IP", "Packets", "Bytes"]}
                rows={result.payload.topTalkers.slice(0, 10).map((t) => [
                  t.ip,
                  String(t.packets),
                  `${(t.bytes / 1024).toFixed(1)} KiB`,
                ])}
              />
            </Section>

            {result.payload.dnsQueries.length > 0 && (
              <Section title="DNS queries">
                <Table
                  head={["Name", "Type", "Count"]}
                  rows={result.payload.dnsQueries.slice(0, 15).map((d) => [d.name, d.type, String(d.count)])}
                />
              </Section>
            )}

            {result.payload.httpHits.length > 0 && (
              <Section title="HTTP requests">
                <Table
                  head={["Method", "Host", "Path", "Count"]}
                  rows={result.payload.httpHits.slice(0, 15).map((h) => [
                    h.method,
                    h.host ?? "(none)",
                    h.path,
                    String(h.count),
                  ])}
                />
              </Section>
            )}

            {result.payload.tlsHandshakes.length > 0 && (
              <Section title="TLS handshakes (SNI + JA3)">
                <Table
                  head={["SNI", "JA3", "Count"]}
                  rows={result.payload.tlsHandshakes.slice(0, 15).map((t) => [
                    t.sni ?? "(no SNI)",
                    t.ja3.length > 60 ? `${t.ja3.slice(0, 57)}…` : t.ja3,
                    String(t.count),
                  ])}
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

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="p-2 bg-gray-50 dark:bg-gray-900 rounded border border-gray-200 dark:border-gray-700">
      <div className="text-gray-500">{label}</div>
      <div className="font-mono">{value}</div>
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
    <div className="border border-gray-200 dark:border-gray-700 rounded-md overflow-auto max-h-64">
      <table className="w-full text-xs">
        <thead className="bg-gray-100 dark:bg-gray-900 sticky top-0">
          <tr>
            {head.map((h, i) => (
              <th key={i} className="text-left p-2">{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i} className="border-t border-gray-200 dark:border-gray-700">
              {r.map((c, j) => (
                <td key={j} className="p-2 font-mono">{c}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
