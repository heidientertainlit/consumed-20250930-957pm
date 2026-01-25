import { useQuery } from "@tanstack/react-query";
import { Link, useLocation } from "wouter";
import { motion } from "framer-motion";
import { Trophy, ArrowLeft, Calendar, Clock, ChevronRight, Award, Sparkles, ChevronLeft, Target } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/lib/supabase";
import Navigation from "@/components/navigation";

interface AwardsEvent {
  id: string;
  slug: string;
  name: string;
  year: number;
  status: 'open' | 'locked' | 'completed';
  deadline: string | null;
  ceremony_date: string | null;
  points_per_correct: number;
}

export default function AwardsList() {
  const [, navigate] = useLocation();

  const { data: events, isLoading } = useQuery<AwardsEvent[]>({
    queryKey: ['awards-events'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('awards_events')
        .select('*')
        .order('ceremony_date', { ascending: true });
      
      if (error) throw error;
      return data || [];
    }
  });

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return 'TBD';
    return new Date(dateStr).toLocaleDateString('en-US', { 
      month: 'short', 
      day: 'numeric', 
      year: 'numeric' 
    });
  };

  const getStatusBadge = (status: string, eventSlug: string, hasNominees: boolean = true) => {
    if (status === 'locked' && !hasNominees) {
      return <span className="px-2 py-1 bg-purple-500/20 text-purple-400 text-xs rounded-full">Coming Soon</span>;
    }
    // Show Trending for newly opened Oscars 2026
    const isTrending = status === 'open' && eventSlug === 'oscars-2026';
    switch (status) {
      case 'open':
        return isTrending 
          ? <span className="px-2 py-1 bg-orange-500/20 text-orange-500 text-xs rounded-full font-semibold">🔥 Trending</span>
          : <span className="px-2 py-1 bg-green-500/20 text-green-400 text-xs rounded-full">Open</span>;
      case 'locked':
        return <span className="px-2 py-1 bg-amber-500/20 text-amber-400 text-xs rounded-full">Locked</span>;
      case 'completed':
        return <span className="px-2 py-1 bg-gray-500/20 text-gray-400 text-xs rounded-full">Completed</span>;
      default:
        return null;
    }
  };

  const isComingSoon = (event: AwardsEvent) => {
    return event.status === 'locked';
  };

  return (
    <div className="min-h-screen bg-gray-50 pb-24">
      <Navigation />
      
      {/* Header Section with Gradient - Matching Polls/Trivia */}
      <div className="bg-gradient-to-r from-[#0a0a0f] via-[#12121f] to-[#2d1f4e] pb-12 -mt-px">
        <div className="max-w-4xl mx-auto px-4 pt-4">
          <div>
            <h1 className="text-3xl font-semibold text-white mb-2" data-testid="predictions-title">Predictions</h1>
            <p className="text-gray-400 text-left">
              Predict outcomes, earn points, and climb the leaderboard by showing off your expertise
            </p>
          </div>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 py-8 -mt-6">
        {/* Awards Ballots Section */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-2">
              <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
                Awards Ballots
              </h2>
            </div>
          </div>

          {isLoading ? (
            <div className="text-center py-12">
              <div className="animate-spin w-8 h-8 border-2 border-amber-500 border-t-transparent rounded-full mx-auto mb-4" />
              <p className="text-gray-500 font-medium">Loading ballots...</p>
            </div>
          ) : events && events.length > 0 ? (
            <div className="space-y-4">
              {events.map((event, index) => {
                const comingSoon = isComingSoon(event);
                return (
                  <motion.div
                    key={event.id}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.1 }}
                    onClick={() => !comingSoon && navigate(`/play/awards/${event.slug}`)}
                    className={`w-full rounded-2xl p-5 text-left transition-all ${
                      comingSoon 
                        ? 'bg-gray-100 border border-gray-200 cursor-default opacity-70' 
                        : 'bg-white border border-gray-200 shadow-sm hover:border-amber-500/50 hover:shadow-md cursor-pointer group'
                    }`}
                    data-testid={`button-awards-${event.slug}`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        <div className={`w-14 h-14 rounded-xl flex items-center justify-center flex-shrink-0 ${
                          comingSoon 
                            ? 'bg-gray-200' 
                            : 'bg-amber-50'
                        }`}>
                          <Award size={28} className={comingSoon ? 'text-gray-400' : 'text-amber-600'} />
                        </div>
                        <div>
                          <div className="flex items-center gap-2 mb-1">
                            <Badge className="bg-purple-600 text-white hover:bg-purple-700 text-[10px] py-0.5 px-2 font-bold uppercase tracking-wider">
                              Consumed
                            </Badge>
                            <h3 className={`text-lg font-bold transition-colors ${
                              comingSoon ? 'text-gray-400' : 'text-gray-900 group-hover:text-amber-600'
                            }`}>
                              {event.name} {event.year}
                            </h3>
                            {getStatusBadge(event.status, event.slug, !comingSoon)}
                          </div>
                          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-gray-500">
                            {!comingSoon && event.deadline && (
                              <span className="flex items-center">
                                <Clock size={14} className="mr-1 text-amber-500" />
                                Due: {formatDate(event.deadline)}
                              </span>
                            )}
                            <span className="flex items-center">
                              <Calendar size={14} className="mr-1" />
                              Airs: {formatDate(event.ceremony_date)}
                            </span>
                            {!comingSoon && (
                              <span className="flex items-center">
                                <Sparkles size={14} className="mr-1 text-purple-600" />
                                +{event.points_per_correct} pts/correct
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                      {!comingSoon && (
                        <ChevronRight size={24} className="text-gray-400 group-hover:text-amber-500 transition-colors" />
                      )}
                    </div>
                  </motion.div>
                );
              })}
            </div>
          ) : (
            <div className="text-center py-12 bg-white rounded-2xl border border-gray-200 shadow-sm">
              <Trophy size={48} className="mx-auto text-gray-300 mb-4" />
              <h3 className="text-lg font-semibold text-gray-900 mb-2">No Awards Available</h3>
              <p className="text-gray-500">Check back soon for upcoming award shows!</p>
            </div>
          )}
        </div>

        {/* How it works Section */}
        <div className="mt-12 p-6 bg-white rounded-2xl border border-gray-200 shadow-sm">
          <h4 className="text-base font-bold text-gray-900 mb-4 flex items-center">
            <Sparkles size={20} className="mr-2 text-amber-500" />
            How Predictions Work
          </h4>
          <div className="grid grid-cols-1 gap-4 text-sm text-gray-600">
            <div className="flex gap-3">
              <div className="w-6 h-6 rounded-full bg-amber-50 text-amber-600 flex items-center justify-center flex-shrink-0 font-bold">1</div>
              <p>Pick your winner for each category before the deadline.</p>
            </div>
            <div className="flex gap-3">
              <div className="w-6 h-6 rounded-full bg-amber-50 text-amber-600 flex items-center justify-center flex-shrink-0 font-bold">2</div>
              <p>Your picks are automatically saved as you make them.</p>
            </div>
            <div className="flex gap-3">
              <div className="w-6 h-6 rounded-full bg-amber-50 text-amber-600 flex items-center justify-center flex-shrink-0 font-bold">3</div>
              <p>Earn points for every correct prediction made.</p>
            </div>
            <div className="flex gap-3">
              <div className="w-6 h-6 rounded-full bg-amber-50 text-amber-600 flex items-center justify-center flex-shrink-0 font-bold">4</div>
              <p>Share your ballot link with friends to compare picks.</p>
            </div>
          </div>
        </div>
      </div>
      
    </div>
  );
}
