import { useLocation } from "wouter";
import { ChevronLeft } from "lucide-react";
import { useAuth } from "@/lib/auth";
import Navigation from "@/components/navigation";

interface ChallengeGroup {
  showTag: string;
  questionCount: number;
}

const SHOW_CONFIG: Record<string, { emoji: string; accentColor: string; description: string }> = {
  "Harry Potter": { emoji: "⚡", accentColor: "#7c3aed", description: "Test your wizarding world knowledge" },
  "Friends": { emoji: "☕", accentColor: "#f59e0b", description: "Could you BE any more of a fan?" },
};

function showConfig(tag: string) {
  return SHOW_CONFIG[tag] || { emoji: "🎮", accentColor: "#7c3aed", description: `${tag} trivia` };
}

export default function PlayPoolsPage() {
  const [, setLocation] = useLocation();

  const challenges: ChallengeGroup[] = [
    { showTag: "Harry Potter", questionCount: 12 },
    { showTag: "Friends", questionCount: 12 },
  ];

  return (
    <div className="min-h-screen bg-gray-50">
      <Navigation />

      {/* Header */}
      <div className="bg-white px-4 pt-5 pb-4" style={{ borderBottom: "0.5px solid #f3f4f6" }}>
        <div className="flex items-center gap-3">
          <button
            onClick={() => setLocation("/play")}
            className="w-7 h-7 rounded-full bg-gray-100 flex items-center justify-center shrink-0"
          >
            <ChevronLeft size={14} className="text-gray-500" />
          </button>
          <div>
            <h1 className="text-gray-900 text-xl font-bold leading-tight">Trivia Challenges</h1>
            <p className="text-gray-400 text-xs mt-0.5">Pick a show and test your knowledge</p>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="px-4 pt-4 pb-28">
        <div className="space-y-3">
          {challenges.map((group) => {
            const cfg = showConfig(group.showTag);
            const accent = cfg.accentColor;
            return (
              <div
                key={group.showTag}
                onClick={() => setLocation(`/play/challenge/${encodeURIComponent(group.showTag)}`)}
                className="rounded-2xl overflow-hidden relative cursor-pointer active:scale-[0.98] transition-transform"
                style={{
                  background: `linear-gradient(135deg, ${accent}0e 0%, ${accent}1a 100%)`,
                  border: `1px solid ${accent}28`,
                }}
              >
                <div className="px-4 pt-4 pb-3">
                  <div className="flex items-start gap-3">
                    <span className="text-2xl leading-none mt-0.5">{cfg.emoji}</span>
                    <div className="flex-1 min-w-0 pr-20">
                      <p className="text-gray-900 text-[15px] font-bold leading-tight">{group.showTag}</p>
                      <p className="text-gray-500 text-xs mt-0.5 line-clamp-1">{cfg.description}</p>
                      <div className="flex items-center gap-3 mt-2">
                        <span className="text-gray-400 text-[10px] font-medium">
                          {group.questionCount} question{group.questionCount !== 1 ? "s" : ""}
                        </span>
                      </div>
                    </div>
                  </div>
                  <div
                    className="flex items-center justify-end mt-3 pt-2.5"
                    style={{ borderTop: `0.5px solid ${accent}20` }}
                  >
                    <div
                      className="px-3 py-1.5 rounded-xl text-xs font-bold text-white"
                      style={{ background: accent }}
                    >
                      Play Now
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
