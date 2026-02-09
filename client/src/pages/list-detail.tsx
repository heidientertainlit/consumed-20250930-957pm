import { useState, useEffect } from "react";
import Navigation from "@/components/navigation";
import { QuickAddModal } from "@/components/quick-add-modal";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Plus, Globe, Lock, X, Share2, Calendar, Check, Users, UserMinus, Trash2, MoreVertical, LayoutGrid, List, Search, Film, Tv, BookOpen, Music, ChevronRight, Star, GripVertical } from "lucide-react";
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
import { DndContext, closestCenter, PointerSensor, TouchSensor, useSensor, useSensors, DragEndEvent } from "@dnd-kit/core";
import { arrayMove, SortableContext, verticalListSortingStrategy, useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

interface SortableListItemProps {
  item: any;
  onRemove: (id: string) => void;
  isOwner: boolean;
}

function SortableListItem({ item, onRemove, isOwner }: SortableListItemProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: item.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  const isClickable = item.external_id && item.external_source;
  const mediaUrl = isClickable ? `/media/${item.type?.toLowerCase()}/${item.external_source}/${item.external_id}` : null;

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="flex items-center gap-2 p-3 bg-white rounded-lg border border-gray-200 hover:border-purple-300 transition-colors group"
    >
      {isOwner && (
        <div
          {...attributes}
          {...listeners}
          className="cursor-grab active:cursor-grabbing text-gray-400 hover:text-gray-600 touch-none"
        >
          <GripVertical size={18} />
        </div>
      )}
      {isClickable ? (
        <Link href={mediaUrl!} className="flex items-center gap-3 flex-1 min-w-0">
          <div className="w-10 h-10 rounded overflow-hidden flex-shrink-0 bg-gray-100">
            {item.artwork && item.artwork !== "https://images.unsplash.com/photo-1481627834876-b7833e8f5570?w=80&h=80&fit=crop" ? (
              <img src={item.artwork} alt="" className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-gray-400 text-xs">
                {item.type?.charAt(0) || '?'}
              </div>
            )}
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-medium text-gray-900 truncate text-sm">{item.title}</p>
            <p className="text-xs text-gray-500 truncate">{item.creator} · {item.type}</p>
          </div>
        </Link>
      ) : (
        <div className="flex items-center gap-3 flex-1 min-w-0">
          <div className="w-10 h-10 rounded overflow-hidden flex-shrink-0 bg-gray-100">
            {item.artwork && item.artwork !== "https://images.unsplash.com/photo-1481627834876-b7833e8f5570?w=80&h=80&fit=crop" ? (
              <img src={item.artwork} alt="" className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-gray-400 text-xs">
                {item.type?.charAt(0) || '?'}
              </div>
            )}
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-medium text-gray-900 truncate text-sm">{item.title}</p>
            <p className="text-xs text-gray-500 truncate">{item.creator} · {item.type}</p>
          </div>
        </div>
      )}
      {isOwner && (
        <Button
          variant="ghost"
          size="sm"
          onClick={() => onRemove(item.id)}
          className="text-gray-400 hover:text-red-600 hover:bg-red-50 p-1.5 h-auto"
          data-testid={`button-remove-${item.id}`}
        >
          <Trash2 size={16} />
        </Button>
      )}
    </div>
  );
}

