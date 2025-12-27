import { useState, useEffect } from "react";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle 
} from "@/components/ui/dialog";
import { Star, Users, Sparkles, Loader2, ChevronLeft, ChevronRight, Lock, User } from "lucide-react";
import { DNAFeatureLock } from "@/components/dna-level-badge";

interface CelebrityMatch {
  name: string;
  category: string;
  match_score: number;
  dna_title: string;
  dna_tagline: string;
  shared_traits: string[];
  why_you_match: string;
  image_url?: string;
}

interface CelebrityDNAMatchesProps {
  dnaLevel: 1 | 2 | 3;
  itemCount: number;
}

export function CelebrityDNAMatches({ dnaLevel, itemCount }: CelebrityDNAMatchesProps) {
  const { session } = useAuth();
  const [celebrities, setCelebrities] = useState<CelebrityMatch[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedCelebrity, setSelectedCelebrity] = useState<CelebrityMatch | null>(null);
  const [currentIndex, setCurrentIndex] = useState(0);

  const fetchCelebrityMatches = async () => {
    if (!session?.access_token || dnaLevel < 2) return;

    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch(
        'https://mahpgcogwpawvviapqza.supabase.co/functions/v1/match-dna-celebrity',
        {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${session.access_token}`,
            'Content-Type': 'application/json',
          },
        }
      );

      if (response.ok) {
        const data = await response.json();
        setCelebrities(data.celebrities || []);
      } else {
        const errorData = await response.json();
        setError(errorData.error || 'Failed to load celebrity matches');
      }
    } catch (err) {
      console.error('Error fetching celebrity matches:', err);
      setError('Failed to load celebrity matches');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (dnaLevel >= 2 && session?.access_token) {
      fetchCelebrityMatches();
    }
  }, [dnaLevel, session?.access_token]);

  // Carousel navigation
  const nextSlide = () => {
    setCurrentIndex((prev) => (prev + 1) % Math.max(1, celebrities.length - 2));
  };

  const prevSlide = () => {
    setCurrentIndex((prev) => (prev - 1 + Math.max(1, celebrities.length - 2)) % Math.max(1, celebrities.length - 2));
  };

  // If user is not Level 2+, show locked state
  if (dnaLevel < 2) {
    const itemsNeeded = 15 - itemCount;
    return (
      <div className="mt-6 bg-white rounded-xl border border-gray-200 p-6">
        <div className="flex items-center gap-2 mb-4">
          <Star className="text-amber-500" size={20} />
          <h4 className="font-semibold text-gray-900">Celebrity DNA Matches</h4>
          <Badge className="bg-amber-100 text-amber-700 text-xs ml-auto">Level 2</Badge>
        </div>
        
        <div className="flex flex-col items-center justify-center py-8 text-center">
          <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mb-4">
            <Lock size={28} className="text-gray-400" />
          </div>
          <h5 className="font-semibold text-gray-700 mb-2">Celebrity Matches Locked</h5>
          <p className="text-sm text-gray-500 mb-4 max-w-xs">
            Discover which celebrities share your entertainment taste
          </p>
          <div className="w-full max-w-xs">
            <div className="flex justify-between text-xs text-gray-500 mb-1">
              <span>{itemCount} items logged</span>
              <span>15 needed</span>
            </div>
            <Progress value={(itemCount / 15) * 100} className="h-2" />
            <p className="text-xs text-purple-600 font-medium mt-2">
              Log {itemsNeeded} more items to unlock
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="mt-6 bg-white rounded-xl border border-gray-200 p-6">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Star className="text-amber-500" size={20} />
          <h4 className="font-semibold text-gray-900">Your Celebrity DNA Matches</h4>
        </div>
        {celebrities.length > 3 && (
          <div className="flex gap-1">
            <button
              onClick={prevSlide}
              className="w-8 h-8 rounded-full bg-gray-100 hover:bg-gray-200 flex items-center justify-center"
              data-testid="button-celebrity-prev"
            >
              <ChevronLeft size={16} />
            </button>
            <button
              onClick={nextSlide}
              className="w-8 h-8 rounded-full bg-gray-100 hover:bg-gray-200 flex items-center justify-center"
              data-testid="button-celebrity-next"
            >
              <ChevronRight size={16} />
            </button>
          </div>
        )}
      </div>

      {isLoading && (
        <div className="flex flex-col items-center justify-center py-12">
          <Loader2 className="animate-spin text-purple-600 mb-3" size={32} />
          <p className="text-sm text-gray-600">Finding your celebrity matches...</p>
          <p className="text-xs text-gray-400 mt-1">This may take a moment</p>
        </div>
      )}

      {error && (
        <div className="text-center py-8">
          <p className="text-sm text-red-600 mb-3">{error}</p>
          <Button 
            variant="outline" 
            size="sm" 
            onClick={fetchCelebrityMatches}
            data-testid="button-retry-celebrity-matches"
          >
            Try Again
          </Button>
        </div>
      )}

      {!isLoading && !error && celebrities.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {celebrities.slice(currentIndex, currentIndex + 3).map((celeb, idx) => (
            <button
              key={`${celeb.name}-${idx}`}
              onClick={() => setSelectedCelebrity(celeb)}
              className="bg-gradient-to-br from-purple-50 to-indigo-50 rounded-xl p-4 border border-purple-100 hover:border-purple-300 transition-all text-left group"
              data-testid={`card-celebrity-${idx}`}
            >
              <div className="flex items-start gap-3">
                {celeb.image_url ? (
                  <img 
                    src={celeb.image_url} 
                    alt={celeb.name}
                    className="w-14 h-14 rounded-full object-cover border-2 border-white shadow-md"
                  />
                ) : (
                  <div className="w-14 h-14 rounded-full bg-gradient-to-br from-purple-400 to-indigo-500 flex items-center justify-center border-2 border-white shadow-md">
                    <User className="text-white" size={24} />
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <h5 className="font-semibold text-gray-900 truncate">{celeb.name}</h5>
                    <Badge className="bg-green-100 text-green-700 text-xs ml-2 flex-shrink-0">
                      {celeb.match_score}%
                    </Badge>
                  </div>
                  <p className="text-xs text-purple-600 font-medium">{celeb.dna_title}</p>
                  <p className="text-xs text-gray-500 truncate mt-1">{celeb.dna_tagline}</p>
                </div>
              </div>
              
              <div className="mt-3 flex flex-wrap gap-1">
                {celeb.shared_traits?.slice(0, 2).map((trait, tIdx) => (
                  <Badge key={tIdx} variant="outline" className="text-xs bg-white">
                    {trait}
                  </Badge>
                ))}
              </div>
            </button>
          ))}
        </div>
      )}

      {!isLoading && !error && celebrities.length === 0 && (
        <div className="text-center py-8">
          <Sparkles className="mx-auto text-purple-400 mb-3" size={32} />
          <p className="text-sm text-gray-600">No celebrity matches generated yet.</p>
          <Button 
            variant="outline" 
            size="sm" 
            className="mt-3"
            onClick={fetchCelebrityMatches}
            data-testid="button-generate-celebrity-matches"
          >
            Generate Matches
          </Button>
        </div>
      )}

      {/* Celebrity Detail Dialog */}
      <Dialog open={!!selectedCelebrity} onOpenChange={() => setSelectedCelebrity(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-3">
              {selectedCelebrity?.image_url ? (
                <img 
                  src={selectedCelebrity.image_url} 
                  alt={selectedCelebrity.name}
                  className="w-12 h-12 rounded-full object-cover border-2 border-purple-200"
                />
              ) : (
                <div className="w-12 h-12 rounded-full bg-gradient-to-br from-purple-400 to-indigo-500 flex items-center justify-center">
                  <User className="text-white" size={20} />
                </div>
              )}
              <div>
                <span className="text-lg">{selectedCelebrity?.name}</span>
                <p className="text-sm font-normal text-purple-600">{selectedCelebrity?.dna_title}</p>
              </div>
            </DialogTitle>
          </DialogHeader>
          
          {selectedCelebrity && (
            <div className="space-y-4">
              {/* Match Score */}
              <div className="flex items-center justify-between bg-gradient-to-r from-green-50 to-emerald-50 rounded-lg p-4 border border-green-100">
                <span className="text-sm font-medium text-gray-700">DNA Match</span>
                <div className="flex items-center gap-2">
                  <Progress value={selectedCelebrity.match_score} className="w-24 h-2" />
                  <span className="text-lg font-bold text-green-600">{selectedCelebrity.match_score}%</span>
                </div>
              </div>

              {/* Tagline */}
              <p className="text-gray-600 italic text-center">"{selectedCelebrity.dna_tagline}"</p>

              {/* Why You Match */}
              <div>
                <h5 className="text-sm font-semibold text-gray-900 mb-2">Why You Match</h5>
                <p className="text-sm text-gray-600">{selectedCelebrity.why_you_match}</p>
              </div>

              {/* Shared Traits */}
              <div>
                <h5 className="text-sm font-semibold text-gray-900 mb-2">Shared Entertainment Traits</h5>
                <div className="flex flex-wrap gap-2">
                  {selectedCelebrity.shared_traits?.map((trait, idx) => (
                    <Badge key={idx} className="bg-purple-100 text-purple-700">
                      {trait}
                    </Badge>
                  ))}
                </div>
              </div>

              {/* Category */}
              <div className="text-center pt-2 border-t">
                <Badge variant="outline" className="text-xs capitalize">
                  {selectedCelebrity.category}
                </Badge>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
