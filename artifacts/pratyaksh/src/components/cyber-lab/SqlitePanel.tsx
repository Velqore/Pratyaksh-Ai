import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Database as DbIcon, Download } from "lucide-react";
import { EvidenceUploader } from "./EvidenceUploader";
import { ModeProgressBar } from "./ProgressBar";
import { CaseActions } from "./CaseActions";
import { FindingsList } from "./FindingsList";
import { analyzeSqlite, type SqlitePayload } from "@/lib/forensics/sqlite";
import { readPage, tableToCsv } from "@/lib/forensics/sqlite/tables";
import type { Database } from "@/lib/forensics/sqlite/open";
import type { CaseModeResult } from "@/lib/forensics/common/types";
import { toast } from "sonner";

interface Props {
  onResult: (file: File, r: CaseModeResult<SqlitePayload>) => void;
  onExport: () => void;
  onSave: () => void;
  result: CaseModeResult<SqlitePayload> | null;
}

const PAGE_SIZE = 25;

export function SqlitePanel({ onResult, onExport, onSave, result }: Props) {
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState({ label: "", frac: 0 });
  const [db, setDb] = useState<Database | null>(null);
  const [activeTable, setActiveTable] = useState<string | null>(null);
  const [page, setPage] = useState(0);
  const [rows, setRows] = useState<{ columns: string[]; values: Array<Array<string | number | null>>; total: number } | null>(null);

  useEffect(() => {
    if (!db || !activeTable) {
      setRows(null);
      return;
    }
    try {
      const r = readPage(db, activeTable, page, PAGE_SIZE);
      setRows({ columns: r.columns, values: r.rows, total: r.totalRows });
    } catch (e) {
      toast.error(`Read failed: ${(e as Error).message}`);
    }
  }, [db, activeTable, page]);

  const run = async () => {
    if (!file) return;
    setBusy(true);
    try {
      const r = await analyzeSqlite(file, (label, frac) => setProgress({ label, frac }));
      onResult(file, r);
      setDb(r._db);
      const firstUserTable = r.payload.tables.find((t) => !t.internal);
      setActiveTable(firstUserTable?.name ?? r.payload.tables[0]?.name ?? null);
      setPage(0);
      toast.success(`Loaded ${r.payload.tables.length} table(s)`);
    } catch (e) {
      toast.error(`SQLite analysis failed: ${(e as Error).message}`);
    } finally {
      setBusy(false);
    }
  };

  const exportCsv = () => {
    if (!db || !activeTable) return;
    const csv = tableToCsv(db, activeTable);
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${activeTable}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-4">
      <Card className="bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-gray-900 dark:text-white">
            <DbIcon className="w-5 h-5 text-purple-600" />
            SQLite Forensics
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <EvidenceUploader
            file={file}
            accept=".db,.sqlite,.sqlite3,.db3"
            hint="A SQLite file. Schema is read with sql.js; deleted rows are recovered by walking unallocated B-tree page space."
            onFile={setFile}
            disabled={busy}
            testId="sqlite-uploader"
          />
          <Button
            onClick={run}
            disabled={!file || busy}
            className="bg-purple-600 hover:bg-purple-700 text-white w-full"
            data-testid="button-run-sqlite"
          >
            {busy ? "Opening database…" : "Open & analyse"}
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
              <Stat label="Page size" value={`${result.payload.pageSize}B`} />
              <Stat label="Encoding" value={result.payload.encoding} />
              <Stat label="user_version" value={String(result.payload.userVersion)} />
              <Stat label="application_id" value={`0x${result.payload.applicationId.toString(16)}`} />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div>
                <h4 className="text-sm font-semibold text-gray-900 dark:text-white mb-2">Tables</h4>
                <div className="space-y-1 max-h-72 overflow-auto pr-1">
                  {result.payload.tables.map((t) => (
                    <button
                      key={t.name}
                      onClick={() => { setActiveTable(t.name); setPage(0); }}
                      data-testid={`table-${t.name}`}
                      className={`w-full text-left text-xs font-mono p-2 rounded border ${
                        activeTable === t.name
                          ? "bg-purple-100 dark:bg-purple-900/30 border-purple-400"
                          : "bg-gray-50 dark:bg-gray-900 border-gray-200 dark:border-gray-700"
                      } ${t.internal ? "opacity-60" : ""}`}
                    >
                      <div className="flex justify-between">
                        <span>{t.name}</span>
                        <Badge variant="outline" className="text-[10px]">{t.rowCount}</Badge>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
              <div className="md:col-span-2">
                <div className="flex items-center justify-between mb-2">
                  <h4 className="text-sm font-semibold text-gray-900 dark:text-white">
                    {activeTable ?? "(no table selected)"}
                  </h4>
                  {activeTable && (
                    <Button size="sm" variant="outline" onClick={exportCsv}>
                      <Download className="w-3 h-3 mr-1" /> CSV
                    </Button>
                  )}
                </div>
                {rows && (
                  <>
                    <div className="border border-gray-200 dark:border-gray-700 rounded-md overflow-auto max-h-72">
                      <table className="w-full text-xs">
                        <thead className="bg-gray-100 dark:bg-gray-900 sticky top-0">
                          <tr>{rows.columns.map((c, i) => (<th key={i} className="text-left p-2 font-mono">{c}</th>))}</tr>
                        </thead>
                        <tbody>
                          {rows.values.map((r, i) => (
                            <tr key={i} className="border-t border-gray-200 dark:border-gray-700">
                              {r.map((v, j) => (<td key={j} className="p-2 font-mono">{v === null ? "NULL" : String(v)}</td>))}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    <div className="flex items-center justify-between mt-2 text-xs">
                      <span className="text-gray-500">
                        {rows.total === 0
                          ? "0 rows"
                          : `Rows ${page * PAGE_SIZE + 1}–${Math.min((page + 1) * PAGE_SIZE, rows.total)} of ${rows.total}`}
                      </span>
                      <div className="flex gap-1">
                        <Button size="sm" variant="outline" disabled={page === 0} onClick={() => setPage(page - 1)}>Prev</Button>
                        <Button size="sm" variant="outline" disabled={(page + 1) * PAGE_SIZE >= rows.total} onClick={() => setPage(page + 1)}>Next</Button>
                      </div>
                    </div>
                  </>
                )}
              </div>
            </div>

            {result.payload.recovered.length > 0 && (
              <div>
                <h4 className="text-sm font-semibold text-gray-900 dark:text-white mb-2">
                  Deleted-row recovery ({result.payload.recovered.length})
                </h4>
                <div className="border border-gray-200 dark:border-gray-700 rounded-md overflow-auto max-h-64">
                  <table className="w-full text-xs">
                    <thead className="bg-gray-100 dark:bg-gray-900 sticky top-0">
                      <tr>
                        <th className="text-left p-2">Table</th>
                        <th className="text-left p-2">Page</th>
                        <th className="text-left p-2">File offset</th>
                        <th className="text-left p-2">Recovered values</th>
                      </tr>
                    </thead>
                    <tbody>
                      {result.payload.recovered.slice(0, 50).map((r, i) => (
                        <tr key={i} className="border-t border-gray-200 dark:border-gray-700">
                          <td className="p-2 font-mono">{r.table}</td>
                          <td className="p-2 font-mono">{r.pageNumber}</td>
                          <td className="p-2 font-mono">0x{r.fileOffset.toString(16)}</td>
                          <td className="p-2 font-mono text-[10px] break-all">
                            {r.values.map((v) => (v === null ? "NULL" : String(v))).join(" | ")}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
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
