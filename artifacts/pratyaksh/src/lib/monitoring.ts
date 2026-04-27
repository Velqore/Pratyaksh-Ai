// Error Monitoring and Logging Integration
// Supports Honeybadger, Sentry, and custom logging

interface MonitoringConfig {
  honeybadgerApiKey?: string;
  sentryDsn?: string;
  environment: string;
  userId?: string;
  userEmail?: string;
  customEndpoint?: string;
}

interface ErrorContext {
  user?: {
    id: string;
    email: string;
    department?: string;
  };
  request?: {
    url: string;
    method: string;
    userAgent: string;
  };
  forensics?: {
    caseId?: string;
    analysisType?: string;
    fileType?: string;
  };
  authentication?: {
    action: string;
    identifier?: string;
    otpType?: string;
  };
  component?: string;
  action?: string;
  severity?: "low" | "normal" | "high" | "critical";
}

class MonitoringService {
  private config: MonitoringConfig;
  private initialized = false;

  constructor(config: MonitoringConfig) {
    this.config = config;
    this.initialize();
  }

  private async initialize() {
    try {
      // Initialize Honeybadger if available
      if (this.config.honeybadgerApiKey && typeof window !== "undefined") {
        await this.initializeHoneybadger();
      }

      // Initialize Sentry if available
      if (this.config.sentryDsn) {
        await this.initializeSentry();
      }

      this.initialized = true;
      console.log("Monitoring service initialized");
    } catch (error) {
      console.error("Failed to initialize monitoring:", error);
    }
  }

  private async initializeHoneybadger() {
    try {
      // Load Honeybadger script if not already loaded
      if (!(window as any).Honeybadger) {
        const script = document.createElement("script");
        script.src = "https://js.honeybadger.io/v6.9/honeybadger.min.js";
        script.crossOrigin = "anonymous";
        document.head.appendChild(script);

        await new Promise((resolve, reject) => {
          script.onload = resolve;
          script.onerror = (event) => {
            const errorMessage =
              event instanceof Event
                ? "Failed to load Honeybadger script"
                : String(event);
            reject(new Error(errorMessage));
          };
          setTimeout(
            () => reject(new Error("Honeybadger script load timeout")),
            10000,
          ); // 10 second timeout
        });
      }

      // Configure Honeybadger
      (window as any).Honeybadger.configure({
        apiKey: this.config.honeybadgerApiKey,
        environment: this.config.environment,
        revision: "production",
        reportData: true,
        enableUncaught: true,
        enableUnhandledRejection: true,
        beforeNotify: (notice: any) => {
          // Add context to all errors
          notice.context = {
            ...notice.context,
            application: "Pratyaksh Forensic AI",
            userAgent: navigator.userAgent,
            timestamp: new Date().toISOString(),
            url: window.location.href,
          };
          return true;
        },
      });

      // Set user context if available
      if (this.config.userId) {
        (window as any).Honeybadger.setContext({
          user_id: this.config.userId,
          user_email: this.config.userEmail,
        });
      }

      console.log("Honeybadger initialized successfully");
    } catch (error) {
      console.error("Failed to initialize Honeybadger:", error);
    }
  }

  private async initializeSentry() {
    try {
      // This would integrate with Sentry SDK
      // Implementation depends on your Sentry setup
      console.log("Sentry monitoring ready");
    } catch (error) {
      console.error("Failed to initialize Sentry:", error);
    }
  }

  // Update user context
  setUserContext(user: { id: string; email: string; department?: string }) {
    this.config.userId = user.id;
    this.config.userEmail = user.email;

    if (typeof window !== "undefined" && (window as any).Honeybadger) {
      (window as any).Honeybadger.setContext({
        user_id: user.id,
        user_email: user.email,
        user_department: user.department,
      });
    }
  }

  // Clear user context on logout
  clearUserContext() {
    this.config.userId = undefined;
    this.config.userEmail = undefined;

    if (typeof window !== "undefined" && (window as any).Honeybadger) {
      (window as any).Honeybadger.resetContext();
    }
  }

  // Log authentication events
  logAuthEvent(
    action: string,
    success: boolean,
    context?: ErrorContext["authentication"],
  ) {
    const logData = {
      event: "authentication",
      action,
      success,
      timestamp: new Date().toISOString(),
      ...context,
    };

    if (success) {
      console.log("Auth Success:", logData);
    } else {
      console.warn("Auth Failure:", logData);
      this.notifyError(new Error(`Authentication failed: ${action}`), {
        authentication: { action, ...context },
        severity: "normal",
      });
    }
  }

