import { Switch, Route, useLocation } from "wouter";
import { ErrorBoundary } from "@/components/error-boundary";
import { useEffect } from "react";
import { useKeyboardAdjust } from "@/hooks/use-keyboard-adjust";
import { Capacitor } from "@capacitor/core";
import { App as CapApp } from "@capacitor/app";
import { Browser } from "@capacitor/browser";
import { supabase } from "@/lib/supabase";

import { sessionTracker } from "./lib/sessionTracker";
import { initPostHog, trackPageView } from "./lib/posthog";

import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider, useAuth } from "./lib/auth";
import { IdentityAwareRoute, ProtectedRoute, PublicOnlyRoute } from "@/components/route-guards";
import { FeatureFlagsProvider, useFeatureFlags } from "@/lib/feature-flags";
import { AppUpdateGate } from "@/components/app-update-gate";
import { TermsAcceptanceGate } from "@/components/terms-consent";
import { markRecoveryAuthFlow } from "@/lib/auth-flow";
import {
  clearMatchingOAuthTermsConsentAttempt,
  hasMatchingOAuthTermsConsentAttempt,
  noteNativeOAuthCallbackReceived,
  notifyNativeOAuthBrowserOutcome,
} from "@/lib/legal-terms-consent";
import { parseNativeAuthCallback } from "@/lib/native-oauth";
import { restoreNativeAuthCallbackSession } from "@/lib/native-oauth-session";

// Pages
import AdminPage from "@/pages/admin";
import AdminPersonasPage from "@/pages/admin-personas";
import AdminTriviaPage from "@/pages/admin-trivia";
import AdminPoolsPage from "@/pages/admin-pools";
import AdminRanksPage from "@/pages/admin-ranks";
import AdminDnaMomentsPage from "@/pages/admin-dna-moments";
import AdminDailyCallPage from "@/pages/admin-daily-call";
import AdminTodaysPlayPage from "@/pages/admin-todays-play";
import AdminRoomConversationsPage from "@/pages/admin-room-conversations";
import AdminExportsPage from "@/pages/admin-exports";
import AdminImportLedgerPage from "@/pages/admin-import-ledger";
import AdminBlockAlertsPage from "@/pages/admin-block-alerts";
import Feed from "@/pages/feed";
import GameFirstFeed from "@/pages/game-first-feed";
import QuickLog from "@/pages/quick-log";
import BlendedFeed from "@/pages/blended-feed";
import FriendsUpdates from "@/pages/friendsupdates";
import AiSearch from "@/pages/ai-search";
import Conversations from "@/pages/conversations";
import Leaderboard from "@/pages/leaderboard";

import PlayPage from "@/pages/play";
import PlayBingeBattle from "@/pages/play-binge-battle";
import PlayBingeBattleAccept from "@/pages/play-binge-battle-accept";
import PlayPools from "@/pages/play-pools";
import PlayPoolsDetail from "@/pages/play-pools-detail";
import PlayChallenge from "@/pages/play-challenge";
import PlayTrivia from "@/pages/play-trivia";
import PlayPredictions from "@/pages/play-predictions";
import PlayAskRecs from "@/pages/play-ask-recs";
import PlayHighStakes from "@/pages/play-high-stakes";
import PlayCast from "@/pages/play-cast";

import People from "@/pages/people";
import CreatorProfile from "@/pages/creator-profile";
import UserProfile from "@/pages/user-profile";
import DnaPage from "@/pages/dna";
import MediaDetail from "@/pages/media-detail";
import ListDetail from "@/pages/list-detail";
import PostDetail from "@/pages/post-detail";
import ConversationPage from "@/pages/conversation";
import CreateRank from "@/pages/create-rank";
import RankDetail from "@/pages/rank-detail";
import EdnaSharePage from "@/pages/edna-share";

import CTVDemo from "@/pages/ctv";
import CTVRoku from "@/pages/ctv-roku";
import EngagePage from "@/pages/engage";

import LoginPage from "./pages/login";
import ResetPasswordPage from "./pages/reset-password";
import OnboardingPage from "./pages/onboarding";
import NotFoundPage from "./pages/not-found";

import About from "@/pages/about";
import PointsBreakdown from "@/pages/points-breakdown";

import AwardsList from "@/pages/awards-list";
import AwardsPredictions from "@/pages/awards-predictions";
import AwardsBallotShare from "@/pages/awards-ballot-share";

import InvitePage from "@/pages/invite";
import PublicProfilePage from "@/pages/public-profile";
import FeedbackSurvey from "@/pages/feedback-survey";
import CastSharePage from "@/pages/cast-share";


