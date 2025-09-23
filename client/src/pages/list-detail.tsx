import { useState } from "react";
import Navigation from "@/components/navigation";
import ConsumptionTracker from "@/components/consumption-tracker";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Plus, Search, Settings, Users, Globe, Lock, X, Share2, Trash2, MoreVertical, Star, Clock, Calendar } from "lucide-react";
import { useLocation } from "wouter";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth";
import { useToast } from "@/hooks/use-toast";

export default function ListDetail() {
  const [, setLocation] = useLocation();
  const [isPublic, setIsPublic] = useState(false); // Initialize as private, will be updated when data loads
  const [isTrackModalOpen, setIsTrackModalOpen] = useState(false);
  
  const queryClient = useQueryClient();
  const { session } = useAuth();
  const { toast } = useToast();

  // Get list name from URL: /list/currently -> "currently" 
  const urlListName = window.location.pathname.split('/list/')[1];
  
  // Get user ID from URL parameters for shared links
  const urlParams = new URLSearchParams(window.location.search);
  const sharedUserId = urlParams.get('user');
  
  // Load REAL user data - works for both your own lists and shared public lists
  const { data: userListsData, isLoading: listsLoading } = useQuery({
    queryKey: ['user-lists-with-media', sharedUserId || 'own'],
    queryFn: async () => {
      // For shared links (has sharedUserId), use public list access
      if (sharedUserId) {
        console.log('Loading shared public list data for user:', sharedUserId);
        
        const response = await fetch(`https://mahpgcogwpawvviapqza.supabase.co/functions/v1/get-public-list?list_slug=${urlListName}&user_id=${sharedUserId}`, {
          method: "GET",
          headers: {
            "Content-Type": "application/json",
          },
        });
        
        if (!response.ok) {
          const errorText = await response.text();
          console.error('Public list fetch failed:', response.status, errorText);
          throw new Error('Failed to fetch public list');
        }
        
        const data = await response.json();
        console.log('Public list data:', data);
        
        // Convert to expected format
        return {
          lists: [data.list]
        };
      }
      
      if (!session?.access_token) {
        console.log('No session token available for list detail');
        return null;
      }
      
      const response = await fetch("https://mahpgcogwpawvviapqza.supabase.co/functions/v1/get-user-lists-with-media", {
        method: "GET",
        headers: {
          "Authorization": `Bearer ${session.access_token}`,
        },
      });
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error('User lists fetch failed:', response.status, errorText);
        throw new Error('Failed to fetch user lists');
      }
      
      const data = await response.json();
      console.log('REAL user lists data for list detail:', data);
      return data;
    },
    enabled: !!urlListName,
  });

  // Find the specific list from the REAL data based on URL slug
  const sharedListData = userListsData?.lists?.find((list: any) => {
    const sluggedTitle = list.title.toLowerCase().replace(/\s+/g, '-');
    return sluggedTitle === urlListName;
  });

  // Update the data structure to match new response format
  const listData = sharedListData ? {
    id: sharedListData.id,
    name: sharedListData.title,
    description: getListDescription(sharedListData.title),
    items: (sharedListData.items || []).map((item: any) => ({
      id: item.id,
      title: item.title,
      creator: item.creator || 'Unknown',
      type: item.media_type ? capitalizeFirst(item.media_type) : 'Mixed',
      artwork: item.image_url || "https://images.unsplash.com/photo-1481627834876-b7833e8f5570?w=80&h=80&fit=crop",
      progress: 0,
      addedDate: new Date(item.created_at).toLocaleDateString(),
      addedBy: "You"
    })),
    collaborators: [],
    owner: "You",
    createdDate: new Date().toLocaleDateString(),
    totalItems: sharedListData.items?.length || 0,
    likes: 0,
    isPublic: !sharedListData?.is_private // is_private from DB, invert for isPublic
  } : null;

  // Update local state when list data loads
  if (listData && isPublic !== listData.isPublic) {
    setIsPublic(listData.isPublic);
  }

  // Helper functions
  function getListDescription(title: string) {
    switch (title) {
      case "All": return "All your tracked media items";
      case "Currently": return "What you're watching, reading, or playing right now";
      case "Queue": return "Media you want to consume later";
      case "Finished": return "Media you've completed";
      case "Did Not Finish": return "Media you started but didn't complete";
      default: return "Your custom list";
    }
  }

  function capitalizeFirst(str: string) {
    return str.charAt(0).toUpperCase() + str.slice(1);
  }


  // Use exact same working pattern as prediction invites
  const handleShare = async () => {
    // Add user identifier to shared URL so non-logged-in users can see the data
    const shareUrl = session?.user?.id 
      ? `${window.location.origin}/list/${urlListName}?user=${session.user.id}`
      : window.location.href;
      
    const shareData = {
      title: `Check out my entertainment list on entertainlit!`,
      text: `I'm tracking my ${listData?.name || 'entertainment'} - want to see what I'm consuming? Check it out and share yours too! 🎬🎵📚`,
      url: shareUrl
    };

    try {
      if (navigator.share) {
        await navigator.share(shareData);
      } else {
        await navigator.clipboard.writeText(`${shareData.text} ${shareData.url}`);
        toast({
          title: "List Link Copied!",
          description: "Share this with your friends to show your entertainment list",
        });
      }
    } catch (error) {
      console.error('Error sharing list:', error);
      toast({
        title: "Share Failed",
        description: "Unable to create share link",
        variant: "destructive"
      });
    }
  };

  // Removed fallbackCopyToClipboard - using same pattern as predictions

  const handleRemoveItem = (itemId: number) => {
    // In real app, would make API call to remove item
    console.log("Removing item:", itemId);
  };

  const togglePrivacyMutation = useMutation({
    mutationFn: async (isPublic: boolean) => {
      if (!session?.access_token) {
        throw new Error("Authentication required");
      }

      const response = await fetch("https://mahpgcogwpawvviapqza.supabase.co/functions/v1/update-list-visibility", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          listId: listData.id,
          isPublic: isPublic,
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Failed to update privacy: ${response.status} - ${errorText}`);
      }

      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Privacy updated!",
        description: `List is now ${!isPublic ? 'public' : 'private'}.`,
      });
      queryClient.invalidateQueries({ queryKey: ["lists"] });
    },
    onError: (error) => {
      toast({
        title: "Failed to update privacy",
        description: error.message,
        variant: "destructive",
      });
      setIsPublic(isPublic); // Revert the UI change
    },
  });

  const handleTogglePrivacy = () => {
    const newPublicState = !isPublic;
    setIsPublic(newPublicState);
    togglePrivacyMutation.mutate(newPublicState);
  };

  if (!listData) {
    return (
      <div className="min-h-screen bg-gray-50 pb-20">
        <Navigation onTrackConsumption={() => {}} />
        <div className="max-w-4xl mx-auto px-4 py-6">
          <div className="text-center">
            <h1 className="text-2xl font-bold text-gray-900 mb-4">List not found</h1>
            <Button onClick={() => setLocation("/track")}>
              Back to Track
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      <Navigation onTrackConsumption={() => {}} />

      <div className="max-w-4xl mx-auto px-4 py-6">
        {/* Header */}
        <div className="flex items-center mb-6">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setLocation("/track")}
            className="mr-4"
            data-testid="button-back"
          >
            <ArrowLeft size={20} />
          </Button>
          <div className="flex-1">
            <h1 className="text-3xl font-bold text-gray-900">{listData.name}</h1>
            <p className="text-gray-600">{listData.description}</p>
          </div>
        </div>

        {/* List Stats & Actions */}
        <div className="bg-white rounded-2xl p-6 shadow-sm mb-6">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div className="flex items-center gap-6">
              <div className="text-center">
                <div className="text-2xl font-bold text-gray-900">{listData.totalItems}</div>
                <div className="text-sm text-gray-600">Items</div>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <Badge variant={isPublic ? "default" : "secondary"} className="flex items-center gap-1">
                {isPublic ? <Globe size={12} /> : <Lock size={12} />}
                {isPublic ? "Public" : "Private"}
              </Badge>
              
              {/* Toggle Privacy Button */}
              <Button
                variant="ghost"
                size="sm"
                onClick={handleTogglePrivacy}
                disabled={togglePrivacyMutation.isPending}
                className="text-gray-600 hover:text-gray-900"
                data-testid="button-toggle-privacy"
              >
                {isPublic ? <Lock size={16} /> : <Globe size={16} />}
                <span className="ml-1 text-sm">
                  Make {isPublic ? 'Private' : 'Public'}
                </span>
              </Button>
              
              <Button
                onClick={() => setIsTrackModalOpen(true)}
                className="bg-purple-600 hover:bg-purple-700"
                data-testid="button-add-item"
              >
                <Plus size={16} className="mr-2" />
                Add Item
              </Button>
              
              <Button
                variant="outline"
                onClick={handleShare}
                data-testid="button-share-list"
              >
                <Share2 size={16} className="mr-2" />
                Share
              </Button>
            </div>
          </div>
        </div>

        {/* List Items */}
        <div className="bg-white rounded-2xl shadow-sm mb-6">
          <div className="p-6 border-b border-gray-200">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-semibold text-gray-900">Items</h2>
              <div className="flex items-center gap-2">
                <Button variant="ghost" size="sm">
                  <Search size={16} />
                </Button>
                <Button variant="ghost" size="sm">
                  <Settings size={16} />
                </Button>
              </div>
            </div>
          </div>

          <div className="divide-y divide-gray-100">
            {listData.items.map((item) => (
              <div key={item.id} className="p-6 hover:bg-gray-50 transition-colors">
                <div className="flex items-start gap-4">
                  <img
                    src={item.artwork}
                    alt={item.title}
                    className="w-16 h-16 rounded-lg object-cover flex-shrink-0"
                  />
                  
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between mb-2">
                      <div>
                        <h3 className="font-semibold text-gray-900 mb-1">{item.title}</h3>
                        <p className="text-sm text-gray-600">by {item.creator}</p>
                        <Badge variant="secondary" className="mt-1 text-xs">
                          {item.type}
                        </Badge>
                      </div>
                      
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleRemoveItem(item.id)}
                        className="text-gray-400 hover:text-red-600"
                        data-testid={`button-remove-${item.id}`}
                      >
                        <X size={16} />
                      </Button>
                    </div>

                    {item.progress > 0 && (
                      <div className="mb-3">
                        <div className="flex items-center justify-between text-sm text-gray-600 mb-1">
                          <span>Progress</span>
                          <span>{item.progress}%</span>
                        </div>
                        <div className="w-full bg-gray-200 rounded-full h-2">
                          <div 
                            className="bg-purple-600 h-2 rounded-full transition-all duration-300"
                            style={{ width: `${item.progress}%` }}
                          ></div>
                        </div>
                      </div>
                    )}

                    <div className="flex items-center justify-between text-xs text-gray-500">
                      <div className="flex items-center gap-4">
                        <div className="flex items-center gap-1">
                          <Calendar size={12} />
                          <span>Added {item.addedDate}</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <span>by {item.addedBy}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

      </div>

      {/* Consumption Tracker Modal for Adding Media */}
      <ConsumptionTracker 
        isOpen={isTrackModalOpen} 
        onClose={() => setIsTrackModalOpen(false)} 
      />

    </div>
  );
}