import { useState, useEffect, useRef } from "react";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/lib/supabase";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { Eye, EyeOff, Lock } from "lucide-react";
import { Capacitor } from "@capacitor/core";

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
    if (Capacitor.isNativePlatform()) {
      // Already inside the iOS app — just navigate to the main feed.
      // The user's session is now fully active after updateUser() succeeded.
      setLocation('/activity');
    } else {
      // Web browser (Safari) — open the app via universal link.
      window.location.href = 'https://app.consumedapp.com';
    }
  };

  useEffect(() => {
    console.log("[RESET-DEBUG] reset-password mounted");
    console.log("[RESET-DEBUG] window.location.href:", window.location.href);
    console.log("[RESET-DEBUG] window.location.hash:", window.location.hash);

    // --- Path 1: Capacitor cold-start via Universal Link ---
    const pendingRaw = localStorage.getItem("pendingRecovery");
    console.log("[RESET-DEBUG] localStorage pendingRecovery:", pendingRaw ? "EXISTS" : "not found");

    if (pendingRaw) {
      localStorage.removeItem("pendingRecovery");
      try {
        const { accessToken, refreshToken } = JSON.parse(pendingRaw);
        console.log("[RESET-DEBUG] Calling setSession() with tokens from localStorage");
        supabase.auth.setSession({ access_token: accessToken, refresh_token: refreshToken })
          .then(({ data, error }) => {
            console.log("[RESET-DEBUG] setSession() result — error:", error, "| session user:", data?.session?.user?.email ?? "none");
            if (error) {
              console.log("[RESET-DEBUG] setSession FAILED:", error.message);
            } else {
              console.log("[RESET-DEBUG] setSession SUCCESS — setting recoveryReady=true");
              setRecoveryReady(true);
              if (timeoutRef.current) clearTimeout(timeoutRef.current);
            }
          });
      } catch (e) {
        console.log("[RESET-DEBUG] Failed to parse pendingRecovery JSON:", e);
      }
    }

    // --- Path 2: Web browser (Safari / desktop) ---
    // IMPORTANT: Do NOT use getSession() here to set recoveryReady.
    // A stale old session from a previous login would fire recoveryReady=true
    // before the recovery token in the URL is processed, causing updateUser()
    // to run against the wrong session and silently fail to update the password.
    // We must wait for the actual PASSWORD_RECOVERY event from the recovery link.

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      console.log("[RESET-DEBUG] onAuthStateChange event:", event, "| session:", session ? session.user?.email : "null");
      if (event === 'PASSWORD_RECOVERY') {
        console.log("[RESET-DEBUG] PASSWORD_RECOVERY event — setting recoveryReady=true");
        setRecoveryReady(true);
        if (timeoutRef.current) clearTimeout(timeoutRef.current);
      }
      // PKCE flow fires SIGNED_IN instead of PASSWORD_RECOVERY in some Supabase configs.
      // Only trust SIGNED_IN if the URL contains recovery-related params.
      if (event === 'SIGNED_IN' && session) {
        const hasRecoveryParams =
          window.location.hash.includes('type=recovery') ||
          window.location.search.includes('code=') ||
          !!localStorage.getItem("pendingRecovery");
        if (hasRecoveryParams) {
          console.log("[RESET-DEBUG] SIGNED_IN with recovery params — setting recoveryReady=true");
          setRecoveryReady(true);
          if (timeoutRef.current) clearTimeout(timeoutRef.current);
        } else {
          console.log("[RESET-DEBUG] SIGNED_IN ignored — no recovery params in URL");
        }
      }
    });

    // Final fallback
    timeoutRef.current = setTimeout(async () => {
      console.log("[RESET-DEBUG] 10s timeout fired — checking session one last time");
      const { data: { session } } = await supabase.auth.getSession();
      console.log("[RESET-DEBUG] Timeout getSession():", session ? `active (${session.user?.email})` : "null");
      if (!session) {
        console.log("[RESET-DEBUG] No session found — redirecting to /login");
        toast({
          title: "Invalid or expired reset link",
          description: "Please request a new password reset link.",
          variant: "destructive",
        });
        setLocation('/login');
      } else {
        console.log("[RESET-DEBUG] Session found at timeout — setting recoveryReady=true");
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
              Open the Consumed app and sign in with your new password.
            </p>
            <Button
              onClick={openApp}
              className="w-full h-12 bg-gradient-to-r from-purple-600 to-purple-500 hover:from-purple-700 hover:to-purple-600 text-white rounded-full text-sm font-semibold shadow-lg shadow-purple-500/25 transition-all"
            >
              {Capacitor.isNativePlatform() ? "Go to Consumed" : "Open Consumed App"}
            </Button>
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
