import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth";
import { useLocation } from "wouter";

interface CreateRankDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export default function CreateRankDialog({ open, onOpenChange }: CreateRankDialogProps) {
  const [title, setTitle] = useState("");
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { session } = useAuth();
  const [, setLocation] = useLocation();

  const createRankMutation = useMutation({
    mutationFn: async (rankTitle: string) => {
      const response = await fetch("https://mahpgcogwpawvviapqza.supabase.co/functions/v1/create-rank", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${session?.access_token || ''}`,
        },
        body: JSON.stringify({ 
          title: rankTitle,
          visibility: 'public'
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to create rank');
      }

      return response.json();
    },
    onSuccess: async (data) => {
      toast({
        title: "Rank Created!",
        description: `"${data.rank.title}" has been created`,
      });
      
      await queryClient.invalidateQueries({ queryKey: ['user-ranks'] });
      
      setTitle("");
      onOpenChange(false);
      
      setLocation(`/rank/${data.rank.id}`);
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to Create Rank",
        description: error.message || "Please try again",
        variant: "destructive",
      });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!title.trim()) {
      toast({
        title: "Title Required",
        description: "Please enter a name for your rank",
        variant: "destructive",
      });
      return;
    }

    if (title.trim().length > 50) {
      toast({
        title: "Title Too Long",
        description: "Rank name must be 50 characters or less",
        variant: "destructive",
      });
      return;
    }

    createRankMutation.mutate(title.trim());
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px] bg-white dark:bg-white text-black dark:text-black border-gray-200">
        <DialogHeader>
          <DialogTitle className="text-black">Create Ranked List</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 mt-4">
          <div className="space-y-2">
            <Label htmlFor="rank-title" className="text-black">Rank Name</Label>
            <Input
              id="rank-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g., Top 10 90s Movies, Best Albums Ever"
              maxLength={50}
              data-testid="input-rank-title"
              autoFocus
              className="bg-white text-black border-gray-300 placeholder:text-gray-500"
            />
            <p className="text-xs text-gray-600">
              {title.length}/50 characters
            </p>
          </div>

          <div className="flex justify-end gap-3 pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              data-testid="button-cancel-create-rank"
              className="border-gray-300 bg-white text-black hover:bg-gray-100 hover:text-black"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={createRankMutation.isPending || !title.trim()}
              className="bg-purple-600 hover:bg-purple-700 text-white"
              data-testid="button-create-rank"
            >
              {createRankMutation.isPending ? "Creating..." : "Create Rank"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
