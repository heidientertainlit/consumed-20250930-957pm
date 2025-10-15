import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth";

interface CreateListDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export default function CreateListDialog({ open, onOpenChange }: CreateListDialogProps) {
  const [title, setTitle] = useState("");
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { session } = useAuth();

  const createListMutation = useMutation({
    mutationFn: async (listTitle: string) => {
      const response = await fetch("https://mahpgcogwpawvviapqza.supabase.co/functions/v1/create-custom-list", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${session?.access_token || ''}`,
        },
        body: JSON.stringify({ title: listTitle }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to create list');
      }

      return response.json();
    },
    onSuccess: (data) => {
      toast({
        title: "List Created!",
        description: `"${data.list.title}" has been added to your custom lists`,
      });
      queryClient.invalidateQueries({ queryKey: ['user-lists-with-media'] });
      setTitle("");
      onOpenChange(false);
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to Create List",
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
        description: "Please enter a name for your list",
        variant: "destructive",
      });
      return;
    }

    if (title.trim().length > 50) {
      toast({
        title: "Title Too Long",
        description: "List name must be 50 characters or less",
        variant: "destructive",
      });
      return;
    }

    createListMutation.mutate(title.trim());
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px] bg-white dark:bg-white text-black dark:text-black border-gray-200">
        <DialogHeader>
          <DialogTitle className="text-black">Create Custom List</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 mt-4">
          <div className="space-y-2">
            <Label htmlFor="list-title" className="text-black">List Name</Label>
            <Input
              id="list-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g., My Watchlist, Classics, Binge Queue"
              maxLength={50}
              data-testid="input-list-title"
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
              data-testid="button-cancel-create-list"
              className="border-gray-300 text-black hover:bg-gray-100"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={createListMutation.isPending || !title.trim()}
              className="bg-purple-600 hover:bg-purple-700 text-white"
              data-testid="button-create-list"
            >
              {createListMutation.isPending ? "Creating..." : "Create List"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

