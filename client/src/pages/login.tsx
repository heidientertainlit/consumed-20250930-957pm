
import { useState, useEffect } from "react";
import { useAuth } from "@/lib/auth";
import { useLocation } from "wouter";
import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { Eye, EyeOff, Mail, Lock, User, AtSign } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";

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
  const [resetSent, setResetSent] = useState(false);
  const [justSignedUp, setJustSignedUp] = useState(false);
  const [showSignInPassword, setShowSignInPassword] = useState(false);
  const [showSignUpPassword, setShowSignUpPassword] = useState(false);
  const { user, session, loading, signIn, signUp, resetPassword } = useAuth();
  const [, setLocation] = useLocation();
  const { toast } = useToast();

  useEffect(() => {
    if (!loading && user && !justSignedUp) {
      const returnUrl = sessionStorage.getItem('returnUrl');
      if (returnUrl) {
        sessionStorage.removeItem('returnUrl');
        setLocation(returnUrl);
      } else {
        setLocation('/activity');
      }
    }
  }, [user, loading, justSignedUp, setLocation]);

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
      setEmail("");
      setPassword("");
    }
    
    setSubmitting(false);
  };

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!username || username.trim() === '') {
      toast({
        title: "Username Required",
        description: "Please enter a username.",
        variant: "destructive",
      });
      setSubmitting(false);
      return;
    }

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
      const referrerId = localStorage.getItem('consumed_referrer');
      if (referrerId && data?.user?.id) {
        try {
          const { data: sessionData } = await supabase.auth.getSession();
          if (sessionData?.session?.access_token) {
            await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/manage-friendships`, {
              method: 'POST',
              headers: {
                'Authorization': `Bearer ${sessionData.session.access_token}`,
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({ action: 'sendRequest', friendId: referrerId }),
            });
            console.log('Auto-sent friend request to referrer:', referrerId);
          }
        } catch (err) {
          console.error('Failed to auto-send friend request:', err);
        }
        localStorage.removeItem('consumed_referrer');
      }
      
      setJustSignedUp(true);
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
      setResetSent(true);
    }
    
    setResetting(false);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-[#0a0a0f] via-[#12121f] to-[#2d1f4e] flex items-center justify-center">
        <div className="text-center">
          <div className="w-8 h-8 border-4 border-purple-500 border-t-transparent rounded-full animate-spin mx-auto"></div>
          <div className="text-white text-sm mt-4">Loading...</div>
        </div>
      </div>
    );
  }

  if (user) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-[#0a0a0f] via-[#12121f] to-[#2d1f4e] flex items-center justify-center">
        <div className="text-center">
          <div className="w-8 h-8 border-4 border-purple-500 border-t-transparent rounded-full animate-spin mx-auto"></div>
          <div className="text-white text-xl mt-4">Redirecting to Feed...</div>
        </div>
      </div>
    );
  }

  const inputClasses = "w-full h-12 bg-gray-100/80 border-0 rounded-full px-12 text-gray-900 text-sm placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-400/50 focus:bg-white transition-all";
  const labelClasses = "text-sm font-medium text-gray-600 ml-1";

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#0a0a0f] via-[#12121f] to-[#2d1f4e] flex items-center justify-center p-4">
      <div className="max-w-md w-full">
        <div className="text-center mb-8 mt-8">
          <div className="flex justify-center mb-3">
            <img 
              src="/consumed-logo-new.png" 
              alt="Consumed" 
              className="h-16 w-auto"
            />
          </div>
          <h1 className="text-white text-lg font-semibold mb-2 leading-tight">
            How you do entertainment.
          </h1>
          <p className="text-gray-400 text-xs max-w-xs mx-auto">
            Play trivia, track what you consume,<br />and discover your entertainment DNA.
          </p>
        </div>
        
        <div className="bg-white rounded-3xl p-8 shadow-2xl">
          <Tabs defaultValue="signin" className="w-full">
            <TabsList className="grid w-full grid-cols-2 mb-8 bg-gray-100 rounded-full p-1 h-12">
              <TabsTrigger 
                value="signin" 
                data-testid="tab-signin"
                className="data-[state=active]:bg-white data-[state=active]:text-gray-900 data-[state=active]:shadow-md data-[state=inactive]:text-gray-400 rounded-full transition-all text-sm font-medium h-10"
              >
                Sign In
              </TabsTrigger>
              <TabsTrigger 
                value="signup" 
                data-testid="tab-signup"
                className="data-[state=active]:bg-white data-[state=active]:text-gray-900 data-[state=active]:shadow-md data-[state=inactive]:text-gray-400 rounded-full transition-all text-sm font-medium h-10"
              >
                Sign Up
              </TabsTrigger>
            </TabsList>
            
            <TabsContent value="signin">
              <form onSubmit={handleSignIn} className="space-y-4">
                <div className="space-y-1.5">
                  <div className="relative">
                    <Mail className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                    <input
                      id="signin-email"
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      required
                      placeholder="Email address"
                      data-testid="input-signin-email"
                      className={inputClasses}
                    />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <div className="relative">
                    <Lock className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                    <input
                      id="signin-password"
                      type={showSignInPassword ? "text" : "password"}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                      placeholder="Password"
                      data-testid="input-signin-password"
                      className={inputClasses + " pr-12"}
                    />
                    <button
                      type="button"
                      onClick={() => setShowSignInPassword(!showSignInPassword)}
                      className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
                      data-testid="button-toggle-signin-password"
                      aria-label={showSignInPassword ? "Hide password" : "Show password"}
                    >
                      {showSignInPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                  <div className="flex justify-end">
                    <button
                      type="button"
                      onClick={() => setIsForgotPasswordOpen(true)}
                      className="text-xs text-purple-500 hover:text-purple-700 font-medium transition-colors"
                      data-testid="link-forgot-password"
                    >
                      I forgot password
                    </button>
                  </div>
                </div>
                <Button
                  type="submit"
                  className="w-full h-12 bg-gradient-to-r from-purple-600 to-purple-500 hover:from-purple-700 hover:to-purple-600 text-white rounded-full text-sm font-semibold shadow-lg shadow-purple-500/25 transition-all"
                  disabled={submitting}
                  data-testid="button-signin"
                >
                  {submitting ? "Signing in..." : "Sign In"}
                </Button>
              </form>
            </TabsContent>
            
            <TabsContent value="signup">
              <form onSubmit={handleSignUp} className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div className="relative">
                    <User className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                    <input
                      id="signup-firstname"
                      type="text"
                      value={firstName}
                      onChange={(e) => setFirstName(e.target.value)}
                      required
                      placeholder="First name"
                      data-testid="input-signup-firstname"
                      className={inputClasses}
                    />
                  </div>
                  <div className="relative">
                    <User className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                    <input
                      id="signup-lastname"
                      type="text"
                      value={lastName}
                      onChange={(e) => setLastName(e.target.value)}
                      required
                      placeholder="Last name"
                      data-testid="input-signup-lastname"
                      className={inputClasses}
                    />
                  </div>
                </div>
                <div className="relative">
                  <AtSign className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                  <input
                    id="signup-username"
                    type="text"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    required
                    placeholder="Username"
                    data-testid="input-signup-username"
                    className={inputClasses}
                  />
                </div>
                <p className="text-[11px] text-gray-400 ml-4 -mt-1">3-20 characters, letters, numbers, underscores</p>
                <div className="relative">
                  <Mail className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                  <input
                    id="signup-email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    placeholder="Email address"
                    data-testid="input-signup-email"
                    className={inputClasses}
                  />
                </div>
                <div className="relative">
                  <Lock className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                  <input
                    id="signup-password"
                    type={showSignUpPassword ? "text" : "password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    placeholder="Password"
                    data-testid="input-signup-password"
                    className={inputClasses + " pr-12"}
                  />
                  <button
                    type="button"
                    onClick={() => setShowSignUpPassword(!showSignUpPassword)}
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
                    data-testid="button-toggle-signup-password"
                    aria-label={showSignUpPassword ? "Hide password" : "Show password"}
                  >
                    {showSignUpPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
                <Button
                  type="submit"
                  className="w-full h-12 bg-gradient-to-r from-purple-600 to-purple-500 hover:from-purple-700 hover:to-purple-600 text-white rounded-full text-sm font-semibold shadow-lg shadow-purple-500/25 transition-all"
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

      <Dialog open={isForgotPasswordOpen} onOpenChange={(open) => {
        setIsForgotPasswordOpen(open);
        if (!open) {
          setResetSent(false);
          setResetEmail("");
        }
      }}>
        <DialogContent className="sm:max-w-md bg-white rounded-3xl border-0 shadow-2xl">
          {!resetSent ? (
            <>
              <DialogHeader>
                <DialogTitle className="text-gray-900 text-xl font-bold text-center">Reset Password</DialogTitle>
                <DialogDescription className="text-gray-500 text-center text-sm">
                  Enter your email and we'll send you a reset link.
                </DialogDescription>
              </DialogHeader>
              <form onSubmit={handleForgotPassword} className="space-y-4 py-2">
                <div className="relative">
                  <Mail className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                  <input
                    id="reset-email"
                    type="email"
                    value={resetEmail}
                    onChange={(e) => setResetEmail(e.target.value)}
                    required
                    placeholder="you@example.com"
                    data-testid="input-reset-email"
                    className={inputClasses}
                  />
                </div>
                <Button
                  type="submit"
                  className="w-full h-12 bg-gradient-to-r from-purple-600 to-purple-500 hover:from-purple-700 hover:to-purple-600 text-white rounded-full text-sm font-semibold shadow-lg shadow-purple-500/25 transition-all"
                  disabled={resetting}
                  data-testid="button-send-reset-link"
                >
                  {resetting ? "Sending..." : "Send Reset Link"}
                </Button>
              </form>
            </>
          ) : (
            <div className="text-center py-4">
              <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <Mail className="h-8 w-8 text-green-600" />
              </div>
              <h3 className="text-xl font-bold text-gray-900 mb-2">Check Your Email</h3>
              <p className="text-gray-500 text-sm mb-5">
                We sent a reset link to<br />
                <span className="font-semibold text-gray-800">{resetEmail}</span>
              </p>
              <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 mb-5">
                <p className="text-amber-800 font-bold text-base mb-1">
                  Don't see it? Check your spam!
                </p>
                <p className="text-amber-700 text-xs">
                  The email often lands in your spam or junk folder. Look for an email from Supabase or noreply.
                </p>
              </div>
              <Button
                onClick={() => {
                  setIsForgotPasswordOpen(false);
                  setResetSent(false);
                  setResetEmail("");
                }}
                className="w-full h-12 bg-gradient-to-r from-purple-600 to-purple-500 hover:from-purple-700 hover:to-purple-600 text-white rounded-full text-sm font-semibold shadow-lg shadow-purple-500/25 transition-all"
              >
                Got it, back to Sign In
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
