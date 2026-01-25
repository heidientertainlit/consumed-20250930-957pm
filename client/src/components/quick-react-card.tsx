import { useState } from 'react';
import { MessageCircle, Search, Send, X, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { useAuth } from '@/lib/auth';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/lib/supabase';

interface PreselectedMedia {
  id: string;
  title: string;
  type: string;
  image?: string;
}

interface QuickReactCardProps {
  onPost?: () => void;
  preselectedMedia?: PreselectedMedia;
}

export function QuickReactCard({ onPost, preselectedMedia }: QuickReactCardProps) {
  const { session } = useAuth();
  const { toast } = useToast();
  const [isExpanded, setIsExpanded] = useState(!!preselectedMedia);
  const [step, setStep] = useState<'search' | 'react'>(preselectedMedia ? 'react' : 'search');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedMedia, setSelectedMedia] = useState<any>(preselectedMedia || null);
  const [reactText, setReactText] = useState('');
  const [isPosting, setIsPosting] = useState(false);
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [isSearching, setIsSearching] = useState(false);

  const recentMedia = [
    { id: '1', title: 'Severance', type: 'TV', image: 'https://image.tmdb.org/t/p/w92/pB8BM7pdSp6B6Ih7QZ4DrQ3PmJK.jpg' },
    { id: '2', title: 'The Bear', type: 'TV', image: 'https://image.tmdb.org/t/p/w92/sHFlbKS3WLqMnp9t2ghADIJFnuQ.jpg' },
    { id: '3', title: 'Dune: Part Two', type: 'Movie', image: 'https://image.tmdb.org/t/p/w92/8b8R8l88Qje9dn9OE8PY05Nxl1X.jpg' },
  ];

  const handleSearch = async () => {
    if (!searchQuery.trim()) return;
    setIsSearching(true);
    try {
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/media-search`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${session?.access_token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ query: searchQuery, types: ['movie', 'tv'] }),
        }
      );
      const data = await response.json();
      setSearchResults(data.results?.slice(0, 5) || []);
    } catch (error) {
      console.error('Search error:', error);
    }
    setIsSearching(false);
  };

  const handleSelectMedia = (media: any) => {
    setSelectedMedia(media);
    setStep('react');
    setSearchResults([]);
    setSearchQuery('');
  };

  const handlePost = async () => {
    if (!reactText.trim() || !selectedMedia) return;
    setIsPosting(true);
    try {
      const { error } = await supabase.from('social_posts').insert({
        user_id: session?.user?.id,
        content: reactText,
        post_type: 'hot_take',
        media_items: [{
          title: selectedMedia.title,
          media_type: selectedMedia.type?.toLowerCase() || 'movie',
          image_url: selectedMedia.image || selectedMedia.poster_url,
          external_id: selectedMedia.id || selectedMedia.external_id,
          external_source: 'tmdb'
        }]
      });

      if (error) throw error;

      toast({ title: 'Posted!', description: `Your take on ${selectedMedia.title} is live` });
      setReactText('');
      setSelectedMedia(null);
      setStep('search');
      setIsExpanded(false);
      onPost?.();
    } catch (error: any) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    }
    setIsPosting(false);
  };

  const handleClose = () => {
    setIsExpanded(false);
    setStep('search');
    setSelectedMedia(null);
    setReactText('');
    setSearchQuery('');
    setSearchResults([]);
  };

  if (!session) return null;

  if (!isExpanded) {
    return (
      <Card 
        className="bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 border-0 rounded-2xl p-4 shadow-sm cursor-pointer active:scale-[0.98] transition-transform"
        onClick={() => setIsExpanded(true)}
      >
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center">
            <MessageCircle className="w-5 h-5 text-white" />
          </div>
          <div className="flex-1">
            <p className="text-white font-semibold text-sm">What are you consuming?</p>
            <p className="text-white/70 text-xs">Share a hot take.</p>
          </div>
          <ChevronRight className="w-5 h-5 text-white/50" />
        </div>
      </Card>
    );
  }

  return (
    <Card className="bg-white border border-gray-100 rounded-2xl overflow-hidden shadow-lg">
      <div className="bg-gradient-to-r from-purple-600 to-indigo-600 px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <MessageCircle className="w-5 h-5 text-white" />
          <span className="text-white font-semibold">Quick React</span>
        </div>
        <button onClick={handleClose} className="text-white/70 hover:text-white">
          <X size={20} />
        </button>
      </div>

      <div className="p-4">
        {step === 'search' && (
          <>
            <div className="flex items-center gap-2 mb-4">
              <div className="flex-1 relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
                  placeholder="Search for what you're watching..."
                  className="w-full pl-9 pr-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-purple-400"
                  autoFocus
                />
              </div>
              <Button 
                onClick={handleSearch}
                disabled={isSearching}
                className="bg-purple-600 hover:bg-purple-700 rounded-xl"
              >
                {isSearching ? '...' : 'Search'}
              </Button>
            </div>

            {searchResults.length > 0 && (
              <div className="space-y-2 mb-4">
                <p className="text-xs text-gray-500 font-medium">Results</p>
                {searchResults.map((result) => (
                  <button
                    key={result.id || result.external_id}
                    onClick={() => handleSelectMedia(result)}
                    className="w-full flex items-center gap-3 p-2 rounded-xl hover:bg-gray-50 text-left"
                  >
                    <img 
                      src={result.poster_url || result.image_url || 'https://via.placeholder.com/40x60'} 
                      alt={result.title}
                      className="w-10 h-14 rounded-lg object-cover"
                    />
                    <div>
                      <p className="text-gray-900 font-medium text-sm">{result.title}</p>
                      <p className="text-gray-500 text-xs">{result.type} {result.year && `• ${result.year}`}</p>
                    </div>
                  </button>
                ))}
              </div>
            )}

            {searchResults.length === 0 && (
              <>
                <p className="text-xs text-gray-500 font-medium mb-2">Recent</p>
                <div className="flex gap-3 overflow-x-auto pb-2">
                  {recentMedia.map((media) => (
                    <button
                      key={media.id}
                      onClick={() => handleSelectMedia(media)}
                      className="flex-shrink-0 text-center"
                    >
                      <img 
                        src={media.image} 
                        alt={media.title}
                        className="w-16 h-24 rounded-xl object-cover mb-1 border border-gray-200"
                      />
                      <p className="text-xs text-gray-700 font-medium truncate w-16">{media.title}</p>
                    </button>
                  ))}
                </div>
              </>
            )}
          </>
        )}

        {step === 'react' && selectedMedia && (
          <>
            <div className="flex items-center gap-3 mb-4 p-3 bg-gray-50 rounded-xl">
              <img 
                src={selectedMedia.image || selectedMedia.poster_url} 
                alt={selectedMedia.title}
                className="w-12 h-16 rounded-lg object-cover"
              />
              <div className="flex-1">
                <p className="text-gray-900 font-medium">{selectedMedia.title}</p>
                <p className="text-gray-500 text-xs">{selectedMedia.type}</p>
              </div>
              <button 
                onClick={() => { setStep('search'); setSelectedMedia(null); }}
                className="text-gray-400 hover:text-gray-600"
              >
                <X size={18} />
              </button>
            </div>

            <textarea
              value={reactText}
              onChange={(e) => setReactText(e.target.value)}
              placeholder="What's your take? No spoilers without warning..."
              className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-purple-400 resize-none"
              rows={3}
              autoFocus
            />

            <div className="flex justify-end mt-3">
              <Button
                onClick={handlePost}
                disabled={!reactText.trim() || isPosting}
                className="bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 rounded-xl"
              >
                {isPosting ? 'Posting...' : (
                  <>
                    <Send size={16} className="mr-2" />
                    Post Take
                  </>
                )}
              </Button>
            </div>
          </>
        )}
      </div>
    </Card>
  );
}
