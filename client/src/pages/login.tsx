
import { useState, useEffect } from "react";
import { useAuth } from "@/lib/auth";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import "./auth.css";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [username, setUsername] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [isForgotPasswordOpen, setIsForgotPasswordOpen] = useState(false);
  const [resetEmail, setResetEmail] = useState("");
  const [resetting, setResetting] = useState(false);
  const { user, loading, signIn, signUp, resetPassword } = useAuth();
  const [, setLocation] = useLocation();
  const { toast } = useToast();

  useEffect(() => {
    if (!loading && user) {
      setLocation('/feed');
    }
  }, [user, loading, setLocation]);

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    
    const { error } = await signIn(email, password);
    
    if (error) {
      toast({
        title: "Sign in failed",
        description: error.message,
        variant: "destructive",
      });
    } else {
      toast({
        title: "Welcome back!",
        description: "You have successfully signed in.",
      });
      setEmail("");
      setPassword("");
    }
    
    setSubmitting(false);
  };

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validate username is provided
    if (!username || username.trim() === '') {
      toast({
        title: "Username Required",
        description: "Please enter a username.",
        variant: "destructive",
      });
      setSubmitting(false);
      return;
    }

    // Validate username format
    const usernameRegex = /^[a-zA-Z0-9_]{3,20}$/;
    if (!usernameRegex.test(username.trim())) {
      toast({
        title: "Invalid Username",
        description: "Username must be 3-20 characters and contain only letters, numbers, and underscores (no spaces).",
        variant: "destructive",
      });
      setSubmitting(false);
      return;
    }
    
    setSubmitting(true);
    
    const { error, data } = await signUp(email, password, {
      firstName: firstName.trim(),
      lastName: lastName.trim(),
      username: username.trim()
    });
    
    if (error) {
      toast({
        title: "Sign up failed",
        description: error.message,
        variant: "destructive",
      });
      setSubmitting(false);
    } else {
      toast({
        title: "Welcome to Consumed!",
        description: "Let's discover your Entertainment DNA.",
      });
      
      // Redirect to onboarding immediately
      setLocation('/onboarding');
      setSubmitting(false);
    }
  };

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setResetting(true);
    
    const { error } = await resetPassword(resetEmail);
    
    if (error) {
      toast({
        title: "Password reset failed",
        description: error.message,
        variant: "destructive",
      });
    } else {
      toast({
        title: "Check your email",
        description: "We've sent you a password reset link.",
      });
      setIsForgotPasswordOpen(false);
      setResetEmail("");
    }
    
    setResetting(false);
  };

  // Show loading spinner while auth state is being determined
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

  // If user is logged in, show redirecting message (useEffect will redirect)
  if (user) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-black via-slate-900 to-purple-900 flex items-center justify-center">
        <div className="text-center">
          <div className="w-8 h-8 border-4 border-purple-500 border-t-transparent rounded-full animate-spin mx-auto"></div>
          <div className="text-white text-xl mt-4">Redirecting to Feed...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-black via-slate-900 to-purple-900 flex items-center justify-center p-4">
      <div className="max-w-md w-full">
        {/* Logo and welcome section */}
        <div className="text-center mb-8">
          <div className="flex justify-center mb-4">
            <img 
              src="/consumed-logo-white.png" 
              alt="Consumed" 
              className="h-16 w-auto"
            />
          </div>
          <p className="text-purple-300 text-lg italic mb-6">entertained ... with benefits</p>
          <p className="text-purple-100 text-sm max-w-lg mx-auto">
            Track, Predict, & Connect over the entertainment you love. And get rewarded for it.
          </p>
        </div>
        
        {/* Auth form */}
        <div 
          id="auth"
          className="bg-white rounded-2xl p-8 shadow-2xl border border-purple-200"
        >
          <Tabs defaultValue="signin" className="w-full">
            <TabsList className="grid w-full grid-cols-2 mb-6 bg-gradient-to-r from-purple-600 to-purple-800 relative">
              <TabsTrigger 
                value="signin" 
                data-testid="tab-signin"
                className="data-[state=active]:bg-purple-700 data-[state=active]:text-white data-[state=active]:opacity-100 data-[state=inactive]:opacity-50 text-white transition-opacity"
              >
                Sign In
              </TabsTrigger>
              <div className="absolute left-1/2 top-2 bottom-2 w-px bg-white/30"></div>
              <TabsTrigger 
                value="signup" 
                data-testid="tab-signup"
                className="data-[state=active]:bg-purple-700 data-[state=active]:text-white data-[state=active]:opacity-100 data-[state=inactive]:opacity-50 text-white transition-opacity"
              >
                Sign Up
              </TabsTrigger>
            </TabsList>
            
            <TabsContent value="signin">
              <form onSubmit={handleSignIn} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="signin-email" className="form-text-black">Email</Label>
                  <Input
                    id="signin-email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    data-testid="input-signin-email"
                    className="bg-white form-text-black form-placeholder-black"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="signin-password" className="form-text-black">Password</Label>
                  <Input
                    id="signin-password"
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    data-testid="input-signin-password"
                    className="bg-white form-text-black form-placeholder-black"
                  />
                  <button
                    type="button"
                    onClick={() => setIsForgotPasswordOpen(true)}
                    className="text-sm text-purple-600 hover:text-purple-700 hover:underline"
                    data-testid="link-forgot-password"
                  >
                    Forgot password?
                  </button>
                </div>
                <Button
                  type="submit"
                  className="w-full bg-purple-600 hover:bg-purple-700"
                  disabled={submitting}
                  data-testid="button-signin"
                >
                  {submitting ? "Signing in..." : "Sign In"}
                </Button>
              </form>
            </TabsContent>
            
            <TabsContent value="signup">
              <form onSubmit={handleSignUp} className="space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <Label htmlFor="signup-firstname" className="form-text-black">First Name</Label>
                    <Input
                      id="signup-firstname"
                      type="text"
                      value={firstName}
                      onChange={(e) => setFirstName(e.target.value)}
                      required
                      data-testid="input-signup-firstname"
                      className="bg-white form-text-black form-placeholder-black"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="signup-lastname" className="form-text-black">Last Name</Label>
                    <Input
                      id="signup-lastname"
                      type="text"
                      value={lastName}
                      onChange={(e) => setLastName(e.target.value)}
                      required
                      data-testid="input-signup-lastname"
                      className="bg-white form-text-black form-placeholder-black"
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="signup-username" className="form-text-black">Username</Label>
                  <Input
                    id="signup-username"
                    type="text"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    required
                    data-testid="input-signup-username"
                    className="bg-white form-text-black form-placeholder-black"
                    placeholder="letters, numbers, underscores only"
                  />
                  <p className="text-xs text-gray-500">3-20 characters, no spaces</p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="signup-email" className="form-text-black">Email</Label>
                  <Input
                    id="signup-email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    data-testid="input-signup-email"
                    className="bg-white form-text-black form-placeholder-black"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="signup-password" className="form-text-black">Password</Label>
                  <Input
                    id="signup-password"
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    data-testid="input-signup-password"
                    className="bg-white form-text-black form-placeholder-black"
                  />
                </div>
                <Button
                  type="submit"
                  className="w-full bg-purple-600 hover:bg-purple-700"
                  disabled={submitting}
                  data-testid="button-signup"
                >
                  {submitting ? "Creating account..." : "Sign Up"}
                </Button>
              </form>
            </TabsContent>
          </Tabs>
        </div>
      </div>

      {/* Forgot Password Modal */}
      <Dialog open={isForgotPasswordOpen} onOpenChange={setIsForgotPasswordOpen}>
        <DialogContent className="sm:max-w-md bg-white">
          <DialogHeader>
            <DialogTitle className="text-black">Reset Password</DialogTitle>
            <DialogDescription className="text-gray-600">
              Enter your email address and we'll send you a link to reset your password.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleForgotPassword} className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="reset-email" className="text-black">Email</Label>
              <Input
                id="reset-email"
                type="email"
                value={resetEmail}
                onChange={(e) => setResetEmail(e.target.value)}
                required
                placeholder="you@example.com"
                data-testid="input-reset-email"
                className="bg-white text-black placeholder:text-gray-400"
              />
            </div>
            <Button
              type="submit"
              className="w-full bg-purple-600 hover:bg-purple-700 text-white"
              disabled={resetting}
              data-testid="button-send-reset-link"
            >
              {resetting ? "Sending..." : "Send Reset Link"}
            </Button>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
