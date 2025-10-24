import { useState } from "react";
import Navigation from "@/components/navigation";
import ConsumptionTracker from "@/components/consumption-tracker";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Plus, Globe, Lock, X, Share2, Calendar, Check, Users, UserMinus } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { useLocation, Link } from "wouter";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth";
import { useToast } from "@/hooks/use-toast";
import { copyLink } from "@/lib/share";
import { supabase } from "@/lib/supabase";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import UserSearch from "@/components/user-search";

export default function ListDetail() {
  const [, setLocation] = useLocation();
  // Removed privacy state - all lists are now public for MVP
  const [isTrackModalOpen, setIsTrackModalOpen] = useState(false);
  const [isCollaboratorsDialogOpen, setIsCollaboratorsDialogOpen] = useState(false);

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
            "Authorization": `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
          },
        });

        if (!response.ok) {
          const errorText = await response.text();
          console.error('Public list fetch failed:', response.status, errorText);
          throw new Error('Failed to fetch public list');
        }

        const data = await response.json();
        console.log('Public list data:', data);

        // Convert to expected format - ensure we have the right structure
        if (data.list) {
          return {
            lists: [data.list]
          };
        }
        return { lists: [] };
      }

      if (!session?.access_token) {
        console.log('No session token available for list detail');
        throw new Error('Authentication required');
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
    enabled: !!urlListName && (sharedUserId ? true : !!session?.access_token),
  });

  // Find the specific list from the REAL data based on URL slug
  const sharedListData = sharedUserId 
    ? userListsData?.lists?.[0] // For shared links, get the first (and only) list returned
    : userListsData?.lists?.find((list: any) => {
        const sluggedTitle = list.title.toLowerCase().replace(/\s+/g, '-');
        return sluggedTitle === urlListName;
      });

  console.log('Shared list data found:', sharedListData);

  // Update the data structure to match new response format
  const listData = sharedListData ? {
    id: sharedListData.id,
    name: sharedListData.title,
    description: getListDescription(sharedListData.title),
    isPublic: !sharedListData.is_private, // Use actual privacy setting
    items: (sharedListData.items || []).map((item: any) => ({
      id: item.id,
      title: item.title,
      creator: item.creator || 'Unknown',
      type: item.media_type ? capitalizeFirst(item.media_type) : 'Mixed',
      artwork: item.image_url || "https://images.unsplash.com/photo-1481627834876-b7833e8f5570?w=80&h=80&fit=crop",
      progress: 0,
      addedDate: new Date(item.created_at).toLocaleDateString(),
      addedBy: "You",
      external_id: item.external_id,
      external_source: item.external_source
    })),
    collaborators: [],
    owner: "You",
    createdDate: new Date().toLocaleDateString(),
    totalItems: sharedListData.items?.length || 0,
    likes: 0
  } : null;

  // All lists are public for MVP - removed state update logic

  // Helper functions
  function getListDescription(title: string) {
    switch (title) {
      case "All": return "All your tracked media items";
      case "Currently": return "What you're watching, reading, or playing right now";
      case "Queue": return "Media you want to consume later";
      case "Finished": return "Media you've completed";
      case "Did Not Finish": return "Media you started but didn't complete";
      case "Favorites": return "Your favorite media items";
      default: return "Your custom list";
    }
  }

  function getListTypeFromTitle(title: string): string {
    const typeMap: { [key: string]: string } = {
      'All': 'all',
      'Currently': 'currently',
      'Queue': 'queue',
      'Finished': 'finished',
      'Did Not Finish': 'dnf',
      'Favorites': 'favorites'
    };
    return typeMap[title] || 'all';
  }

  function capitalizeFirst(str: string) {
    return str.charAt(0).toUpperCase() + str.slice(1);
  }


  const [copied, setCopied] = useState(false);

  // Share functionality using unified share system
  const handleShare = async () => {
    if (!listData?.isPublic) {
      toast({
        title: "Cannot Share Private List",
        description: "Make your list public first to share it with others",
        variant: "destructive"
      });
      return;
    }

    if (!sharedListData?.id) {
      toast({
        title: "Cannot Share",
        description: "List information not available",
        variant: "destructive"
      });
      return;
    }

    try {
      // Convert title to slug for clean URLs
      const listSlug = sharedListData.title.toLowerCase().replace(/\s+/g, '-');
      
      // Use sharedUserId when viewing someone else's list, otherwise your own
      const userId = sharedUserId || session?.user?.id;
      
      console.log('LIST-DETAIL SHARE:', { 
        listId: sharedListData.id,
        listTitle: sharedListData.title, 
        listSlug, 
        userId,
        sharedUserId 
      });
      
      await copyLink({ 
        kind: 'list', 
        obj: { 
          id: listSlug,
          isCurrently: sharedListData.title === 'Currently',
          user_id: userId
        } 
      });

      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
      toast({
        title: "Link Copied!",
        description: "Share this with your friends to show your list",
      });
    } catch (error) {
      console.error('Error sharing list:', error);
      toast({
        title: "Share Failed",
        description: "Unable to share list",
        variant: "destructive"
      });
    }
  };

  // Removed fallbackCopyToClipboard - using same pattern as predictions

  const deleteMutation = useMutation({
    mutationFn: async (itemId: string) => {
      if (!session?.access_token) {
        throw new Error('Authentication required');
      }

      const response = await fetch("https://mahpgcogwpawvviapqza.supabase.co/functions/v1/delete-list-item", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${session.access_token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ itemId }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Failed to delete item: ${errorText}`);
      }

      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['user-lists-with-media'] });
      toast({
        title: "Item Removed",
        description: "Item has been removed from your list",
      });
    },
    onError: (error) => {
      toast({
        title: "Delete Failed", 
        description: error.message,
        variant: "destructive"
      });
    }
  });

  const handleRemoveItem = (itemId: string) => {
    deleteMutation.mutate(itemId);
  };

  // Privacy toggle mutation - Direct Supabase update (no edge function)
  const privacyMutation = useMutation({
    mutationFn: async (isPublic: boolean) => {
      if (!sharedListData?.id) {
        throw new Error('List ID required');
      }

      const { data, error } = await supabase
        .from('lists')
        .update({ is_private: !isPublic })
        .eq('id', sharedListData.id)
        .select('id, title, is_private')
        .single();

      if (error) {
        throw new Error(error.message || 'Failed to update list visibility');
      }

      return { success: true, list: data, message: `List is now ${isPublic ? 'public' : 'private'}` };
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['user-lists-with-media'] });
      toast({
        title: "Privacy Updated",
        description: data.message || `List privacy updated successfully`,
      });
    },
    onError: (error) => {
      toast({
        title: "Update Failed", 
        description: error.message,
        variant: "destructive"
      });
    }
  });

  const handlePrivacyToggle = () => {
    if (listData) {
      // Toggle: if currently public, make private (and vice versa)
      const newIsPublic = !listData.isPublic;
      privacyMutation.mutate(newIsPublic);
    }
  };

  // Fetch collaborators for the current list
  const { data: collaborators = [], refetch: refetchCollaborators } = useQuery({
    queryKey: ['list-collaborators', sharedListData?.id],
    queryFn: async () => {
      if (!sharedListData?.id || !session?.access_token) return [];

      const { data, error } = await supabase
        .from('list_collaborators')
        .select('*, users(id, user_name, display_name)')
        .eq('list_id', sharedListData.id);

      if (error) {
        console.error('Failed to fetch collaborators:', error);
        return [];
      }

      return data.map((collab: any) => ({
        id: collab.id,
        userId: collab.user_id,
        userName: collab.users?.user_name || 'Unknown',
        displayName: collab.users?.display_name || collab.users?.user_name || 'Unknown',
        permission: collab.permission || 'edit',
        addedAt: collab.added_at
      }));
    },
    enabled: !!sharedListData?.id && !!session?.access_token,
  });

  // Add collaborator mutation
  const addCollaboratorMutation = useMutation({
    mutationFn: async (userId: string) => {
      if (!session?.access_token || !sharedListData?.id) {
        throw new Error('Authentication or list ID required');
      }

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/add-list-collaborator`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${session.access_token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            listId: sharedListData.id,
            userId,
            permission: 'edit'
          }),
        }
      );

      if (!response.ok) {
        const error = await response.text();
        throw new Error(error || 'Failed to add collaborator');
      }

      return response.json();
    },
    onSuccess: () => {
      refetchCollaborators();
      toast({
        title: "Collaborator Added",
        description: "User can now access and edit this list",
      });
    },
    onError: (error) => {
      toast({
        title: "Failed to Add Collaborator",
        description: error.message,
        variant: "destructive"
      });
    }
  });

  // Remove collaborator mutation
  const removeCollaboratorMutation = useMutation({
    mutationFn: async (userId: string) => {
      if (!session?.access_token || !sharedListData?.id) {
        throw new Error('Authentication or list ID required');
      }

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/remove-list-collaborator`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${session.access_token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            listId: sharedListData.id,
            userId
          }),
        }
      );

      if (!response.ok) {
        const error = await response.text();
        throw new Error(error || 'Failed to remove collaborator');
      }

      return response.json();
    },
    onSuccess: () => {
      refetchCollaborators();
      toast({
        title: "Collaborator Removed",
        description: "User no longer has access to this list",
      });
    },
    onError: (error) => {
      toast({
        title: "Failed to Remove Collaborator",
        description: error.message,
        variant: "destructive"
      });
    }
  });

  // Show loading state instead of "List not found" during data fetch
  if (listsLoading) {
    return (
      <div className="min-h-screen bg-gray-50 pb-20">
        <Navigation onTrackConsumption={() => {}} />
        <div className="max-w-4xl mx-auto px-4 py-6">
          <div className="text-center">
            <h1 className="text-2xl font-bold text-gray-900 mb-4">Loading...</h1>
          </div>
        </div>
      </div>
    );
  }

  // Only show "List not found" if data finished loading but no list found
  if (!listData && !listsLoading) {
    console.log('List not found - Debug info:', {
      sharedUserId,
      urlListName,
      userListsData,
      sharedListData,
      hasSession: !!session
    });
    
    return (
      <div className="min-h-screen bg-gray-50 pb-20">
        <Navigation onTrackConsumption={() => {}} />
        <div className="max-w-4xl mx-auto px-4 py-6">
          <div className="text-center">
            <h1 className="text-2xl font-bold text-gray-900 mb-4">List not found</h1>
            <p className="text-gray-600 mb-4">
              {sharedUserId ? 'This list may be private or does not exist.' : 'Please log in to view your lists.'}
            </p>
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
          <button
            onClick={() => setLocation("/track")}
            className="mr-4 p-2 text-gray-700 hover:text-black transition-colors"
            data-testid="button-back"
            aria-label="Back to track"
          >
            <ArrowLeft size={24} />
          </button>
          <div className="flex-1">
            <h1 className="text-3xl font-bold text-gray-900">{listData?.name}</h1>
            <p className="text-gray-600">{listData?.description}</p>
          </div>
        </div>

        {/* List Stats & Actions */}
        <div className="bg-white rounded-2xl p-6 shadow-sm mb-6">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div className="flex items-center gap-6">
              <div className="text-center">
                <div className="text-2xl font-bold text-gray-900">{listData?.totalItems}</div>
                <div className="text-sm text-gray-600">Items</div>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              {/* Show privacy toggle for all user-owned lists (both system and custom) */}
              {!sharedUserId && session ? (
                <button
                  onClick={() => {
                    if (!privacyMutation.isPending && listData) {
                      privacyMutation.mutate(!listData.isPublic);
                    }
                  }}
                  disabled={privacyMutation.isPending}
                  className="flex items-center gap-3 px-4 py-2 bg-white border border-gray-200 rounded-full hover:border-gray-300 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
                  data-testid="toggle-list-privacy"
                >
                  {listData?.isPublic ? (
                    <>
                      <Globe size={16} className="text-purple-600" />
                      <span className="text-sm font-medium text-gray-700">Public</span>
                    </>
                  ) : (
                    <>
                      <Lock size={16} className="text-gray-600" />
                      <span className="text-sm font-medium text-gray-700">Private</span>
                    </>
                  )}
                  <div className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${listData?.isPublic ? 'bg-gray-400' : 'bg-gray-300'}`}>
                    <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${listData?.isPublic ? 'translate-x-6' : 'translate-x-1'}`} />
                  </div>
                </button>
              ) : (
                <Badge variant="secondary" className="bg-purple-100 text-purple-700 text-sm">
                  <Globe size={14} className="mr-1" />
                  Public List
                </Badge>
              )}

              <Button
                onClick={() => setIsTrackModalOpen(true)}
                className="bg-purple-600 hover:bg-purple-700"
                data-testid="button-add-item"
              >
                <Plus size={16} className="mr-2" />
                Add Item
              </Button>

              <Button
                onClick={handleShare}
                data-testid="button-share-list"
                className={copied ? "bg-green-500 hover:bg-green-600 text-white" : "bg-purple-500 hover:bg-purple-600 text-white"}
              >
                {copied ? (
                  <>
                    <Check size={16} className="mr-2" />
                    Copied!
                  </>
                ) : (
                  <>
                    <Share2 size={16} className="mr-2" />
                    Share
                  </>
                )}
              </Button>

              {/* Manage Collaborators - Only show for list owner */}
              {!sharedUserId && session && (
                <Button
                  onClick={() => setIsCollaboratorsDialogOpen(true)}
                  variant="outline"
                  data-testid="button-manage-collaborators"
                  className="border-purple-300 text-purple-700 hover:bg-purple-50"
                >
                  <Users size={16} className="mr-2" />
                  Collaborators
                  {collaborators.length > 0 && (
                    <Badge className="ml-2 bg-purple-600 text-white">{collaborators.length}</Badge>
                  )}
                </Button>
              )}
            </div>
          </div>

          {/* Show "Shared with you" indicator if viewing someone else's list or if you're a collaborator */}
          {(sharedUserId || (collaborators.length > 0 && !sharedUserId)) && (
            <div className="mt-4 flex items-center gap-2 text-sm text-gray-600">
              <Users size={14} />
              <span>
                {sharedUserId ? "Shared by another user" : `Shared with ${collaborators.length} ${collaborators.length === 1 ? 'person' : 'people'}`}
              </span>
            </div>
          )}
        </div>

        {/* List Items */}
        <div className="bg-white rounded-2xl shadow-sm mb-6">
          <div className="p-6 border-b border-gray-200">
            <h2 className="text-xl font-semibold text-gray-900">Items</h2>
          </div>

          <div className="divide-y divide-gray-100">
            {(listData?.items || []).map((item: any) => {
              const isClickable = item.external_id && item.external_source;
              const mediaUrl = isClickable ? `/media/${item.type.toLowerCase()}/${item.external_source}/${item.external_id}` : null;
              
              return (
                <div key={item.id} className="p-6 hover:bg-gray-50 transition-colors">
                  <div className="flex items-start gap-4">
                    {isClickable ? (
                      <Link href={mediaUrl!}>
                        <img
                          src={item.artwork}
                          alt={item.title}
                          className="w-16 h-16 rounded-lg object-cover flex-shrink-0 cursor-pointer hover:opacity-80 transition-opacity"
                        />
                      </Link>
                    ) : (
                      <img
                        src={item.artwork}
                        alt={item.title}
                        className="w-16 h-16 rounded-lg object-cover flex-shrink-0"
                      />
                    )}

                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between mb-2">
                        <div>
                          {isClickable ? (
                            <Link href={mediaUrl!}>
                              <h3 className="font-semibold text-gray-900 mb-1 hover:text-purple-600 cursor-pointer transition-colors">{item.title}</h3>
                            </Link>
                          ) : (
                            <h3 className="font-semibold text-gray-900 mb-1">{item.title}</h3>
                          )}
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
              );
            })}
          </div>
        </div>

      </div>

      {/* Consumption Tracker Modal for Adding Media */}
      <ConsumptionTracker 
        isOpen={isTrackModalOpen} 
        onClose={() => setIsTrackModalOpen(false)}
        defaultListType={listData?.name && listData.name !== 'All' ? getListTypeFromTitle(listData.name) : undefined}
      />

      {/* Manage Collaborators Dialog */}
      <Dialog open={isCollaboratorsDialogOpen} onOpenChange={setIsCollaboratorsDialogOpen}>
        <DialogContent className="max-w-md bg-white" data-testid="dialog-manage-collaborators">
          <DialogHeader>
            <DialogTitle className="text-gray-900">Manage Collaborators</DialogTitle>
            <DialogDescription className="text-gray-600">
              Add friends to collaborate on "{listData?.name}". They'll be able to add and remove items.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-6 py-4">
            {/* User Search */}
            <div>
              <h3 className="text-sm font-medium text-gray-900 mb-3">Add Collaborators</h3>
              <UserSearch
                onSelectUser={(user) => addCollaboratorMutation.mutate(user.id)}
                excludeUserIds={[session?.user?.id || '', ...collaborators.map(c => c.userId)]}
                placeholder="Search by username or name..."
              />
            </div>

            {/* Current Collaborators */}
            {collaborators.length > 0 && (
              <div>
                <h3 className="text-sm font-medium text-gray-900 mb-3">
                  Current Collaborators ({collaborators.length})
                </h3>
                <div className="space-y-2 max-h-64 overflow-y-auto">
                  {collaborators.map((collaborator: any) => (
                    <div
                      key={collaborator.id}
                      className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
                      data-testid={`collaborator-${collaborator.userId}`}
                    >
                      <div className="flex items-center gap-3">
                        <Avatar className="h-10 w-10">
                          <AvatarFallback className="bg-purple-600 text-white">
                            {collaborator.displayName.charAt(0).toUpperCase()}
                          </AvatarFallback>
                        </Avatar>
                        <div>
                          <p className="font-medium text-gray-900" data-testid={`text-collaborator-name-${collaborator.userId}`}>
                            {collaborator.displayName}
                          </p>
                          <p className="text-sm text-gray-600" data-testid={`text-collaborator-username-${collaborator.userId}`}>
                            @{collaborator.userName}
                          </p>
                        </div>
                      </div>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => removeCollaboratorMutation.mutate(collaborator.userId)}
                        disabled={removeCollaboratorMutation.isPending}
                        className="text-red-600 hover:text-red-700 hover:bg-red-50"
                        data-testid={`button-remove-collaborator-${collaborator.userId}`}
                      >
                        <UserMinus size={16} />
                      </Button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {collaborators.length === 0 && (
              <div className="text-center py-6">
                <Users className="mx-auto text-gray-400 mb-2" size={32} />
                <p className="text-sm text-gray-500">No collaborators yet</p>
                <p className="text-xs text-gray-400 mt-1">Search above to add friends</p>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

    </div>
  );
}