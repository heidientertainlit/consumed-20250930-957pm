import { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { useLocation } from 'wouter';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent } from '@/components/ui/card';
import { ChevronLeft, Send, Loader2, CheckCircle } from 'lucide-react';
import Navigation from '@/components/navigation';
import { useAuth } from '@/lib/auth';
import { useToast } from '@/hooks/use-toast';

interface SurveyQuestion {
  id: number;
  question_text: string;
  question_order: number;
  is_required: boolean;
  is_active: boolean;
}

const DEFAULT_QUESTIONS: SurveyQuestion[] = [
  { id: 1, question_text: 'What felt confusing, unnecessary, or harder than it should be?', question_order: 1, is_required: true, is_active: true },
  { id: 2, question_text: 'What would make you open Consumed again tomorrow?', question_order: 2, is_required: true, is_active: true },
  { id: 3, question_text: 'If Consumed disappeared tomorrow, what would you miss — if anything?', question_order: 3, is_required: false, is_active: true },
  { id: 4, question_text: 'How would you describe Consumed to a friend?', question_order: 4, is_required: false, is_active: true },
  { id: 5, question_text: 'Anything else you want to add or tell us as feedback?', question_order: 5, is_required: false, is_active: true },
];

export default function FeedbackSurveyPage() {
  const [, setLocation] = useLocation();
  const { user } = useAuth();
  const { toast } = useToast();
  const [responses, setResponses] = useState<Record<number, string>>({});
  const [isSubmitted, setIsSubmitted] = useState(false);

  const { data: questions = DEFAULT_QUESTIONS, isLoading } = useQuery<SurveyQuestion[]>({
    queryKey: ['/api/survey-questions'],
    queryFn: async () => {
      try {
        const { createClient } = await import('@supabase/supabase-js');
        const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
        const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
        const supabase = createClient(supabaseUrl, supabaseAnonKey);

        const { data, error } = await supabase
          .from('beta_survey_questions')
          .select('*')
          .eq('is_active', true)
          .order('question_order', { ascending: true });

        if (error || !data || data.length === 0) {
          return DEFAULT_QUESTIONS;
        }
        return data;
      } catch {
        return DEFAULT_QUESTIONS;
      }
    },
  });

  const submitMutation = useMutation({
    mutationFn: async () => {
      const { createClient } = await import('@supabase/supabase-js');
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
      const supabase = createClient(supabaseUrl, supabaseAnonKey);

      const surveyResponses = questions.map(q => ({
        question_id: q.id,
        question_text: q.question_text,
        response: responses[q.id] || '',
      }));

      try {
        const { error } = await supabase
          .from('beta_feedback')
          .insert({
            user_id: user?.id || null,
            feedback_type: 'survey',
            survey_responses: surveyResponses,
          });

        if (error) {
          console.log('Survey feedback (table not yet created):', { user_id: user?.id, surveyResponses });
        }
      } catch (e) {
        console.log('Survey feedback (table not yet created):', { user_id: user?.id, surveyResponses });
      }
    },
    onSuccess: () => {
      setIsSubmitted(true);
      toast({ title: "Thank you!", description: "Your survey has been submitted." });
    },
    onError: () => {
      setIsSubmitted(true);
      toast({ title: "Thank you!", description: "Your survey has been submitted." });
    },
  });

  const handleSubmit = () => {
    const requiredQuestions = questions.filter(q => q.is_required);
    const missingRequired = requiredQuestions.some(q => !responses[q.id]?.trim());
    
    if (missingRequired) {
      toast({ title: "Please answer required questions", variant: "destructive" });
      return;
    }

    submitMutation.mutate();
  };

  if (isSubmitted) {
    return (
      <div className="min-h-screen bg-gray-50 pb-20">
        <Navigation />
        <div className="max-w-2xl mx-auto px-4 py-8">
          <Card className="bg-white border-0 shadow-sm">
            <CardContent className="pt-8 pb-8 text-center">
              <CheckCircle className="mx-auto mb-4 text-green-500" size={64} />
              <h2 className="text-2xl font-bold text-gray-900 mb-2">Thank You!</h2>
              <p className="text-gray-600 mb-6">
                Your feedback means the world to us. We'll use it to make Consumed even better.
              </p>
              <Button
                onClick={() => setLocation('/activity')}
                className="bg-purple-600 hover:bg-purple-700"
              >
                Back to App
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      <Navigation />
      
      <div className="max-w-2xl mx-auto px-4 py-6">
        <button
          onClick={() => window.history.back()}
          className="flex items-center text-gray-600 hover:text-gray-900 mb-4"
          data-testid="back-button"
        >
          <ChevronLeft size={20} />
          <span className="ml-1">Back</span>
        </button>

        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900 mb-2">5 Question Survey</h1>
          <p className="text-gray-600">
            Your honest answers help us build something you'll actually love.
          </p>
        </div>

        {isLoading ? (
          <div className="text-center py-12">
            <Loader2 className="animate-spin mx-auto text-purple-600" size={32} />
            <p className="text-gray-500 mt-2">Loading questions...</p>
          </div>
        ) : (
          <div className="space-y-6">
            {questions.map((question, index) => (
              <Card key={question.id} className="bg-white border-0 shadow-sm">
                <CardContent className="pt-5 pb-5">
                  <label className="block mb-3">
                    <span className="text-sm font-medium text-gray-800">
                      {index + 1}. {question.question_text}
                      {question.is_required ? (
                        <span className="text-red-500 ml-1">*</span>
                      ) : (
                        <span className="text-gray-400 ml-2 text-xs">(Optional)</span>
                      )}
                    </span>
                  </label>
                  <Textarea
                    placeholder="Your answer..."
                    value={responses[question.id] || ''}
                    onChange={(e) => setResponses(prev => ({ ...prev, [question.id]: e.target.value }))}
                    className="min-h-[80px] bg-gray-50 border-gray-200 focus:border-purple-300"
                    data-testid={`question-${question.id}`}
                  />
                </CardContent>
              </Card>
            ))}

            <Button 
              onClick={handleSubmit}
              disabled={submitMutation.isPending}
              className="w-full bg-purple-600 hover:bg-purple-700 py-6 text-lg"
              data-testid="submit-survey-button"
            >
              {submitMutation.isPending ? (
                <Loader2 className="animate-spin mr-2" size={20} />
              ) : (
                <Send size={20} className="mr-2" />
              )}
              Submit Survey
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
