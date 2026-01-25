import { useState, useEffect, useRef } from 'react';
import { Flame, Search, Send, X, ChevronRight, Grid, Star, List } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useAuth } from '@/lib/auth';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/lib/supabase';
import { useLocation } from 'wouter';
import { QuickAddListSheet } from './quick-add-list-sheet';

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
  const [, setLocation] = useLocation();
  const [isExpanded, setIsExpanded] = useState(!!preselectedMedia);
  const [step, setStep] = useState<'search' | 'react'>(preselectedMedia ? 'react' : 'search');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedMedia, setSelectedMedia] = useState<any>(preselectedMedia || null);
  const [reactText, setReactText] = useState('');
  const [isPosting, setIsPosting] = useState(false);
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [recentMedia, setRecentMedia] = useState<any[]>([]);
  const [showPostDialog, setShowPostDialog] = useState(false);
  const [postedMedia, setPostedMedia] = useState<any>(null);
  const [showListSheet, setShowListSheet] = useState(false);
  const debounceRef = useRef<NodeJS.Timeout | null>(null);

  const popularMedia = [
    { id: 'tmdb-1396', title: 'Breaking Bad', type: 'TV', image: 'https://image.tmdb.org/t/p/w92/ztkUQFLlC19CCMYHW9o1zWhJRNq.jpg', external_id: '1396', external_source: 'tmdb' },
    { id: 'tmdb-1399', title: 'Game of Thrones', type: 'TV', image: 'https://image.tmdb.org/t/p/w92/1XS1oqL89opfnbLl8WnZY1O1uJx.jpg', external_id: '1399', external_source: 'tmdb' },
    { id: 'tmdb-238', title: 'The Godfather', type: 'Movie', image: 'https://image.tmdb.org/t/p/w92/3bhkrj58Vtu7enYsRolD1fZdja1.jpg', external_id: '238', external_source: 'tmdb' },
  ];

  useEffect(() => {
    const fetchRecentMedia = async () => {
      if (!session?.access_token) return;
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;
        
        const { data: listItems } = await supabase
          .from('list_items')
          .select('title, media_type, image_url, external_id, external_source')
          .eq('user_id', user.id)
          .order('created_at', { ascending: false })
          .limit(5);
        
        if (listItems && listItems.length > 0) {
          setRecentMedia(listItems.map((item: any) => ({
            id: item.external_id,
            title: item.title,
            type: item.media_type || 'Movie',
            image: item.image_url,
            external_id: item.external_id,
            external_source: item.external_source || 'tmdb',
          })));
        } else {
          setRecentMedia(popularMedia);
        }
      } catch (error) {
        console.error('Failed to fetch recent media:', error);
        setRecentMedia(popularMedia);
      }
    };
    
    if (isExpanded && recentMedia.length === 0) {
      fetchRecentMedia();
    }
  }, [isExpanded, session?.access_token]);

  useEffect(() => {
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }

    if (!searchQuery.trim() || searchQuery.length < 2) {
      setSearchResults([]);
      return;
    }

    debounceRef.current = setTimeout(async () => {
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
    }, 300);

    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
    };
  }, [searchQuery, session?.access_token]);

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
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const { error } = await supabase.from('social_posts').insert({
        user_id: user.id,
        content: reactText,
        post_type: 'hot_take',
        visibility: 'public',
        media_title: selectedMedia.title,
        media_type: selectedMedia.type?.toLowerCase() || 'movie',
        media_external_id: selectedMedia.external_id || selectedMedia.id,
        media_external_source: selectedMedia.external_source || 'tmdb',
        image_url: selectedMedia.image || selectedMedia.poster_url || selectedMedia.image_url || '',
        fire_votes: 0,
        ice_votes: 0,
      });

      if (error) throw error;

      // Save the media for the dialog and show it
      setPostedMedia(selectedMedia);
      handleClose();
      setShowPostDialog(true);
      onPost?.();
    } catch (error) {
      console.error('Post error:', error);
      toast({
        title: "Couldn't post",
        description: "Please try again.",
        variant: "destructive",
      });
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

  return (
    <>
    <Card className="bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 border-0 rounded-2xl overflow-hidden shadow-sm transition-all">
      {/* Header - always visible, tap to expand/collapse */}
      <div 
        className={`p-4 cursor-pointer ${isExpanded ? '' : 'active:scale-[0.99]'}`}
        onClick={() => !isExpanded && setIsExpanded(true)}
      >
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center">
            <Flame className="w-5 h-5 text-white" />
          </div>
          <div className="flex-1">
            <p className="text-white font-semibold text-sm">
              {isExpanded ? 'Hot Take' : 'Got a hot take?'}
            </p>
            <p className="text-white/70 text-xs">
              {isExpanded ? 'Pick what it\'s about' : 'Share it.'}
            </p>
          </div>
          {isExpanded ? (
            <button 
              onClick={(e) => { e.stopPropagation(); handleClose(); }}
              className="text-white/70 active:text-white"
            >
              <X size={20} />
            </button>
          ) : (
            <ChevronRight className="w-5 h-5 text-white/50" />
          )}
        </div>
      </div>

      {/* Expandable content */}
      {isExpanded && (
        <div className="bg-white rounded-t-2xl p-4">
        {step === 'search' && (
          <>
            {/* Search Input */}
            <div className="relative mb-4">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search movies, shows..."
                className="w-full pl-9 pr-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm text-gray-900 focus:outline-none focus:border-purple-400"
                autoFocus
              />
            </div>

            {/* Search Results - Add page style */}
            {searchResults.length > 0 && (
              <div className="bg-gray-50 rounded-xl p-3 mb-4">
                <div className="flex items-center gap-2 mb-3">
                  <Grid className="w-4 h-4 text-gray-500" />
                  <span className="text-gray-700 font-semibold text-sm">Media</span>
                </div>
                <div className="space-y-2">
                  {searchResults.map((result) => (
                    <button
                      key={result.id || result.external_id}
                      onClick={() => handleSelectMedia(result)}
                      className="w-full flex items-center gap-3 bg-white rounded-xl p-3 border border-gray-100 active:bg-gray-50 text-left transition-colors"
                    >
                      <img 
                        src={result.poster_url || result.image_url || 'https://via.placeholder.com/48x72'} 
                        alt={result.title}
                        className="w-12 h-16 rounded-lg object-cover flex-shrink-0"
                      />
                      <div className="flex-1 min-w-0">
                        <p className="text-gray-900 font-semibold text-sm truncate">{result.title}</p>
                        <p className="text-gray-500 text-xs capitalize">
                          {result.type} {result.year && `• ${result.year}`}
                        </p>
                      </div>
                      <ChevronRight className="w-5 h-5 text-gray-400 flex-shrink-0" />
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Loading State */}
            {isSearching && (
              <div className="text-center py-4 text-gray-500 text-sm">
                Searching...
              </div>
            )}

            {/* Recent/Popular - only show when no search query */}
            {searchResults.length === 0 && !isSearching && !searchQuery && (
              <>
                <p className="text-xs text-gray-500 font-medium mb-2">
                  {recentMedia.length > 0 && recentMedia[0]?.id !== 'tmdb-1396' ? 'Recent' : 'Popular'}
                </p>
                <div className="flex gap-3 overflow-x-auto pb-2">
                  {(recentMedia.length > 0 ? recentMedia : popularMedia).map((media) => (
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
                src={selectedMedia.image || selectedMedia.poster_url || selectedMedia.image_url} 
                alt={selectedMedia.title}
                className="w-12 h-16 rounded-lg object-cover"
              />
              <div className="flex-1">
                <p className="text-gray-900 font-medium">{selectedMedia.title}</p>
                <p className="text-gray-500 text-xs capitalize">{selectedMedia.type}</p>
              </div>
              <button 
                onClick={() => { setStep('search'); setSelectedMedia(null); }}
                className="text-gray-400 active:text-gray-600"
              >
                <X size={18} />
              </button>
            </div>

            <textarea
              value={reactText}
              onChange={(e) => setReactText(e.target.value)}
              placeholder="What's your take? No spoilers without warning..."
              className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl text-sm text-gray-900 focus:outline-none focus:border-purple-400 resize-none"
              rows={3}
              autoFocus
            />

            <div className="flex justify-end mt-3">
              <Button
                onClick={handlePost}
                disabled={!reactText.trim() || isPosting}
                className="bg-gradient-to-r from-purple-600 to-indigo-600 active:from-purple-700 active:to-indigo-700 rounded-xl"
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
      )}
    </Card>

    {/* Post-submission dialog */}
    <Dialog open={showPostDialog} onOpenChange={setShowPostDialog}>
      <DialogContent className="sm:max-w-sm rounded-3xl bg-white border-0">
        <DialogHeader>
          <DialogTitle className="text-center text-lg font-semibold text-gray-900">Take posted! 🔥</DialogTitle>
        </DialogHeader>
        <div className="flex flex-col items-center py-2">
          {postedMedia?.image && (
            <img 
              src={postedMedia.image} 
              alt={postedMedia?.title} 
              className="w-16 h-24 object-cover rounded-xl mb-3 shadow-md"
            />
          )}
          <p className="text-center text-gray-600 text-sm mb-5">
            Want to rate or track <span className="font-medium text-gray-900">{postedMedia?.title}</span>?
          </p>
          <div className="flex gap-3 w-full px-2">
            <button
              className="flex-1 flex items-center justify-center gap-2 py-3 px-4 rounded-full border-2 border-purple-200 bg-purple-50 text-purple-700 font-medium text-sm hover:bg-purple-100 transition-colors"
              onClick={() => {
                setShowPostDialog(false);
                // Open the list sheet directly - rating is part of that flow
                setShowListSheet(true);
              }}
            >
              <Star className="w-4 h-4" />
              Rate it
            </button>
            <button
              className="flex-1 flex items-center justify-center gap-2 py-3 px-4 rounded-full bg-gradient-to-r from-purple-600 to-indigo-600 text-white font-medium text-sm hover:from-purple-700 hover:to-indigo-700 transition-colors shadow-md"
              onClick={() => {
                setShowPostDialog(false);
                setShowListSheet(true);
              }}
            >
              <List className="w-4 h-4" />
              Add to list
            </button>
          </div>
          <button
            className="mt-5 text-sm text-gray-400 hover:text-gray-600"
            onClick={() => setShowPostDialog(false)}
          >
            Maybe later
          </button>
        </div>
      </DialogContent>
    </Dialog>

    {/* Add to List Sheet */}
    <QuickAddListSheet
      isOpen={showListSheet}
      onClose={() => setShowListSheet(false)}
      media={postedMedia ? {
        title: postedMedia.title,
        mediaType: postedMedia.type || 'movie',
        imageUrl: postedMedia.image,
        externalId: postedMedia.external_id || postedMedia.id,
        externalSource: postedMedia.external_source || 'tmdb',
      } : null}
    />
    </>
  );
}
