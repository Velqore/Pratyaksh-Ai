import "./global.css";

import { Toaster } from "@/components/ui/toaster";
import { createRoot } from "react-dom/client";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { ErrorBoundary } from "@/components/ui/error-boundary";
import Index from "./pages/Index";
import NotFound from "./pages/NotFound";
import FingerprintDepartment from "./pages/FingerprintDepartment";
import CyberDepartment from "./pages/CyberDepartment";
import DocumentsDepartment from "./pages/DocumentsDepartment";
import UserDashboard from "./pages/UserDashboard";
import { useEffect } from "react";

// Force dark mode immediately
if (typeof document !== "undefined") {
  document.documentElement.classList.add("dark");
  document.body.classList.add("dark");
}

// Extend Window interface for root tracking
declare global {
  interface Window {
    __PRATYAKSH_ROOT__?: ReturnType<typeof createRoot>;
  }
}

const queryClient = new QueryClient();

const App = () => {
  // Ensure dark mode is always active
  useEffect(() => {
    document.documentElement.classList.add("dark");
    document.body.classList.add("dark");

    // Monitor for changes and force dark mode
    const observer = new MutationObserver(() => {
      if (!document.documentElement.classList.contains("dark")) {
        document.documentElement.classList.add("dark");
      }
      if (!document.body.classList.contains("dark")) {
        document.body.classList.add("dark");
      }
    });

    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["class"],
    });

    return () => observer.disconnect();
  }, []);

  return (
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <TooltipProvider>
          <Toaster />
          <Sonner />
          <BrowserRouter>
            <Routes>
              <Route path="/" element={<Index />} />
              <Route path="/fingerprint" element={<FingerprintDepartment />} />
              <Route path="/cyber" element={<CyberDepartment />} />
              <Route path="/documents" element={<DocumentsDepartment />} />
              <Route path="/dashboard" element={<UserDashboard />} />
              {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
              <Route path="*" element={<NotFound />} />
            </Routes>
          </BrowserRouter>
        </TooltipProvider>
      </QueryClientProvider>
    </ErrorBoundary>
  );
};

// Ensure createRoot is only called once
const container = document.getElementById("root")!;
let root: ReturnType<typeof createRoot>;

try {
  if (!window.__PRATYAKSH_ROOT__) {
    root = createRoot(container);
    window.__PRATYAKSH_ROOT__ = root;
  } else {
    root = window.__PRATYAKSH_ROOT__;
  }

  root.render(<App />);
} catch (error) {
  console.error("Failed to render Pratyaksh application:", error);
  // Fallback: Clear and create new root
  container.innerHTML = "";
  root = createRoot(container);
  window.__PRATYAKSH_ROOT__ = root;
  root.render(<App />);
}
