
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
    <div className="min-h-screen bg-gradient-to-br from-purple-900 via-purple-800 to-pink-800 flex items-center justify-center p-4">
      <div className="max-w-md w-full">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-white mb-2">Welcome to consumed</h1>
          <p className="text-purple-200 text-lg">
            Discover your Entertainment DNA and connect with others
          </p>
        </div>
        
        {/* Render modal content directly without Dialog wrapper */}
        <div className="bg-white rounded-lg p-6 shadow-xl">
          <AuthModal 
            open={true} 
            onOpenChange={handleAuthModalClose}
          />
        </div>
      </div>
    </div>
  );
}
