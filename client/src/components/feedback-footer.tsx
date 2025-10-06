import { useToast } from "@/hooks/use-toast";

export default function FeedbackFooter() {
  const { toast } = useToast();

  const copyEmail = async () => {
    try {
      await navigator.clipboard.writeText('feedback@consumedapp.com');
      toast({
        title: "Email copied!",
        description: "Paste it into your email app to send feedback.",
      });
    } catch (error) {
      console.error('Error copying email:', error);
      toast({
        title: "Copy failed",
        description: "Email: feedback@consumedapp.com",
        variant: "destructive"
      });
    }
  };

  return (
    <div className="bg-gradient-to-r from-purple-50 to-pink-50 border-t-2 border-purple-200 p-6 mb-2">
      <div className="max-w-4xl mx-auto text-center">
        <p className="text-gray-800 mb-3">
          💬 <strong>Have feedback?</strong> Share it directly with me, Heidi, the founder of Consumed.
        </p>
        <div className="text-gray-700 text-sm mb-3 flex items-center justify-center gap-2 flex-wrap">
          <span>Email</span>
          <button
            onClick={copyEmail}
            className="text-purple-700 font-semibold hover:text-purple-900 underline inline-flex items-center gap-1"
            data-testid="copy-feedback-email"
          >
            feedback@consumedapp.com
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
            </svg>
          </button>
          <span>to share what you love, what's not working, and what you'd like to see next.</span>
        </div>
        <p className="text-gray-700 text-sm">
          👉{" "}
          <a
            href="https://www.consumedapp.com/about"
            target="_blank"
            rel="noopener noreferrer"
            className="text-purple-700 font-semibold hover:text-purple-900 underline"
            data-testid="founder-story-link"
          >
            Learn more about Heidi's story
          </a>
          .
        </p>
      </div>
    </div>
  );
}
