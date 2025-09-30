import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "./lib/auth";
import { ProtectedRoute, PublicOnlyRoute } from "@/components/route-guards";
import Track from "@/pages/track";
import Feed from "@/pages/feed";
import Leaderboard from "@/pages/leaderboard";
import Play from "@/pages/play";
import Predictions from "@/pages/predictions";
import Friends from "@/pages/friends";
import CreatorProfile from "@/pages/creator-profile";
import UserProfile from "@/pages/user-profile";
import MediaDetail from "@/pages/media-detail";
import ListDetail from "@/pages/list-detail";
import OnboardingPage from "./pages/onboarding";
import LoginPage from "./pages/login";
import NotFoundPage from "./pages/not-found";

function Router() {
  return (
    <Switch>
      <Route path="/login">
        <PublicOnlyRoute>
          <LoginPage />
        </PublicOnlyRoute>
      </Route>
      <Route path="/onboarding">
        <ProtectedRoute>
          <OnboardingPage />
        </ProtectedRoute>
      </Route>
      <Route path="/">
        <ProtectedRoute>
          <Track />
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
      <Route path="/feed">
        <ProtectedRoute>
          <Feed />
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
      <Route path="/predictions">
        <ProtectedRoute>
          <Predictions />
        </ProtectedRoute>
      </Route>
      <Route path="/media/:id">
        <ProtectedRoute>
          <MediaDetail />
        </ProtectedRoute>
      </Route>
      <Route path="/list/:id">
        <ProtectedRoute>
          <ListDetail />
        </ProtectedRoute>
      </Route>
      <Route path="/creator/:id">
        <ProtectedRoute>
          <CreatorProfile />
        </ProtectedRoute>
      </Route>
      <Route path="/user/:id">
        <ProtectedRoute>
          <UserProfile />
        </ProtectedRoute>
      </Route>
      <Route component={NotFoundPage} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <TooltipProvider>
          <Toaster />
          <Router />
        </TooltipProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
}

export default App;