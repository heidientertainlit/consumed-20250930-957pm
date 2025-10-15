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
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Create New List</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label htmlFor="list-title">List Name</Label>
            <Input
              id="list-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Enter list name..."
              maxLength={50}
              autoFocus
            />
          </div>
          <div className="flex justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={createListMutation.isPending}
            >
              {createListMutation.isPending ? "Creating..." : "Create List"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

