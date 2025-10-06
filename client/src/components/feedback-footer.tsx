export default function FeedbackFooter() {
  return (
    <div className="bg-gradient-to-r from-purple-50 to-pink-50 border-t-2 border-purple-200 p-6 mb-2">
      <div className="max-w-4xl mx-auto text-center">
        <p className="text-gray-800 mb-3">
          💬 <strong>Have feedback?</strong> Share it directly with me, Heidi, the founder of Consumed.
        </p>
        <p className="text-gray-700 text-sm mb-3">
          Email{" "}
          <a
            href="mailto:feedback@consumedapp.com?subject=Consumed Feedback"
            className="text-purple-700 font-semibold hover:text-purple-900 underline"
            data-testid="feedback-email-link"
          >
            feedback@consumedapp.com
          </a>
          {" "}to share what you love, what's not working, and what you'd like to see next.
        </p>
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
