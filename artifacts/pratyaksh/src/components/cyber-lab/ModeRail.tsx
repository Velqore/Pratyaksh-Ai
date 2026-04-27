// Left-rail mode picker for the Cyber Lab. Surface seven analysis modes
// as cards; clicking swaps the active panel in CyberDepartment.tsx.

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  ScanLine,
  HardDrive,
  Bug,
  Network,
  MemoryStick,
  Mail,
  Database as DbIcon,
} from "lucide-react";
import type { CyberMode } from "@/lib/forensics/common/types";

interface ModeDef {
  id: CyberMode;
  label: string;
  description: string;
  Icon: typeof ScanLine;
  /** Single example; not enforced — informational only. */
  example: string;
}

const MODES: ModeDef[] = [
  {
    id: "static",
    label: "Static Analysis",
    description: "Single-file metadata, hashes, IOCs, headers.",
    Icon: ScanLine,
    example: "any binary, image, document",
  },
  {
    id: "disk",
    label: "Disk Imaging",
    description: "Partition table + filesystem triage.",
    Icon: HardDrive,
    example: ".dd / .img / .iso",
  },
  {
    id: "malware",
    label: "Malware Detector",
    description: "YARA-lite rules, PE imports, macros, PDF threats.",
    Icon: Bug,
    example: ".exe / .dll / .docm / .pdf",
  },
  {
    id: "pcap",
    label: "Network / pcap",
    description: "Top talkers, DNS, HTTP, TLS SNI + JA3.",
    Icon: Network,
    example: ".pcap / .pcapng",
  },
  {
    id: "memlog",
    label: "Memory & Logs",
    description: "Strings, EVTX, syslog, auth.log brute-force.",
    Icon: MemoryStick,
    example: ".raw / .mem / .log / .evtx",
  },
  {
    id: "email",
    label: "Email Forensics",
    description: "Headers, SPF/DKIM/DMARC, spoof + phishing score.",
    Icon: Mail,
    example: ".eml",
  },
  {
    id: "sqlite",
    label: "SQLite Forensics",
    description: "Schema, paged rows, deleted-row recovery.",
    Icon: DbIcon,
    example: ".db / .sqlite",
  },
];

interface Props {
  active: CyberMode;
  onSelect: (m: CyberMode) => void;
  /** Map of completed modes — shown as a green dot. */
  completed: Record<string, boolean>;
}

export function ModeRail({ active, onSelect, completed }: Props) {
  return (
    <div className="space-y-2" data-testid="cyber-mode-rail">
      <div className="text-xs uppercase tracking-wider text-gray-500 dark:text-gray-400 px-1 mb-2">
        Analysis Mode
      </div>
      {MODES.map(({ id, label, description, Icon, example }) => {
        const isActive = active === id;
        return (
          <Button
            key={id}
            variant={isActive ? "default" : "outline"}
            onClick={() => onSelect(id)}
            data-testid={`mode-button-${id}`}
            className={cn(
              "mode-rail-button w-full justify-start h-auto py-3 px-3 text-left rounded-xl",
              isActive
                ? "mode-rail-active text-white border-transparent hover:opacity-95"
                : "bg-white/80 dark:bg-gray-800/70 hover:bg-white dark:hover:bg-gray-800 backdrop-blur-sm",
            )}
          >
            <div className="flex items-start gap-3 w-full">
              <Icon className="w-5 h-5 shrink-0 mt-0.5" />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-sm">{label}</span>
                  {completed[id] && (
                    <span
                      className="w-2 h-2 rounded-full bg-green-400"
                      title="Run completed in this session"
                    />
                  )}
                </div>
                <div
                  className={cn(
                    "text-xs leading-snug mt-0.5",
                    isActive ? "text-purple-100" : "text-gray-600 dark:text-gray-400",
                  )}
                >
                  {description}
                </div>
                <div
                  className={cn(
                    "text-[10px] mt-1 font-mono",
                    isActive ? "text-purple-200" : "text-gray-500 dark:text-gray-500",
                  )}
                >
                  {example}
                </div>
              </div>
            </div>
          </Button>
        );
      })}
    </div>
  );
}

export const CYBER_MODES = MODES;
