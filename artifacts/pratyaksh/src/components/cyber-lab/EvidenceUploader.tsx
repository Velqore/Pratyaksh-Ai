// Drag-and-drop / click-to-pick evidence uploader used by every multi-mode
// panel. Wraps the existing visual style of the static-mode dropzone in a
// reusable component.

import { useRef } from "react";
import { Upload } from "lucide-react";
import { cn } from "@/lib/utils";

interface Props {
  file: File | null;
  accept?: string;
  hint: string;
  onFile: (f: File) => void;
  disabled?: boolean;
  testId?: string;
}

export function EvidenceUploader({ file, accept, hint, onFile, disabled, testId }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  return (
    <div
      data-testid={testId ?? "evidence-uploader"}
      onClick={() => !disabled && inputRef.current?.click()}
      onDragOver={(e) => {
        e.preventDefault();
      }}
      onDrop={(e) => {
        e.preventDefault();
        if (disabled) return;
        const f = e.dataTransfer.files?.[0];
        if (f) onFile(f);
      }}
      className={cn(
        "border-2 border-dashed rounded-lg p-6 transition-colors",
        disabled
          ? "border-gray-300 dark:border-gray-700 opacity-50 cursor-not-allowed"
          : "border-purple-300 dark:border-purple-600 hover:border-purple-500 cursor-pointer bg-purple-50/40 dark:bg-purple-900/10",
      )}
    >
      <input
        ref={inputRef}
        type="file"
        className="hidden"
        accept={accept}
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) onFile(f);
        }}
      />
      <div className="flex items-center gap-3">
        <Upload className="w-7 h-7 text-purple-600 shrink-0" />
        <div className="flex-1 min-w-0">
          {file ? (
            <>
              <div className="text-sm font-semibold text-gray-900 dark:text-white truncate">
                {file.name}
              </div>
              <div className="text-xs text-gray-600 dark:text-gray-400">
                {(file.size / 1024).toFixed(1)} KiB · click to replace
              </div>
            </>
          ) : (
            <>
              <div className="text-sm font-semibold text-gray-900 dark:text-white">
                Drop evidence here, or click to choose
              </div>
              <div className="text-xs text-gray-600 dark:text-gray-400">{hint}</div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