import PrivacyPolicy from "@/pages/privacy-policy";
import TermsOfService from "@/pages/terms-of-service";
import ResponsibleGaming from "@/pages/responsible-gaming";
import ProfileByUsername from "@/pages/profile-by-username";
import AddMediaPage from "@/pages/add-media-page";

// Simple redirect component for wouter
function RedirectTo({ to }: { to: string }) {
  const [, setLocation] = useLocation();
  setLocation(to, { replace: true });
  return null;
}

// Track page views on route changes
function PageTracker({ children }: { children: React.ReactNode }) {
  const [location] = useLocation();

  useEffect(() => {
    sessionTracker.trackPageView(location);
    trackPageView(location);
  }, [location]);

  return <>{children}</>;
}

/**
 * ✅ Handles push deep-links stored in localStorage by main.tsx
 * main.tsx saves: localStorage.setItem("pendingRoute", "/some/path")
 * This effect runs after Wouter is mounted, so routing works reliably.
 */
function PendingRouteHandler() {
  const [, setLocation] = useLocation();

  useEffect(() => {
    const restorePendingAuthAndRoute = async () => {
      const pendingOAuthRaw = localStorage.getItem("pendingOAuthSession");
      if (pendingOAuthRaw) {
        localStorage.removeItem("pendingOAuthSession");
        try {
          const { accessToken, refreshToken, attemptId } = JSON.parse(pendingOAuthRaw);
          if (
            typeof accessToken !== "string"
            || typeof refreshToken !== "string"
            || typeof attemptId !== "string"
            || !hasMatchingOAuthTermsConsentAttempt(attemptId)
          ) {
            console.error("[AUTH-DEBUG] Invalid or stale pending OAuth session");
            localStorage.removeItem("pendingRoute");
            return;
          }
          const restored = await restoreNativeAuthCallbackSession(
            {
              kind: "oauth-session",
              accessToken,
              refreshToken,
              attemptId,
            },
            (tokens) => supabase.auth.setSession(tokens),
            (failedAttemptId) => {
              clearMatchingOAuthTermsConsentAttempt(failedAttemptId);
              notifyNativeOAuthBrowserOutcome("Sign-in was denied. Please try again.");
            },
          );
          if (!restored) {
            console.error("[AUTH-DEBUG] Failed to restore pending OAuth session");
            localStorage.removeItem("pendingRoute");
            return;
          }
        } catch {
          console.error("[AUTH-DEBUG] Invalid pending OAuth session");
          localStorage.removeItem("pendingRoute");
          return;
        }
      }

      const route = localStorage.getItem("pendingRoute");
      if (route) {
        localStorage.removeItem("pendingRoute");
        setLocation(route);
      }
    };

    void restorePendingAuthAndRoute();
  }, [setLocation]);

  return null;
}

/**
 * Handles Supabase auth deep links on iOS (Capacitor Universal Links).
 *
 * Problem: iOS intercepts every app.consumedapp.com link and opens it inside the
 * WKWebView via Universal Links. When Capacitor routes the app to /reset-password,
 * it strips the URL hash — so the #access_token=xxx&type=recovery that Supabase
 * needs never reaches window.location. Supabase never fires PASSWORD_RECOVERY,
 * and the page times out to login.
 *
 * Fix: @capacitor/app fires `appUrlOpen` with the FULL original URL (including
 * hash) before any routing happens. We read the hash here, extract the tokens,
 * and call supabase.auth.setSession() directly. By the time reset-password.tsx
 * mounts and calls getSession(), the session is already set.
 */
