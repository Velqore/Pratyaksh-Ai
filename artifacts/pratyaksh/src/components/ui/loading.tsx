import React from 'react';
import { cn } from '@/lib/utils';
import { Loader2, Brain, Cpu, Search } from 'lucide-react';

interface LoadingProps {
  className?: string;
  size?: 'sm' | 'md' | 'lg';
  type?: 'spinner' | 'dots' | 'pulse' | 'forensic';
  text?: string;
}

export function Loading({ 
  className, 
  size = 'md', 
  type = 'forensic', 
  text 
}: LoadingProps) {
  const sizeClasses = {
    sm: 'w-4 h-4',
    md: 'w-6 h-6',
    lg: 'w-8 h-8'
  };

  const textSizeClasses = {
    sm: 'text-sm',
    md: 'text-base',
    lg: 'text-lg'
  };

  if (type === 'spinner') {
    return (
      <div className={cn("flex items-center gap-2", className)}>
        <Loader2 className={cn("animate-spin text-forensic-accent", sizeClasses[size])} />
        {text && (
          <span className={cn("text-forensic-text-secondary", textSizeClasses[size])}>
            {text}
          </span>
        )}
      </div>
    );
  }

  if (type === 'dots') {
    return (
      <div className={cn("flex items-center gap-2", className)}>
        <div className="flex gap-1">
          <div className="w-2 h-2 bg-forensic-accent rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
          <div className="w-2 h-2 bg-forensic-accent rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
          <div className="w-2 h-2 bg-forensic-accent rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
        </div>
        {text && (
          <span className={cn("text-forensic-text-secondary", textSizeClasses[size])}>
            {text}
          </span>
        )}
      </div>
    );
  }

  if (type === 'pulse') {
    return (
      <div className={cn("flex items-center gap-2", className)}>
        <div className={cn(
          "bg-forensic-accent rounded-full animate-pulse",
          sizeClasses[size]
        )} />
        {text && (
          <span className={cn("text-forensic-text-secondary", textSizeClasses[size])}>
            {text}
          </span>
        )}
      </div>
    );
  }

  // Forensic AI themed loading
  return (
    <div className={cn("flex flex-col items-center gap-3", className)}>
      <div className="relative">
        <div className={cn(
          "bg-gradient-to-br from-forensic-primary to-forensic-accent rounded-full flex items-center justify-center",
          size === 'sm' ? 'w-8 h-8' : size === 'md' ? 'w-12 h-12' : 'w-16 h-16'
        )}>
          <Brain className={cn("text-white", sizeClasses[size])} />
        </div>
        <div className="absolute inset-0 rounded-full animate-ping bg-forensic-accent/30" />
      </div>
      {text && (
        <div className="text-center">
          <div className={cn("text-forensic-text font-medium", textSizeClasses[size])}>
            {text}
          </div>
          <div className="text-xs text-forensic-text-muted">
            Pratyaksh AI Analysis
          </div>
        </div>
      )}
    </div>
  );
}

interface PageLoadingProps {
  message?: string;
}

export function PageLoading({ message = "Loading Forensic Analysis System..." }: PageLoadingProps) {
  return (
    <div className="min-h-screen bg-gradient-to-br from-forensic-dark via-forensic-dark-secondary to-forensic-surface flex items-center justify-center">
      <div className="text-center">
        <Loading type="forensic" size="lg" text={message} />
        <div className="mt-6 space-y-2">
          <div className="w-64 h-2 bg-forensic-surface rounded-full overflow-hidden">
            <div className="h-full bg-gradient-to-r from-forensic-primary to-forensic-accent rounded-full animate-pulse" />
          </div>
          <p className="text-xs text-forensic-text-muted">
            Initializing AI algorithms...
          </p>
        </div>
      </div>
    </div>
  );
}

interface AnalysisLoadingProps {
  step?: string;
  progress?: number;
}

export function AnalysisLoading({ 
  step = "Processing evidence...", 
  progress = 0 
}: AnalysisLoadingProps) {
  const steps = [
    "Initializing analysis protocols",
    "Preprocessing evidence data", 
    "Extracting forensic features",
    "Running AI pattern recognition",
    "Cross-referencing databases",
    "Generating expert analysis",
    "Finalizing results"
  ];

  const currentStepIndex = Math.floor((progress / 100) * steps.length);
  const currentStep = steps[currentStepIndex] || step;

  return (
    <div className="flex items-center gap-4 p-4 bg-forensic-surface/30 rounded-lg border border-forensic-border">
      <div className="relative">
        <div className="w-10 h-10 bg-gradient-to-br from-forensic-accent to-forensic-secondary rounded-full flex items-center justify-center animate-pulse">
          <Cpu className="w-5 h-5 text-white animate-spin" />
        </div>
        <div className="absolute inset-0 rounded-full animate-ping bg-forensic-accent/20" />
      </div>
      <div className="flex-1">
        <div className="text-sm font-medium text-forensic-text mb-1">
          Pratyaksh AI Analysis
        </div>
        <div className="text-xs text-forensic-text-secondary mb-2">
          {currentStep}
        </div>
        {progress > 0 && (
          <div className="w-full h-1.5 bg-forensic-surface rounded-full overflow-hidden">
            <div 
              className="h-full bg-gradient-to-r from-forensic-primary to-forensic-accent rounded-full transition-all duration-300"
              style={{ width: `${progress}%` }}
            />
          </div>
        )}
      </div>
    </div>
  );
}
