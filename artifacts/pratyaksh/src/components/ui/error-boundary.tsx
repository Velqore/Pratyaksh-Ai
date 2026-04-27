import React from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { PratyakshLogo } from '@/components/ui/pratyaksh-logo';
import { AlertTriangle, RefreshCw, Home } from 'lucide-react';

interface ErrorBoundaryState {
  hasError: boolean;
  error?: Error;
  errorInfo?: React.ErrorInfo;
}

export class ErrorBoundary extends React.Component<
  React.PropsWithChildren<{}>,
  ErrorBoundaryState
> {
  constructor(props: React.PropsWithChildren<{}>) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('Pratyaksh Error Boundary caught an error:', error, errorInfo);
    this.setState({ error, errorInfo });
  }

  handleReload = () => {
    window.location.reload();
  };

  handleGoHome = () => {
    window.location.href = '/';
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-gradient-to-br from-forensic-dark via-forensic-dark-secondary to-forensic-surface flex items-center justify-center p-4">
          <Card className="w-full max-w-lg bg-forensic-surface/50 border-forensic-border">
            <CardHeader className="text-center">
              <div className="mb-4">
                <PratyakshLogo size="lg" className="justify-center" />
              </div>
              <div className="w-16 h-16 mx-auto bg-forensic-error/20 rounded-full flex items-center justify-center mb-4">
                <AlertTriangle className="w-8 h-8 text-forensic-error" />
              </div>
              <CardTitle className="text-forensic-text">System Error Detected</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-forensic-text-secondary text-center">
                The Pratyaksh forensic analysis system encountered an unexpected error. 
                Our AI diagnostic systems are working to resolve this issue.
              </p>
              
              {process.env.NODE_ENV === 'development' && this.state.error && (
                <div className="p-3 bg-forensic-error/10 rounded-lg border border-forensic-error/20">
                  <h4 className="text-sm font-medium text-forensic-error mb-2">Debug Information</h4>
                  <pre className="text-xs text-forensic-text-muted overflow-auto max-h-32">
                    {this.state.error.toString()}
                  </pre>
                </div>
              )}
              
              <div className="flex gap-3">
                <Button 
                  onClick={this.handleReload}
                  className="bg-forensic-primary hover:bg-forensic-primary/90 text-white flex-1"
                >
                  <RefreshCw className="w-4 h-4 mr-2" />
                  Restart Analysis
                </Button>
                <Button 
                  onClick={this.handleGoHome}
                  variant="outline"
                  className="border-forensic-border text-forensic-text flex-1"
                >
                  <Home className="w-4 h-4 mr-2" />
                  Return Home
                </Button>
              </div>
              
              <p className="text-xs text-forensic-text-muted text-center">
                Error ID: {Date.now().toString(36).toUpperCase()}
              </p>
            </CardContent>
          </Card>
        </div>
      );
    }

    return this.props.children;
  }
}

// Hook for functional components error handling
export function useErrorHandler() {
  return (error: Error, errorInfo?: React.ErrorInfo) => {
    console.error('Pratyaksh Runtime Error:', error, errorInfo);
    // Could integrate with error reporting service here
  };
}
