// Small action bar shared by each mode panel — Export PDF + Save to Case.

import { Button } from "@/components/ui/button";
import { Download, Database } from "lucide-react";

interface Props {
  onExport: () => void;
  onSave: () => void;
  disabled?: boolean;
}

export function CaseActions({ onExport, onSave, disabled }: Props) {
  return (
    <div className="flex flex-wrap gap-2 mt-4">
      <Button
        onClick={onExport}
        disabled={disabled}
        className="bg-purple-600 hover:bg-purple-700 text-white"
        data-testid="button-export-pdf"
      >
        <Download className="w-4 h-4 mr-2" />
        Export PDF Report
      </Button>
      <Button
        variant="outline"
        onClick={onSave}
        disabled={disabled}
        data-testid="button-save-case"
      >
        <Database className="w-4 h-4 mr-2" />
        Save to Case File
      </Button>
    </div>
  );
}