function CapacitorDeepLinkHandler() {
  const [, setLocation] = useLocation();

  useEffect(() => {
    if (!Capacitor.isNativePlatform()) {
      console.log("[RESET-DEBUG] CapacitorDeepLinkHandler: not native, skipping");
      return;
    }
    console.log("[RESET-DEBUG] CapacitorDeepLinkHandler: mounted, registering appUrlOpen listener (warm-start backup)");

    const handleAppUrlOpen = async ({ url }: { url: string }) => {
      console.log("[AUTH-DEBUG] CapacitorDeepLinkHandler appUrlOpen fired");
      const appUrl = (import.meta.env.VITE_APP_URL || "https://app.consumedapp.com").replace(/\/$/, "");
      const callback = parseNativeAuthCallback(
        url,
        appUrl,
        hasMatchingOAuthTermsConsentAttempt,
      );
      if (!callback) {
        console.log("[RESET-DEBUG] CapacitorDeepLinkHandler: invalid callback, ignoring");
        return;
      }
      if (callback.kind === "oauth-error") {
        clearMatchingOAuthTermsConsentAttempt(callback.attemptId);
        notifyNativeOAuthBrowserOutcome("Sign-in was denied. Please try again.");
        void Browser.close().catch(() => {});
        return;
      }

      noteNativeOAuthCallbackReceived(
        callback.kind === "oauth-session" ? callback.attemptId : null,
      );
      void Browser.close().catch(() => {
        // Closing is best-effort; callback verification and session setup
        // remain independent if the system browser was already dismissed.
      });
      if (callback.kind === "recovery-session") {
          // Warm native links set the session before navigation. Mark and
          // clear first so AuthProvider cannot classify this as a normal login.
          markRecoveryAuthFlow();
          // Recovery callbacks never own a pre-auth OAuth consent attempt.
      }
      console.log("[AUTH-DEBUG] CapacitorDeepLinkHandler: calling setSession()");
      const restored = await restoreNativeAuthCallbackSession(
        callback,
        (tokens) => supabase.auth.setSession(tokens),
        (attemptId) => {
          clearMatchingOAuthTermsConsentAttempt(attemptId);
          notifyNativeOAuthBrowserOutcome("Sign-in was denied. Please try again.");
        },
      );
      console.log("[AUTH-DEBUG] CapacitorDeepLinkHandler: setSession result — restored:", restored);
      if (restored) {
        if (callback.kind !== "recovery-session") {
          localStorage.removeItem("pendingOAuthSession");
          localStorage.removeItem("pendingRoute");
        }
        setLocation(callback.kind === "recovery-session" ? "/reset-password" : "/activity");
      }
    };

    CapApp.addListener('appUrlOpen', handleAppUrlOpen);
    return () => { CapApp.removeAllListeners(); };
  }, [setLocation]);

  return null;
}

const ADMIN_USER_ID = "88bfb2a0-e8ce-4081-b731-2a49567ff093";

