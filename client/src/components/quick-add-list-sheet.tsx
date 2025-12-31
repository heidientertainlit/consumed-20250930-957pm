import { useState } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { X, Loader2, Check, Plus } from "lucide-react";
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
  const [addedToLists, setAddedToLists] = useState<Set<string>>(new Set());

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

      setAddedToLists(prev => new Set([...prev, listId]));
      toast({ title: `Added to ${listName}!` });
      queryClient.invalidateQueries({ queryKey: ['user-lists-with-media'] });
      queryClient.invalidateQueries({ queryKey: ['activity-feed'] });
    } catch (error: any) {
      toast({ title: error.message || "Failed to add", variant: "destructive" });
    } finally {
      setIsAdding(null);
    }
  };

  const handleClose = () => {
    setAddedToLists(new Set());
    onClose();
  };

  const defaultLists = userLists.filter((l: any) => l.is_default);
  const customLists = userLists.filter((l: any) => !l.is_default);

  return (
    <Sheet open={isOpen} onOpenChange={(open) => !open && handleClose()}>
      <SheetContent side="bottom" className="rounded-t-3xl max-h-[70vh] overflow-hidden">
        <SheetHeader className="pb-4 border-b border-gray-100">
          <div className="flex items-center justify-between">
            <SheetTitle className="text-lg font-semibold">Add to List</SheetTitle>
            <button onClick={handleClose} className="p-1 hover:bg-gray-100 rounded-full">
              <X size={20} className="text-gray-500" />
            </button>
          </div>
        </SheetHeader>

        {media && (
          <div className="flex items-center gap-3 py-4 border-b border-gray-100">
            {media.imageUrl ? (
              <img src={media.imageUrl} alt={media.title} className="w-12 h-16 object-cover rounded-lg" />
            ) : (
              <div className="w-12 h-16 bg-gray-200 rounded-lg flex items-center justify-center text-gray-400 text-xs">
                No image
              </div>
            )}
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-gray-900 truncate">{media.title}</p>
              <p className="text-sm text-gray-500 capitalize">{media.mediaType}</p>
            </div>
          </div>
        )}

        <div className="py-4 overflow-y-auto max-h-[40vh]">
          {isLoadingLists ? (
            <div className="flex justify-center py-8">
              <Loader2 className="animate-spin text-purple-500" size={24} />
            </div>
          ) : (
            <div className="space-y-2">
              {defaultLists.length > 0 && (
                <>
                  <p className="text-xs font-medium text-gray-500 uppercase tracking-wide px-1 mb-2">Quick Add</p>
                  {defaultLists.map((list: any) => (
                    <button
                      key={list.id}
                      onClick={() => handleAddToList(list.id, list.name)}
                      disabled={isAdding === list.id || addedToLists.has(list.id)}
                      className="w-full flex items-center justify-between p-3 rounded-xl bg-gray-50 hover:bg-gray-100 disabled:opacity-60 transition-colors"
                      data-testid={`quick-add-list-${list.id}`}
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg bg-purple-100 flex items-center justify-center">
                          <span className="text-lg">{list.icon || '📋'}</span>
                        </div>
                        <span className="font-medium text-gray-900">{list.name}</span>
                      </div>
                      {isAdding === list.id ? (
                        <Loader2 className="animate-spin text-purple-500" size={18} />
                      ) : addedToLists.has(list.id) ? (
                        <Check className="text-green-500" size={18} />
                      ) : (
                        <Plus className="text-gray-400" size={18} />
                      )}
                    </button>
                  ))}
                </>
              )}

              {customLists.length > 0 && (
                <>
                  <p className="text-xs font-medium text-gray-500 uppercase tracking-wide px-1 mt-4 mb-2">Your Lists</p>
                  {customLists.map((list: any) => (
                    <button
                      key={list.id}
                      onClick={() => handleAddToList(list.id, list.name)}
                      disabled={isAdding === list.id || addedToLists.has(list.id)}
                      className="w-full flex items-center justify-between p-3 rounded-xl bg-gray-50 hover:bg-gray-100 disabled:opacity-60 transition-colors"
                      data-testid={`quick-add-list-${list.id}`}
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg bg-purple-100 flex items-center justify-center">
                          <span className="text-lg">{list.icon || '📋'}</span>
                        </div>
                        <span className="font-medium text-gray-900">{list.name}</span>
                      </div>
                      {isAdding === list.id ? (
                        <Loader2 className="animate-spin text-purple-500" size={18} />
                      ) : addedToLists.has(list.id) ? (
                        <Check className="text-green-500" size={18} />
                      ) : (
                        <Plus className="text-gray-400" size={18} />
                      )}
                    </button>
                  ))}
                </>
              )}

              {userLists.length === 0 && (
                <div className="text-center py-8 text-gray-500">
                  <p>No lists yet</p>
                  <p className="text-sm mt-1">Create a list to start tracking</p>
                </div>
              )}
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
