import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { motion } from "framer-motion";
import { Trophy, ArrowLeft, Calendar, Clock, ChevronRight, Award, Sparkles } from "lucide-react";
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

  const getStatusBadge = (status: string, hasNominees: boolean = true) => {
    if (status === 'locked' && !hasNominees) {
      return <span className="px-2 py-1 bg-purple-500/20 text-purple-400 text-xs rounded-full">Coming Soon</span>;
    }
    switch (status) {
      case 'open':
        return <span className="px-2 py-1 bg-green-500/20 text-green-400 text-xs rounded-full">Open</span>;
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
    <div className="min-h-screen bg-gradient-to-b from-gray-950 via-gray-900 to-black pb-24">
      <Navigation />
      
      <div className="max-w-2xl mx-auto px-4 py-6">
        <button 
          onClick={() => navigate('/play')}
          className="flex items-center text-gray-400 hover:text-white mb-6 transition-colors"
          data-testid="button-back-play"
        >
          <ArrowLeft size={20} className="mr-2" />
          Back to Play
        </button>

        <div className="text-center mb-8">
          <div className="mb-4">
            <Badge className="bg-purple-600 text-white hover:bg-purple-700 text-[10px] py-0.5 px-2 font-bold uppercase tracking-wider">
              Consumed
            </Badge>
          </div>
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-gradient-to-r from-amber-500 to-amber-600 mb-4">
            <Trophy size={32} className="text-black" />
          </div>
          <h1 className="text-3xl font-bold text-white mb-2">Awards Ballots</h1>
          <p className="text-gray-400">Make your predictions for upcoming award shows</p>
        </div>

        {isLoading ? (
          <div className="text-center py-12">
            <div className="animate-spin w-8 h-8 border-2 border-amber-500 border-t-transparent rounded-full mx-auto mb-4" />
            <p className="text-gray-400">Loading awards...</p>
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
                    ? 'bg-gray-800/40 border border-gray-700/30 cursor-default opacity-70' 
                    : 'bg-gradient-to-r from-gray-800/80 to-gray-900/80 border border-gray-700/50 hover:border-amber-500/50 hover:shadow-lg hover:shadow-amber-500/10 cursor-pointer group'
                }`}
                data-testid={`button-awards-${event.slug}`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className={`w-14 h-14 rounded-xl flex items-center justify-center flex-shrink-0 ${
                      comingSoon 
                        ? 'bg-gradient-to-br from-gray-600 to-gray-700' 
                        : 'bg-gradient-to-br from-amber-500 to-amber-600'
                    }`}>
                      <Award size={28} className={comingSoon ? 'text-gray-400' : 'text-black'} />
                    </div>
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <div className="flex items-center gap-2">
                          <h3 className={`text-lg font-semibold transition-colors ${
                            comingSoon ? 'text-gray-400' : 'text-white group-hover:text-amber-400'
                          }`}>
                            {event.name} {event.year}
                          </h3>
                          <Badge className="bg-purple-600 text-white hover:bg-purple-700 text-[10px] py-0 px-1.5 font-bold uppercase tracking-wider">
                            Consumed
                          </Badge>
                        </div>
                        {getStatusBadge(event.status, !comingSoon)}
                      </div>
                      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-gray-400">
                        {!comingSoon && event.deadline && (
                          <span className="flex items-center">
                            <Clock size={14} className="mr-1 text-amber-400" />
                            Due: {formatDate(event.deadline)}
                          </span>
                        )}
                        <span className="flex items-center">
                          <Calendar size={14} className="mr-1" />
                          Airs: {formatDate(event.ceremony_date)}
                        </span>
                        {!comingSoon && (
                          <span className="flex items-center">
                            <Sparkles size={14} className="mr-1" />
                            +{event.points_per_correct} pts/correct
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                  {!comingSoon && (
                    <ChevronRight size={24} className="text-gray-500 group-hover:text-amber-400 transition-colors" />
                  )}
                </div>
              </motion.div>
              );
            })}
          </div>
        ) : (
          <div className="text-center py-12 bg-gray-800/50 rounded-2xl border border-gray-700">
            <Trophy size={48} className="mx-auto text-gray-500 mb-4" />
            <h3 className="text-lg font-semibold text-white mb-2">No Awards Available</h3>
            <p className="text-gray-400">Check back soon for upcoming award shows!</p>
          </div>
        )}

        <div className="mt-8 p-4 bg-gray-800/30 rounded-xl border border-gray-700/50">
          <h4 className="text-sm font-semibold text-white mb-2 flex items-center">
            <Sparkles size={16} className="mr-2 text-amber-400" />
            How it works
          </h4>
          <ul className="text-sm text-gray-400 space-y-1">
            <li>• Pick your winner for each category</li>
            <li>• Picks auto-save instantly</li>
            <li>• Earn points for each correct prediction</li>
            <li>• Share your ballot with friends</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
