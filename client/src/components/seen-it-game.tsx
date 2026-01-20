import { useState, useRef, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Eye, ChevronRight, Check, X, Users, Trophy, Plus, Star, Loader2, Sparkles, Search } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/auth";
import { useToast } from "@/hooks/use-toast";
import { queryClient } from "@/lib/queryClient";
import { trackEvent } from "@/lib/posthog";
import { useFriendsManagement } from "@/hooks/use-friends-management";

interface SeenItItem {
  id: string;
  title: string;
  image_url: string;
  year?: string;
  external_id?: string;
  external_source?: string;
  media_type?: string;
}

interface SeenItSet {
  id: string;
  title: string;
  items: SeenItItem[];
}

export default function SeenItGame() {
  const { session, user } = useAuth();
  const { toast } = useToast();
  const scrollRef = useRef<HTMLDivElement>(null);
  const [responses, setResponses] = useState<Record<string, boolean | null>>({});
  const [currentSetIndex, setCurrentSetIndex] = useState(0);
  const [showChallengeModal, setShowChallengeModal] = useState(false);
  const { friendsData, isLoadingFriends } = useFriendsManagement();

  const { data: sets, isLoading } = useQuery({
    queryKey: ['seen-it-sets'],
    queryFn: async () => {
      const { data: setsData, error } = await supabase
        .from('seen_it_sets')
        .select('*')
        .eq('visibility', 'public')
        .order('created_at', { ascending: false })
        .limit(3);
      
      if (error) throw error;
      
      const setsWithItems: SeenItSet[] = [];
      for (const set of setsData || []) {
        const { data: items } = await supabase
          .from('seen_it_items')
          .select('*')
          .eq('set_id', set.id)
          .order('position', { ascending: true });
        
        setsWithItems.push({
          id: set.id,
          title: set.title,
          items: items || []
        });
      }
      
      return setsWithItems;
    }
  });

  const { data: existingResponses } = useQuery({
    queryKey: ['seen-it-responses', user?.id],
    queryFn: async () => {
      if (!user?.id) return {};
      const { data } = await supabase
        .from('seen_it_responses')
        .select('item_id, seen')
        .eq('user_id', user.id);
      
      const responseMap: Record<string, boolean> = {};
      (data || []).forEach(r => {
        responseMap[r.item_id] = r.seen;
      });
      return responseMap;
    },
    enabled: !!user?.id
  });

  useEffect(() => {
    if (existingResponses && Object.keys(existingResponses).length > 0) {
      setResponses(existingResponses);
    }
  }, [existingResponses]);

  const responseMutation = useMutation({
    mutationFn: async ({ setId, itemId, seen, item }: { setId: string; itemId: string; seen: boolean; item: SeenItItem }) => {
      if (!user?.id) throw new Error('Must be logged in');
      
      const { data: existing } = await supabase
        .from('seen_it_responses')
        .select('id')
        .eq('item_id', itemId)
        .eq('user_id', user.id)
        .single();
      
      if (existing) {
        await supabase
          .from('seen_it_responses')
          .update({ seen })
          .eq('id', existing.id);
      } else {
        await supabase.from('seen_it_responses').insert({
          set_id: setId,
          item_id: itemId,
          user_id: user.id,
          seen
        });
      }
      
      // If user marked as "seen", add to their watch history (Finished list)
      if (seen && item.external_id && item.external_source) {
        try {
          const { data: { session } } = await supabase.auth.getSession();
          await supabase.functions.invoke('track-media', {
            body: {
              media: {
                title: item.title,
                mediaType: item.media_type || 'movie',
                imageUrl: item.image_url,
                externalId: item.external_id,
                externalSource: item.external_source
              },
              listType: 'finished',
              skip_social_post: true
            }
          });
        } catch (err) {
          console.error('Failed to add to watch history:', err);
        }
      }
      
      return { itemId, seen };
    },
    onSuccess: ({ itemId, seen }) => {
      trackEvent('seen_it_response', { item_id: itemId, seen });
      if (seen) {
        queryClient.invalidateQueries({ queryKey: ['/api/list-items'] });
      }
    }
  });

  const handleResponse = (setId: string, item: SeenItItem, seen: boolean) => {
    setResponses(prev => ({ ...prev, [item.id]: seen }));
    if (session) {
      responseMutation.mutate({ setId, itemId: item.id, seen, item });
    }
  };

  const challengeMutation = useMutation({
    mutationFn: async (friendId: string) => {
      if (!user?.id || !currentSet) throw new Error('Must be logged in');
      
      const { data, error } = await supabase.functions.invoke('seen-it-challenge', {
        body: {
          action: 'create',
          set_id: currentSet.id,
          set_title: currentSet.title,
          challenged_id: friendId,
          score: seenCount,
          total_items: currentSet.items.length
        }
      });
      
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      
      return data;
    },
    onSuccess: () => {
      setShowChallengeModal(false);
      toast({
        title: "Challenge sent!",
        description: "Your friend will be notified"
      });
      trackEvent('seen_it_challenge_sent', { set_id: currentSet?.id });
    },
    onError: (err) => {
      toast({
        title: "Couldn't send challenge",
        description: err instanceof Error ? err.message : "Try again",
        variant: "destructive"
      });
    }
  });

  const currentSet = sets?.[currentSetIndex];

  if (isLoading) {
    return (
      <Card className="bg-gradient-to-br from-[#2d1b4e] via-[#1a1035] to-[#0f0a1a] border-0 p-4 rounded-xl">
        <div className="flex items-center justify-center py-8">
          <Loader2 className="w-6 h-6 animate-spin text-purple-400" />
        </div>
      </Card>
    );
  }

  if (!sets || sets.length === 0 || !currentSet) {
    return null;
  }

  const seenCount = currentSet.items.filter(item => responses[item.id] === true).length;
  const answeredCount = currentSet.items.filter(item => responses[item.id] !== null && responses[item.id] !== undefined).length;
  const isComplete = answeredCount === currentSet.items.length;

  return (
    <Card className="bg-gradient-to-br from-[#2d1b4e] via-[#1a1035] to-[#0f0a1a] border-0 p-4 rounded-xl">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Eye className="w-4 h-4 text-yellow-400" />
          <h3 className="text-white font-medium text-sm">Seen It?</h3>
          <span className="text-purple-400 text-xs">• {currentSet.title}</span>
        </div>
        <div className="flex items-center gap-2">
          {answeredCount > 0 && (
            <span className="text-purple-300 text-xs">{seenCount}/{answeredCount}</span>
          )}
          <ChevronRight className="w-4 h-4 text-purple-400" />
        </div>
      </div>

      <div 
        ref={scrollRef}
        className="flex gap-3 overflow-x-auto pb-2 scrollbar-hide"
        style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
      >
        {currentSet.items.map((item) => {
          const response = responses[item.id];
          const answered = response !== null && response !== undefined;
          
          return (
            <div key={item.id} className="flex-shrink-0 w-32">
              <div className="relative">
                <img 
                  src={item.image_url} 
                  alt={item.title}
                  className={`w-32 h-48 rounded-lg object-cover transition-all ${
                    answered ? 'opacity-60' : ''
                  }`}
                />
                <div className="absolute top-2 right-2 flex flex-col gap-1">
                  <button className="w-7 h-7 rounded-full bg-black/60 backdrop-blur-sm flex items-center justify-center hover:bg-black/80 active:scale-90 transition-all">
                    <Plus className="w-4 h-4 text-white" />
                  </button>
                  <button className="w-7 h-7 rounded-full bg-black/60 backdrop-blur-sm flex items-center justify-center hover:bg-black/80 active:scale-90 transition-all">
                    <Star className="w-4 h-4 text-white" />
                  </button>
                </div>
                {answered && (
                  <div className={`absolute inset-0 flex items-center justify-center rounded-lg ${
                    response ? 'bg-green-500/30' : 'bg-red-500/30'
                  }`}>
                    {response ? (
                      <Check className="w-10 h-10 text-green-400" />
                    ) : (
                      <X className="w-10 h-10 text-red-400" />
                    )}
                  </div>
                )}
              </div>
              
              <p className="text-white text-sm font-medium mt-2 truncate">{item.title}</p>
              
              {!answered ? (
                <div className="flex gap-1 mt-2">
                  <button
                    onClick={() => handleResponse(currentSet.id, item, false)}
                    className="flex-1 py-1.5 rounded-full bg-white/10 border border-white/20 text-white/80 text-xs font-medium hover:bg-white/20 active:scale-95 transition-all"
                  >
                    Nope
                  </button>
                  <button
                    onClick={() => handleResponse(currentSet.id, item, true)}
                    className="flex-1 py-1.5 rounded-full bg-gradient-to-r from-[#6366f1] to-[#8b5cf6] text-white text-xs font-medium hover:opacity-90 active:scale-95 transition-all"
                  >
                    Seen It
                  </button>
                </div>
              ) : (
                <div className={`mt-2 py-1.5 rounded-full text-center text-xs font-medium ${
                  response ? 'bg-gradient-to-r from-[#6366f1] to-[#8b5cf6] text-white' : 'bg-white/10 text-white/60'
                }`}>
                  {response ? '✓ Seen' : '✗ Nope'}
                </div>
              )}
            </div>
          );
        })}
        
        {isComplete && (
          <div className="flex-shrink-0 w-32">
            <div className="w-32 h-48 rounded-lg bg-gradient-to-br from-purple-600 via-indigo-600 to-purple-800 flex flex-col items-center justify-center p-3">
              <div className="w-10 h-10 rounded-full bg-gradient-to-br from-yellow-400 to-orange-500 flex items-center justify-center mb-1">
                <Trophy className="w-5 h-5 text-white" />
              </div>
              <span className="text-white font-bold text-lg">
                {Math.round((seenCount / currentSet.items.length) * 100)}%
              </span>
              <span className="text-purple-200 text-[10px] text-center">
                Seen
              </span>
              <div className="flex items-center gap-1 mt-2">
                <Sparkles className="w-3 h-3 text-yellow-400" />
                <span className="text-yellow-300 text-[9px]">+ Added to DNA</span>
              </div>
            </div>
            
            <p className="text-white text-sm font-medium mt-2 text-center">Complete!</p>
            
            <div className="flex flex-col gap-1 mt-2">
              {sets && sets.length > 1 && currentSetIndex < sets.length - 1 ? (
                <button
                  onClick={() => setCurrentSetIndex(prev => prev + 1)}
                  className="w-full py-1.5 rounded-full bg-gradient-to-r from-[#6366f1] to-[#8b5cf6] text-white text-xs font-medium hover:opacity-90 active:scale-95 transition-all"
                >
                  Next Set →
                </button>
              ) : (
                <button className="w-full py-1.5 rounded-full bg-gradient-to-r from-[#6366f1] to-[#8b5cf6] text-white text-xs font-medium hover:opacity-90 active:scale-95 transition-all">
                  View DNA
                </button>
              )}
              <button 
                onClick={() => setShowChallengeModal(true)}
                className="w-full py-1.5 rounded-full bg-white/10 text-white/80 text-xs font-medium hover:bg-white/20 active:scale-95 transition-all"
              >
                Challenge
              </button>
            </div>
          </div>
        )}
      </div>

      
      {sets.length > 1 && (
        <div className="flex justify-center gap-1.5 mt-3">
          {sets.map((_, idx) => (
            <button
              key={idx}
              onClick={() => setCurrentSetIndex(idx)}
              className={`w-1.5 h-1.5 rounded-full transition-colors ${
                idx === currentSetIndex ? 'bg-purple-400' : 'bg-purple-700'
              }`}
            />
          ))}
        </div>
      )}

      <Dialog open={showChallengeModal} onOpenChange={setShowChallengeModal}>
        <DialogContent className="bg-white border-gray-200 max-w-sm rounded-2xl">
          <DialogHeader>
            <DialogTitle className="text-gray-900 flex items-center gap-2">
              <Users className="w-5 h-5 text-purple-600" />
              Challenge a Friend
            </DialogTitle>
          </DialogHeader>
          
          <div className="space-y-3 max-h-64 overflow-y-auto">
            {isLoadingFriends ? (
              <div className="flex justify-center py-4">
                <Loader2 className="w-5 h-5 animate-spin text-purple-600" />
              </div>
            ) : !friendsData?.friends?.length ? (
              <p className="text-gray-500 text-sm text-center py-4">
                Add friends to challenge them!
              </p>
            ) : (
              friendsData.friends.map((friend: any) => (
                <button
                  key={friend.id}
                  onClick={() => challengeMutation.mutate(friend.id)}
                  disabled={challengeMutation.isPending}
                  className="w-full flex items-center gap-3 p-3 rounded-lg bg-gray-50 hover:bg-gray-100 transition-colors"
                >
                  <div className="w-10 h-10 rounded-full bg-gradient-to-br from-purple-500 to-indigo-600 flex items-center justify-center text-white font-bold">
                    {(friend.display_name || friend.user_name || '?')[0].toUpperCase()}
                  </div>
                  <div className="flex-1 text-left">
                    <p className="text-gray-900 font-medium text-sm">
                      {friend.display_name || friend.user_name}
                    </p>
                    <p className="text-gray-500 text-xs">@{friend.user_name}</p>
                  </div>
                  {challengeMutation.isPending ? (
                    <Loader2 className="w-4 h-4 animate-spin text-purple-600" />
                  ) : (
                    <ChevronRight className="w-4 h-4 text-gray-400" />
                  )}
                </button>
              ))
            )}
          </div>
          
          <p className="text-gray-400 text-xs text-center mt-2">
            Your score: {seenCount}/{currentSet?.items?.length || 0} ({Math.round((seenCount / (currentSet?.items?.length || 1)) * 100)}%)
          </p>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
