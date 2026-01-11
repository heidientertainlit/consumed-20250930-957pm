import { Switch, Route, useLocation } from "wouter";
import { useEffect } from "react";
import { sessionTracker } from "./lib/sessionTracker";

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
    // Track page view when location changes
    sessionTracker.trackPageView(location);
  }, [location]);

  return <>{children}</>;
}

import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "./lib/auth";
import { ProtectedRoute, PublicOnlyRoute } from "@/components/route-guards";
import Track from "@/pages/track";
import Feed from "@/pages/feed";
import GameFirstFeed from "@/pages/game-first-feed";
import FriendsUpdates from "@/pages/friendsupdates";
import Search from "@/pages/search";
import Conversations from "@/pages/conversations";
import Leaderboard from "@/pages/leaderboard";
import Play from "@/pages/play";
import PlayTrivia from "@/pages/play-trivia";
import PlayPolls from "@/pages/play-polls";
import PlayPredictions from "@/pages/play-predictions";
import PlayHotTakes from "@/pages/play-hot-takes";
import PlayAskRecs from "@/pages/play-ask-recs";
import PlayHighStakes from "@/pages/play-high-stakes";
import PlayRanks from "@/pages/play-ranks";
import Friends from "@/pages/friends";
import CreatorProfile from "@/pages/creator-profile";
import UserProfile from "@/pages/user-profile";
import MediaDetail from "@/pages/media-detail";
import ListDetail from "@/pages/list-detail";
import CreateRank from "@/pages/create-rank";
import RankDetail from "@/pages/rank-detail";
import EdnaSharePage from "@/pages/edna-share";
import AdminDashboard from "@/pages/admin";
import CTVDemo from "@/pages/ctv";
import CTVRoku from "@/pages/ctv-roku";
import EngagePage from "@/pages/engage";
import CollectionsPage from "@/pages/collections";
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

function Router() {
  return (
    <AuthProvider>
      <PageTracker>
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
        <Route path="/feedback-survey">
          <ProtectedRoute>
            <FeedbackSurvey />
          </ProtectedRoute>
        </Route>
        <Route path="/invite/:userId">
          <InvitePage />
        </Route>
        <Route path="/u/:userId">
          <PublicProfilePage />
        </Route>
        <Route path="/onboarding">
          <ProtectedRoute>
            <OnboardingPage />
          </ProtectedRoute>
        </Route>
        <Route path="/game-first">
          <ProtectedRoute>
            <GameFirstFeed />
          </ProtectedRoute>
        </Route>
        <Route path="/">
          <ProtectedRoute>
            <Feed />
          </ProtectedRoute>
        </Route>
        <Route path="/track">
          <ProtectedRoute>
            <Track />
          </ProtectedRoute>
        </Route>
        <Route path="/leaderboard">
          <ProtectedRoute>
            <Leaderboard />
          </ProtectedRoute>
        </Route>
        <Route path="/activity">
          <ProtectedRoute>
            <Feed />
          </ProtectedRoute>
        </Route>
        <Route path="/friendsupdates">
          <ProtectedRoute>
            <FriendsUpdates />
          </ProtectedRoute>
        </Route>
        <Route path="/search">
          <ProtectedRoute>
            <Search />
          </ProtectedRoute>
        </Route>
        <Route path="/discover">
          <ProtectedRoute>
            <Search />
          </ProtectedRoute>
        </Route>
        <Route path="/conversations">
          <ProtectedRoute>
            <Conversations />
          </ProtectedRoute>
        </Route>
        <Route path="/friends">
          <ProtectedRoute>
            <Friends />
          </ProtectedRoute>
        </Route>
        <Route path="/play">
          <ProtectedRoute>
            <Play />
          </ProtectedRoute>
        </Route>
        <Route path="/my-library">
          <ProtectedRoute>
            <CollectionsPage />
          </ProtectedRoute>
        </Route>
        <Route path="/collections">
          <RedirectTo to="/my-library" />
        </Route>
        <Route path="/trivia">
          <RedirectTo to="/play/trivia" />
        </Route>
        <Route path="/play/trivia">
          <ProtectedRoute>
            <PlayTrivia />
          </ProtectedRoute>
        </Route>
        <Route path="/polls">
          <RedirectTo to="/play/polls" />
        </Route>
        <Route path="/play/polls">
          <ProtectedRoute>
            <PlayPolls />
          </ProtectedRoute>
        </Route>
        <Route path="/play/predictions">
          <RedirectTo to="/play/awards" />
        </Route>
        <Route path="/play/awards">
          <ProtectedRoute>
            <AwardsList />
          </ProtectedRoute>
        </Route>
        <Route path="/play/awards/:slug">
          <ProtectedRoute>
            <AwardsPredictions />
          </ProtectedRoute>
        </Route>
        <Route path="/awards">
          <RedirectTo to="/play/awards" />
        </Route>
        <Route path="/awards/:eventId">
          <ProtectedRoute>
            <AwardsPredictions />
          </ProtectedRoute>
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
            <PlayRanks />
          </ProtectedRoute>
        </Route>
        <Route path="/predictions">
          <RedirectTo to="/play/awards" />
        </Route>
        <Route path="/play/hot-takes">
          <ProtectedRoute>
            <PlayHotTakes />
          </ProtectedRoute>
        </Route>
        <Route path="/play/ask-recs">
          <ProtectedRoute>
            <PlayAskRecs />
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
        <Route path="/list/:id">
          <ProtectedRoute>
            <ListDetail />
          </ProtectedRoute>
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
            <AdminDashboard />
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
    </AuthProvider>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Router />
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;