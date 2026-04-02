import { useLocation } from "wouter";
import { ArrowLeft, ListChecks, Sparkles } from "lucide-react";

export default function AdminTriviaPage() {
  const [, setLocation] = useLocation();

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      <div className="max-w-4xl mx-auto px-4 py-8">
        <div className="mb-8">
          <button
            onClick={() => setLocation("/admin")}
            className="flex items-center gap-1.5 text-gray-400 hover:text-white text-sm mb-2 transition-colors"
          >
            <ArrowLeft size={14} />Back to Admin
          </button>
          <h1 className="text-2xl font-bold text-white mb-1">Generate Trivia & Polls</h1>
          <p className="text-gray-400 text-sm">AI-generated platform content — posts as Consumed, not as a user</p>
        </div>

        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-10 flex flex-col items-center justify-center text-center">
          <div className="w-14 h-14 rounded-2xl bg-blue-900/40 flex items-center justify-center mb-4">
            <ListChecks size={28} className="text-blue-400" />
          </div>
          <h2 className="text-lg font-semibold text-white mb-2">Coming Soon</h2>
          <p className="text-sm text-gray-400 max-w-xs leading-relaxed">
            AI trivia and poll generation is being set up. Check back shortly.
          </p>
          <div className="flex items-center gap-1.5 mt-5 text-xs text-gray-600">
            <Sparkles size={12} />
            <span>Powered by GPT-4o</span>
          </div>
        </div>
      </div>
    </div>
  );
}
