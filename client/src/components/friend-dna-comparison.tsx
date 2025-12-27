import { useState } from "react";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle,
  DialogDescription
} from "@/components/ui/dialog";
import { Users, Sparkles, Loader2, Lock, Film, Tv, BookOpen, Music, Heart } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface FriendDNAComparisonProps {
  friendId: string;
  friendName: string;
  friendAvatar?: string;
  userDnaLevel: 1 | 2 | 3;
  userItemCount: number;
}

interface ComparisonResult {
  match_score: number;
  shared_genres: string[];
  shared_creators: string[];
  shared_titles: { title: string; media_type: string }[];
  differences: {
    user_unique: string[];
    friend_unique: string[];
  };
  insights: {
    compatibilityLine?: string;
    enjoyTogether?: string[];
    theyCouldIntroduce?: string[];
    youCouldIntroduce?: string[];
  };
  friend_name: string;
  friend_dna_label?: string;
  friend_dna_tagline?: string;
  your_dna_label?: string;
  your_dna_tagline?: string;
}

export function FriendDNACompareButton({ 
  friendId, 
  friendName, 
  friendAvatar,
  userDnaLevel, 
  userItemCount 
}: FriendDNAComparisonProps) {
  const { session } = useAuth();
  const { toast } = useToast();
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [comparison, setComparison] = useState<ComparisonResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const canCompare = userDnaLevel >= 3;
  const itemsNeeded = Math.max(0, 30 - userItemCount);

  const handleCompare = async () => {
    if (!session?.access_token || !canCompare) return;

    setIsOpen(true);
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch(
        'https://mahpgcogwpawvviapqza.supabase.co/functions/v1/compare-dna-friend',
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${session.access_token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ friend_id: friendId }),
        }
      );

      if (response.ok) {
        const data = await response.json();
        setComparison(data);
      } else {
        const errorData = await response.json();
        setError(errorData.error || 'Failed to compare DNA');
      }
    } catch (err) {
      console.error('Error comparing DNA:', err);
      setError('Failed to compare DNA');
    } finally {
      setIsLoading(false);
    }
  };

  const getMatchColor = (score: number) => {
    if (score >= 80) return 'text-green-600';
    if (score >= 60) return 'text-amber-600';
    return 'text-purple-600';
  };

  const getMatchEmoji = (score: number) => {
    if (score >= 90) return '🔥';
    if (score >= 80) return '⭐';
    if (score >= 70) return '✨';
    if (score >= 60) return '💫';
    return '🌟';
  };

  const getMediaIcon = (type: string) => {
    const typeL = type?.toLowerCase();
    if (typeL?.includes('movie') || typeL?.includes('film')) return <Film size={12} />;
    if (typeL?.includes('tv') || typeL?.includes('show')) return <Tv size={12} />;
    if (typeL?.includes('book')) return <BookOpen size={12} />;
    if (typeL?.includes('music') || typeL?.includes('album')) return <Music size={12} />;
    return <Heart size={12} />;
  };

  // If user can't compare, show locked button
  if (!canCompare) {
    return (
      <Button 
        variant="outline" 
        size="sm" 
        disabled
        className="opacity-60"
        data-testid="button-compare-dna-locked"
      >
        <Lock size={14} className="mr-2" />
        Compare DNA
        <Badge className="ml-2 bg-emerald-100 text-emerald-700 text-xs">L3</Badge>
      </Button>
    );
  }

  return (
    <>
      <Button 
        variant="outline" 
        size="sm"
        onClick={handleCompare}
        className="border-purple-200 hover:border-purple-300 hover:bg-purple-50"
        data-testid="button-compare-dna"
      >
        <Users size={14} className="mr-2 text-purple-600" />
        Compare DNA
      </Button>

      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Users className="text-purple-600" size={20} />
              DNA Comparison
            </DialogTitle>
            <DialogDescription>
              See how your entertainment taste matches with {friendName}
            </DialogDescription>
          </DialogHeader>

          {isLoading && (
            <div className="flex flex-col items-center justify-center py-12">
              <Loader2 className="animate-spin text-purple-600 mb-3" size={32} />
              <p className="text-sm text-gray-600">Comparing your DNA with {friendName}...</p>
              <p className="text-xs text-gray-400 mt-1">This may take a moment</p>
            </div>
          )}

          {error && (
            <div className="text-center py-8">
              <p className="text-sm text-red-600 mb-3">{error}</p>
              <Button 
                variant="outline" 
                size="sm" 
                onClick={handleCompare}
                data-testid="button-retry-compare"
              >
                Try Again
              </Button>
            </div>
          )}

          {!isLoading && !error && comparison && (
            <div className="space-y-6">
              {/* Match Score Header */}
              <div className="text-center bg-gradient-to-r from-purple-50 to-indigo-50 rounded-xl p-6 border border-purple-100">
                <div className="text-5xl font-bold mb-2">
                  <span className={getMatchColor(comparison.match_score)}>
                    {comparison.match_score}%
                  </span>
                  <span className="ml-2">{getMatchEmoji(comparison.match_score)}</span>
                </div>
                <p className="text-gray-600 font-medium">Entertainment DNA Match</p>
                {comparison.insights?.compatibilityLine && (
                  <p className="text-sm text-purple-600 mt-2 italic">
                    "{comparison.insights.compatibilityLine}"
                  </p>
                )}
              </div>

              {/* DNA Labels */}
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-purple-50 rounded-lg p-3 border border-purple-100">
                  <p className="text-xs text-gray-500 mb-1">Your DNA</p>
                  <p className="font-semibold text-purple-800 text-sm">
                    {comparison.your_dna_label || 'Your Profile'}
                  </p>
                </div>
                <div className="bg-indigo-50 rounded-lg p-3 border border-indigo-100">
                  <p className="text-xs text-gray-500 mb-1">{friendName}'s DNA</p>
                  <p className="font-semibold text-indigo-800 text-sm">
                    {comparison.friend_dna_label || 'Their Profile'}
                  </p>
                </div>
              </div>

              {/* Shared Titles */}
              {comparison.shared_titles?.length > 0 && (
                <div>
                  <h5 className="text-sm font-semibold text-gray-900 mb-2 flex items-center gap-2">
                    <Heart size={14} className="text-red-500" />
                    You Both Love
                  </h5>
                  <div className="flex flex-wrap gap-2">
                    {comparison.shared_titles.slice(0, 6).map((item, idx) => (
                      <Badge key={idx} className="bg-red-50 text-red-700 text-xs">
                        {getMediaIcon(item.media_type)}
                        <span className="ml-1">{item.title}</span>
                      </Badge>
                    ))}
                  </div>
                </div>
              )}

              {/* Shared Genres */}
              {comparison.shared_genres?.length > 0 && (
                <div>
                  <h5 className="text-sm font-semibold text-gray-900 mb-2">Shared Genres</h5>
                  <div className="flex flex-wrap gap-2">
                    {comparison.shared_genres.slice(0, 6).map((genre, idx) => (
                      <Badge key={idx} className="bg-purple-100 text-purple-700 text-xs">
                        {genre}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}

              {/* What to Enjoy Together */}
              {comparison.insights?.enjoyTogether?.length > 0 && (
                <div className="bg-gradient-to-r from-amber-50 to-orange-50 rounded-lg p-4 border border-amber-100">
                  <h5 className="text-sm font-semibold text-amber-800 mb-2 flex items-center gap-2">
                    <Sparkles size={14} />
                    Watch/Read Together
                  </h5>
                  <ul className="space-y-1">
                    {comparison.insights.enjoyTogether.map((suggestion, idx) => (
                      <li key={idx} className="text-sm text-amber-700">• {suggestion}</li>
                    ))}
                  </ul>
                </div>
              )}

              {/* What They Could Introduce You To */}
              {comparison.insights?.theyCouldIntroduce?.length > 0 && (
                <div>
                  <h5 className="text-sm font-semibold text-gray-900 mb-2">
                    {friendName} Could Introduce You To
                  </h5>
                  <div className="flex flex-wrap gap-2">
                    {comparison.insights.theyCouldIntroduce.map((item, idx) => (
                      <Badge key={idx} variant="outline" className="text-xs">
                        {item}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}

              {/* What You Could Introduce Them To */}
              {comparison.insights?.youCouldIntroduce?.length > 0 && (
                <div>
                  <h5 className="text-sm font-semibold text-gray-900 mb-2">
                    You Could Introduce {friendName} To
                  </h5>
                  <div className="flex flex-wrap gap-2">
                    {comparison.insights.youCouldIntroduce.map((item, idx) => (
                      <Badge key={idx} variant="outline" className="text-xs">
                        {item}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}

export function FriendDNALockMessage({ itemCount }: { itemCount: number }) {
  const itemsNeeded = Math.max(0, 30 - itemCount);
  
  return (
    <div className="flex items-center gap-2 p-3 bg-gray-50 rounded-lg border border-gray-200 text-center">
      <Lock size={16} className="text-gray-400 flex-shrink-0" />
      <p className="text-xs text-gray-600">
        Log <span className="font-semibold text-purple-600">{itemsNeeded} more items</span> to unlock Friend DNA Comparisons
      </p>
    </div>
  );
}
