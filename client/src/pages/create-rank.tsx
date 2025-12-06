import { useState } from 'react';
import { useLocation } from 'wouter';
import { ArrowLeft, Trophy, Globe, Lock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/lib/auth';

export default function CreateRank() {
  const [, setLocation] = useLocation();
  const { session } = useAuth();
  const { toast } = useToast();
  
  const [title, setTitle] = useState('');
  const [isPublic, setIsPublic] = useState(true);
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
          visibility: isPublic ? 'public' : 'private'
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
                className="mt-1.5 bg-white border-gray-300 text-gray-900 placeholder:text-gray-400"
                data-testid="input-rank-title"
              />
            </div>

            <div className="flex items-center justify-between py-3 border-t border-gray-100">
              <div className="flex items-center gap-3">
                {isPublic ? (
                  <Globe size={20} className="text-purple-600" />
                ) : (
                  <Lock size={20} className="text-gray-500" />
                )}
                <div>
                  <p className="font-medium text-gray-900">
                    {isPublic ? 'Public' : 'Private'}
                  </p>
                  <p className="text-sm text-gray-500">
                    {isPublic ? 'Anyone can see this rank' : 'Only you can see this rank'}
                  </p>
                </div>
              </div>
              <Switch
                checked={isPublic}
                onCheckedChange={setIsPublic}
                data-testid="switch-visibility"
              />
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
