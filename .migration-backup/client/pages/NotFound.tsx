import { useLocation, Link } from "react-router-dom";
import { useEffect } from "react";
import { PratyakshLogo } from '@/components/ui/pratyaksh-logo';
import { Button } from '@/components/ui/button';
import { AlertCircle } from 'lucide-react';

const NotFound = () => {
  const location = useLocation();

  useEffect(() => {
    console.error(
      "404 Error: User attempted to access non-existent route:",
      location.pathname,
    );
  }, [location.pathname]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-forensic-dark via-forensic-dark-secondary to-forensic-surface flex items-center justify-center">
      <div className="text-center max-w-md mx-auto px-6">
        <div className="mb-8">
          <PratyakshLogo size="xl" className="justify-center" />
        </div>
        <div className="mb-6">
          <div className="w-16 h-16 mx-auto bg-forensic-error/20 rounded-full flex items-center justify-center mb-4">
            <AlertCircle className="w-8 h-8 text-forensic-error" />
          </div>
          <h1 className="text-4xl font-bold text-forensic-text mb-2">404</h1>
          <h2 className="text-xl font-medium text-forensic-text mb-4">Evidence Not Found</h2>
          <p className="text-forensic-text-secondary mb-6">
            The forensic analysis you're looking for doesn't exist in our database.
            The trail has gone cold.
          </p>
        </div>
        <Link to="/">
          <Button className="bg-forensic-primary hover:bg-forensic-primary/90 text-white">
            Return to Investigation Console
          </Button>
        </Link>
      </div>
    </div>
  );
};

export default NotFound;
