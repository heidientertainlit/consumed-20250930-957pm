import { useState, useEffect } from 'react';
import { useLocation, useParams, Link } from 'wouter';
import { ArrowLeft, Trophy, Plus, GripVertical, Globe, Lock, Trash2, MoreVertical, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/lib/auth';
import { supabase } from '@/lib/supabase';
import AddRankItemDialog from '@/components/add-rank-item-dialog';
import Navigation from '@/components/navigation';

interface RankItem {
  id: string;
  position: number;
  title: string;
  media_type?: string;
  creator?: string;
  image_url?: string;
  external_id?: string;
  external_source?: string;
}

interface Rank {
  id: string;
  user_id: string;
  title: string;
  visibility: string;
  max_items: number;
  items: RankItem[];
}

export default function RankDetail() {
  const { id } = useParams<{ id: string }>();
  const [, setLocation] = useLocation();
  const { session } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  const [isTrackModalOpen, setIsTrackModalOpen] = useState(false);

  const { data: rankData, isLoading } = useQuery({
    queryKey: ['rank-detail', id],
    queryFn: async () => {
      if (!session?.access_token) throw new Error('Authentication required');
      
      const response = await fetch(`https://mahpgcogwpawvviapqza.supabase.co/functions/v1/get-user-ranks?user_id=${session.user?.id}`, {
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
        },
      });

      if (!response.ok) throw new Error('Failed to fetch ranks');
      
      const data = await response.json();
      const foundRank = data.ranks?.find((r: Rank) => r.id === id);
      return foundRank || null;
    },
    enabled: !!session?.access_token && !!id,
  });

  const privacyMutation = useMutation({
    mutationFn: async (isPublic: boolean) => {
      if (!rankData?.id) throw new Error('Rank ID required');

      const { data, error } = await supabase
        .from('ranks')
        .update({ visibility: isPublic ? 'public' : 'private' })
        .eq('id', rankData.id)
        .select('id, title, visibility')
        .single();

      if (error) throw new Error(error.message || 'Failed to update visibility');
      return { success: true, rank: data, message: `Rank is now ${isPublic ? 'public' : 'private'}` };
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['rank-detail', id] });
      queryClient.invalidateQueries({ queryKey: ['user-ranks'] });
      toast({
        title: "Privacy Updated",
        description: data.message,
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

  const deleteRankMutation = useMutation({
    mutationFn: async (rankId: string) => {
      if (!session?.access_token) throw new Error('Authentication required');

      const response = await fetch("https://mahpgcogwpawvviapqza.supabase.co/functions/v1/delete-rank", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${session.access_token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ rank_id: rankId }),
      });

      if (!response.ok) throw new Error('Failed to delete rank');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['user-ranks'] });
      toast({ title: "Rank Deleted" });
      setLocation('/me?tab=collections');
    },
    onError: (error) => {
      toast({
        title: "Delete Failed",
        description: error.message,
        variant: "destructive"
      });
    }
  });

  const deleteItemMutation = useMutation({
    mutationFn: async (itemId: string) => {
      const { error } = await supabase
        .from('rank_items')
        .delete()
        .eq('id', itemId);

      if (error) throw new Error(error.message);
      return { success: true };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['rank-detail', id] });
      toast({ title: "Item Removed" });
    },
    onError: (error) => {
      toast({
        title: "Remove Failed",
        description: error.message,
        variant: "destructive"
      });
    }
  });

  const handleDeleteRank = () => {
    if (!rankData?.id) return;
    if (confirm(`Are you sure you want to delete "${rankData.title}"? This action cannot be undone.`)) {
      deleteRankMutation.mutate(rankData.id);
    }
  };

  const handleRemoveItem = (itemId: string) => {
    deleteItemMutation.mutate(itemId);
  };

  const isPublic = rankData?.visibility === 'public';

  if (isLoading) {
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

  if (!rankData) {
    return (
      <div className="min-h-screen bg-gray-50 pb-20">
        <Navigation onTrackConsumption={() => {}} />
        <div className="max-w-4xl mx-auto px-4 py-6">
          <div className="text-center">
            <h1 className="text-2xl font-bold text-gray-900 mb-4">Rank not found</h1>
            <Button onClick={() => setLocation("/me")}>
              Back to Profile
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      <Navigation onTrackConsumption={() => {}} />

      <div className="sticky top-16 z-40 bg-gradient-to-r from-gray-50 to-white border-b border-gray-200 shadow-sm">
        <div className="max-w-4xl mx-auto px-4 py-3">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-3 flex-1 min-w-0">
              <button
                onClick={() => setLocation("/me?tab=collections")}
                className="p-1.5 text-gray-700 hover:text-black transition-colors"
                data-testid="button-back"
              >
                <ArrowLeft size={20} />
              </button>
              <div className="flex-1 min-w-0">
                <h1 className="text-lg font-bold text-gray-900 truncate">{rankData.title}</h1>
                <p className="text-xs text-gray-500">{rankData.items?.length || 0} items</p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Badge 
                onClick={() => {
                  if (!privacyMutation.isPending) {
                    privacyMutation.mutate(!isPublic);
                  }
                }}
                variant="secondary" 
                className="cursor-pointer hover:bg-gray-200 text-xs px-2 py-1"
                data-testid="toggle-rank-privacy"
              >
                {isPublic ? (
                  <><Globe size={12} className="mr-1 text-purple-600" /> Public</>
                ) : (
                  <><Lock size={12} className="mr-1" /> Private</>
                )}
              </Badge>

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
                  <DropdownMenuItem 
                    onClick={handleDeleteRank}
                    disabled={deleteRankMutation.isPending}
                    className="text-red-600"
                  >
                    <Trash2 size={14} className="mr-2" />
                    {deleteRankMutation.isPending ? 'Deleting...' : 'Delete Rank'}
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 py-4">
        {rankData.items && rankData.items.length > 0 ? (
          <div className="grid grid-cols-6 sm:grid-cols-8 md:grid-cols-10 lg:grid-cols-12 xl:grid-cols-15 gap-1">
            {rankData.items.map((item: RankItem, index: number) => {
              const isClickable = item.external_id && item.external_source;
              const mediaUrl = isClickable ? `/media/${item.media_type}/${item.external_source}/${item.external_id}` : null;
              
              return (
                <div 
                  key={item.id} 
                  className="bg-white rounded-lg border border-gray-200 hover:border-purple-400 hover:shadow-lg transition-all relative group overflow-hidden"
                >
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleRemoveItem(item.id)}
                    className="absolute top-0.5 right-0.5 z-10 bg-black/60 hover:bg-red-600 text-white p-1 h-auto opacity-0 group-hover:opacity-100 transition-opacity rounded"
                    data-testid={`button-remove-${item.id}`}
                  >
                    <X size={12} />
                  </Button>

                  <div className="absolute top-0.5 left-0.5 z-10 bg-purple-600 text-white text-xs font-bold px-1.5 py-0.5 rounded">
                    {index + 1}
                  </div>

                  {isClickable ? (
                    <Link href={mediaUrl!}>
                      <div className="aspect-[2/3] relative">
                        <img
                          src={item.image_url || "https://images.unsplash.com/photo-1481627834876-b7833e8f5570?w=80&h=80&fit=crop"}
                          alt={item.title}
                          className="w-full h-full object-cover cursor-pointer hover:opacity-90 transition-opacity"
                        />
                      </div>
                    </Link>
                  ) : (
                    <div className="aspect-[2/3] relative">
                      <img
                        src={item.image_url || "https://images.unsplash.com/photo-1481627834876-b7833e8f5570?w=80&h=80&fit=crop"}
                        alt={item.title}
                        className="w-full h-full object-cover"
                      />
                    </div>
                  )}

                  <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/90 to-transparent p-2 opacity-0 group-hover:opacity-100 transition-opacity">
                    <h3 className="font-semibold text-xs text-white line-clamp-2 leading-tight">
                      {item.title}
                    </h3>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="bg-white rounded-xl p-12 text-center border border-gray-200">
            <Trophy className="text-gray-300 mx-auto mb-3" size={48} />
            <h3 className="text-lg font-semibold text-gray-700 mb-2">No items yet</h3>
            <p className="text-gray-500 mb-4">Click "Add" to start adding items to your rank</p>
            <Button
              onClick={() => setIsTrackModalOpen(true)}
              className="bg-purple-600 hover:bg-purple-700"
            >
              <Plus size={16} className="mr-2" />
              Add First Item
            </Button>
          </div>
        )}
      </div>

      <AddRankItemDialog 
        open={isTrackModalOpen} 
        onOpenChange={setIsTrackModalOpen}
        rankId={rankData.id}
        rankTitle={rankData.title}
        currentItemCount={rankData.items?.length || 0}
        maxItems={rankData.max_items || 10}
      />
    </div>
  );
}
