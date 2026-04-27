// Reusable findings list shared by every mode panel. Each finding is
// colour-coded by severity and supports an optional `where` location.

import { Badge } from "@/components/ui/badge";
import type { ModeFinding } from "@/lib/forensics/common/types";

const SEVERITY_STYLES: Record<ModeFinding["severity"], string> = {
  crit: "bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-200 border-red-300 dark:border-red-800",
  high: "bg-orange-100 text-orange-800 dark:bg-orange-900/40 dark:text-orange-200 border-orange-300 dark:border-orange-800",
  med: "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-200 border-amber-300 dark:border-amber-800",
  low: "bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-200 border-blue-300 dark:border-blue-800",
  info: "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300 border-gray-300 dark:border-gray-700",
};

interface Props {
  findings: ModeFinding[];
}

export function FindingsList({ findings }: Props) {
  if (findings.length === 0) {
    return (
      <div className="text-sm text-gray-500 dark:text-gray-400 italic">
        No findings surfaced.
      </div>
    );
  }
  return (
    <ul className="space-y-2" data-testid="findings-list">
      {findings.map((f, i) => (
        <li
          key={i}
          className="border border-gray-200 dark:border-gray-700 rounded-md p-3 bg-white dark:bg-gray-900"
        >
          <div className="flex items-start gap-2 flex-wrap">
            <Badge
              variant="outline"
              className={`text-xs font-mono uppercase ${SEVERITY_STYLES[f.severity]}`}
            >
              {f.severity}
            </Badge>
            <div className="flex-1 min-w-0">
              <div className="text-sm font-medium text-gray-900 dark:text-white">
                {f.title}
              </div>
              {f.detail && (
                <div className="text-xs text-gray-600 dark:text-gray-400 mt-0.5">
                  {f.detail}
                </div>
              )}
              {f.where && (
                <div className="text-[10px] text-gray-500 dark:text-gray-500 mt-1 font-mono">
                  @ {f.where}
                </div>
              )}
            </div>
          </div>
        </li>
      ))}
    </ul>
  );
}
