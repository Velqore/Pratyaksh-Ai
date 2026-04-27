import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ErrorBoundary } from "@/components/ui/error-boundary";
import Index from "@/pages/Index";
import NotFound from "@/pages/NotFound";
import FingerprintDepartment from "@/pages/FingerprintDepartment";
import CyberDepartment from "@/pages/CyberDepartment";
import DocumentsDepartment from "@/pages/DocumentsDepartment";
import UserDashboard from "@/pages/UserDashboard";
import { useEffect } from "react";

if (typeof document !== "undefined") {
  document.documentElement.classList.add("dark");
  document.body.classList.add("dark");
}

const queryClient = new QueryClient();

const App = () => {
  useEffect(() => {
    document.documentElement.classList.add("dark");
    document.body.classList.add("dark");

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
          <BrowserRouter basename={import.meta.env.BASE_URL?.replace(/\/$/, "") || ""}>
            <Routes>
              <Route path="/" element={<Index />} />
              <Route path="/fingerprint" element={<FingerprintDepartment />} />
              <Route path="/cyber" element={<CyberDepartment />} />
              <Route path="/documents" element={<DocumentsDepartment />} />
              <Route path="/dashboard" element={<UserDashboard />} />
              <Route path="*" element={<NotFound />} />
            </Routes>
          </BrowserRouter>
        </TooltipProvider>
      </QueryClientProvider>
    </ErrorBoundary>
  );
};

export default App;
