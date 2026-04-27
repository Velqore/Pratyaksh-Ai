import React, { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { CalendarIcon, FileText, Shield, User } from "lucide-react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";

interface CaseDetails {
  caseNumber: string;
  caseName: string;
  investigatorName: string;
  investigatorId: string;
  department: string;
  priority: "Low" | "Medium" | "High" | "Critical";
  caseType: string;
  dateOpened: Date | undefined;
  description: string;
  evidenceType: string;
  location: string;
  suspects: string;
  witnesses: string;
  notes: string;
}

interface CaseDetailsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  evidenceType?: string;
  onSave: (caseDetails: CaseDetails) => void;
}

export function CaseDetailsDialog({
  open,
  onOpenChange,
  evidenceType = "",
  onSave,
}: CaseDetailsDialogProps) {
  const [caseDetails, setCaseDetails] = useState<CaseDetails>({
    caseNumber: `CASE-${new Date().getFullYear()}-${String(Date.now()).slice(-6)}`,
    caseName: "",
    investigatorName: "",
    investigatorId: "",
    department: "Digital Forensics Division",
    priority: "Medium",
    caseType: evidenceType || "Digital Evidence",
    dateOpened: new Date(),
    description: "",
    evidenceType: evidenceType || "",
    location: "",
    suspects: "",
    witnesses: "",
    notes: "",
  });

  const handleSave = () => {
    if (!caseDetails.caseName || !caseDetails.investigatorName) {
      alert(
        "Please fill in the required fields (Case Name and Investigator Name)",
      );
      return;
    }

    onSave(caseDetails);
    onOpenChange(false);

    // Reset form
    setCaseDetails({
      caseNumber: `CASE-${new Date().getFullYear()}-${String(Date.now()).slice(-6)}`,
      caseName: "",
      investigatorName: "",
      investigatorId: "",
      department: "Digital Forensics Division",
      priority: "Medium",
      caseType: evidenceType || "Digital Evidence",
      dateOpened: new Date(),
      description: "",
      evidenceType: evidenceType || "",
      location: "",
      suspects: "",
      witnesses: "",
      notes: "",
    });
  };

  const updateField = (field: keyof CaseDetails, value: any) => {
    setCaseDetails((prev) => ({ ...prev, [field]: value }));
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="w-5 h-5 text-cyan-400" />
            Create Case File
          </DialogTitle>
          <DialogDescription>
            Provide details for this forensic investigation case. All evidence
            and analysis will be linked to this case file.
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 py-4">
          {/* Basic Information */}
          <div className="space-y-4">
            <div className="flex items-center gap-2 mb-3">
              <Shield className="w-4 h-4 text-cyan-400" />
              <h3 className="font-semibold text-sm text-cyan-400">
                Case Information
              </h3>
            </div>

            <div className="space-y-2">
              <Label htmlFor="caseNumber">Case Number</Label>
              <Input
                id="caseNumber"
                value={caseDetails.caseNumber}
                onChange={(e) => updateField("caseNumber", e.target.value)}
                className="bg-slate-800 border-slate-600"
                readOnly
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="caseName">Case Name *</Label>
              <Input
                id="caseName"
                value={caseDetails.caseName}
                onChange={(e) => updateField("caseName", e.target.value)}
                placeholder="Enter case name"
                className="bg-slate-800 border-slate-600"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="caseType">Case Type</Label>
              <Select
                value={caseDetails.caseType}
                onValueChange={(value) => updateField("caseType", value)}
              >
                <SelectTrigger className="bg-slate-800 border-slate-600">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Fingerprint Analysis">
                    Fingerprint Analysis
                  </SelectItem>
                  <SelectItem value="Cyber Crime Investigation">
                    Cyber Crime Investigation
                  </SelectItem>
                  <SelectItem value="Document Examination">
                    Document Examination
                  </SelectItem>
                  <SelectItem value="Digital Evidence">
                    Digital Evidence
                  </SelectItem>
                  <SelectItem value="Criminal Investigation">
                    Criminal Investigation
                  </SelectItem>
                  <SelectItem value="Fraud Investigation">
                    Fraud Investigation
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Priority Level</Label>
              <Select
                value={caseDetails.priority}
                onValueChange={(value) => updateField("priority", value as any)}
              >
                <SelectTrigger className="bg-slate-800 border-slate-600">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Low">🟢 Low Priority</SelectItem>
                  <SelectItem value="Medium">🟡 Medium Priority</SelectItem>
                  <SelectItem value="High">🟠 High Priority</SelectItem>
                  <SelectItem value="Critical">🔴 Critical Priority</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Date Opened</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      "w-full justify-start text-left font-normal bg-slate-800 border-slate-600",
                      !caseDetails.dateOpened && "text-muted-foreground",
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {caseDetails.dateOpened ? (
                      format(caseDetails.dateOpened, "PPP")
                    ) : (
                      <span>Pick a date</span>
                    )}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0">
                  <Calendar
                    mode="single"
                    selected={caseDetails.dateOpened}
                    onSelect={(date) => updateField("dateOpened", date)}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
            </div>
          </div>

          {/* Investigator Information */}
          <div className="space-y-4">
            <div className="flex items-center gap-2 mb-3">
              <User className="w-4 h-4 text-cyan-400" />
              <h3 className="font-semibold text-sm text-cyan-400">
                Investigator Details
              </h3>
            </div>

            <div className="space-y-2">
              <Label htmlFor="investigatorName">Investigator Name *</Label>
              <Input
                id="investigatorName"
                value={caseDetails.investigatorName}
                onChange={(e) =>
                  updateField("investigatorName", e.target.value)
                }
                placeholder="Enter investigator name"
                className="bg-slate-800 border-slate-600"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="investigatorId">Investigator ID</Label>
              <Input
                id="investigatorId"
                value={caseDetails.investigatorId}
                onChange={(e) => updateField("investigatorId", e.target.value)}
                placeholder="FA-2024-XXX"
                className="bg-slate-800 border-slate-600"
              />
            </div>

            <div className="space-y-2">
              <Label>Department</Label>
              <Select
                value={caseDetails.department}
                onValueChange={(value) => updateField("department", value)}
              >
                <SelectTrigger className="bg-slate-800 border-slate-600">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Digital Forensics Division">
                    Digital Forensics Division
                  </SelectItem>
                  <SelectItem value="Fingerprint Analysis Lab">
                    Fingerprint Analysis Lab
                  </SelectItem>
                  <SelectItem value="Cyber Crime Investigation">
                    Cyber Crime Investigation
                  </SelectItem>
                  <SelectItem value="Document Examination Unit">
                    Document Examination Unit
                  </SelectItem>
                  <SelectItem value="Criminal Investigation Department">
                    Criminal Investigation Department
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="location">Location</Label>
              <Input
                id="location"
                value={caseDetails.location}
                onChange={(e) => updateField("location", e.target.value)}
                placeholder="Investigation location"
                className="bg-slate-800 border-slate-600"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="evidenceType">Evidence Type</Label>
              <Input
                id="evidenceType"
                value={caseDetails.evidenceType}
                onChange={(e) => updateField("evidenceType", e.target.value)}
                placeholder="Type of evidence"
                className="bg-slate-800 border-slate-600"
              />
            </div>
          </div>

          {/* Additional Details */}
          <div className="md:col-span-2 space-y-4">
            <h3 className="font-semibold text-sm text-cyan-400">
              Additional Information
            </h3>

            <div className="space-y-2">
              <Label htmlFor="description">Case Description</Label>
              <Textarea
                id="description"
                value={caseDetails.description}
                onChange={(e) => updateField("description", e.target.value)}
                placeholder="Brief description of the case..."
                className="bg-slate-800 border-slate-600 min-h-[80px]"
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="suspects">Suspects (if any)</Label>
                <Textarea
                  id="suspects"
                  value={caseDetails.suspects}
                  onChange={(e) => updateField("suspects", e.target.value)}
                  placeholder="List of suspects..."
                  className="bg-slate-800 border-slate-600 min-h-[60px]"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="witnesses">Witnesses (if any)</Label>
                <Textarea
                  id="witnesses"
                  value={caseDetails.witnesses}
                  onChange={(e) => updateField("witnesses", e.target.value)}
                  placeholder="List of witnesses..."
                  className="bg-slate-800 border-slate-600 min-h-[60px]"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="notes">Additional Notes</Label>
              <Textarea
                id="notes"
                value={caseDetails.notes}
                onChange={(e) => updateField("notes", e.target.value)}
                placeholder="Any additional notes or observations..."
                className="bg-slate-800 border-slate-600 min-h-[80px]"
              />
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            onClick={handleSave}
            className="bg-cyan-600 hover:bg-cyan-700"
          >
            Save Case File
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