  // Log forensic analysis events
  logForensicEvent(
    caseId: string,
    analysisType: string,
    success: boolean,
    metadata?: any,
  ) {
    const logData = {
      event: "forensic_analysis",
      caseId,
      analysisType,
      success,
      timestamp: new Date().toISOString(),
      ...metadata,
    };

    if (success) {
      console.log("Forensic Analysis:", logData);
    } else {
      console.error("Forensic Analysis Failed:", logData);
      this.notifyError(new Error(`Forensic analysis failed: ${analysisType}`), {
        forensics: { caseId, analysisType },
        severity: "high",
      });
    }
  }

  // Log performance metrics
  logPerformance(action: string, duration: number, metadata?: any) {
    const logData = {
      event: "performance",
      action,
      duration,
      timestamp: new Date().toISOString(),
      ...metadata,
    };

    console.log("Performance Metric:", logData);

    // Alert on slow operations
    if (duration > 5000) {
      // 5 seconds
      this.notifyError(new Error(`Slow operation detected: ${action}`), {
        component: "performance",
        action,
        severity: "normal",
      });
    }
  }

  // Log API errors
  logAPIError(
    endpoint: string,
    status: number,
    error: any,
    context?: ErrorContext,
  ) {
    // Properly extract error information
    let errorMessage: string;
    let errorStack: string | undefined;
    let errorName: string | undefined;

    if (error instanceof Error) {
      errorMessage = error.message;
      errorStack = error.stack;
      errorName = error.name;
    } else if (error && typeof error === "object") {
      // Handle complex error objects
      if (error.message) {
        errorMessage = String(error.message);
      } else if (error.error) {
        errorMessage = String(error.error);
      } else if (
        error.toString &&
        typeof error.toString === "function" &&
        error.toString() !== "[object Object]"
      ) {
        errorMessage = error.toString();
      } else {
        try {
          // Try to extract meaningful properties
          const errorKeys = Object.keys(error);
          if (errorKeys.length > 0) {
            const relevantProps = errorKeys.filter((key) =>
              ["message", "error", "description", "details", "reason"].includes(
                key,
              ),
            );
            if (relevantProps.length > 0) {
              errorMessage = relevantProps
                .map((key) => `${key}: ${error[key]}`)
                .join(", ");
            } else {
              errorMessage = JSON.stringify(error);
            }
          } else {
            errorMessage = "Unknown error object";
          }
        } catch (stringifyError) {
          errorMessage = "Error object (unable to serialize)";
        }
      }
      errorStack = error.stack;
      errorName = error.name;
    } else {
      errorMessage = String(error);
    }

    const errorData = {
      event: "api_error",
      endpoint,
      status,
      error: {
        message: errorMessage,
        name: errorName,
        stack: errorStack,
      },
      timestamp: new Date().toISOString(),
      ...context,
    };

    console.error("API Error:", errorData);

    // Create a proper Error object for monitoring
    const monitoringError = new Error(
      `API Error: ${endpoint} (${status}) - ${errorMessage}`,
    );
    if (errorStack) {
      monitoringError.stack = errorStack;
    }
    if (errorName) {
      monitoringError.name = errorName;
    }

    this.notifyError(monitoringError, {
      request: {
        url: endpoint,
        method: "unknown",
        userAgent: navigator.userAgent,
      },
      severity: status >= 500 ? "high" : "normal",
      ...context,
    });
  }

  // Send custom error to monitoring service
  notifyError(error: Error, context?: ErrorContext) {
    try {
      // Add default context
      const fullContext = {
        timestamp: new Date().toISOString(),
        url: window.location.href,
        userAgent: navigator.userAgent,
        ...context,
      };

      // Send to Honeybadger if available
      if (typeof window !== "undefined" && (window as any).Honeybadger) {
        (window as any).Honeybadger.notify(error, {
          context: fullContext,
          fingerprint: context?.component
            ? `${context.component}_${error.message}`
            : undefined,
        });
      }

      // Send to custom endpoint if configured
      if (
        this.config.customEndpoint &&
        this.config.environment === "production"
      ) {
        this.sendToCustomEndpoint(error, fullContext);
      }

      // Log to console for development
      if (this.config.environment === "development") {
        console.error("Monitored Error:", error, fullContext);
      }
    } catch (monitoringError) {
      console.error(
        "Failed to send error to monitoring service:",
        monitoringError,
      );
    }
  }

