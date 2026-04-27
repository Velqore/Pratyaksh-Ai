// Slim progress display used by every mode while an analysis is streaming.

import { Progress } from "@/components/ui/progress";

interface Props {
  visible: boolean;
  label: string;
  fraction: number;
}

export function ModeProgressBar({ visible, label, fraction }: Props) {
  if (!visible) return null;
  return (
    <div className="space-y-2 mt-4" data-testid="mode-progress">
      <div className="flex items-center justify-between">
        <span className="text-sm text-gray-700 dark:text-gray-300">{label}</span>
        <span className="text-sm font-mono text-purple-600 dark:text-purple-400">
          {Math.round(fraction * 100)}%
        </span>
      </div>
      <Progress value={Math.round(fraction * 100)} />
    </div>
  );
}
