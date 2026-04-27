import React from "react";
import { cn } from "@/lib/utils";

interface PratyakshLogoProps {
  size?: "sm" | "md" | "lg" | "xl";
  variant?: "default" | "minimal" | "icon-only" | "text-only";
  animated?: boolean;
  className?: string;
}

export function PratyakshLogoEnhanced({
  size = "md",
  variant = "default",
  animated = false,
  className,
}: PratyakshLogoProps) {
  const sizeClasses = {
    sm: "w-8 h-8",
    md: "w-12 h-12",
    lg: "w-16 h-16",
    xl: "w-24 h-24",
  };

  const textSizeClasses = {
    sm: "text-sm",
    md: "text-xl",
    lg: "text-2xl",
    xl: "text-4xl",
  };

  const iconSize = {
    sm: 32,
    md: 48,
    lg: 64,
    xl: 96,
  };

  const currentSize = iconSize[size];

  // Professional logo icon with forensic theme
  const LogoIcon = () => (
    <div
      className={cn(
        "relative flex items-center justify-center",
        sizeClasses[size],
        animated && "animate-pulse-glow",
      )}
    >
      {/* Outer ring with scanning effect */}
      <div
        className={cn(
          "absolute inset-0 rounded-full border-2 border-cyan-400/60",
          animated && "animate-spin-slow",
        )}
      >
        {/* Scanning dots */}
        <div className="absolute -top-1 left-1/2 w-2 h-2 bg-cyan-400 rounded-full transform -translate-x-1/2 animate-pulse" />
        <div className="absolute top-1/2 -right-1 w-2 h-2 bg-cyan-400 rounded-full transform -translate-y-1/2 animate-pulse delay-100" />
        <div className="absolute -bottom-1 left-1/2 w-2 h-2 bg-cyan-400 rounded-full transform -translate-x-1/2 animate-pulse delay-200" />
        <div className="absolute top-1/2 -left-1 w-2 h-2 bg-cyan-400 rounded-full transform -translate-y-1/2 animate-pulse delay-300" />
      </div>

      {/* Main logo content */}
      <svg
        width={currentSize}
        height={currentSize}
        viewBox="0 0 100 100"
        className="relative z-10"
      >
        {/* Central fingerprint-inspired design */}
        <defs>
          <radialGradient id="centerGradient" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#00ffff" stopOpacity="0.8" />
            <stop offset="100%" stopColor="#0080ff" stopOpacity="0.4" />
          </radialGradient>
          <linearGradient
            id="ridgeGradient"
            x1="0%"
            y1="0%"
            x2="100%"
            y2="100%"
          >
            <stop offset="0%" stopColor="#00ffff" />
            <stop offset="50%" stopColor="#0080ff" />
            <stop offset="100%" stopColor="#004080" />
          </linearGradient>
        </defs>

        {/* Ridge patterns (fingerprint inspired) */}
        <g
          stroke="url(#ridgeGradient)"
          strokeWidth="1"
          fill="none"
          className={animated ? "animate-pulse-slow" : ""}
        >
          <ellipse cx="50" cy="50" rx="15" ry="10" />
          <ellipse cx="50" cy="50" rx="22" ry="16" />
          <ellipse cx="50" cy="50" rx="29" ry="22" />
          <ellipse cx="50" cy="50" rx="36" ry="28" />
        </g>

        {/* Central hub */}
        <circle
          cx="50"
          cy="50"
          r="8"
          fill="url(#centerGradient)"
          className={animated ? "animate-pulse-node" : ""}
        />

        {/* Data points */}
        <g
          fill="#00ffff"
          className={animated ? "animate-pulse-connection" : ""}
        >
          <circle cx="35" cy="35" r="2" />
          <circle cx="65" cy="35" r="2" />
          <circle cx="35" cy="65" r="2" />
          <circle cx="65" cy="65" r="2" />
        </g>

        {/* Connection lines */}
        <g
          stroke="#00ffff"
          strokeWidth="0.5"
          opacity="0.6"
          className={animated ? "animate-pulse-connection" : ""}
        >
          <line x1="35" y1="35" x2="50" y2="50" />
          <line x1="65" y1="35" x2="50" y2="50" />
          <line x1="35" y1="65" x2="50" y2="50" />
          <line x1="65" y1="65" x2="50" y2="50" />
        </g>

        {/* Scanner overlay */}
        {animated && (
          <rect
            x="0"
            y="0"
            width="100"
            height="2"
            fill="url(#ridgeGradient)"
            opacity="0.8"
            className="animate-scan-vertical"
          />
        )}
      </svg>

      {/* Subtle glow effect */}
      <div
        className={cn(
          "absolute inset-0 rounded-full bg-cyan-400/10 blur-sm",
          animated && "animate-pulse-ultra",
        )}
      />
    </div>
  );

  const LogoText = ({ isSubtle = false }: { isSubtle?: boolean }) => (
    <div className={cn("flex flex-col items-start", isSubtle && "opacity-80")}>
      <div
        className={cn(
          "font-bold tracking-wider text-cyan-400",
          textSizeClasses[size],
          animated &&
            "animate-gradient-shift bg-gradient-to-r from-cyan-400 via-blue-400 to-cyan-400 bg-clip-text text-transparent bg-[length:200%_100%]",
        )}
      >
        PRATYAKSH
      </div>
      {size !== "sm" && (
        <div
          className={cn(
            "text-gray-400 tracking-wide font-medium",
            size === "md" ? "text-xs" : size === "lg" ? "text-sm" : "text-base",
          )}
        >
          FORENSIC AI
        </div>
      )}
    </div>
  );

  if (variant === "icon-only") {
    return (
      <div className={cn("flex items-center", className)}>
        <LogoIcon />
      </div>
    );
  }

  if (variant === "text-only") {
    return (
      <div className={cn("flex items-center", className)}>
        <LogoText />
      </div>
    );
  }

  if (variant === "minimal") {
    return (
      <div className={cn("flex items-center gap-3", className)}>
        <div
          className={cn(
            "w-8 h-8 rounded-full bg-gradient-to-br from-cyan-400 to-blue-600 flex items-center justify-center",
            animated && "animate-pulse-glow",
          )}
        >
          <div className="w-3 h-3 rounded-full bg-white/80" />
        </div>
        <LogoText isSubtle />
      </div>
    );
  }

  // Default variant
  return (
    <div className={cn("flex items-center gap-4", className)}>
      <LogoIcon />
      <LogoText />
    </div>
  );
}

// Compact header version
export function PratyakshHeaderLogo({ className }: { className?: string }) {
  return (
    <PratyakshLogoEnhanced
      size="sm"
      variant="minimal"
      animated={false}
      className={className}
    />
  );
}

// Loading/scanning version
export function PratyakshLoadingLogo({ className }: { className?: string }) {
  return (
    <div className={cn("flex flex-col items-center space-y-3", className)}>
      <PratyakshLogoEnhanced size="lg" variant="icon-only" animated={true} />
      <div className="text-cyan-400 text-sm font-medium animate-pulse">
        Analyzing Evidence...
      </div>
    </div>
  );
}

// Full brand version for dashboards
export function PratyakshBrandLogo({ className }: { className?: string }) {
  return (
    <div className={cn("flex flex-col items-center space-y-2", className)}>
      <PratyakshLogoEnhanced size="xl" variant="default" animated={true} />
      <div className="text-center">
        <div className="text-gray-400 text-sm">Advanced AI-Powered</div>
        <div className="text-gray-400 text-sm">Forensic Analysis System</div>
      </div>
    </div>
  );
}
