import { useState } from "react";
import { useLocation } from "wouter";
import { ChevronRight, Tv, BookOpen, Music, Mic, Zap, Heart } from "lucide-react";
import { supabase } from "@/lib/supabase";

const GENDER_OPTIONS = ["Man", "Woman", "Non-binary", "Prefer not to say"];

const SUGGESTIONS = [
  { id: "comfort", label: "You rewatch the same shows on repeat", icon: Tv },
  { id: "reader", label: "You always have a book on the go", icon: BookOpen },
  { id: "music", label: "You discover new music before everyone else", icon: Music },
  { id: "podcast", label: "You've had the same podcast for years", icon: Mic },
  { id: "binger", label: "You finish new seasons the day they drop", icon: Zap },
  { id: "recommender", label: "You love recommending things to friends", icon: Heart },
];

export default function OnboardingPage() {
  const [, setLocation] = useLocation();
  const [gender, setGender] = useState<string | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [saving, setSaving] = useState(false);

  const toggleSuggestion = (id: string) => {
    setSelected(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const finish = async (toDNA = false) => {
    setSaving(true);
    try {
      if (gender) {
        await supabase.auth.updateUser({ data: { gender } });
      }
      localStorage.setItem("consumed_onboarded", "true");
      if (selected.size > 0) {
        localStorage.setItem("consumed_vibe_tags", JSON.stringify([...selected]));
      }
    } catch {}
    setSaving(false);
    setLocation(toDNA ? "/entertainment-dna" : "/activity");
  };

  const skipAll = () => {
    localStorage.setItem("consumed_onboarded", "true");
    setLocation("/activity");
  };

  return (
    <div
      className="min-h-screen flex flex-col"
      style={{ background: "linear-gradient(160deg, #0a0a0f 0%, #12121f 60%, #1a1030 100%)" }}
    >
      {/* Skip All */}
      <div className="flex justify-end px-5 pt-5">
        <button
          onClick={skipAll}
          className="text-sm text-white/40 hover:text-white/70 transition-colors"
        >
          Skip All
        </button>
      </div>

      <div className="flex-1 flex flex-col px-5 pt-4 pb-10 max-w-md mx-auto w-full">

        {/* Hook */}
        <div className="mb-8">
          <h1
            className="text-3xl font-bold text-white leading-tight mb-3"
            style={{ fontFamily: "Poppins, sans-serif" }}
          >
            You found it.
          </h1>
          <p className="text-white/60 text-base leading-relaxed">
            Is your media scattered everywhere — hard to track what you want to watch, read, and listen to? And where's the one place you can open up and see what everyone around you is into?
          </p>
          <p className="text-white/80 text-base font-medium mt-2">
            This is it. Let's get you set up in seconds.
          </p>
        </div>

        {/* Gender */}
        <div className="mb-7">
          <p className="text-xs font-semibold text-white/40 uppercase tracking-widest mb-3">
            I am a
          </p>
          <div className="flex flex-wrap gap-2">
            {GENDER_OPTIONS.map(opt => (
              <button
                key={opt}
                onClick={() => setGender(g => g === opt ? null : opt)}
                className={`px-4 py-2 rounded-full text-sm font-medium border transition-all ${
                  gender === opt
                    ? "bg-purple-600 border-purple-600 text-white"
                    : "bg-white/5 border-white/15 text-white/70 hover:border-white/30"
                }`}
              >
                {opt}
              </button>
            ))}
          </div>
        </div>

        {/* Suggestions */}
        <div className="mb-8">
          <p className="text-xs font-semibold text-white/40 uppercase tracking-widest mb-3">
            Does this sound like you?
          </p>
          <div className="grid grid-cols-2 gap-2.5">
            {SUGGESTIONS.map(({ id, label, icon: Icon }) => {
              const active = selected.has(id);
              return (
                <button
                  key={id}
                  onClick={() => toggleSuggestion(id)}
                  className={`flex flex-col items-start gap-2 p-3.5 rounded-2xl border text-left transition-all active:scale-95 ${
                    active
                      ? "bg-purple-600/20 border-purple-500/60 text-white"
                      : "bg-white/5 border-white/10 text-white/60 hover:border-white/20"
                  }`}
                >
                  <Icon size={18} className={active ? "text-purple-400" : "text-white/40"} />
                  <span className="text-xs leading-snug">{label}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Get Started */}
        <button
          onClick={() => finish(false)}
          disabled={saving}
          className="w-full py-3.5 rounded-2xl bg-purple-600 hover:bg-purple-700 text-white font-semibold text-base transition-colors disabled:opacity-60 mb-4"
        >
          {saving ? "Saving…" : "Get Started"}
        </button>

        {/* DNA Divider */}
        <div className="flex items-center gap-3 mb-4">
          <div className="flex-1 h-px bg-white/10" />
          <span className="text-xs text-white/30">want to go deeper?</span>
          <div className="flex-1 h-px bg-white/10" />
        </div>

        {/* DNA CTA */}
        <button
          onClick={() => finish(true)}
          disabled={saving}
          className="w-full flex items-center justify-between px-4 py-3 rounded-2xl bg-white/5 border border-white/10 hover:border-white/20 transition-colors group"
        >
          <div className="text-left">
            <p className="text-sm font-semibold text-white">Find your Entertainment DNA</p>
            <p className="text-xs text-white/40 mt-0.5">8 quick questions — map your full entertainment personality</p>
          </div>
          <ChevronRight size={16} className="text-white/30 group-hover:text-white/60 transition-colors flex-shrink-0" />
        </button>

      </div>
    </div>
  );
}
