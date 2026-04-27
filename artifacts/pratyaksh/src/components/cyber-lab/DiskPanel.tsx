import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { HardDrive, FolderTree } from "lucide-react";
import { EvidenceUploader } from "./EvidenceUploader";
import { ModeProgressBar } from "./ProgressBar";
import { CaseActions } from "./CaseActions";
import { FindingsList } from "./FindingsList";
import { analyzeDiskImage, type DiskAnalysisPayload } from "@/lib/forensics/disk";
import type { CaseModeResult } from "@/lib/forensics/common/types";
import { toast } from "sonner";

interface Props {
  onResult: (file: File, r: CaseModeResult<DiskAnalysisPayload>) => void;
  onExport: () => void;
  onSave: () => void;
  result: CaseModeResult<DiskAnalysisPayload> | null;
}

interface NormalizedEntry {
  name: string;
  size: number;
  isDir: boolean;
  deleted: boolean;
}

function normalizeEntries(view: DiskAnalysisPayload["views"][number]): NormalizedEntry[] {
  const fs = view.filesystem;
  if (fs.kind === "fat") {
    return fs.volume.entries.map((e) => ({
      name: e.longName ?? e.shortName,
      size: e.size,
      isDir: e.isDir,
      deleted: e.deleted,
    }));
  }
  if (fs.kind === "ntfs") {
    return fs.volume.files.map((f) => ({
      name: f.name,
      size: f.size,
      isDir: f.isDir,
      deleted: f.deleted,
    }));
  }
  if (fs.kind === "ext") {
    return fs.volume.files.map((f) => ({
      name: f.name,
      size: f.size,
      isDir: f.isDir,
      deleted: f.deleted,
    }));
  }
  return [];
}

export function DiskPanel({ onResult, onExport, onSave, result }: Props) {
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState({ label: "", frac: 0 });
  const [activePart, setActivePart] = useState(0);

  const run = async () => {
    if (!file) return;
    setBusy(true);
    setProgress({ label: "Starting", frac: 0 });
    try {
      const r = await analyzeDiskImage(file, (label, frac) => {
        setProgress({ label, frac });
      });
      onResult(file, r);
      setActivePart(0);
      toast.success(`Disk image parsed: ${r.payload.table.partitions.length} partition(s)`);
    } catch (e) {
      toast.error(`Disk analysis failed: ${(e as Error).message}`);
    } finally {
      setBusy(false);
    }
  };

  const view = result?.payload.views[activePart];
  const entries = view ? normalizeEntries(view) : [];

  return (
    <div className="space-y-4">
      <Card className="bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-gray-900 dark:text-white">
            <HardDrive className="w-5 h-5 text-purple-600" />
            Disk Imaging
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <EvidenceUploader
            file={file}
            hint="Raw disk images (.dd / .img / .iso). Reads MBR/GPT partition tables and lists FAT/NTFS/ext root entries with deletion markers."
            onFile={setFile}
            disabled={busy}
            testId="disk-uploader"
          />
          <Button
            onClick={run}
            disabled={!file || busy}
            className="bg-purple-600 hover:bg-purple-700 text-white w-full"
            data-testid="button-run-disk"
          >
            {busy ? "Parsing image…" : "Parse disk image"}
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
            <div className="text-xs text-gray-600 dark:text-gray-400 font-mono">
              Scheme: {result.payload.table.scheme} · Disk ID: {result.payload.table.diskId} ·
              Image: {(result.payload.imageSize / 1024).toFixed(1)} KiB
            </div>

            <div>
              <h4 className="text-sm font-semibold text-gray-900 dark:text-white mb-2">
                Partitions
              </h4>
              {result.payload.views.length === 0 && (
                <div className="text-xs italic text-gray-500">
                  No partitions enumerated.
                </div>
              )}
              <div className="space-y-1">
                {result.payload.views.map((v, i) => (
                  <button
                    key={i}
                    onClick={() => setActivePart(i)}
                    data-testid={`partition-${i}`}
                    className={`w-full text-left text-xs font-mono p-2 rounded border ${
                      i === activePart
                        ? "bg-purple-100 dark:bg-purple-900/30 border-purple-400"
                        : "bg-gray-50 dark:bg-gray-900 border-gray-200 dark:border-gray-700"
                    }`}
                  >
                    <div className="flex justify-between gap-2 items-center">
                      <span>#{v.partition.index} {v.partition.typeName} {v.partition.name && `· ${v.partition.name}`}</span>
                      <Badge variant="outline" className="text-[10px] uppercase">
                        {v.filesystem.kind}
                      </Badge>
                    </div>
                    <div className="text-[10px] text-gray-500 mt-0.5">
                      Start 0x{v.partition.start.toString(16)} · {(v.partition.size / 1024).toFixed(1)} KiB
                    </div>
                  </button>
                ))}
              </div>
            </div>

            {view && (
              <div>
                <h4 className="text-sm font-semibold text-gray-900 dark:text-white mb-2 flex items-center gap-2">
                  <FolderTree className="w-4 h-4" />
                  Entries in #{view.partition.index} ({entries.length})
                </h4>
                {view.filesystem.kind === "unknown" ? (
                  <div className="text-xs italic text-gray-500">
                    Unrecognised filesystem: {view.filesystem.reason}
                  </div>
                ) : (
                  <div className="border border-gray-200 dark:border-gray-700 rounded-md max-h-72 overflow-auto">
                    <table className="w-full text-xs">
                      <thead className="bg-gray-100 dark:bg-gray-900 sticky top-0">
                        <tr>
                          <th className="text-left p-2">Name</th>
                          <th className="text-right p-2">Size</th>
                          <th className="text-left p-2">Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {entries.slice(0, 200).map((e, i) => (
                          <tr
                            key={i}
                            className={`border-t border-gray-200 dark:border-gray-700 ${e.deleted ? "opacity-60" : ""}`}
                          >
                            <td className="p-2 font-mono">
                              {e.isDir ? "📁 " : "📄 "}{e.name}
                            </td>
                            <td className="p-2 text-right font-mono">{e.size}</td>
                            <td className="p-2">
                              {e.deleted ? (
                                <Badge className="bg-red-100 text-red-800 text-[10px]">deleted</Badge>
                              ) : (
                                <Badge variant="outline" className="text-[10px]">live</Badge>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
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
