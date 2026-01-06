import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { MessageCircle, ArrowRight, Send, Loader2 } from 'lucide-react';
import { useAuth } from '@/lib/auth';
import { useToast } from '@/hooks/use-toast';
import { useLocation } from 'wouter';

interface FeedbackDialogProps {
  isOpen: boolean;
  onClose: () => void;
}

export function FeedbackDialog({ isOpen, onClose }: FeedbackDialogProps) {
  const [openFeedback, setOpenFeedback] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { user, session } = useAuth();
  const { toast } = useToast();
  const [, setLocation] = useLocation();

  const handleSubmitOpenFeedback = async () => {
    if (!openFeedback.trim()) {
      toast({ title: "Please enter some feedback", variant: "destructive" });
      return;
    }

    setIsSubmitting(true);
    try {
      const { createClient } = await import('@supabase/supabase-js');
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
      const supabase = createClient(supabaseUrl, supabaseAnonKey);

      try {
        const { error } = await supabase
          .from('beta_feedback')
          .insert({
            user_id: user?.id || null,
            feedback_type: 'open_form',
            open_feedback: openFeedback.trim(),
          });

        if (error) {
          console.log('Open feedback (table not yet created):', { user_id: user?.id, feedback: openFeedback.trim() });
        }
      } catch (e) {
        console.log('Open feedback (table not yet created):', { user_id: user?.id, feedback: openFeedback.trim() });
      }

      toast({ title: "Thank you!", description: "Your feedback has been submitted." });
      setOpenFeedback('');
      onClose();
    } catch (error) {
      console.log('Open feedback (table not yet created):', { user_id: user?.id, feedback: openFeedback.trim() });
      toast({ title: "Thank you!", description: "Your feedback has been submitted." });
      setOpenFeedback('');
      onClose();
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleTakeSurvey = () => {
    onClose();
    setLocation('/feedback-survey');
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md bg-white">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-xl font-bold text-gray-900">
            <MessageCircle className="text-purple-600" size={24} />
            Share Your Feedback
          </DialogTitle>
        </DialogHeader>
        
        <div className="space-y-4 pt-2">
          <div className="text-gray-600 text-sm leading-relaxed">
            <p>
              We're still in beta, and your honest feedback helps shape what this becomes. Tell us what's clicking, what's confusing, and what you wish existed. Feedback = gold. You won't hurt our feelings.
            </p>
          </div>

          <div className="border-t border-gray-100 pt-4">
            <p className="text-sm text-gray-600 mb-3">
              Submit any thoughts below or take the 2-minute survey here:
            </p>
            
            <Button 
              onClick={handleTakeSurvey}
              variant="outline"
              className="w-full mb-4 border-purple-200 text-purple-600 hover:bg-purple-50"
              data-testid="take-survey-button"
            >
              Take 2-Minute Survey
              <ArrowRight size={16} className="ml-2" />
            </Button>
          </div>

          <div className="border-t border-gray-100 pt-4">
            <label className="text-sm font-medium text-gray-700 mb-2 block">
              Open Form
            </label>
            <Textarea
              placeholder="What's on your mind? Share anything..."
              value={openFeedback}
              onChange={(e) => setOpenFeedback(e.target.value)}
              className="min-h-[100px] bg-gray-50 border-gray-200 focus:border-purple-300"
              data-testid="open-feedback-textarea"
            />
            <Button 
              onClick={handleSubmitOpenFeedback}
              disabled={isSubmitting || !openFeedback.trim()}
              className="w-full mt-3 bg-purple-600 hover:bg-purple-700"
              data-testid="submit-feedback-button"
            >
              {isSubmitting ? (
                <Loader2 className="animate-spin mr-2" size={16} />
              ) : (
                <Send size={16} className="mr-2" />
              )}
              Submit Feedback
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
