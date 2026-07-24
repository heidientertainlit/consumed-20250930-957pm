
import { useState, useEffect } from "react";
import { useAuth } from "@/lib/auth";
import { useLocation } from "wouter";
import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { Eye, EyeOff, Mail, Lock, User, AtSign, Flame, Tv, Headphones, BookOpen, BarChart3, TrendingUp } from "lucide-react";

const TYPE_STYLES: Record<string, { badge: typeof Flame; badgeBg: string; statIcon: typeof Flame }> = {
  movie: { badge: Flame, badgeBg: "bg-orange-500", statIcon: TrendingUp },
  tv: { badge: Tv, badgeBg: "bg-purple-600", statIcon: TrendingUp },
  book: { badge: BookOpen, badgeBg: "bg-purple-600", statIcon: BarChart3 },
  podcast: { badge: Headphones, badgeBg: "bg-purple-600", statIcon: BarChart3 },
};

const TYPE_HOOKS: Record<string, string[]> = {
  movie: [
    "Is the ending brilliant or a cop-out?",
    "Overrated or a masterpiece? Fans are split",
    "The final scene has everyone talking",
  ],
  tv: [
    "Everyone's debating the latest episode",
    "Worth the binge? Opinions are heated",
    "That twist has group chats blowing up",
  ],
  book: [
    "Readers can't agree on this one",
    "Book clubs are arguing about the ending",
    "Is the hype real? Readers are split",
  ],
  podcast: [
    "This week's episode sparked a debate",
    "Listeners have strong opinions on this one",
    "The take everyone's reacting to",
  ],
};

function assignHooks(items: { title: string; type: string }[]): Record<string, string> {
  const used = new Set<string>();
  const result: Record<string, string> = {};
  for (const item of items) {
    const hooks = TYPE_HOOKS[item.type] ?? TYPE_HOOKS.movie;
    let hash = 0;
    for (let i = 0; i < item.title.length; i++) hash = (hash * 31 + item.title.charCodeAt(i)) >>> 0;
    let pick = hooks[hash % hooks.length];
    for (let step = 0; used.has(pick) && step < hooks.length; step++) {
      pick = hooks[(hash + step + 1) % hooks.length];
    }
    used.add(pick);
    result[item.title] = pick;
  }
  return result;
}

