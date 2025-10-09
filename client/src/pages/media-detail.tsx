
import { useState } from "react";
import { ArrowLeft, Share, Star, Calendar, Clock, ExternalLink, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import Navigation from "@/components/navigation";
import { useRoute, useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth";
import { copyLink } from "@/lib/share";
import { useToast } from "@/hooks/use-toast";
import RatingModal from "@/components/rating-modal";
import { supabase } from "@/lib/supabase";

export default function MediaDetail() {
  const [, params] = useRoute("/media/:type/:source/:id");
  const [, setLocation] = useLocation();
  const { session } = useAuth();
  const [showRatingModal, setShowRatingModal] = useState(false);
  const [isTrackModalOpen, setIsTrackModalOpen] = useState(false);
  const { toast } = useToast();

  const handleTrackConsumption = () => {
    setIsTrackModalOpen(true);
  };

  const handleShare = async () => {
    try {
      await copyLink({
        kind: 'media',
        obj: {
          type: params?.type,
          source: params?.source,
          id: params?.id
        }
      });
      toast({
        title: "Link copied!",
        description: "Share this media with your friends",
      });
    } catch (err) {
      console.error('Failed to copy link:', err);
      toast({
        title: "Failed to copy link",
        description: "Please try again",
        variant: "destructive"
      });
    }
  };

  // Fetch media details from edge function
  const { data: mediaItem, isLoading } = useQuery({
    queryKey: ['media-detail', params?.type, params?.source, params?.id],
    queryFn: async () => {
      const response = await fetch(
        `https://mahpgcogwpawvviapqza.supabase.co/functions/v1/get-media-details?source=${params?.source}&external_id=${params?.id}&media_type=${params?.type}`,
        {
          headers: {
            'Authorization': `Bearer ${session?.access_token}`,
            'Content-Type': 'application/json'
          }
        }
      );
      if (!response.ok) {
        console.error('Failed to fetch media details:', response.status, await response.text());
        throw new Error('Failed to fetch media details');
      }
      return response.json();
    },
    enabled: !!params?.source && !!params?.id && !!session?.access_token
  });

  // Fetch reviews/ratings for this specific media
  const { data: reviews = [] } = useQuery({
    queryKey: ['media-reviews', params?.source, params?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('social_posts')
        .select(`
          id,
          rating,
          content,
          created_at,
          users:user_id (
            display_name,
            user_name
          )
        `)
        .eq('media_external_source', params?.source)
        .eq('media_external_id', params?.id)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Failed to fetch reviews:', error);
        return [];
      }
      return data || [];
    },
    enabled: !!params?.source && !!params?.id
  });

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 pb-20">
        <Navigation onTrackConsumption={handleTrackConsumption} />
        <div className="max-w-6xl mx-auto px-4 py-8">
          <div className="text-center">Loading...</div>
        </div>
      </div>
    );
  }

  if (!mediaItem) {
    return (
      <div className="min-h-screen bg-gray-50 pb-20">
        <Navigation onTrackConsumption={handleTrackConsumption} />
        <div className="max-w-6xl mx-auto px-4 py-8">
          <div className="text-center">Media not found</div>
        </div>
      </div>
    );
  }

  // Use fetched data or fallback to mock data structure
  const mediaData = mediaItem || {
    id: "spotify_0Yzd0g8NYmn27k2HFNplv7",
    title: "SmartLess",
    creator: "Jason Bateman, Sean Hayes, Will Arnett",
    type: "Podcast",
    provider: "Spotify",
    artwork: "https://images.unsplash.com/photo-1478737270239-2f02b77fc618?w=400&h=400&fit=crop",
    description: "Jason Bateman, Sean Hayes, and Will Arnett invite their favorite people for uninformed conversations.",
    rating: 4.8,
    totalEpisodes: 245,
    subscribers: "2.1M",
    category: "Comedy",
    language: "English",
    releaseDate: "2020-07-20",
    lastEpisode: "2024-01-15",
    averageLength: "45 min"
  };

  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      <Navigation onTrackConsumption={handleTrackConsumption} />

      <div className="max-w-6xl mx-auto px-4 py-8">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => {
            if (window.history.length > 1) {
              window.history.back();
            } else {
              setLocation('/');
            }
          }}
          className="mb-4 text-gray-600 hover:text-gray-900 hover:bg-gray-100"
          data-testid="button-back"
        >
          <ArrowLeft size={24} className="text-gray-600" />
        </Button>
        
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Main Content */}
          <div className="lg:col-span-2 space-y-8">
            {/* Media Header */}
            <div className="bg-white rounded-2xl p-8 shadow-sm">
              <div className="flex flex-col md:flex-row gap-6">
                <div className="w-48 h-48 rounded-2xl overflow-hidden shadow-lg flex-shrink-0">
                  <img 
                    src={mediaItem.artwork} 
                    alt={mediaItem.title}
                    className="w-full h-full object-cover"
                  />
                </div>
                
                <div className="flex-1 space-y-4">
                  <div>
                    <h1 className="text-3xl font-bold text-gray-900 mb-2">{mediaData.title}</h1>
                    <p className="text-lg text-gray-600 mb-4">by {mediaData.creator}</p>
                    
                    <div className="flex flex-wrap items-center gap-4 text-sm text-gray-600">
                      <div className="flex items-center gap-1">
                        <Star className="w-4 h-4 text-yellow-500 fill-current" />
                        <span className="font-medium">{mediaItem.rating}</span>
                      </div>
                      {mediaItem.type === 'Movie' && mediaItem.releaseDate && (
                        <div className="flex items-center gap-1">
                          <Calendar className="w-4 h-4" />
                          <span>{new Date(mediaItem.releaseDate).getFullYear()}</span>
                        </div>
                      )}
                      {(mediaItem.type === 'TV Show' || mediaItem.type === 'Podcast') && mediaItem.totalEpisodes > 1 && (
                        <div className="flex items-center gap-1">
                          <Calendar className="w-4 h-4" />
                          <span>{mediaItem.totalEpisodes} episodes</span>
                        </div>
                      )}
                      {mediaItem.averageLength && (
                        <div className="flex items-center gap-1">
                          <Clock className="w-4 h-4" />
                          <span>~{mediaItem.averageLength}</span>
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-3">
                    {session && (
                      <>
                        <Button variant="outline">
                          <Plus size={16} className="mr-2" />
                          Add to List
                        </Button>
                        <Button 
                          variant="outline" 
                          onClick={() => setShowRatingModal(true)}
                          data-testid="button-add-rating"
                        >
                          <Star size={16} className="mr-2" />
                          Add My Rating
                        </Button>
                      </>
                    )}
                    <Button 
                      variant="outline"
                      onClick={handleShare}
                      data-testid="button-share"
                    >
                      <Share size={16} className="mr-2" />
                      Share
                    </Button>
                  </div>

                  {/* Find On Platforms */}
                  {mediaItem.platforms && mediaItem.platforms.length > 0 && (
                    <div className="mt-6 pt-6 border-t border-gray-100">
                      <h3 className="text-sm font-medium text-gray-700 mb-3">
                        {mediaItem.type === 'Movie' || mediaItem.type === 'TV Show' 
                          ? 'Watch On' 
                          : mediaItem.type === 'Podcast' || mediaItem.type === 'Music' 
                          ? 'Listen On' 
                          : mediaItem.type === 'Book' 
                          ? 'Read On' 
                          : 'Find On'}
                      </h3>
                      <div className="flex flex-wrap gap-2">
                        {mediaItem.platforms.map((platform: any, index: number) => (
                          <a
                            key={index}
                            href={platform.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center gap-2 px-3 py-2 bg-gray-50 hover:bg-gray-100 rounded-lg transition-colors text-sm"
                            data-testid={`platform-${platform.name.toLowerCase().replace(/\s+/g, '-')}`}
                          >
                            {platform.logo && (
                              <img 
                                src={platform.logo} 
                                alt={platform.name}
                                className="w-4 h-4 object-contain"
                              />
                            )}
                            <span className="font-medium text-gray-700">{platform.name}</span>
                            <ExternalLink className="w-3 h-3 text-gray-400" />
                          </a>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Description */}
            <div className="bg-white rounded-2xl p-6 shadow-sm">
              <h2 className="text-xl font-semibold text-gray-900 mb-4">About</h2>
              <p className="text-gray-700 leading-relaxed mb-6">{mediaItem.description}</p>
              
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                <div>
                  <span className="text-gray-500">Category</span>
                  <p className="font-medium text-gray-900">{mediaItem.category}</p>
                </div>
                <div>
                  <span className="text-gray-500">Language</span>
                  <p className="font-medium text-gray-900">{mediaItem.language}</p>
                </div>
                {mediaItem.type === 'Movie' && mediaItem.releaseDate && (
                  <div>
                    <span className="text-gray-500">Release Year</span>
                    <p className="font-medium text-gray-900">{new Date(mediaItem.releaseDate).getFullYear()}</p>
                  </div>
                )}
                {(mediaItem.type === 'TV Show' || mediaItem.type === 'Podcast') && mediaItem.releaseDate && (
                  <div>
                    <span className="text-gray-500">Started</span>
                    <p className="font-medium text-gray-900">
                      {new Date(mediaItem.releaseDate).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}
                    </p>
                  </div>
                )}
                {mediaItem.runtime && (
                  <div>
                    <span className="text-gray-500">Runtime</span>
                    <p className="font-medium text-gray-900">{mediaItem.runtime} min</p>
                  </div>
                )}
              </div>
            </div>

            {/* Reviews & Ratings */}
            {reviews.length > 0 && (
              <div className="bg-white rounded-2xl p-6 shadow-sm">
                <h2 className="text-xl font-semibold text-gray-900 mb-4">
                  Reviews & Ratings ({reviews.length})
                </h2>
                <div className="space-y-4">
                  {reviews.map((review: any) => (
                    <div key={review.id} className="border-b border-gray-100 pb-4 last:border-0 last:pb-0">
                      <div className="flex items-start justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <div className="w-8 h-8 rounded-full bg-purple-100 flex items-center justify-center flex-shrink-0">
                            <span className="text-purple-600 text-sm font-medium">
                              {review.users?.display_name?.[0]?.toUpperCase() || review.users?.user_name?.[0]?.toUpperCase() || '?'}
                            </span>
                          </div>
                          <div>
                            <p className="font-medium text-gray-900">
                              {review.users?.display_name || review.users?.user_name || 'Anonymous'}
                            </p>
                            <p className="text-xs text-gray-500">
                              {new Date(review.created_at).toLocaleDateString('en-US', { 
                                month: 'short', 
                                day: 'numeric', 
                                year: 'numeric' 
                              })}
                            </p>
                          </div>
                        </div>
                        {review.rating && (
                          <div className="flex items-center gap-1">
                            <Star className="w-4 h-4 text-yellow-500 fill-current" />
                            <span className="font-medium text-gray-900">{review.rating}</span>
                          </div>
                        )}
                      </div>
                      {review.content && (
                        <p className="text-gray-700 text-sm leading-relaxed">{review.content}</p>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Related Shows */}
            <div className="bg-white rounded-2xl p-6 shadow-sm">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">You Might Also Like</h3>
              <div className="space-y-4">
                {[
                  { title: "Conan O'Brien Needs a Friend", host: "Conan O'Brien" },
                  { title: "WTF with Marc Maron", host: "Marc Maron" },
                  { title: "The Joe Rogan Experience", host: "Joe Rogan" }
                ].map((show, index) => (
                  <div key={index} className="flex items-center space-x-3">
                    <div className="w-12 h-12 bg-gray-200 rounded-lg flex-shrink-0"></div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-gray-900 text-sm">{show.title}</p>
                      <p className="text-xs text-gray-600">{show.host}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
      
      <RatingModal 
        isOpen={showRatingModal} 
        onClose={() => setShowRatingModal(false)}
        mediaTitle={mediaItem?.title || mediaData.title}
        mediaType={mediaItem?.type || mediaData.type}
        mediaCreator={mediaItem?.creator || mediaData.creator}
        mediaImage={mediaItem?.artwork || mediaData.artwork}
        mediaExternalId={params?.id}
        mediaExternalSource={params?.source}
      />
    </div>
  );
}
