import { useState } from "react";
import { Link, useLocation } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient } from "@/lib/queryClient";
import { useAuth } from "@/lib/auth";
import { useToast } from "@/hooks/use-toast";
import Navigation from "@/components/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Trophy, Plus, ChevronRight, ArrowLeft, Users, Loader2, Share2 } from "lucide-react";

export default function PlayRanks() {
  const { user, session } = useAuth();
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const [isCreateRankOpen, setIsCreateRankOpen] = useState(false);
  const [newRankName, setNewRankName] = useState("");
  const [newRankVisibility, setNewRankVisibility] = useState("public");

  const { data: ranksData, isLoading } = useQuery({
    queryKey: ['user-ranks', user?.id],
    queryFn: async () => {
      if (!session?.access_token || !user?.id) return { ranks: [] };
      
      const response = await fetch(
        `https://mahpgcogwpawvviapqza.supabase.co/functions/v1/get-user-ranks?user_id=${user.id}`,
        {
          headers: {
            'Authorization': `Bearer ${session.access_token}`,
            'Content-Type': 'application/json',
          },
        }
      );
      
      if (response.ok) {
        return response.json();
      }
      return { ranks: [] };
    },
    enabled: !!session?.access_token && !!user?.id,
  });

  const createRankMutation = useMutation({
    mutationFn: async () => {
      if (!session?.access_token || !newRankName.trim()) return;
      
      const response = await fetch(
        'https://mahpgcogwpawvviapqza.supabase.co/functions/v1/manage-ranks',
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${session.access_token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            action: 'create',
            title: newRankName.trim(),
            visibility: newRankVisibility,
          }),
        }
      );
      
      if (!response.ok) throw new Error('Failed to create rank');
      return response.json();
    },
    onSuccess: (data) => {
      toast({ title: "Rank created!", description: `"${newRankName}" has been created.` });
      setNewRankName("");
      setIsCreateRankOpen(false);
      queryClient.invalidateQueries({ queryKey: ['user-ranks', user?.id] });
      if (data?.rank?.id) {
        setLocation(`/rank/${data.rank.id}`);
      }
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to create rank", variant: "destructive" });
    },
  });

  const userRanks = ranksData?.ranks || [];

  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      <Navigation />
      
      <div className="max-w-4xl mx-auto px-4 py-6">
        <button 
          onClick={() => window.history.back()}
          className="flex items-center gap-2 text-gray-600 hover:text-gray-900 mb-4"
          data-testid="back-button"
        >
          <ArrowLeft size={20} />
          <span>Back</span>
        </button>

        <div className="mb-6">
          <h1 className="text-3xl font-semibold text-black mb-2 flex items-center gap-2" style={{ fontFamily: 'Poppins, sans-serif' }}>
            <Trophy className="text-orange-600" size={32} />
            Rank Challenges
          </h1>
          <p className="text-base text-gray-600">
            Create ranked lists and challenge friends to make their own
          </p>
        </div>

        <div className="bg-gradient-to-br from-orange-50 to-yellow-50 rounded-2xl border border-orange-200 p-6 mb-6">
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 bg-orange-100 rounded-xl flex items-center justify-center flex-shrink-0">
              <Users className="text-orange-600" size={24} />
            </div>
            <div className="flex-1">
              <h3 className="font-semibold text-gray-900 mb-1">Challenge Friends</h3>
              <p className="text-sm text-gray-600 mb-3">
                Create a ranked list like "Top 10 90s Movies" and share it with friends. They can make their own version and see how your tastes compare!
              </p>
              <Dialog open={isCreateRankOpen} onOpenChange={setIsCreateRankOpen}>
                <DialogTrigger asChild>
                  <Button className="bg-orange-600 hover:bg-orange-700" data-testid="button-create-rank">
                    <Plus size={16} className="mr-2" />
                    Create Rank Challenge
                  </Button>
                </DialogTrigger>
                <DialogContent className="bg-white">
                  <DialogHeader>
                    <DialogTitle className="text-gray-900">Create Rank Challenge</DialogTitle>
                  </DialogHeader>
                  <div className="space-y-4 pt-4">
                    <Input
                      placeholder="e.g., Top 10 90s Movies"
                      value={newRankName}
                      onChange={(e) => setNewRankName(e.target.value)}
                      className="bg-white text-gray-900 border-gray-300"
                      data-testid="input-rank-name"
                    />
                    <Select value={newRankVisibility} onValueChange={setNewRankVisibility}>
                      <SelectTrigger className="bg-white text-gray-900 border-gray-300">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="bg-white border border-gray-200">
                        <SelectItem value="public" className="text-gray-900">Public (anyone can see)</SelectItem>
                        <SelectItem value="friends" className="text-gray-900">Friends Only</SelectItem>
                        <SelectItem value="private" className="text-gray-900">Private</SelectItem>
                      </SelectContent>
                    </Select>
                    <Button 
                      className="w-full bg-orange-600 hover:bg-orange-700"
                      onClick={() => createRankMutation.mutate()}
                      disabled={!newRankName.trim() || createRankMutation.isPending}
                      data-testid="button-submit-rank"
                    >
                      {createRankMutation.isPending ? <Loader2 className="animate-spin mr-2" size={16} /> : null}
                      Create & Start Ranking
                    </Button>
                  </div>
                </DialogContent>
              </Dialog>
            </div>
          </div>
        </div>

        <h2 className="text-lg font-semibold text-gray-900 mb-4">Your Ranks</h2>

        {isLoading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((n) => (
              <div key={n} className="bg-white rounded-xl p-4 animate-pulse">
                <div className="h-5 bg-gray-200 rounded w-1/3 mb-2"></div>
                <div className="h-4 bg-gray-100 rounded w-1/4"></div>
              </div>
            ))}
          </div>
        ) : userRanks.length === 0 ? (
          <div className="bg-white rounded-2xl border border-gray-200 p-8 text-center">
            <Trophy className="mx-auto mb-3 text-gray-300" size={48} />
            <p className="text-gray-600">No rank challenges yet</p>
            <p className="text-sm text-gray-500">Create your first ranked list to challenge friends</p>
          </div>
        ) : (
          <div className="space-y-2">
            {userRanks.map((rank: any) => (
              <div
                key={rank.id}
                className="bg-white border border-gray-200 rounded-xl hover:border-orange-300 transition-colors cursor-pointer"
                onClick={() => setLocation(`/rank/${rank.id}`)}
                data-testid={`rank-card-${rank.id}`}
              >
                <div className="px-4 py-3 flex items-center justify-between">
                  <div className="flex items-center gap-3 flex-1">
                    <div className="w-10 h-10 bg-gradient-to-br from-orange-100 to-yellow-100 rounded-lg flex items-center justify-center">
                      <Trophy className="text-orange-600" size={18} />
                    </div>
                    <div className="flex-1">
                      <h3 className="font-semibold text-gray-900">{rank.title}</h3>
                      <p className="text-sm text-gray-500">
                        {rank.items?.length || 0} {rank.items?.length === 1 ? 'item' : 'items'}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Share2 
                      className="text-gray-400 hover:text-orange-600" 
                      size={18}
                      onClick={(e) => {
                        e.stopPropagation();
                        const url = `${import.meta.env.VITE_APP_URL || window.location.origin}/rank/${rank.id}`;
                        navigator.clipboard.writeText(url);
                        toast({ title: "Link copied!" });
                      }}
                    />
                    <ChevronRight className="text-gray-400" size={20} />
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
