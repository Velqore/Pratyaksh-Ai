import React from "react";
import { cn } from "@/lib/utils";

interface PratyakshLogoProps {
  className?: string;
  size?: "sm" | "md" | "lg" | "xl";
  animated?: boolean;
}

export function PratyakshLogo({
  className,
  size = "md",
  animated = true,
}: PratyakshLogoProps) {
  const sizeClasses = {
    sm: "w-8 h-8",
    md: "w-12 h-12",
    lg: "w-16 h-16",
    xl: "w-24 h-24",
  };

  const textSizeClasses = {
    sm: "text-sm",
    md: "text-lg",
    lg: "text-2xl",
    xl: "text-4xl",
  };

  const iconSizes = {
    sm: "w-6 h-6",
    md: "w-10 h-10",
    lg: "w-14 h-14",
    xl: "w-20 h-20",
  };

  return (
    <div className={cn("flex items-center gap-3", className)}>
      <div
        className={cn(
          "relative flex items-center justify-center",
          sizeClasses[size],
        )}
      >
        {/* Enhanced Aesthetic Animated Logo */}
        <div className={cn("relative", sizeClasses[size])}>
          {/* Outer Glow Ring */}
          {animated && (
            <div className="absolute inset-0 -z-10">
              <div className="absolute inset-0 bg-gradient-to-r from-cyan-500/30 via-purple-500/30 to-blue-500/30 rounded-full blur-xl animate-pulse-slow"></div>
              <div className="absolute inset-0 bg-gradient-to-r from-blue-500/20 via-cyan-500/20 to-purple-500/20 rounded-full blur-2xl animate-pulse-slower"></div>
            </div>
          )}

          {/* Main Logo Container with Glass Morphism */}
          <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-white/10 via-white/5 to-transparent backdrop-blur-sm border border-white/20 p-0.5 shadow-2xl">
            {/* Inner Container with Neural Network Effect */}
            <div className="relative rounded-2xl bg-gradient-to-br from-gray-900/95 via-slate-800/95 to-gray-900/95 h-full w-full flex items-center justify-center overflow-hidden">
              {/* Dynamic Background Grid */}
              {animated && (
                <div className="absolute inset-0 opacity-20">
                  <div className="absolute inset-0 bg-gradient-to-r from-transparent via-cyan-500/10 to-transparent animate-slide-right"></div>
                  <div className="absolute inset-0 bg-gradient-to-b from-transparent via-purple-500/10 to-transparent animate-slide-down"></div>
                </div>
              )}

              {/* Floating Particles with Advanced Animation */}
              {animated && (
                <>
                  {Array.from({ length: 8 }).map((_, i) => (
                    <div
                      key={i}
                      className="absolute rounded-full bg-gradient-to-r from-cyan-400 to-blue-500 opacity-60 animate-float-enhanced"
                      style={{
                        width: `${2 + Math.sin(i) * 1}px`,
                        height: `${2 + Math.sin(i) * 1}px`,
                        left: `${15 + i * 10}%`,
                        top: `${20 + Math.cos(i) * 15}%`,
                        animationDelay: `${i * 0.7}s`,
                        animationDuration: `${4 + i * 0.3}s`,
                        filter: "drop-shadow(0 0 2px currentColor)",
                      }}
                    />
                  ))}

                  {/* Neural Connection Lines */}
                  {Array.from({ length: 3 }).map((_, i) => (
                    <div
                      key={`line-${i}`}
                      className="absolute bg-gradient-to-r from-transparent via-cyan-400/30 to-transparent animate-pulse-connection"
                      style={{
                        width: "60%",
                        height: "1px",
                        left: "20%",
                        top: `${30 + i * 20}%`,
                        transform: `rotate(${i * 45}deg)`,
                        animationDelay: `${i * 1.2}s`,
                        animationDuration: "3s",
                      }}
                    />
                  ))}
                </>
              )}

              {/* Main Logo Symbol with Enhanced Design */}
              <div className="relative z-10">
                <svg viewBox="0 0 120 120" className={cn(iconSizes[size])}>
                  {/* Outer Rotating Ring with Segments */}
                  <circle
                    cx="60"
                    cy="60"
                    r="50"
                    fill="none"
                    stroke="url(#outerRing)"
                    strokeWidth="2"
                    strokeDasharray="8 4"
                    className={animated ? "animate-spin-slow" : ""}
                    style={{
                      animationDuration: "20s",
                      filter: "drop-shadow(0 0 4px #06b6d4)",
                    }}
                  />

                  {/* Middle Ring Counter-Rotating */}
                  <circle
                    cx="60"
                    cy="60"
                    r="40"
                    fill="none"
                    stroke="url(#middleRing)"
                    strokeWidth="1.5"
                    strokeDasharray="12 3"
                    className={animated ? "animate-spin-reverse" : ""}
                    style={{
                      animationDuration: "15s",
                      filter: "drop-shadow(0 0 2px #8b5cf6)",
                    }}
                  />

                  {/* Inner Core Ring */}
                  <circle
                    cx="60"
                    cy="60"
                    r="30"
                    fill="none"
                    stroke="url(#innerRing)"
                    strokeWidth="1"
                    strokeDasharray="6 2"
                    className={animated ? "animate-spin-slow" : ""}
                    style={{
                      animationDuration: "10s",
                      filter: "drop-shadow(0 0 3px #3b82f6)",
                    }}
                  />

                  {/* Central Hexagonal Core */}
                  <polygon
                    points="60,25 80,40 80,80 60,95 40,80 40,40"
                    fill="url(#coreGradient)"
                    stroke="url(#coreStroke)"
                    strokeWidth="1"
                    className={animated ? "animate-pulse-glow" : ""}
                    style={{
                      animationDuration: "4s",
                      filter: "drop-shadow(0 0 8px #4f46e5)",
                    }}
                  />

                  {/* Enhanced P Symbol */}
                  <text
                    x="60"
                    y="70"
                    textAnchor="middle"
                    className="fill-white text-4xl font-bold"
                    style={{
                      fontFamily: "Inter, sans-serif",
                      filter: "drop-shadow(0 0 4px #ffffff)",
                    }}
                  >
                    P
                  </text>

                  {/* Corner Energy Nodes */}
                  <circle
                    cx="30"
                    cy="30"
                    r="3"
                    fill="#06b6d4"
                    className={animated ? "animate-pulse-node" : ""}
                    style={{ animationDelay: "0s" }}
                  />
                  <circle
                    cx="90"
                    cy="30"
                    r="3"
                    fill="#8b5cf6"
                    className={animated ? "animate-pulse-node" : ""}
                    style={{ animationDelay: "1s" }}
                  />
                  <circle
                    cx="90"
                    cy="90"
                    r="3"
                    fill="#3b82f6"
                    className={animated ? "animate-pulse-node" : ""}
                    style={{ animationDelay: "2s" }}
                  />
                  <circle
                    cx="30"
                    cy="90"
                    r="3"
                    fill="#06b6d4"
                    className={animated ? "animate-pulse-node" : ""}
                    style={{ animationDelay: "3s" }}
                  />

                  {/* Orbital Dots */}
                  {animated && (
                    <>
                      <circle r="2" fill="#00d4ff" className="animate-orbit">
                        <animateMotion dur="8s" repeatCount="indefinite">
                          <path d="M 60,10 A 50,50 0 1,1 60,10" />
                        </animateMotion>
                      </circle>
                      <circle r="1.5" fill="#ff00aa" className="animate-orbit">
                        <animateMotion dur="6s" repeatCount="indefinite">
                          <path d="M 60,20 A 40,40 0 1,0 60,20" />
                        </animateMotion>
                      </circle>
                    </>
                  )}

                  {/* Advanced Gradient Definitions */}
                  <defs>
                    <linearGradient
                      id="outerRing"
                      x1="0%"
                      y1="0%"
                      x2="100%"
                      y2="100%"
                    >
                      <stop offset="0%" stopColor="#06b6d4" stopOpacity="0.9">
                        {animated && (
                          <animate
                            attributeName="stop-opacity"
                            values="0.9;0.4;0.9"
                            dur="3s"
                            repeatCount="indefinite"
                          />
                        )}
                      </stop>
                      <stop offset="50%" stopColor="#8b5cf6" stopOpacity="0.7">
                        {animated && (
                          <animate
                            attributeName="stop-opacity"
                            values="0.7;1;0.7"
                            dur="3s"
                            repeatCount="indefinite"
                          />
                        )}
                      </stop>
                      <stop offset="100%" stopColor="#3b82f6" stopOpacity="0.9">
                        {animated && (
                          <animate
                            attributeName="stop-opacity"
                            values="0.9;0.4;0.9"
                            dur="3s"
                            repeatCount="indefinite"
                          />
                        )}
                      </stop>
                    </linearGradient>

                    <linearGradient
                      id="middleRing"
                      x1="0%"
                      y1="0%"
                      x2="100%"
                      y2="100%"
                    >
                      <stop offset="0%" stopColor="#8b5cf6" stopOpacity="0.8" />
                      <stop
                        offset="100%"
                        stopColor="#06b6d4"
                        stopOpacity="0.6"
                      />
                    </linearGradient>

                    <linearGradient
                      id="innerRing"
                      x1="0%"
                      y1="0%"
                      x2="100%"
                      y2="100%"
                    >
                      <stop offset="0%" stopColor="#3b82f6" stopOpacity="0.7" />
                      <stop
                        offset="100%"
                        stopColor="#06b6d4"
                        stopOpacity="0.5"
                      />
                    </linearGradient>

                    <radialGradient id="coreGradient" cx="50%" cy="50%" r="60%">
                      <stop offset="0%" stopColor="#4f46e5" stopOpacity="0.95">
                        {animated && (
                          <animate
                            attributeName="stop-opacity"
                            values="0.95;0.7;0.95"
                            dur="4s"
                            repeatCount="indefinite"
                          />
                        )}
                      </stop>
                      <stop offset="40%" stopColor="#7c3aed" stopOpacity="0.8">
                        {animated && (
                          <animate
                            attributeName="stop-opacity"
                            values="0.8;0.95;0.8"
                            dur="4s"
                            repeatCount="indefinite"
                          />
                        )}
                      </stop>
                      <stop offset="100%" stopColor="#0891b2" stopOpacity="0.6">
                        {animated && (
                          <animate
                            attributeName="stop-opacity"
                            values="0.6;0.9;0.6"
                            dur="4s"
                            repeatCount="indefinite"
                          />
                        )}
                      </stop>
                    </radialGradient>

                    <linearGradient
                      id="coreStroke"
                      x1="0%"
                      y1="0%"
                      x2="100%"
                      y2="100%"
                    >
                      <stop offset="0%" stopColor="#00d4ff" stopOpacity="0.8" />
                      <stop
                        offset="100%"
                        stopColor="#ff00aa"
                        stopOpacity="0.8"
                      />
                    </linearGradient>
                  </defs>
                </svg>
              </div>

              {/* Holographic Scan Line */}
              {animated && (
                <div className="absolute inset-0 rounded-2xl overflow-hidden">
                  <div className="absolute inset-0 bg-gradient-to-r from-transparent via-cyan-400/20 to-transparent w-full h-1 animate-scan-vertical"></div>
                  <div className="absolute inset-0 bg-gradient-to-b from-transparent via-purple-400/15 to-transparent w-1 h-full animate-scan-horizontal"></div>
                </div>
              )}
            </div>
          </div>

          {/* Enhanced Outer Glow Layers */}
          {animated && (
            <>
              <div className="absolute inset-0 -z-20 rounded-2xl">
                <div
                  className="absolute inset-0 bg-gradient-to-r from-cyan-500/10 via-purple-500/10 to-blue-500/10 rounded-2xl blur-xl animate-pulse-glow"
                  style={{ animationDuration: "6s" }}
                ></div>
              </div>
              <div className="absolute inset-0 -z-30 rounded-2xl">
                <div
                  className="absolute inset-0 bg-gradient-to-r from-blue-500/5 via-cyan-500/5 to-purple-500/5 rounded-2xl blur-2xl animate-pulse-ultra"
                  style={{ animationDuration: "8s" }}
                ></div>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Enhanced Text with Gradient Animation */}
      <div className="flex flex-col">
        <h1
          className={cn(
            "font-bold bg-gradient-to-r from-cyan-400 via-blue-500 to-purple-600 bg-clip-text text-transparent leading-tight",
            textSizeClasses[size],
            animated && "animate-gradient-shift",
          )}
          style={{
            backgroundSize: animated ? "200% 200%" : "100% 100%",
            filter: "drop-shadow(0 0 8px rgba(59, 130, 246, 0.3))",
          }}
        >
          Pratyaksh
        </h1>
      </div>
    </div>
  );
}

interface LogoIconProps {
  className?: string;
  size?: number;
  animated?: boolean;
}

export function LogoIcon({
  className,
  size = 24,
  animated = true,
}: LogoIconProps) {
  const iconSize = size * 0.8;

  return (
    <div
      className={cn("relative", className)}
      style={{ width: size, height: size }}
    >
      <div className="relative overflow-hidden rounded-xl bg-gradient-to-br from-white/10 via-white/5 to-transparent backdrop-blur-sm border border-white/20 p-0.5 h-full w-full shadow-lg">
        <div className="relative rounded-xl bg-gradient-to-br from-gray-900/95 via-slate-800/95 to-gray-900/95 h-full w-full flex items-center justify-center">
          <svg
            viewBox="0 0 100 100"
            style={{ width: iconSize, height: iconSize }}
          >
            <circle
              cx="50"
              cy="50"
              r="35"
              fill="none"
              stroke="url(#miniGradient)"
              strokeWidth="3"
              strokeDasharray="8 4"
              className={animated ? "animate-spin" : ""}
              style={{ animationDuration: "15s" }}
            />
            <polygon
              points="50,25 65,40 65,60 50,75 35,60 35,40"
              fill="url(#miniGradient2)"
              className={animated ? "animate-pulse" : ""}
            />
            <text
              x="50"
              y="58"
              textAnchor="middle"
              className="fill-white text-2xl font-bold"
              style={{ filter: "drop-shadow(0 0 2px #ffffff)" }}
            >
              P
            </text>
            <defs>
              <linearGradient
                id="miniGradient"
                x1="0%"
                y1="0%"
                x2="100%"
                y2="100%"
              >
                <stop offset="0%" stopColor="#06b6d4" />
                <stop offset="100%" stopColor="#8b5cf6" />
              </linearGradient>
              <radialGradient id="miniGradient2" cx="50%" cy="50%" r="50%">
                <stop offset="0%" stopColor="#4f46e5" />
                <stop offset="100%" stopColor="#0891b2" />
              </radialGradient>
            </defs>
          </svg>
        </div>
      </div>
    </div>
  );
}
