import { useState } from "react";
import {
  Flame,
  Sparkles,
  ArrowRight,
  Check,
  ChevronDown,
  Shuffle,
  Brain,
  Zap,
  MessageCircle,
  User,
  Film,
  Tv,
  BookOpen,
  Music,
  Mic,
} from "lucide-react";

type Step =
  | "debate"
  | "feedback"
  | "discover"
  | "about"
  | "dna"
  | "done";

const mediaTabs = [
  { label: "Movies", icon: Film },
  { label: "TV Shows", icon: Tv },
  { label: "Books", icon: BookOpen },
  { label: "Music", icon: Music },
  { label: "Podcasts", icon: Mic },
];

const discoverItems = [
  { title: "The Dark Knight", sub: "2008 · Movie", color: "#1f2937" },
  { title: "Pride & Prejudice", sub: "Novel · Jane Austen", color: "#7c5c3e" },
  { title: "Hamilton", sub: "Musical · 2015", color: "#8a6d1f" },
];

function Phone({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen w-full flex items-stretch justify-center bg-[#0b0812]">
      <div className="w-full max-w-[430px] flex flex-col text-white" style={{ background: "linear-gradient(180deg, #120d1f 0%, #0b0812 100%)" }}>
        {children}
      </div>
    </div>
  );
}

function ProgressDots({ step }: { step: number }) {
  return (
    <div className="flex items-center justify-center gap-1.5 pt-5">
      {[0, 1, 2, 3, 4].map((i) => (
        <div
          key={i}
          className="h-1.5 rounded-full transition-all"
          style={{
            width: i === step ? 22 : 8,
            background: i <= step ? "#a855f7" : "rgba(255,255,255,0.15)",
          }}
        />
      ))}
    </div>
  );
}

function Poster({ title, gradient, tagline }: { title: string; gradient: string; tagline: string }) {
  return (
    <div className="flex-1 rounded-2xl overflow-hidden relative" style={{ background: gradient, aspectRatio: "2/3" }}>
      <div className="absolute inset-0 flex flex-col items-center justify-center px-3 text-center">
        <span className="text-lg font-black tracking-tight leading-tight drop-shadow-lg">{title}</span>
        <span className="text-[10px] mt-1.5 text-white/80 font-medium uppercase tracking-widest">{tagline}</span>
      </div>
    </div>
  );
}

export function ConversationalOnboarding() {
  const [step, setStep] = useState<Step>("debate");
  const [vote, setVote] = useState<string | null>(null);
  const [seen, setSeen] = useState<Record<string, string>>({});
  const [gender, setGender] = useState<string | null>(null);

  if (step === "debate")
    return (
      <Phone>
        <ProgressDots step={0} />
        <div className="flex-1 flex flex-col px-5 pt-6 pb-8">
          <div className="flex items-center gap-2 justify-center">
            <Flame size={16} className="text-orange-400" />
            <span className="text-sm font-semibold text-white/80">What's your vote?</span>
          </div>
          <h1 className="text-center text-2xl font-black mt-2">Barbie vs Oppenheimer</h1>
          <p className="text-center text-sm text-white/60 mt-1">Which was better?</p>

          <div className="flex items-center gap-3 mt-6 relative">
            <Poster title="BARBIE" tagline="She's everything" gradient="linear-gradient(160deg, #ff5fa2 0%, #d93b8a 60%, #a12468 100%)" />
            <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-10 w-11 h-11 rounded-full bg-[#0b0812] border border-white/20 flex items-center justify-center text-sm font-black">
              VS
            </div>
            <Poster title="OPPENHEIMER" tagline="The world changed" gradient="linear-gradient(160deg, #f97316 0%, #9a3412 55%, #1c1917 100%)" />
          </div>

          <p className="text-center text-xs text-white/50 mt-5 mb-2 font-medium">Choose your side</p>
          <div className="space-y-2.5">
            <button
              onClick={() => { setVote("Barbie"); setStep("feedback"); }}
              className="w-full py-3 rounded-full font-bold text-[15px] transition-transform active:scale-95"
              style={{ background: "linear-gradient(90deg, #ec4899, #d946ef)" }}
            >
              Barbie was better
            </button>
            <button
              onClick={() => { setVote("Oppenheimer"); setStep("feedback"); }}
              className="w-full py-3 rounded-full font-bold text-[15px] transition-transform active:scale-95"
              style={{ background: "linear-gradient(90deg, #f97316, #ea580c)" }}
            >
              Oppenheimer was better
            </button>
            <button
              onClick={() => setStep("feedback")}
              className="w-full py-3 rounded-full font-semibold text-[14px] text-white/70 border border-white/15 active:scale-95 transition-transform"
            >
              Neither / Haven't seen
            </button>
          </div>

          <button className="flex items-center gap-1.5 justify-center mt-5 text-xs text-white/40 font-medium">
            <Shuffle size={13} /> Switch media type
          </button>
        </div>
      </Phone>
    );

  if (step === "feedback")
    return (
      <Phone>
        <ProgressDots step={1} />
        <div className="flex-1 flex flex-col items-center px-6 pt-14 pb-8">
          <div className="w-28 h-28 rounded-full flex items-center justify-center" style={{ background: "radial-gradient(circle at 35% 30%, #a855f7, #6b21a8 70%)", boxShadow: "0 0 60px rgba(168,85,247,0.45)" }}>
            <Sparkles size={44} className="text-white" />
          </div>
          <h2 className="text-2xl font-black mt-8">Nice pick!</h2>
          <p className="text-sm text-white/60 mt-1.5">
            {vote ? `Based on your ${vote} vote...` : "Based on your vote..."}
          </p>
          <div className="flex flex-wrap gap-2 justify-center mt-5">
            {["Big stories", "Thought-provoking", "Event movies"].map((t) => (
              <span key={t} className="px-3.5 py-1.5 rounded-full text-xs font-semibold bg-white/10 border border-white/10 text-white/85">
                {t}
              </span>
            ))}
          </div>
          <div className="flex-1" />
          <button
            onClick={() => setStep("discover")}
            className="w-full py-3.5 rounded-full font-bold text-[15px] flex items-center justify-center gap-2 active:scale-95 transition-transform"
            style={{ background: "linear-gradient(90deg, #7c3aed, #a855f7)" }}
          >
            Show me more <ArrowRight size={17} />
          </button>
        </div>
      </Phone>
    );

  if (step === "discover")
    return (
      <Phone>
        <ProgressDots step={2} />
        <div className="flex-1 flex flex-col px-5 pt-6 pb-8">
          <h2 className="text-center text-xl font-black">Based on that...</h2>
          <p className="text-center text-sm text-white/60 mt-1">
            Which of these have you seen, read, or listened to?
          </p>

          <div className="flex gap-1.5 mt-5 overflow-x-auto pb-1">
            {mediaTabs.map((t, i) => (
              <span
                key={t.label}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap ${i === 0 ? "bg-purple-600 text-white" : "bg-white/8 text-white/60 border border-white/10"}`}
              >
                <t.icon size={12} /> {t.label}
              </span>
            ))}
          </div>

          <div className="space-y-3 mt-4">
            {discoverItems.map((item) => (
              <div key={item.title} className="flex items-center gap-3 p-3 rounded-2xl bg-white/5 border border-white/8">
                <div className="w-11 h-16 rounded-lg shrink-0" style={{ background: `linear-gradient(160deg, ${item.color}, #0f0c18)` }} />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold truncate">{item.title}</p>
                  <p className="text-[11px] text-white/50">{item.sub}</p>
                  <div className="flex gap-1.5 mt-2">
                    {["Seen", "Want to", "Skip"].map((opt) => (
                      <button
                        key={opt}
                        onClick={() => setSeen((s) => ({ ...s, [item.title]: opt }))}
                        className={`px-2.5 py-1 rounded-full text-[11px] font-semibold transition-colors ${seen[item.title] === opt ? "bg-purple-600 text-white" : "bg-white/8 text-white/60"}`}
                      >
                        {seen[item.title] === opt && <Check size={10} className="inline mr-0.5 -mt-px" />}
                        {opt}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            ))}
          </div>

          <button className="flex items-center gap-1 justify-center mt-4 text-xs text-white/40 font-medium">
            Show more <ChevronDown size={13} />
          </button>

          <div className="flex-1" />
          <button
            onClick={() => setStep("about")}
            className="w-full py-3.5 rounded-full font-bold text-[15px] mt-4 active:scale-95 transition-transform"
            style={{ background: "linear-gradient(90deg, #7c3aed, #a855f7)" }}
          >
            Continue
          </button>
        </div>
      </Phone>
    );

  if (step === "about")
    return (
      <Phone>
        <ProgressDots step={3} />
        <div className="flex-1 flex flex-col px-6 pt-8 pb-8">
          <h2 className="text-center text-2xl font-black">Almost there!</h2>
          <p className="text-center text-sm text-white/60 mt-1.5">
            This helps us personalize your experience.
          </p>

          <p className="text-sm font-semibold text-white/80 mt-8 mb-3">What's your gender?</p>
          <div className="space-y-2.5">
            {["Female", "Male", "Prefer not to say"].map((g) => (
              <button
                key={g}
                onClick={() => setGender(g)}
                className={`w-full flex items-center gap-3 px-4 py-3.5 rounded-2xl text-left text-[15px] font-semibold transition-colors ${gender === g ? "bg-purple-600/30 border border-purple-400/60" : "bg-white/5 border border-white/10"}`}
              >
                <User size={17} className={gender === g ? "text-purple-300" : "text-white/50"} />
                {g}
                {gender === g && <Check size={16} className="ml-auto text-purple-300" />}
              </button>
            ))}
          </div>

          <div className="flex-1" />
          <button
            onClick={() => setStep("dna")}
            className="w-full py-3.5 rounded-full font-bold text-[15px] active:scale-95 transition-transform"
            style={{ background: "linear-gradient(90deg, #7c3aed, #a855f7)" }}
          >
            Continue
          </button>
          <button onClick={() => setStep("dna")} className="mt-3 text-sm text-white/50 font-medium">
            Skip for now
          </button>
        </div>
      </Phone>
    );

  if (step === "dna")
    return (
      <Phone>
        <ProgressDots step={4} />
        <div className="flex-1 flex flex-col items-center px-6 pt-8 pb-8">
          <p className="text-sm text-white/60">Your starter</p>
          <h2 className="text-2xl font-black mt-0.5" style={{ background: "linear-gradient(90deg, #c084fc, #818cf8)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>
            Entertainment DNA
          </h2>

          <div className="mt-7 w-40 h-40 rounded-3xl flex items-center justify-center relative" style={{ background: "rgba(168,85,247,0.12)", border: "1px solid rgba(168,85,247,0.4)", boxShadow: "0 0 50px rgba(168,85,247,0.25)" }}>
            <Brain size={64} className="text-purple-300" />
          </div>

          <p className="text-center text-sm text-white/70 mt-6 leading-relaxed px-2">
            You love big ideas, deep stories, and dissecting what it all means.
          </p>

          <p className="text-xs text-white/45 mt-5 mb-2 font-medium">You lean towards:</p>
          <div className="flex flex-wrap gap-2 justify-center">
            {["Smart & Thoughtful", "Big Emotion", "Story-Driven", "Event-Worthy"].map((t) => (
              <span key={t} className="px-3 py-1.5 rounded-full text-xs font-semibold bg-white/8 border border-purple-400/30 text-purple-200">
                {t}
              </span>
            ))}
          </div>

          <div className="flex-1" />
          <button
            onClick={() => setStep("done")}
            className="w-full py-3.5 rounded-full font-bold text-[15px] active:scale-95 transition-transform"
            style={{ background: "linear-gradient(90deg, #7c3aed, #a855f7)" }}
          >
            Continue
          </button>
          <p className="text-[11px] text-white/40 mt-3">It gets sharper the more you play</p>
        </div>
      </Phone>
    );

  return (
    <Phone>
      <div className="flex-1 flex flex-col items-center justify-center px-6 pb-8">
        <div className="w-24 h-24 rounded-full flex items-center justify-center" style={{ background: "radial-gradient(circle at 35% 30%, #a855f7, #6b21a8 70%)", boxShadow: "0 0 60px rgba(168,85,247,0.4)" }}>
          <Zap size={40} className="text-white" />
        </div>
        <h2 className="text-2xl font-black mt-7">You're in! Let's go.</h2>
        <p className="text-sm text-white/60 mt-1.5">Your feed is waiting.</p>

        <div className="w-full mt-8 space-y-2.5">
          {[
            { icon: MessageCircle, text: "Vote on debates as you scroll" },
            { icon: Brain, text: "Every tap builds your DNA" },
            { icon: Sparkles, text: "Skip anything, keep moving" },
          ].map((r) => (
            <div key={r.text} className="flex items-center gap-3 px-4 py-3 rounded-2xl bg-white/5 border border-white/10">
              <r.icon size={17} className="text-purple-300 shrink-0" />
              <span className="text-sm text-white/80 font-medium">{r.text}</span>
            </div>
          ))}
        </div>

        <button
          onClick={() => { setStep("debate"); setVote(null); setSeen({}); setGender(null); }}
          className="w-full py-3.5 rounded-full font-bold text-[15px] mt-9 active:scale-95 transition-transform"
          style={{ background: "linear-gradient(90deg, #7c3aed, #a855f7)" }}
        >
          View feed
        </button>
        <p className="text-[11px] text-white/35 mt-3">(Tap to restart the demo)</p>
      </div>
    </Phone>
  );
}
