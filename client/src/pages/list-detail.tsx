import { useState } from "react";
import Navigation from "@/components/navigation";
import ConsumptionTracker from "@/components/consumption-tracker";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Plus, Globe, Lock, X, Share2, Calendar, Check, Users, UserMinus, Trash2, MoreVertical } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { useLocation, Link } from "wouter";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth";
import { useToast } from "@/hooks/use-toast";
import { copyLink } from "@/lib/share";
import { supabase } from "@/lib/supabase";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import UserSearch from "@/components/user-search";
import { ProgressTracker } from "@/components/progress-tracker";

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
      media_type: item.media_type, // Keep original lowercase for ProgressTracker
      artwork: item.image_url || "https://images.unsplash.com/photo-1481627834876-b7833e8f5570?w=80&h=80&fit=crop",
      progress: item.progress || 0,
      total: item.total || 0,
      progress_mode: item.progress_mode || 'percent',
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
            userId
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

  // Delete custom list mutation
  const deleteListMutation = useMutation({
    mutationFn: async (listId: string) => {
      if (!session?.access_token) {
        throw new Error('Authentication required');
      }

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/delete-list`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${session.access_token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ list_id: listId })
        }
      );

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to delete list');
      }

      return response.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['user-lists-with-media'] });
      toast({
        title: "List Deleted",
        description: data.message || "Your custom list has been deleted",
      });
      setLocation('/track');
    },
    onError: (error) => {
      toast({
        title: "Delete Failed",
        description: error.message,
        variant: "destructive"
      });
    }
  });

  const handleDeleteList = () => {
    if (!sharedListData?.id) return;
    
    if (confirm(`Are you sure you want to delete "${sharedListData.title}"? This action cannot be undone.`)) {
      deleteListMutation.mutate(sharedListData.id);
    }
  };

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

      {/* Compact Sticky Header */}
      <div className="sticky top-16 z-40 bg-gradient-to-r from-gray-50 to-white border-b border-gray-200 shadow-sm">
        <div className="max-w-4xl mx-auto px-4 py-3">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-3 flex-1 min-w-0">
              <button
                onClick={() => setLocation("/library")}
                className="p-1.5 text-gray-700 hover:text-black transition-colors"
                data-testid="button-back"
                aria-label="Back"
              >
                <ArrowLeft size={20} />
              </button>
              <div className="flex-1 min-w-0">
                <h1 className="text-lg font-bold text-gray-900 truncate">{listData?.name}</h1>
                <p className="text-xs text-gray-500">{listData?.totalItems} items</p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              {/* Privacy badge/toggle - compact */}
              {!sharedUserId && session ? (
                <Badge 
                  onClick={() => {
                    if (!privacyMutation.isPending && listData) {
                      privacyMutation.mutate(!listData.isPublic);
                    }
                  }}
                  variant="secondary" 
                  className="cursor-pointer hover:bg-gray-200 text-xs px-2 py-1"
                  data-testid="toggle-list-privacy"
                >
                  {listData?.isPublic ? (
                    <><Globe size={12} className="mr-1 text-purple-600" /> Public</>
                  ) : (
                    <><Lock size={12} className="mr-1" /> Private</>
                  )}
                </Badge>
              ) : null}

              <Button
                size="sm"
                onClick={() => setIsTrackModalOpen(true)}
                className="bg-purple-600 hover:bg-purple-700 text-xs px-3 py-1.5"
                data-testid="button-add-item"
              >
                <Plus size={14} className="mr-1" />
                Add
              </Button>

              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button size="sm" variant="outline" className="px-2">
                    <MoreVertical size={16} />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-48">
                  <DropdownMenuItem onClick={handleShare}>
                    {copied ? (
                      <><Check size={14} className="mr-2" /> Copied!</>
                    ) : (
                      <><Share2 size={14} className="mr-2" /> Share List</>
                    )}
                  </DropdownMenuItem>
                  {!sharedUserId && session && !sharedListData?.is_default && (
                    <>
                      <DropdownMenuItem onClick={() => setIsCollaboratorsDialogOpen(true)}>
                        <Users size={14} className="mr-2" />
                        Manage Collaborators {collaborators.length > 0 && `(${collaborators.length})`}
                      </DropdownMenuItem>
                      <DropdownMenuItem 
                        onClick={handleDeleteList}
                        disabled={deleteListMutation.isPending}
                        className="text-red-600"
                      >
                        <Trash2 size={14} className="mr-2" />
                        {deleteListMutation.isPending ? 'Deleting...' : 'Delete List'}
                      </DropdownMenuItem>
                    </>
                  )}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-4xl mx-auto px-4 py-4">

        {/* List Items - Ultra Compact Grid */}
        <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-8 gap-2">
          {(listData?.items || []).map((item: any) => {
            const isClickable = item.external_id && item.external_source;
            const mediaUrl = isClickable ? `/media/${item.type.toLowerCase()}/${item.external_source}/${item.external_id}` : null;
            
            return (
              <div 
                key={item.id} 
                className="bg-white rounded-lg border border-gray-200 hover:border-purple-400 hover:shadow-lg transition-all relative group overflow-hidden"
              >
                {/* Remove Button - Top Right */}
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleRemoveItem(item.id)}
                  className="absolute top-0.5 right-0.5 z-10 bg-black/60 hover:bg-red-600 text-white p-1 h-auto opacity-0 group-hover:opacity-100 transition-opacity rounded"
                  data-testid={`button-remove-${item.id}`}
                >
                  <X size={12} />
                </Button>

                {/* Artwork */}
                {isClickable ? (
                  <Link href={mediaUrl!}>
                    <div className="aspect-[2/3] relative">
                      <img
                        src={item.artwork}
                        alt={item.title}
                        className="w-full h-full object-cover cursor-pointer hover:opacity-90 transition-opacity"
                      />
                    </div>
                  </Link>
                ) : (
                  <div className="aspect-[2/3] relative">
                    <img
                      src={item.artwork}
                      alt={item.title}
                      className="w-full h-full object-cover"
                    />
                  </div>
                )}

                {/* Info - Only on hover */}
                <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/90 to-transparent p-2 opacity-0 group-hover:opacity-100 transition-opacity">
                  <h3 className="font-semibold text-xs text-white line-clamp-2 leading-tight">
                    {item.title}
                  </h3>
                </div>
              </div>
            );
          })}
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