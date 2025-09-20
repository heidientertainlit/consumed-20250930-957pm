import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "./lib/auth";
import Track from "@/pages/track";
import Feed from "@/pages/feed";
import Leaderboard from "@/pages/leaderboard";
import Play from "@/pages/play";
import FriendsCreators from "@/pages/friends-creators";
import CreatorProfile from "@/pages/creator-profile";
import UserProfile from "@/pages/user-profile";
import MediaDetail from "@/pages/media-detail";
import ListDetail from "@/pages/list-detail";
import Onboarding from "@/pages/onboarding";
import NotFound from "@/pages/not-found";

function Router() {
  return (
    <Switch>
      <Route path="/" component={Track} />
      <Route path="/track" component={Track} />
      <Route path="/leaderboard" component={Leaderboard} />
      <Route path="/feed" component={Feed} />
      <Route path="/friends-creators" component={FriendsCreators} />
      <Route path="/play" component={Play} />
      <Route path="/onboarding" component={Onboarding} />
      <Route path="/media/:id" component={MediaDetail} />
      <Route path="/list/:id" component={ListDetail} />
      <Route path="/creator/:id" component={CreatorProfile} />
      <Route path="/user/:id" component={UserProfile} />
      <Route component={NotFound} />
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
