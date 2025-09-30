
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

  const handleAuthModalClose = () => {
    setShowAuthModal(false);
    // Redirect to home or feed when modal is closed
    setLocation('/');
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-900 via-purple-800 to-pink-800 flex items-center justify-center p-4">
      <div className="max-w-md w-full">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-white mb-2">Welcome to consumed</h1>
          <p className="text-purple-200 text-lg">
            Discover your Entertainment DNA and connect with others
          </p>
        </div>
        
        <AuthModal 
          open={showAuthModal} 
          onOpenChange={handleAuthModalClose}
        />
      </div>
    </div>
  );
}
