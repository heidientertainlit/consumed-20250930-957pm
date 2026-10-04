import { useRef, useState } from "react";
import { useLocation } from "wouter";
import { useToast } from "@/hooks/use-toast";
import { feedMediaHref, resolveFeedMediaIdentity, storedFeedMediaIdentity, type FeedMediaTarget } from "@/lib/feed-media-navigation";

/** Poster navigation only. Does not write to tracking, posts or generation data. */
export function useFeedMediaNavigation(post: FeedMediaTarget, accessToken?: string) {
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const busy = useRef(false);
  const [loading, setLoading] = useState(false);
  const identity = storedFeedMediaIdentity(post);
  const href = identity ? feedMediaHref(identity) : undefined;
  const open = async () => {
    if (href) { navigate(href); return; }
    if (busy.current) return;
    busy.current = true;
    setLoading(true);
    try {
      const resolved = await resolveFeedMediaIdentity(post, async (title, type) => {
        const origin = import.meta.env.VITE_SUPABASE_URL || "https://mahpgcogwpawvviapqza.supabase.co";
        const token = accessToken || import.meta.env.VITE_SUPABASE_ANON_KEY;
        const response = await fetch(`${origin}/functions/v1/media-search?q=${encodeURIComponent(title)}&type=${encodeURIComponent(type)}&limit=10`, {
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        });
        if (!response.ok) throw new Error("Media lookup failed");
        const data = await response.json();
        return Array.isArray(data) ? data : data.results || [];
      });
      if (!resolved) throw new Error("No unambiguous media match");
      navigate(feedMediaHref(resolved));
    } catch {
      toast({ title: "Couldn't open this title", description: "We couldn't identify its media page. Please try searching for the title.", variant: "destructive" });
    } finally {
      busy.current = false;
      setLoading(false);
    }
  };
  return { href, open, loading };
}