const FALLBACK_TRENDING = [
  { title: "The Odyssey", image: "https://image.tmdb.org/t/p/w300/5rhTDKUhPYvpdQIijFIs5VoWsON.jpg", type: "movie", stat: "Users are talking about" },
  { title: "A Knight of the Seven Kingdoms", image: "https://image.tmdb.org/t/p/w300/k8yARbD9iYn2nRX2HvsopfKDN2r.jpg", type: "tv", stat: "Friends are watching" },
  { title: "Stolen in Death", image: "https://books.google.com/books/content?id=ECFYEQAAQBAJ&printsec=frontcover&img=1&zoom=1&source=gbs_api", type: "book", stat: "Readers recommend" },
  { title: "The Daily", image: "https://is1-ssl.mzstatic.com/image/thumb/Podcasts221/v4/ab/64/66/ab6466a9-9a7d-e20e-7a3d-bc5be37d29ce/mza_15084852813176276273.jpg/300x300bb.png", type: "podcast", stat: "#1 podcast" },
];
import { SiApple, SiGoogle } from "react-icons/si";
import { useQuery } from "@tanstack/react-query";
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

  const { data: trendingData } = useQuery({
    queryKey: ["trending-content"],
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke("trending-content");
      if (error) throw error;
      return data as { items: { title: string; image: string; type: string; stat: string }[] };
    },
    staleTime: 60 * 60 * 1000,
    retry: 1,
  });
  const trendingItems =
    trendingData?.items &&
    trendingData.items.length >= 4 &&
    trendingData.items.some((i) => i.type === "podcast")
      ? trendingData.items
      : FALLBACK_TRENDING;

  const itemHooks = assignHooks(trendingItems);

  const [carouselIndex, setCarouselIndex] = useState(0);
  useEffect(() => {
    const timer = setInterval(() => {
      setCarouselIndex((prev) => prev + 1);
    }, 4000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    if (!loading && user) {
      if (justSignedUp) {
        setLocation('/onboarding');
        return;
      }
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
      // Identify new user in Customer.io for email journey
      console.log('Sign up data:', { userId: data?.user?.id, email: data?.user?.email });
      if (data?.user?.id && data?.user?.email) {
        try {
          const { error: fnError } = await supabase.functions.invoke('customerio-identify', {
            body: {
              id: data.user.id,
              email: data.user.email,
              first_name: firstName.trim() || null,
              username: username.trim() || null,
            },
          });
          if (fnError) {
            console.error('Customer.io identify error:', fnError);
          } else {
            console.log('Customer.io identify success');
          }
        } catch (err) {
          console.error('Customer.io identify exception:', err);
        }
      } else {
        console.warn('Customer.io skipped — no user id/email in signup response', data);
      }

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
      
      // Clear any stale onboarding flag so new users always see onboarding
      localStorage.removeItem('consumed_onboarding_completed');
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
      <div className="min-h-screen bg-gradient-to-b from-[#171028] to-[#241740] flex items-center justify-center">
        <div className="text-center">
          <div className="w-8 h-8 border-4 border-purple-500 border-t-transparent rounded-full animate-spin mx-auto"></div>
          <div className="text-gray-300 text-sm mt-4">Loading...</div>
        </div>
      </div>
    );
  }

  if (user) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-[#171028] to-[#241740] flex items-center justify-center">
        <div className="text-center">
          <div className="w-8 h-8 border-4 border-purple-500 border-t-transparent rounded-full animate-spin mx-auto"></div>
          <div className="text-gray-200 text-xl mt-4">Redirecting to Feed...</div>
        </div>
      </div>
    );
  }

  const inputClasses = "w-full h-12 bg-gray-100/80 border-0 rounded-full px-12 text-gray-900 text-sm placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-400/50 focus:bg-white transition-all";
  const labelClasses = "text-sm font-medium text-gray-600 ml-1";

  // UI-only for now — real OAuth gets wired in after Apple/Google provider config is done.
  const handleOAuth = (provider: 'apple' | 'google') => {
    toast({
      title: "Almost there",
      description: `${provider === 'apple' ? 'Apple' : 'Google'} sign-in isn't connected yet — coming soon.`,
    });
  };

  const renderSocialButtons = (context: 'signin' | 'signup') => (
    <div className="space-y-3 mt-5">
      <div className="relative py-1">
        <div className="absolute inset-0 flex items-center">
          <span className="w-full border-t border-gray-200" />
        </div>
        <div className="relative flex justify-center text-xs">
          <span className="bg-white px-3 text-gray-400">or continue with</span>
        </div>
      </div>
      <button
        type="button"
        onClick={() => handleOAuth('apple')}
        className="w-full h-12 flex items-center justify-center gap-2 bg-black text-white rounded-full text-sm font-semibold hover:bg-black/90 transition-all"
        data-testid={`button-${context}-apple`}
      >
        <SiApple className="h-4 w-4" />
        Continue with Apple
      </button>
      <button
        type="button"
        onClick={() => handleOAuth('google')}
        className="w-full h-12 flex items-center justify-center gap-2 bg-white text-gray-700 border border-gray-300 rounded-full text-sm font-semibold hover:bg-gray-50 transition-all"
        data-testid={`button-${context}-google`}
      >
        <SiGoogle className="h-4 w-4 text-[#4285F4]" />
        Continue with Google
      </button>
    </div>
  );

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#171028] to-[#241740] overflow-y-auto flex flex-col">
      <div className="max-w-md w-full mx-auto px-4 flex-1 pb-10">
        <div className="text-center mb-6 mt-12">
          <div className="flex justify-center mb-2">
            <img
              src="/consumed-logo-new.png"
              alt="Consumed"
              className="h-14 w-auto"
            />
          </div>
          <h1 className="text-white text-lg font-serif mb-2 leading-tight whitespace-nowrap">
            Entertainment is better, shared.
          </h1>
        </div>

        <div className="mb-5">
          <div className="space-y-2">
            {[0, 1].map((offset) => {
              const idx = (carouselIndex + offset) % trendingItems.length;
              const item = trendingItems[idx];
              const style = TYPE_STYLES[item.type] ?? TYPE_STYLES.movie;
              const Badge = style.badge;
              const StatIcon = style.statIcon;
              return (
                <div
                  key={item.title}
                  className="flex items-center gap-3 py-2 px-3 bg-white/[0.05] border border-white/10 rounded-2xl animate-in fade-in slide-in-from-right-4 duration-500"
                >
                  <img
                    src={item.image}
                    alt={item.title}
                    className="w-14 h-11 object-cover rounded-lg flex-shrink-0"
                    loading="lazy"
                  />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-white leading-snug truncate">{item.title}</p>
                    <div className="flex items-center gap-1.5 mt-0.5">
                      <StatIcon className="h-3 w-3 text-purple-400 flex-shrink-0" />
                      <p className="text-xs text-gray-400 truncate">{itemHooks[item.title]}</p>
                    </div>
                  </div>
                  <div className="flex-shrink-0 flex items-center gap-1 border border-white/15 rounded-full px-2 py-0.5">
                    <Badge className="h-3 w-3 text-purple-300" />
                    <span className="text-[10px] font-medium text-gray-300">
                      {item.type === "tv" ? "TV" : item.type.charAt(0).toUpperCase() + item.type.slice(1)}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
          <div className="flex items-center justify-center gap-3 mt-2.5">
            <div className="flex items-center gap-1.5">
              {trendingItems.map((_, i) => (
                <div
                  key={i}
                  className={`h-1.5 rounded-full transition-all duration-300 ${
                    i === carouselIndex % trendingItems.length ? "w-4 bg-purple-400" : "w-1.5 bg-white/20"
                  }`}
                />
              ))}
            </div>
            <p className="text-xs text-purple-400 font-medium">439 more conversations</p>
          </div>
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
                      Forgot password
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
              {renderSocialButtons('signin')}
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
              {renderSocialButtons('signup')}
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
