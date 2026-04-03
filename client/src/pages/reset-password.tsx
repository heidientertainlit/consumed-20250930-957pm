import { useState, useEffect, useRef } from "react";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/lib/supabase";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { Eye, EyeOff, Lock } from "lucide-react";

export default function ResetPasswordPage() {
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [recoveryReady, setRecoveryReady] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const { updatePassword } = useAuth();
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const openApp = () => {
    window.location.href = 'app.consumed.entertainment://';
  };

  useEffect(() => {
    // --- Path 1: Capacitor cold-start via Universal Link ---
    // main.tsx registers appUrlOpen BEFORE React renders and stashes the recovery
    // tokens in localStorage. We read them here and call setSession() directly,
    // bypassing the URL hash which Capacitor strips during routing.
    const pendingRaw = localStorage.getItem("pendingRecovery");
    if (pendingRaw) {
      localStorage.removeItem("pendingRecovery");
      try {
        const { accessToken, refreshToken } = JSON.parse(pendingRaw);
        supabase.auth.setSession({ access_token: accessToken, refresh_token: refreshToken })
          .then(() => {
            setRecoveryReady(true);
            if (timeoutRef.current) clearTimeout(timeoutRef.current);
          });
      } catch {}
    }

    // --- Path 2: Web browser (Safari / desktop) ---
    // Supabase processes the token from window.location.hash automatically when
    // the client initialises. We just need to wait for the session to be ready.
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        setRecoveryReady(true);
        if (timeoutRef.current) clearTimeout(timeoutRef.current);
      }
    });

    // Also listen for the auth event — backup for slow connections
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'PASSWORD_RECOVERY' || (event === 'SIGNED_IN' && session)) {
        setRecoveryReady(true);
        if (timeoutRef.current) clearTimeout(timeoutRef.current);
      }
    });

    // Final fallback: if nothing worked after 10 seconds, the link is invalid
    timeoutRef.current = setTimeout(async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        toast({
          title: "Invalid or expired reset link",
          description: "Please request a new password reset link.",
          variant: "destructive",
        });
        setLocation('/login');
      } else {
        setRecoveryReady(true);
      }
    }, 10000);

    return () => {
      subscription.unsubscribe();
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, [setLocation, toast]);

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (newPassword !== confirmPassword) {
      toast({
        title: "Passwords don't match",
        description: "Please make sure both passwords are the same.",
        variant: "destructive",
      });
      return;
    }

    if (newPassword.length < 6) {
      toast({
        title: "Password too short",
        description: "Password must be at least 6 characters long.",
        variant: "destructive",
      });
      return;
    }

    setSubmitting(true);
    
    const { error } = await updatePassword(newPassword);
    
    if (error) {
      toast({
        title: "Password update failed",
        description: error.message,
        variant: "destructive",
      });
    } else {
      setSuccess(true);
    }
    
    setSubmitting(false);
  };

  if (success) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-[#0a0a0f] via-[#12121f] to-[#2d1f4e] flex items-center justify-center p-4">
        <div className="max-w-md w-full">
          <div className="text-center mb-8">
            <div className="flex justify-center mb-4">
              <img src="/consumed-logo-new.png" alt="consumed" className="h-16 w-auto" />
            </div>
          </div>
          <div className="bg-white rounded-3xl p-8 shadow-2xl text-center">
            <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <Lock className="h-8 w-8 text-green-600" />
            </div>
            <h2 className="text-xl font-bold text-gray-900 mb-2">Password Updated</h2>
            <p className="text-gray-500 text-sm mb-6">
              Your password has been successfully reset. You can now log in to Consumed with your new password.
            </p>
            <Button
              onClick={openApp}
              className="w-full h-12 bg-gradient-to-r from-purple-600 to-purple-500 hover:from-purple-700 hover:to-purple-600 text-white rounded-full text-sm font-semibold shadow-lg shadow-purple-500/25 transition-all mb-3"
            >
              Open Consumed App
            </Button>
            <button
              onClick={() => setLocation('/login')}
              className="text-sm text-gray-400 hover:text-gray-600 transition-colors"
            >
              Login on web instead
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (!recoveryReady) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-[#0a0a0f] via-[#12121f] to-[#2d1f4e] flex items-center justify-center">
        <div className="text-center">
          <div className="w-8 h-8 border-4 border-purple-500 border-t-transparent rounded-full animate-spin mx-auto"></div>
          <div className="text-white text-sm mt-4">Verifying reset link...</div>
        </div>
      </div>
    );
  }

  const inputClasses = "w-full h-12 bg-gray-100/80 border-0 rounded-full px-12 text-gray-900 text-sm placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-400/50 focus:bg-white transition-all";

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#0a0a0f] via-[#12121f] to-[#2d1f4e] flex items-center justify-center p-4">
      <div className="max-w-md w-full">
        <div className="text-center mb-8">
          <div className="flex justify-center mb-4">
            <img 
              src="/consumed-logo-new.png" 
              alt="consumed" 
              className="h-16 w-auto"
            />
          </div>
          <h1 className="text-2xl font-bold text-white mb-2">Reset Your Password</h1>
          <p className="text-gray-400 text-sm">
            Enter your new password below
          </p>
        </div>
        
        <div className="bg-white rounded-3xl p-8 shadow-2xl">
          <form onSubmit={handleResetPassword} className="space-y-4">
            <div className="space-y-1.5">
              <label htmlFor="new-password" className="text-sm font-medium text-gray-600 ml-4">New Password</label>
              <div className="relative">
                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                <input
                  id="new-password"
                  type={showNewPassword ? "text" : "password"}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  required
                  minLength={6}
                  data-testid="input-new-password"
                  className={inputClasses + " pr-12"}
                  placeholder="Enter new password"
                />
                <button
                  type="button"
                  onClick={() => setShowNewPassword(!showNewPassword)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
                  data-testid="button-toggle-new-password"
                  aria-label={showNewPassword ? "Hide password" : "Show password"}
                >
                  {showNewPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>
            <div className="space-y-1.5">
              <label htmlFor="confirm-password" className="text-sm font-medium text-gray-600 ml-4">Confirm Password</label>
              <div className="relative">
                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                <input
                  id="confirm-password"
                  type={showConfirmPassword ? "text" : "password"}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                  minLength={6}
                  data-testid="input-confirm-password"
                  className={inputClasses + " pr-12"}
                  placeholder="Confirm new password"
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
                  data-testid="button-toggle-confirm-password"
                  aria-label={showConfirmPassword ? "Hide password" : "Show password"}
                >
                  {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>
            <Button
              type="submit"
              className="w-full h-12 bg-gradient-to-r from-purple-600 to-purple-500 hover:from-purple-700 hover:to-purple-600 text-white rounded-full text-sm font-semibold shadow-lg shadow-purple-500/25 transition-all"
              disabled={submitting}
              data-testid="button-reset-password"
            >
              {submitting ? "Updating..." : "Update Password"}
            </Button>
          </form>
        </div>
      </div>
    </div>
  );
}