function Router() {
  useKeyboardAdjust();

  return (
    <AuthProvider>
      <PendingRouteHandler />
      <CapacitorDeepLinkHandler />
      <TermsAcceptanceGate>
        <PageTracker>
          <AppUpdateGate />

          <Switch>
          <Route path="/login">
            <PublicOnlyRoute>
              <LoginPage />
            </PublicOnlyRoute>
          </Route>

          <Route path="/reset-password">
            <ResetPasswordPage />
          </Route>

          <Route path="/about">
            <About />
          </Route>

          <Route path="/privacy">
            <PrivacyPolicy />
          </Route>

          <Route path="/terms">
            <TermsOfService />
          </Route>

          <Route path="/responsible-gaming">
            <ResponsibleGaming />
          </Route>

          <Route path="/feedback-survey">
            <ProtectedRoute>
              <FeedbackSurvey />
            </ProtectedRoute>
          </Route>

          <Route path="/invite/:userId">
            <InvitePage />
          </Route>

          <Route path="/cast/:token">
            <CastSharePage />
          </Route>

          <Route path="/u/:userId">
            <PublicProfilePage />
          </Route>

          <Route path="/onboarding">
            <ProtectedRoute>
              <OnboardingPage />
            </ProtectedRoute>
          </Route>

          <Route path="/entertainment-dna">
            <ProtectedRoute>
              <RedirectTo to="/onboarding?resume=dna" />
            </ProtectedRoute>
          </Route>

          <Route path="/game-first">
            <ProtectedRoute>
              <GameFirstFeed />
            </ProtectedRoute>
          </Route>

          {/* Home feed is guest-accessible — Feed handles logged-out (guest) mode itself */}
          <Route path="/">
            <IdentityAwareRoute>
              <Feed />
            </IdentityAwareRoute>
          </Route>

          <Route path="/quick-log">
            <ProtectedRoute>
              <QuickLog />
            </ProtectedRoute>
          </Route>

          <Route path="/blended">
            <ProtectedRoute>
              <BlendedFeed />
            </ProtectedRoute>
          </Route>

          <Route path="/track">
            <RedirectTo to="/profile" />
          </Route>

          <Route path="/leaderboard">
            <ProtectedRoute>
              <Leaderboard />
            </ProtectedRoute>
          </Route>

          {/* Guest-accessible like "/" */}
          <Route path="/activity">
            <IdentityAwareRoute>
              <Feed />
            </IdentityAwareRoute>
          </Route>

          <Route path="/notifications">
            <RedirectTo to="/people?tab=friends" />
          </Route>

          <Route path="/friendsupdates">
            <ProtectedRoute>
              <FriendsUpdates />
            </ProtectedRoute>
          </Route>

          <Route path="/add">
            <ProtectedRoute>
              <AddMediaPage />
            </ProtectedRoute>
          </Route>

          <Route path="/search">
            <ProtectedRoute>
              <AiSearch />
            </ProtectedRoute>
          </Route>

          <Route path="/discover">
            <RedirectTo to="/activity" />
          </Route>

          <Route path="/conversations">
            <ProtectedRoute>
              <Conversations />
            </ProtectedRoute>
          </Route>

          <Route path="/friends">
            <RedirectTo to="/people?tab=friends" />
          </Route>

          <Route path="/people/tribes/:tribeId">
            {(params) => (
              <ProtectedRoute>
                <People initialTribeId={params.tribeId} />
              </ProtectedRoute>
            )}
          </Route>

          <Route path="/people">
            <ProtectedRoute>
              <People />
            </ProtectedRoute>
          </Route>

          <Route path="/room/:id/conversation/:takeId">
            {params => <RedirectTo to={`/conversation/${params.takeId}`} />}
          </Route>

          <Route path="/rooms"><RedirectTo to="/people" /></Route>
          <Route path="/new-room"><RedirectTo to="/activity" /></Route>
          <Route path="/room/join/:code"><RedirectTo to="/activity" /></Route>
          <Route path="/room/:id">
            <RedirectTo to="/activity" />
          </Route>

          <Route path="/play">
            <ProtectedRoute>
              <PlayPage />
            </ProtectedRoute>
          </Route>

          <Route path="/play/binge-battle/accept/:battleId">
            <IdentityAwareRoute>
              <PlayBingeBattleAccept />
            </IdentityAwareRoute>
          </Route>

          <Route path="/play/binge-battle">
            <ProtectedRoute>
              <PlayBingeBattle />
            </ProtectedRoute>
          </Route>

          <Route path="/play/pools">
            <ProtectedRoute>
              <PlayPools />
            </ProtectedRoute>
          </Route>

          <Route path="/play/pools/:id">
            <ProtectedRoute>
              <PlayPoolsDetail />
            </ProtectedRoute>
          </Route>

          <Route path="/play/challenge/:showTag/:difficulty">
            <ProtectedRoute>
              <PlayChallenge />
            </ProtectedRoute>
          </Route>
          <Route path="/play/challenge/:showTag">
            <ProtectedRoute>
              <PlayChallenge />
            </ProtectedRoute>
          </Route>

          <Route path="/dna">
            <ProtectedRoute>
              <DnaPage />
            </ProtectedRoute>
          </Route>

          <Route path="/collections">
            <RedirectTo to="/profile" />
          </Route>

          <Route path="/trivia">
            <RedirectTo to="/activity" />
          </Route>

          <Route path="/play/trivia">
            <ProtectedRoute>
              {window.location.hash
                ? <PlayTrivia />
                : <PlayPage initialTab="trivia" />}
            </ProtectedRoute>
          </Route>

          <Route path="/polls">
            <RedirectTo to="/activity" />
          </Route>

          <Route path="/play/polls">
            <ProtectedRoute>
              <PlayPage initialTab="polls" />
            </ProtectedRoute>
          </Route>

          <Route path="/play/predictions">
            <ProtectedRoute>
              <PlayPredictions />
            </ProtectedRoute>
          </Route>

          <Route path="/play/awards">
            <RedirectTo to="/activity" />
          </Route>

          <Route path="/play/awards/:slug">
            <IdentityAwareRoute>
              <AwardsPredictions />
            </IdentityAwareRoute>
          </Route>

          <Route path="/awards">
            <RedirectTo to="/activity" />
          </Route>

          <Route path="/awards/:eventId">
            <IdentityAwareRoute>
              <AwardsPredictions />
            </IdentityAwareRoute>
          </Route>

          <Route path="/awards/:eventId/ballot">
            <AwardsBallotShare />
          </Route>

          <Route path="/play/high-stakes">
            <ProtectedRoute>
              <PlayHighStakes />
            </ProtectedRoute>
          </Route>

          <Route path="/ranks">
            <RedirectTo to="/play/ranks" />
          </Route>

          <Route path="/play/ranks">
            <ProtectedRoute>
              <PlayPage initialTab="ranks" />
            </ProtectedRoute>
          </Route>

          <Route path="/predictions">
            <RedirectTo to="/activity" />
          </Route>

          <Route path="/play/hot-takes">
            <ProtectedRoute>
              <PlayPage />
            </ProtectedRoute>
          </Route>

          <Route path="/play/ask-recs">
            <ProtectedRoute>
              <PlayAskRecs />
            </ProtectedRoute>
          </Route>

          <Route path="/play/cast">
            <ProtectedRoute>
              <PlayCast />
            </ProtectedRoute>
          </Route>

          <Route path="/media/:type/:source/:id">
            <ProtectedRoute>
              <MediaDetail />
            </ProtectedRoute>
          </Route>

          <Route path="/media/:type/:source/:prefix/:id">
            <ProtectedRoute>
              <MediaDetail />
            </ProtectedRoute>
          </Route>

          <Route path="/post/:id">
            <ProtectedRoute>
              <PostDetail />
            </ProtectedRoute>
          </Route>

          <Route path="/conversation/:takeId">
            <ProtectedRoute>
              <ConversationPage />
            </ProtectedRoute>
          </Route>

          <Route path="/list/:id">
            <ListDetail />
          </Route>

          <Route path="/create-rank">
            <ProtectedRoute>
              <CreateRank />
            </ProtectedRoute>
          </Route>

          <Route path="/rank/:id">
            <ProtectedRoute>
              <RankDetail />
            </ProtectedRoute>
          </Route>

          <Route path="/creator/:id">
            <ProtectedRoute>
              <CreatorProfile />
            </ProtectedRoute>
          </Route>

          <Route path="/creator-profile">
            <ProtectedRoute>
              <CreatorProfile />
            </ProtectedRoute>
          </Route>

          <Route path="/me">
            <ProtectedRoute>
              <UserProfile />
            </ProtectedRoute>
          </Route>

          <Route path="/profile">
            <ProtectedRoute>
              <UserProfile />
            </ProtectedRoute>
          </Route>

          <Route path="/profile/:username">
            <ProtectedRoute>
              <ProfileByUsername />
            </ProtectedRoute>
          </Route>

          <Route path="/points">
            <ProtectedRoute>
              <PointsBreakdown />
            </ProtectedRoute>
          </Route>

          <Route path="/user/:id">
            <ProtectedRoute>
              <UserProfile />
            </ProtectedRoute>
          </Route>

          <Route path="/edna/:id">
            <EdnaSharePage />
          </Route>

          <Route path="/admin">
            <ProtectedRoute>
              <AdminPage />
            </ProtectedRoute>
          </Route>

          <Route path="/admin/personas">
            <ProtectedRoute>
              <AdminPersonasPage />
            </ProtectedRoute>
          </Route>

          <Route path="/admin/trivia-polls">
            <ProtectedRoute>
              <AdminTriviaPage />
            </ProtectedRoute>
          </Route>

          <Route path="/admin/ranks">
            <ProtectedRoute>
              <AdminRanksPage />
            </ProtectedRoute>
          </Route>

          <Route path="/admin/pools">
            <ProtectedRoute>
              <AdminPoolsPage />
            </ProtectedRoute>
          </Route>

          <Route path="/admin/dna-moments">
            <ProtectedRoute>
              <AdminDnaMomentsPage />
            </ProtectedRoute>
          </Route>

          <Route path="/admin/daily-call">
            <ProtectedRoute>
              <AdminDailyCallPage />
            </ProtectedRoute>
          </Route>

          <Route path="/admin/todays-play">
            <ProtectedRoute>
              <AdminTodaysPlayPage />
            </ProtectedRoute>
          </Route>

          <Route path="/admin/room-conversations">
            <ProtectedRoute>
              <AdminRoomConversationsPage />
            </ProtectedRoute>
          </Route>
          <Route path="/admin/exports">
            <ProtectedRoute>
              <AdminExportsPage />
            </ProtectedRoute>
          </Route>
          <Route path="/admin/import-ledger">
            <ProtectedRoute>
              <AdminImportLedgerPage />
            </ProtectedRoute>
          </Route>
          <Route path="/admin/block-alerts">
            <ProtectedRoute>
              <AdminBlockAlertsPage />
            </ProtectedRoute>
          </Route>

          <Route path="/ctv">
            <CTVDemo />
          </Route>

          <Route path="/ctv-roku">
            <CTVRoku />
          </Route>

          <Route path="/engage">
            <ProtectedRoute>
              <EngagePage />
            </ProtectedRoute>
          </Route>

          <Route component={NotFoundPage} />
          </Switch>
        </PageTracker>
      </TermsAcceptanceGate>
    </AuthProvider>
  );
}

function App() {
  return (
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <TooltipProvider>
          <FeatureFlagsProvider>
            <ErrorBoundary>
              <Router />
            </ErrorBoundary>
            <Toaster />
          </FeatureFlagsProvider>
        </TooltipProvider>
      </QueryClientProvider>
    </ErrorBoundary>
  );
}

export default App;