import { Link } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { PratyakshLogo } from "@/components/ui/pratyaksh-logo";
import { cn } from "@/lib/utils";

export type LabAccent = "cyber" | "documents" | "fingerprint";

interface LabHeaderProps {
  accent: LabAccent;
  Icon: LucideIcon;
  title: string;
  subtitle: string;
  accuracyLabel: string;
  maxWidth?: "6xl" | "7xl";
}

const ACCENT_STYLES: Record<
  LabAccent,
  {
    iconBg: string;
    badge: string;
    ring: string;
  }
> = {
  cyber: {
    iconBg: "bg-gradient-to-br from-purple-500 to-purple-700",
    badge:
      "bg-purple-100 text-purple-800 dark:bg-purple-900/40 dark:text-purple-200 border border-purple-200/50 dark:border-purple-700/40",
    ring: "ring-1 ring-purple-500/30 shadow-[0_0_24px_-8px_rgba(168,85,247,0.55)]",
  },
  documents: {
    iconBg: "bg-gradient-to-br from-emerald-500 to-emerald-700",
    badge:
      "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-200 border border-emerald-200/50 dark:border-emerald-700/40",
    ring: "ring-1 ring-emerald-500/30 shadow-[0_0_24px_-8px_rgba(16,185,129,0.55)]",
  },
  fingerprint: {
    iconBg: "bg-gradient-to-br from-cyan-500 to-cyan-700",
    badge:
      "bg-cyan-100 text-cyan-800 dark:bg-cyan-900/40 dark:text-cyan-200 border border-cyan-200/50 dark:border-cyan-700/40",
    ring: "ring-1 ring-cyan-500/30 shadow-[0_0_24px_-8px_rgba(6,182,212,0.55)]",
  },
};

export function LabHeader({
  accent,
  Icon,
  title,
  subtitle,
  accuracyLabel,
  maxWidth = "7xl",
}: LabHeaderProps) {
  const styles = ACCENT_STYLES[accent];
  const widthClass = maxWidth === "7xl" ? "max-w-7xl" : "max-w-6xl";

  return (
    <header
      className={cn(
        "sticky top-0 z-40 border-b border-gray-200/70 dark:border-gray-800/70",
        "bg-white/70 dark:bg-gray-950/70 backdrop-blur-xl",
        "supports-[backdrop-filter]:bg-white/60 supports-[backdrop-filter]:dark:bg-gray-950/60",
        "transition-shadow",
      )}
    >
      <div className={cn(widthClass, "mx-auto px-4 py-3")}>
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <Button
              asChild
              variant="ghost"
              size="sm"
              className="shrink-0 text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white transition-colors"
            >
              <Link to="/" aria-label="Back to Console">
                <ArrowLeft className="w-4 h-4 mr-2" aria-hidden="true" />
                <span className="hidden sm:inline">Back to Console</span>
              </Link>
            </Button>
            <div className="flex items-center gap-3 min-w-0">
              <div
                className={cn(
                  "p-2 rounded-xl text-white shrink-0 transition-transform duration-300 hover:scale-105",
                  styles.iconBg,
                  styles.ring,
                )}
              >
                <Icon className="w-5 h-5" />
              </div>
              <div className="min-w-0">
                <h1 className="text-lg sm:text-xl font-bold text-gray-900 dark:text-white tracking-tight truncate">
                  {title}
                </h1>
                <p className="text-xs sm:text-sm text-gray-600 dark:text-gray-400 truncate">
                  {subtitle}
                </p>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-3 shrink-0">
            <Badge
              variant="secondary"
              className={cn(
                "hidden sm:inline-flex font-semibold tracking-wide",
                styles.badge,
              )}
            >
              {accuracyLabel}
            </Badge>
            <PratyakshLogo size="sm" />
          </div>
        </div>
      </div>
    </header>
  );
}
