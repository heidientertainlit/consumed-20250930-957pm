import { useState } from 'react';
import { useLocation } from 'wouter';
import { ArrowLeft, Trophy, Info } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/lib/auth';

export default function CreateRank() {
  const [, setLocation] = useLocation();
  const { session } = useAuth();
  const { toast } = useToast();
  
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [maxItems, setMaxItems] = useState('10');
  const [visibility, setVisibility] = useState('public');
  const [isCreating, setIsCreating] = useState(false);

  const handleCreate = async () => {
    if (!title.trim()) {
      toast({
        title: "Title required",
        description: "Please enter a title for your rank",
        variant: "destructive"
      });
      return;
    }

    if (!session?.access_token) {
      toast({
        title: "Not logged in",
        description: "Please log in to create a rank",
        variant: "destructive"
      });
      return;
    }

    setIsCreating(true);

    try {
      const response = await fetch("https://mahpgcogwpawvviapqza.supabase.co/functions/v1/create-rank", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          title: title.trim(),
          description: description.trim() || null,
          max_items: parseInt(maxItems),
          visibility
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to create rank');
      }

      const data = await response.json();
      
      toast({
        title: "Rank Created!",
        description: `"${title}" is ready for you to add items`,
      });

      setLocation(`/rank/${data.rank.id}`);
    } catch (error: any) {
      console.error('Error creating rank:', error);
      toast({
        title: "Creation Failed",
        description: error.message || "Unable to create rank. Please try again.",
        variant: "destructive"
      });
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="sticky top-0 z-50 bg-white border-b border-gray-200 px-4 py-3">
        <div className="flex items-center gap-3">
          <button
            onClick={() => setLocation('/me')}
            className="p-2 -ml-2 hover:bg-gray-100 rounded-full transition-colors"
            data-testid="button-back"
          >
            <ArrowLeft size={20} className="text-gray-700" />
          </button>
          <h1 className="text-lg font-semibold text-gray-900">Create Rank</h1>
        </div>
      </div>

      <div className="p-4 max-w-lg mx-auto">
        <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-200">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-12 h-12 bg-gradient-to-br from-purple-100 to-blue-100 rounded-xl flex items-center justify-center">
              <Trophy className="text-purple-600" size={24} />
            </div>
            <div>
              <h2 className="font-semibold text-gray-900">New Ranked List</h2>
              <p className="text-sm text-gray-500">Create your personal ranking</p>
            </div>
          </div>

          <div className="space-y-5">
            <div>
              <Label htmlFor="title" className="text-sm font-medium text-gray-700">
                Title <span className="text-red-500">*</span>
              </Label>
              <Input
                id="title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g., Top 10 90s Movies"
                className="mt-1.5"
                data-testid="input-rank-title"
              />
            </div>

            <div>
              <Label htmlFor="description" className="text-sm font-medium text-gray-700">
                Description
              </Label>
              <Textarea
                id="description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="What's this ranking about?"
                className="mt-1.5 resize-none"
                rows={3}
                data-testid="input-rank-description"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="maxItems" className="text-sm font-medium text-gray-700">
                  Max Items
                </Label>
                <Select value={maxItems} onValueChange={setMaxItems}>
                  <SelectTrigger className="mt-1.5" data-testid="select-max-items">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="5">Top 5</SelectItem>
                    <SelectItem value="10">Top 10</SelectItem>
                    <SelectItem value="15">Top 15</SelectItem>
                    <SelectItem value="20">Top 20</SelectItem>
                    <SelectItem value="25">Top 25</SelectItem>
                    <SelectItem value="50">Top 50</SelectItem>
                    <SelectItem value="100">Top 100</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label htmlFor="visibility" className="text-sm font-medium text-gray-700">
                  Visibility
                </Label>
                <Select value={visibility} onValueChange={setVisibility}>
                  <SelectTrigger className="mt-1.5" data-testid="select-visibility">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="public">Public</SelectItem>
                    <SelectItem value="friends">Friends Only</SelectItem>
                    <SelectItem value="private">Private</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="bg-blue-50 rounded-lg p-3 flex items-start gap-2">
              <Info size={16} className="text-blue-600 mt-0.5 flex-shrink-0" />
              <p className="text-sm text-blue-800">
                After creating your rank, you can add and reorder items using drag-and-drop.
              </p>
            </div>

            <Button
              onClick={handleCreate}
              disabled={isCreating || !title.trim()}
              className="w-full bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 text-white"
              data-testid="button-submit-rank"
            >
              {isCreating ? 'Creating...' : 'Create Rank'}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