  private async sendToCustomEndpoint(error: Error, context: any) {
    try {
      await fetch(this.config.customEndpoint!, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          error: {
            message: error.message,
            stack: error.stack,
            name: error.name,
          },
          context,
          timestamp: new Date().toISOString(),
        }),
      });
    } catch (error) {
      console.error("Failed to send to custom monitoring endpoint:", error);
    }
  }

  // Log user actions for analytics
  logUserAction(action: string, component: string, metadata?: any) {
    const logData = {
      event: "user_action",
      action,
      component,
      timestamp: new Date().toISOString(),
      userId: this.config.userId,
      ...metadata,
    };

    console.log("User Action:", logData);

    // Send to analytics if configured
    if (
      this.config.customEndpoint &&
      this.config.environment === "production"
    ) {
      this.sendAnalytics(logData);
    }
  }

  private async sendAnalytics(data: any) {
    try {
      await fetch(`${this.config.customEndpoint}/analytics`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(data),
      });
    } catch (error) {
      console.error("Failed to send analytics:", error);
    }
  }

  // Check monitoring service health
  getStatus() {
    return {
      initialized: this.initialized,
      honeybadgerAvailable:
        typeof window !== "undefined" && !!(window as any).Honeybadger,
      environment: this.config.environment,
      userId: this.config.userId,
    };
  }
}

// Create monitoring service instance
export const monitoringService = new MonitoringService({
  honeybadgerApiKey: import.meta.env.VITE_HONEYBADGER_API_KEY,
  sentryDsn: import.meta.env.VITE_SENTRY_DSN,
  environment: import.meta.env.MODE || "development",
  customEndpoint: import.meta.env.VITE_MONITORING_ENDPOINT,
});

// React hook for monitoring
export const useMonitoring = () => {
  const logError = (error: Error, context?: ErrorContext) => {
    monitoringService.notifyError(error, context);
  };

  const logAuthEvent = (
    action: string,
    success: boolean,
    context?: ErrorContext["authentication"],
  ) => {
    monitoringService.logAuthEvent(action, success, context);
  };

  const logForensicEvent = (
    caseId: string,
    analysisType: string,
    success: boolean,
    metadata?: any,
  ) => {
    monitoringService.logForensicEvent(caseId, analysisType, success, metadata);
  };

  const logUserAction = (action: string, component: string, metadata?: any) => {
    monitoringService.logUserAction(action, component, metadata);
  };

  const startPerformanceTimer = (action: string) => {
    const startTime = Date.now();
    return () => {
      const duration = Date.now() - startTime;
      monitoringService.logPerformance(action, duration);
    };
  };

  return {
    logError,
    logAuthEvent,
    logForensicEvent,
    logUserAction,
    startPerformanceTimer,
    setUserContext: monitoringService.setUserContext.bind(monitoringService),
    clearUserContext:
      monitoringService.clearUserContext.bind(monitoringService),
    getStatus: monitoringService.getStatus.bind(monitoringService),
  };
};

// Error boundary integration
export const withErrorMonitoring = (error: Error, errorInfo: any) => {
  monitoringService.notifyError(error, {
    component: "React Error Boundary",
    severity: "high",
    ...errorInfo,
  });
};

// Global error handlers
if (typeof window !== "undefined") {
  // Catch unhandled promise rejections
  window.addEventListener("unhandledrejection", (event) => {
    const errorMessage =
      event.reason instanceof Error
        ? event.reason.message
        : String(event.reason);

    monitoringService.notifyError(
      new Error(`Unhandled Promise Rejection: ${errorMessage}`),
      {
        component: "Promise Handler",
        severity: "high",
      },
    );

    // Forensic pipelines deliberately surface non-fatal failures (corrupt
    // images decoded by Tesseract, malformed PDFs parsed by pdf-lib, etc.) as
    // warnings — the analysis still completes and the UI still renders. We
    // log the rejection for monitoring above, but call preventDefault for a
    // *narrow*, well-known set of forensic worker errors so Vite's runtime
    // overlay does not block interaction. We deliberately do NOT swallow
    // generic network / decode messages from app code, only signatures that
    // come from known third-party workers (Tesseract, pdf-lib, libpng) or
    // from explicit forensic-pipeline tags.
    const stack =
      event.reason instanceof Error ? (event.reason.stack ?? "") : "";
    const fromForensicWorker =
      stack.includes("/forensics/") ||
      stack.includes("tesseract") ||
      stack.includes("pdf-lib");
    const knownForensicSignature =
      /^Error attempting to read image\.?$/i.test(errorMessage) ||
      /^Image file .* cannot be read/i.test(errorMessage) ||
      /^libpng error:/i.test(errorMessage) ||
      /SetImage Pix failed/i.test(errorMessage);
    if (
      (fromForensicWorker || knownForensicSignature) &&
      typeof event.preventDefault === "function"
    ) {
      event.preventDefault();
    }
  });

  // Catch uncaught exceptions
  window.addEventListener("error", (event) => {
    monitoringService.notifyError(event.error || new Error(event.message), {
      component: "Global Error Handler",
      severity: "high",
    });
  });

  // Network connection monitoring
  window.addEventListener("online", () => {
    console.log("Network connection restored");
  });

  window.addEventListener("offline", () => {
    monitoringService.notifyError(new Error("Network connection lost"), {
      component: "Network Monitor",
      severity: "normal",
    });
  });
}

export default monitoringService;
