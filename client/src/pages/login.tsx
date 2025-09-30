
import { useState, useEffect } from "react";
import { useAuth } from "@/lib/auth";
import { useLocation } from "wouter";
import { AuthModal } from "@/components/auth-modal";

export default function LoginPage() {
  const [showAuthModal, setShowAuthModal] = useState(true);
  const { user } = useAuth();
  const [, setLocation] = useLocation();

  useEffect(() => {
    if (user) {
      setLocation('/feed');
    }
  }, [user, setLocation]);

  const handleAuthModalClose = (open: boolean) => {
    setShowAuthModal(open);
    if (!open) {
      // Redirect to home when modal is closed
      setLocation('/');
    }
  };

  // If user is already logged in, don't show anything (will redirect)
  if (user) {
    return null;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-black via-slate-900 to-purple-900 flex items-center justify-center p-4">
      <div className="max-w-md w-full">
        {/* Logo and welcome section */}
        <div className="text-center mb-8">
          <div className="flex justify-center mb-6">
            <img 
              src="/consumed-logo-white.png" 
              alt="consumed" 
              className="h-16 w-auto"
            />
          </div>
          <h1 className="text-3xl font-bold text-white mb-3">Welcome Back</h1>
          <p className="text-purple-200 text-base">
            Track your entertainment, discover your DNA, and connect with fellow fans
          </p>
        </div>
        
        {/* Auth form */}
        <div className="bg-white rounded-2xl p-8 shadow-2xl border border-purple-200">
          <AuthModal 
            open={true} 
            onOpenChange={handleAuthModalClose}
          />
        </div>
      </div>
    </div>
  );
}
