import { useState, useRef, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Eye, ChevronRight, Check, X, Users, Trophy, Plus, Star, Loader2, Sparkles } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/auth";
import { useToast } from "@/hooks/use-toast";
import { queryClient } from "@/lib/queryClient";
import { trackEvent } from "@/lib/posthog";

interface SeenItItem {
  id: string;
  title: string;
  image_url: string;
  year?: string;
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
    mutationFn: async ({ setId, itemId, seen }: { setId: string; itemId: string; seen: boolean }) => {
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
      
      return { itemId, seen };
    },
    onSuccess: ({ itemId, seen }) => {
      trackEvent('seen_it_response', { item_id: itemId, seen });
    }
  });

  const handleResponse = (setId: string, itemId: string, seen: boolean) => {
    setResponses(prev => ({ ...prev, [itemId]: seen }));
    if (session) {
      responseMutation.mutate({ setId, itemId, seen });
    }
  };

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
                    onClick={() => handleResponse(currentSet.id, item.id, false)}
                    className="flex-1 py-1.5 rounded-full bg-white/10 border border-white/20 text-white/80 text-xs font-medium hover:bg-white/20 active:scale-95 transition-all"
                  >
                    Nope
                  </button>
                  <button
                    onClick={() => handleResponse(currentSet.id, item.id, true)}
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
      </div>

      {isComplete && (
        <div className="mt-4 bg-gradient-to-br from-purple-800/80 to-indigo-900/80 rounded-xl p-4 border border-purple-500/30">
          <div className="text-center mb-4">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-gradient-to-br from-yellow-400 to-orange-500 mb-3">
              <Trophy className="w-8 h-8 text-white" />
            </div>
            <h4 className="text-white font-bold text-xl mb-1">
              {Math.round((seenCount / currentSet.items.length) * 100)}% Seen
            </h4>
            <p className="text-purple-300 text-sm">
              {seenCount} of {currentSet.items.length} • {currentSet.title}
            </p>
          </div>
          
          <div className="bg-purple-900/50 rounded-lg p-3 mb-4">
            <div className="flex items-center gap-2 text-purple-200 text-sm">
              <Sparkles className="w-4 h-4 text-yellow-400" />
              <span>Added to your Entertainment DNA</span>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2">
            {sets && sets.length > 1 && currentSetIndex < sets.length - 1 ? (
              <Button 
                onClick={() => setCurrentSetIndex(prev => prev + 1)}
                className="bg-gradient-to-r from-[#6366f1] to-[#8b5cf6] text-white text-sm h-10"
              >
                <ChevronRight className="w-4 h-4 mr-1" />
                Next Set
              </Button>
            ) : (
              <Button 
                variant="outline"
                className="border-purple-400 text-purple-200 hover:bg-purple-800 text-sm h-10"
              >
                <Eye className="w-4 h-4 mr-1" />
                View History
              </Button>
            )}
            <Button 
              variant="outline"
              className="border-purple-400 text-purple-200 hover:bg-purple-800 text-sm h-10"
            >
              <Users className="w-4 h-4 mr-1" />
              Challenge Friend
            </Button>
          </div>
        </div>
      )}

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
    </Card>
  );
}
