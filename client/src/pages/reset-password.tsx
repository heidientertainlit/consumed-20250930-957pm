import { useState, useEffect } from "react";
import { useAuth } from "@/lib/auth";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";

export default function ResetPasswordPage() {
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const { user, loading, updatePassword } = useAuth();
  const [, setLocation] = useLocation();
  const { toast } = useToast();

  useEffect(() => {
    if (!loading && !user) {
      toast({
        title: "Invalid reset link",
        description: "Please request a new password reset link.",
        variant: "destructive",
      });
      setLocation('/login');
    }
  }, [user, loading, setLocation, toast]);

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
      toast({
        title: "Password updated!",
        description: "Your password has been successfully reset.",
      });
      setLocation('/feed');
    }
    
    setSubmitting(false);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-black via-slate-900 to-purple-900 flex items-center justify-center">
        <div className="text-center">
          <div className="w-8 h-8 border-4 border-purple-500 border-t-transparent rounded-full animate-spin mx-auto"></div>
          <div className="text-white text-sm mt-4">Loading...</div>
        </div>
      </div>
    );
  }

  if (!user) {
    return null;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-black via-slate-900 to-purple-900 flex items-center justify-center p-4">
      <div className="max-w-md w-full">
        <div className="text-center mb-8">
          <div className="flex justify-center mb-4">
            <img 
              src="/consumed-logo-white.png" 
              alt="consumed" 
              className="h-16 w-auto"
            />
          </div>
          <h1 className="text-2xl font-bold text-white mb-2">Reset Your Password</h1>
          <p className="text-purple-300 text-sm">
            Enter your new password below
          </p>
        </div>
        
        <div className="bg-white rounded-2xl p-8 shadow-2xl border border-purple-200">
          <form onSubmit={handleResetPassword} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="new-password" className="text-black">New Password</Label>
              <Input
                id="new-password"
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                required
                minLength={6}
                data-testid="input-new-password"
                className="bg-white text-black placeholder:text-gray-400"
                placeholder="Enter new password"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirm-password" className="text-black">Confirm Password</Label>
              <Input
                id="confirm-password"
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
                minLength={6}
                data-testid="input-confirm-password"
                className="bg-white text-black placeholder:text-gray-400"
                placeholder="Confirm new password"
              />
            </div>
            <Button
              type="submit"
              className="w-full bg-purple-600 hover:bg-purple-700 text-white"
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
