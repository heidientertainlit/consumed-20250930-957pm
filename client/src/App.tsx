import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "./lib/auth";
import { ProtectedRoute, PublicOnlyRoute } from "@/components/route-guards";
import Track from "@/pages/track";
import Feed from "@/pages/feed";
import Discover from "@/pages/discover";
import Leaderboard from "@/pages/leaderboard";
import Play from "@/pages/play";
import PlayTrivia from "@/pages/play-trivia";
import PlayPolls from "@/pages/play-polls";
import PlayPredictions from "@/pages/play-predictions";
import PlayHighStakes from "@/pages/play-high-stakes";
import Friends from "@/pages/friends";
import CreatorProfile from "@/pages/creator-profile";
import UserProfile from "@/pages/user-profile";
import MediaDetail from "@/pages/media-detail";
import ListDetail from "@/pages/list-detail";
import EdnaSharePage from "@/pages/edna-share";
import AdminDashboard from "@/pages/admin";
import CTVDemo from "@/pages/ctv";
import LoginPage from "./pages/login";
import ResetPasswordPage from "./pages/reset-password";
import NotFoundPage from "./pages/not-found";

function Router() {
  return (
    <AuthProvider>
      <Switch>
        <Route path="/login">
          <PublicOnlyRoute>
            <LoginPage />
          </PublicOnlyRoute>
        </Route>
        <Route path="/reset-password">
          <ResetPasswordPage />
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
        <Route path="/discover">
          <ProtectedRoute>
            <Discover />
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
        <Route path="/play/trivia">
          <ProtectedRoute>
            <PlayTrivia />
          </ProtectedRoute>
        </Route>
        <Route path="/play/polls">
          <ProtectedRoute>
            <PlayPolls />
          </ProtectedRoute>
        </Route>
        <Route path="/play/predictions">
          <ProtectedRoute>
            <PlayPredictions />
          </ProtectedRoute>
        </Route>
        <Route path="/play/high-stakes">
          <ProtectedRoute>
            <PlayHighStakes />
          </ProtectedRoute>
        </Route>
        <Route path="/media/:type/:source/:id">
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
        <Route component={NotFoundPage} />
      </Switch>
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