export default function ListDetail() {
  const [, setLocation] = useLocation();
  const [isTrackModalOpen, setIsTrackModalOpen] = useState(false);
  const [isCollaboratorsDialogOpen, setIsCollaboratorsDialogOpen] = useState(false);
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('list');
  
  // Search and filter state
  const [searchQuery, setSearchQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState("all");
  const [yearFilter, setYearFilter] = useState("all");
  const [ratingFilter, setRatingFilter] = useState("all");
  const [openFilter, setOpenFilter] = useState<'type' | 'year' | 'rating' | null>(null);
  
  // Drag and drop state
  const [localItems, setLocalItems] = useState<any[]>([]);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 8 },
    }),
    useSensor(TouchSensor, {
      activationConstraint: { delay: 150, tolerance: 5 },
    })
  );

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

  // Helper function to create a URL-safe slug from a title
  const createSlug = (title: string) => {
    return title.toLowerCase().replace(/\s+/g, '-');
  };

  // Decode URL to handle emojis and special characters
  const decodedUrlListName = (() => {
    try {
      return decodeURIComponent(urlListName || '');
    } catch {
      return urlListName || '';
    }
  })();

  // Find the specific list from the REAL data based on URL slug
  const sharedListData = sharedUserId 
    ? userListsData?.lists?.[0] // For shared links, get the first (and only) list returned
    : userListsData?.lists?.find((list: any) => {
        const sluggedTitle = createSlug(list.title);
        // Compare both encoded and decoded versions
        return sluggedTitle === urlListName || sluggedTitle === decodedUrlListName;
      });

  console.log('Shared list data found:', sharedListData);
  if (!sharedListData && userListsData?.lists) {
    console.log('List not found - Debug info:', {
      sharedUserId,
      urlListName,
      decodedUrlListName,
      availableLists: userListsData.lists.map((l: any) => ({ title: l.title, slug: createSlug(l.title) }))
    });
  }

  // Update the data structure to match new response format
  const listData = sharedListData ? {
    id: sharedListData.id,
    name: sharedListData.title,
    description: getListDescription(sharedListData.title),
    isPublic: !sharedListData.is_private, // Use actual privacy setting
    isCustom: sharedListData.isCustom || false, // Track if this is a custom list
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

  // Sync local items with list data
  useEffect(() => {
    if (listData?.items) {
      setLocalItems(listData.items);
    }
  }, [listData?.items?.length]);

  // Save reordered items to database
  const reorderMutation = useMutation({
    mutationFn: async (orderedItems: any[]) => {
      if (!session?.access_token || !listData?.id) throw new Error('Not authenticated');
      
      // Update each item's position
      const updates = orderedItems.map((item, index) => 
        supabase
          .from('list_items')
          .update({ position: index })
          .eq('id', item.id)
      );
      
      await Promise.all(updates);
      return orderedItems;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['user-lists-with-media'] });
    },
    onError: (error) => {
      console.error('Failed to save order:', error);
      toast({ title: 'Failed to save order', variant: 'destructive' });
    }
  });

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    
    if (over && active.id !== over.id) {
      setLocalItems((items) => {
        const oldIndex = items.findIndex((item) => item.id === active.id);
        const newIndex = items.findIndex((item) => item.id === over.id);
        const newItems = arrayMove(items, oldIndex, newIndex);
        
        // Save the new order to database
        reorderMutation.mutate(newItems);
        
        return newItems;
      });
    }
  };

  // All lists are public for MVP - removed state update logic

  // Helper functions
  
  // Map list titles for display (e.g., "Queue" -> "Want To")
  function getDisplayTitle(title: string): string {
    const displayMap: { [key: string]: string } = {
      'Queue': 'Want To',
    };
    return displayMap[title] || title;
  }

  function getListDescription(title: string) {
    const displayTitle = getDisplayTitle(title);
    switch (displayTitle) {
      case "All": return "All your tracked media items";
      case "Currently": return "What you're watching, reading, or playing right now";
      case "Want To": return "Media you want to consume later";
      case "Finished": return "Media you've completed";
      case "Did Not Finish": return "Media you started but didn't complete";
      case "Favorites": return "Your favorite media items";
      default: return "Your custom list";
    }
  }

  function getListTypeFromTitle(title: string): string {
    const displayTitle = getDisplayTitle(title);
    const typeMap: { [key: string]: string } = {
      'All': 'all',
      'Currently': 'currently',
      'Want To': 'queue',
      'Queue': 'queue',
      'Finished': 'finished',
      'Did Not Finish': 'dnf',
      'Favorites': 'favorites'
    };
    return typeMap[displayTitle] || typeMap[title] || 'all';
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
    },
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
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['user-lists-with-media'] });
    },
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
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['user-lists-with-media'] });
      setLocation('/me?section=collections');
    },
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
      <div className="sticky top-16 z-40 bg-white/95 backdrop-blur-sm border-b border-gray-100">
        <div className="max-w-4xl mx-auto px-4 py-3">
          {/* Row 1: Back arrow + Full name + Add button */}
          <div className="flex items-center justify-between gap-2 mb-2">
            <div className="flex items-center gap-2 min-w-0 flex-1">
              <button
                onClick={() => setLocation("/collections")}
                className="p-1 text-gray-500 hover:text-gray-900 transition-colors flex-shrink-0"
                data-testid="button-back"
                aria-label="Back"
              >
                <ArrowLeft size={20} />
              </button>
              <h1 className="text-lg font-semibold text-gray-900 truncate">{listData?.name ? getDisplayTitle(listData.name) : ''}</h1>
            </div>
          </div>
          
          {/* Row 2: Meta info + actions */}
          <div className="flex items-center justify-between pl-7">
            <div className="flex items-center gap-2 text-xs text-gray-500">
              <span>{listData?.totalItems} items</span>
              <span className="text-gray-300">·</span>
              {/* Privacy toggle */}
              {!sharedUserId && session ? (
                <button 
                  onClick={() => listData && privacyMutation.mutate(!listData.isPublic)}
                  className="inline-flex items-center gap-1 hover:text-gray-700 transition-colors"
                  data-testid="toggle-list-privacy"
                >
                  {listData?.isPublic ? (
                    <><Globe size={12} className="text-purple-500" /> Public</>
                  ) : (
                    <><Lock size={12} /> Private</>
                  )}
                </button>
              ) : (
                <span className="inline-flex items-center gap-1">
                  <Globe size={12} /> Public
                </span>
              )}
            </div>
            
            {/* Right side actions */}
            <div className="flex items-center gap-0.5">
              {/* View Toggle */}
              <div className="flex items-center bg-gray-100 rounded p-0.5 mr-1">
                <button
                  onClick={() => setViewMode('list')}
                  className={`p-1 rounded transition-colors ${viewMode === 'list' ? 'bg-white shadow-sm text-purple-600' : 'text-gray-400'}`}
                  data-testid="view-mode-list"
                  aria-label="List view"
                >
                  <List size={14} />
                </button>
                <button
                  onClick={() => setViewMode('grid')}
                  className={`p-1 rounded transition-colors ${viewMode === 'grid' ? 'bg-white shadow-sm text-purple-600' : 'text-gray-400'}`}
                  data-testid="view-mode-grid"
                  aria-label="Grid view"
                >
                  <LayoutGrid size={14} />
                </button>
              </div>
              
              <button
                onClick={handleShare}
                className="p-1.5 text-gray-400 hover:text-gray-600 rounded transition-colors"
                data-testid="button-share-list"
                aria-label="Share"
              >
                {copied ? <Check size={16} className="text-green-500" /> : <Share2 size={16} />}
              </button>
              
              {!sharedUserId && session && !sharedListData?.is_default && (
                <>
                  <button
                    onClick={() => setIsCollaboratorsDialogOpen(true)}
                    className="p-1.5 text-gray-400 hover:text-gray-600 rounded transition-colors"
                    data-testid="button-manage-collaborators"
                    aria-label="Collaborators"
                  >
                    <Users size={16} />
                  </button>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <button className="p-1.5 text-gray-400 hover:text-gray-600 rounded transition-colors">
                        <MoreVertical size={16} />
                      </button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-36">
                      <DropdownMenuItem 
                        onClick={handleDeleteList}
                        disabled={deleteListMutation.isPending}
                        className="text-red-600 focus:text-red-600"
                      >
                        <Trash2 size={14} className="mr-2" />
                        {deleteListMutation.isPending ? 'Deleting...' : 'Delete'}
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-4xl mx-auto px-4 py-4">
        
        {/* Prominent Add Button */}
        {!sharedUserId && session && (
          <button
            onClick={() => setIsTrackModalOpen(true)}
            className="w-full flex items-center justify-center gap-2 py-3 mb-4 rounded-full bg-gradient-to-r from-purple-500 to-purple-700 hover:from-purple-600 hover:to-purple-800 text-white font-semibold text-sm transition-all shadow-md"
            data-testid="button-add-item-prominent"
          >
            <Plus size={18} strokeWidth={2.5} />
            Add Media to This List
          </button>
        )}

        {/* Search Bar */}
        <div className="relative mb-3">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
          <input
            type="text"
            placeholder="Filter items in list..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 bg-white border border-gray-200 rounded-xl text-gray-900 placeholder-gray-400 focus:outline-none focus:border-purple-400 focus:ring-1 focus:ring-purple-400"
            data-testid="input-search-list"
          />
        </div>

        {/* Filters Row */}
        <div className="flex flex-wrap gap-2 mb-3">
          {/* Media Type Filter */}
          <div className="relative">
            <button
              onClick={() => setOpenFilter(openFilter === 'type' ? null : 'type')}
              className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors flex items-center gap-1.5 ${
                typeFilter !== 'all'
                  ? 'bg-purple-600 text-white'
                  : 'bg-purple-100 text-purple-700 hover:bg-purple-200'
              }`}
              data-testid="filter-type-button"
            >
              <Film size={12} />
              {typeFilter === 'all' ? 'Type' : typeFilter.charAt(0).toUpperCase() + typeFilter.slice(1)}
              <ChevronRight size={12} className={`transition-transform ${openFilter === 'type' ? 'rotate-90' : ''}`} />
            </button>
            {openFilter === 'type' && (
              <div className="absolute top-full left-0 mt-1 bg-white rounded-lg shadow-lg border border-gray-200 py-1 z-20 min-w-[120px]">
                {[
                  { value: 'all', label: 'All Types' },
                  { value: 'movie', label: 'Movies', icon: Film },
                  { value: 'tv', label: 'TV Shows', icon: Tv },
                  { value: 'book', label: 'Books', icon: BookOpen },
                  { value: 'music', label: 'Music', icon: Music },
                ].map((option) => (
                  <button
                    key={option.value}
                    onClick={() => { setTypeFilter(option.value); setOpenFilter(null); }}
                    className={`w-full px-3 py-2 text-left text-sm hover:bg-gray-50 flex items-center gap-2 ${typeFilter === option.value ? 'text-purple-600 bg-purple-50' : 'text-gray-700'}`}
                  >
                    {option.icon && <option.icon size={14} />}
                    {option.label}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Year Filter */}
          <div className="relative">
            <button
              onClick={() => setOpenFilter(openFilter === 'year' ? null : 'year')}
              className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors flex items-center gap-1.5 ${
                yearFilter !== 'all'
                  ? 'bg-purple-600 text-white'
                  : 'bg-purple-100 text-purple-700 hover:bg-purple-200'
              }`}
              data-testid="filter-year-button"
            >
              Year: {yearFilter === 'all' ? 'All' : yearFilter}
              <ChevronRight size={12} className={`transition-transform ${openFilter === 'year' ? 'rotate-90' : ''}`} />
            </button>
            {openFilter === 'year' && (
              <div className="absolute top-full left-0 mt-1 bg-white rounded-lg shadow-lg border border-gray-200 py-1 z-20 min-w-[100px] max-h-48 overflow-y-auto">
                <button
                  onClick={() => { setYearFilter('all'); setOpenFilter(null); }}
                  className={`w-full px-3 py-2 text-left text-sm hover:bg-gray-50 ${yearFilter === 'all' ? 'text-purple-600 bg-purple-50' : 'text-gray-700'}`}
                >
                  All Years
                </button>
                {Array.from({ length: 10 }, (_, i) => (new Date().getFullYear() - i).toString()).map((year) => (
                  <button
                    key={year}
                    onClick={() => { setYearFilter(year); setOpenFilter(null); }}
                    className={`w-full px-3 py-2 text-left text-sm hover:bg-gray-50 ${yearFilter === year ? 'text-purple-600 bg-purple-50' : 'text-gray-700'}`}
                  >
                    {year}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Rating Filter */}
          <div className="relative">
            <button
              onClick={() => setOpenFilter(openFilter === 'rating' ? null : 'rating')}
              className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors flex items-center gap-1.5 ${
                ratingFilter !== 'all'
                  ? 'bg-purple-600 text-white'
                  : 'bg-purple-100 text-purple-700 hover:bg-purple-200'
              }`}
              data-testid="filter-rating-button"
            >
              <Star size={12} />
              {ratingFilter === 'all' ? 'Rating' : `${ratingFilter}+ stars`}
              <ChevronRight size={12} className={`transition-transform ${openFilter === 'rating' ? 'rotate-90' : ''}`} />
            </button>
            {openFilter === 'rating' && (
              <div className="absolute top-full left-0 mt-1 bg-white rounded-lg shadow-lg border border-gray-200 py-1 z-20 min-w-[120px]">
                <button
                  onClick={() => { setRatingFilter('all'); setOpenFilter(null); }}
                  className={`w-full px-3 py-2 text-left text-sm hover:bg-gray-50 ${ratingFilter === 'all' ? 'text-purple-600 bg-purple-50' : 'text-gray-700'}`}
                >
                  All Ratings
                </button>
                {['5', '4', '3', '2', '1'].map((rating) => (
                  <button
                    key={rating}
                    onClick={() => { setRatingFilter(rating); setOpenFilter(null); }}
                    className={`w-full px-3 py-2 text-left text-sm hover:bg-gray-50 flex items-center gap-1 ${ratingFilter === rating ? 'text-purple-600 bg-purple-50' : 'text-gray-700'}`}
                  >
                    {rating}+ <Star size={12} className="text-yellow-500 fill-yellow-500" />
                  </button>
                ))}
              </div>
            )}
          </div>

        </div>

        {/* List View - Draggable */}
        {viewMode === 'list' && (
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={handleDragEnd}
          >
            <SortableContext
              items={localItems.map(item => item.id)}
              strategy={verticalListSortingStrategy}
            >
              <div className="space-y-2">
                {localItems
                  .filter((item: any) => {
                    if (searchQuery && !item.title.toLowerCase().includes(searchQuery.toLowerCase()) && 
                        !item.creator?.toLowerCase().includes(searchQuery.toLowerCase())) {
                      return false;
                    }
                    if (typeFilter !== 'all' && item.type?.toLowerCase() !== typeFilter.toLowerCase()) {
                      return false;
                    }
                    if (yearFilter !== 'all') {
                      const itemYear = item.addedDate ? new Date(item.addedDate).getFullYear().toString() : null;
                      if (itemYear !== yearFilter) return false;
                    }
                    if (ratingFilter !== 'all' && item.rating) {
                      if (item.rating < parseInt(ratingFilter)) return false;
                    }
                    return true;
                  })
                  .map((item: any) => (
                    <SortableListItem
                      key={item.id}
                      item={item}
                      onRemove={handleRemoveItem}
                      isOwner={!sharedUserId}
                    />
                  ))}
                {localItems.length === 0 && (
                  <div className="text-center py-12 text-gray-500">
                    <p>No items yet. Click "+ Add" to add media!</p>
                  </div>
                )}
              </div>
            </SortableContext>
          </DndContext>
        )}

        {/* Grid View - Posters */}
        {viewMode === 'grid' && (
          <div className="grid grid-cols-4 sm:grid-cols-6 md:grid-cols-8 gap-2">
            {(listData?.items || [])
              .filter((item: any) => {
                // Search filter
                if (searchQuery && !item.title.toLowerCase().includes(searchQuery.toLowerCase()) && 
                    !item.creator?.toLowerCase().includes(searchQuery.toLowerCase())) {
                  return false;
                }
                // Type filter
                if (typeFilter !== 'all' && item.type?.toLowerCase() !== typeFilter.toLowerCase()) {
                  return false;
                }
                // Year filter - check addedDate year
                if (yearFilter !== 'all') {
                  const itemYear = item.addedDate ? new Date(item.addedDate).getFullYear().toString() : null;
                  if (itemYear !== yearFilter) return false;
                }
                // Rating filter
                if (ratingFilter !== 'all' && item.rating) {
                  if (item.rating < parseInt(ratingFilter)) return false;
                }
                return true;
              })
              .map((item: any) => {
              const isClickable = item.external_id && item.external_source;
              const mediaUrl = isClickable ? `/media/${item.type?.toLowerCase()}/${item.external_source}/${item.external_id}` : null;
              
              return (
                <div 
                  key={item.id} 
                  className="bg-white rounded-lg border border-gray-200 hover:border-purple-400 hover:shadow-lg transition-all relative group overflow-hidden"
                >
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleRemoveItem(item.id)}
                    className="absolute top-0.5 right-0.5 z-10 bg-black/60 hover:bg-red-600 text-white p-1 h-auto rounded"
                    data-testid={`button-remove-grid-${item.id}`}
                  >
                    <Trash2 size={12} />
                  </Button>

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
          {(listData?.items || []).length === 0 && (
            <div className="col-span-full text-center py-12 text-gray-500">
              <p>No items yet. Click "+ Add" to add media!</p>
            </div>
          )}
        </div>
        )}

      </div>

      {/* Quick Add Modal for Adding Media */}
      <QuickAddModal 
        isOpen={isTrackModalOpen} 
        onClose={() => setIsTrackModalOpen(false)}
        defaultListId={listData?.id}
      />

      {/* Manage Collaborators Dialog */}
      <Dialog open={isCollaboratorsDialogOpen} onOpenChange={setIsCollaboratorsDialogOpen}>
        <DialogContent className="max-w-md bg-white" data-testid="dialog-manage-collaborators">
          <DialogHeader>
            <DialogTitle className="text-gray-900">Manage Collaborators</DialogTitle>
            <DialogDescription className="text-gray-600">
              Add friends to collaborate on "{listData?.name ? getDisplayTitle(listData.name) : ''}". They'll be able to add and remove items.
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