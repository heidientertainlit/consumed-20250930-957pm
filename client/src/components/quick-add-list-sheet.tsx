import { useState } from "react";
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle } from "@/components/ui/drawer";
import { X, Loader2, Check, Play, Clock, Ban, Heart, Folder } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { useToast } from "@/hooks/use-toast";
import { queryClient } from "@/lib/queryClient";
import { useQuery } from "@tanstack/react-query";

interface QuickAddListSheetProps {
  isOpen: boolean;
  onClose: () => void;
  media: {
    title: string;
    mediaType: string;
    imageUrl?: string;
    externalId?: string;
    externalSource?: string;
    creator?: string;
  } | null;
}

export function QuickAddListSheet({ isOpen, onClose, media }: QuickAddListSheetProps) {
  const { session } = useAuth();
  const { toast } = useToast();
  const [isAdding, setIsAdding] = useState<string | null>(null);

  const { data: userListsData, isLoading: isLoadingLists } = useQuery<any>({
    queryKey: ['user-lists-with-media'],
    queryFn: async () => {
      if (!session?.access_token) return null;
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://mahpgcogwpawvviapqza.supabase.co';
      const response = await fetch(`${supabaseUrl}/functions/v1/get-user-lists-with-media`, {
        method: "GET",
        headers: { "Authorization": `Bearer ${session.access_token}` },
      });
      if (!response.ok) throw new Error('Failed to fetch user lists');
      return response.json();
    },
    enabled: !!session?.access_token && isOpen,
  });

  const userLists = userListsData?.lists || [];

  const getListStyle = (title: string) => {
    const lower = title.toLowerCase();
    if (lower.includes('currently') || lower.includes('watching') || lower.includes('reading')) {
      return { bg: 'bg-purple-100', icon: <Play className="text-purple-600" size={20} />, desc: 'Currently consuming' };
    }
    if (lower.includes('queue') || lower.includes('want')) {
      return { bg: 'bg-blue-100', icon: <Clock className="text-blue-600" size={20} />, desc: 'Save for later' };
    }
    if (lower.includes('finished') || lower.includes('complete')) {
      return { bg: 'bg-green-100', icon: <Check className="text-green-600" size={20} />, desc: 'Completed media' };
    }
    if (lower.includes('dnf') || lower.includes('not finish')) {
      return { bg: 'bg-red-100', icon: <Ban className="text-red-600" size={20} />, desc: 'Stopped watching/reading' };
    }
    if (lower.includes('favorite')) {
      return { bg: 'bg-yellow-100', icon: <Heart className="text-yellow-600" size={20} />, desc: 'Your favorites' };
    }
    return { bg: 'bg-purple-100', icon: <Folder className="text-purple-600" size={20} />, desc: 'Custom list' };
  };

  const handleAddToList = async (listId: string, listName: string) => {
    if (!session?.access_token || !media) return;
    
    setIsAdding(listId);
    try {
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://mahpgcogwpawvviapqza.supabase.co';
      const response = await fetch(`${supabaseUrl}/functions/v1/add-to-list`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          list_id: listId,
          media: {
            title: media.title,
            media_type: media.mediaType,
            creator: media.creator || '',
            image_url: media.imageUrl || '',
            external_id: media.externalId,
            external_source: media.externalSource || 'tmdb',
          },
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || 'Failed to add to list');
      }

      toast({ title: `Added "${media.title}" to ${listName}!` });
      queryClient.invalidateQueries({ queryKey: ['user-lists-with-media'] });
      queryClient.invalidateQueries({ queryKey: ['activity-feed'] });
      onClose();
    } catch (error: any) {
      toast({ title: error.message || "Failed to add", variant: "destructive" });
    } finally {
      setIsAdding(null);
    }
  };

  return (
    <Drawer open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DrawerContent className="bg-white rounded-t-2xl">
        <DrawerHeader className="text-center pb-2 border-b border-gray-100">
          <DrawerTitle className="text-lg font-semibold text-gray-900">
            Add to List
          </DrawerTitle>
          {media && (
            <p className="text-sm text-gray-500 mt-1">{media.title}</p>
          )}
        </DrawerHeader>
        
        <div className="px-4 py-4 max-h-[60vh] overflow-y-auto space-y-2">
          {isLoadingLists ? (
            <div className="flex justify-center py-8">
              <Loader2 className="animate-spin text-purple-500" size={24} />
            </div>
          ) : userLists.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <p>No lists yet</p>
              <p className="text-sm mt-1">Create a list to start tracking</p>
            </div>
          ) : (
            <>
              {/* Cancel option */}
              <button
                onClick={onClose}
                className="w-full p-4 text-left rounded-lg hover:bg-gray-50 flex items-center gap-3 transition-colors"
                data-testid="list-option-cancel"
              >
                <div className="w-10 h-10 bg-gray-100 rounded-full flex items-center justify-center">
                  <X className="text-gray-500" size={20} />
                </div>
                <div className="flex-1">
                  <p className="font-medium text-gray-900">Cancel</p>
                  <p className="text-sm text-gray-500">Go back</p>
                </div>
              </button>
              
              {/* List options */}
              {userLists.map((list: any) => {
                const style = getListStyle(list.title || list.name);
                const listName = list.title || list.name;
                const isAddingThis = isAdding === list.id;
                
                return (
                  <button
                    key={list.id}
                    onClick={() => handleAddToList(list.id, listName)}
                    disabled={isAdding !== null}
                    className="w-full p-4 text-left rounded-lg hover:bg-gray-50 flex items-center gap-3 transition-colors disabled:opacity-50"
                    data-testid={`list-option-${list.id}`}
                  >
                    <div className={`w-10 h-10 ${style.bg} rounded-full flex items-center justify-center`}>
                      {isAddingThis ? (
                        <Loader2 className="animate-spin text-purple-600" size={20} />
                      ) : (
                        style.icon
                      )}
                    </div>
                    <div className="flex-1">
                      <p className="font-medium text-gray-900">{listName}</p>
                      <p className="text-sm text-gray-500">{style.desc}</p>
                    </div>
                  </button>
                );
              })}
            </>
          )}
        </div>
      </DrawerContent>
    </Drawer>
  );
}
