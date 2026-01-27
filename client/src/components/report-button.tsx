import { useState } from 'react';
import { Flag, AlertTriangle, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/lib/auth';
import { useMutation } from '@tanstack/react-query';

interface ReportButtonProps {
  contentType: 'post' | 'comment' | 'hot_take' | 'list' | 'review';
  contentId: string;
  className?: string;
  iconOnly?: boolean;
}

const REPORT_REASONS = [
  { value: 'spam', label: 'Spam', description: 'Unwanted promotional content' },
  { value: 'harassment', label: 'Harassment', description: 'Targeting or bullying someone' },
  { value: 'hate_speech', label: 'Hate Speech', description: 'Discriminatory or hateful content' },
  { value: 'misinformation', label: 'Misinformation', description: 'False or misleading information' },
  { value: 'inappropriate', label: 'Inappropriate', description: 'Offensive or adult content' },
  { value: 'spoiler', label: 'Unmarked Spoiler', description: 'Contains spoilers without warning' },
  { value: 'other', label: 'Other', description: 'Something else' },
];

export function ReportButton({ contentType, contentId, className, iconOnly = true }: ReportButtonProps) {
  const { session } = useAuth();
  const { toast } = useToast();
  const [isOpen, setIsOpen] = useState(false);
  const [selectedReason, setSelectedReason] = useState<string>('');
  const [description, setDescription] = useState('');

  const reportMutation = useMutation({
    mutationFn: async () => {
      if (!session?.access_token) throw new Error('Not authenticated');

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/report-content`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${session.access_token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            content_type: contentType,
            content_id: contentId,
            reason: selectedReason,
            description: description || undefined,
          }),
        }
      );

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to submit report');
      }

      return response.json();
    },
    onSuccess: () => {
      toast({
        title: 'Report submitted',
        description: 'Thank you for helping keep our community safe.',
      });
      setIsOpen(false);
      setSelectedReason('');
      setDescription('');
    },
    onError: (error: Error) => {
      toast({
        title: 'Failed to submit report',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  const handleSubmit = () => {
    if (!selectedReason) {
      toast({
        title: 'Please select a reason',
        variant: 'destructive',
      });
      return;
    }
    reportMutation.mutate();
  };

  if (!session) return null;

  return (
    <>
      <button
        onClick={() => setIsOpen(true)}
        className={`text-gray-400 hover:text-red-500 transition-colors ${className}`}
        title="Report"
      >
        <Flag size={16} />
        {!iconOnly && <span className="ml-1 text-sm">Report</span>}
      </button>

      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="text-amber-500" size={20} />
              Report Content
            </DialogTitle>
            <DialogDescription>
              Help us understand what's wrong with this content.
            </DialogDescription>
          </DialogHeader>

          <div className="py-4">
            <RadioGroup value={selectedReason} onValueChange={setSelectedReason}>
              <div className="space-y-3">
                {REPORT_REASONS.map((reason) => (
                  <div key={reason.value} className="flex items-start space-x-3">
                    <RadioGroupItem value={reason.value} id={reason.value} className="mt-1" />
                    <Label htmlFor={reason.value} className="cursor-pointer">
                      <div className="font-medium">{reason.label}</div>
                      <div className="text-sm text-gray-500">{reason.description}</div>
                    </Label>
                  </div>
                ))}
              </div>
            </RadioGroup>

            {selectedReason === 'other' && (
              <div className="mt-4">
                <Textarea
                  placeholder="Please describe the issue..."
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="resize-none"
                  rows={3}
                />
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={!selectedReason || reportMutation.isPending}
              className="bg-red-600 hover:bg-red-700"
            >
              {reportMutation.isPending ? 'Submitting...' : 'Submit Report'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
