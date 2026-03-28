import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { ChevronRight } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/auth";

const GENDER_OPTIONS = ["Man", "Woman", "Non-binary", "Prefer not to say"];

export default function OnboardingPage() {
  const [, setLocation] = useLocation();
  const { session } = useAuth();
  const [gender, setGender] = useState<string | null>(null);
  const [loveText, setLoveText] = useState("");
  const [textQuestionId, setTextQuestionId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // Fetch the "What do you love?" question ID from edna_questions
  useEffect(() => {
    const fetchQuestion = async () => {
      const res = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/rest/v1/edna_questions?question_type=eq.text&select=id&limit=1`,
        {
          headers: {
            apikey: import.meta.env.VITE_SUPABASE_ANON_KEY,
            Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
          },
        }
      );
      if (res.ok) {
        const data = await res.json();
        if (data?.[0]?.id) setTextQuestionId(data[0].id);
      }
    };
    fetchQuestion();
  }, []);

  const saveDNA = async () => {
    if (!loveText.trim() || !textQuestionId || !session?.access_token) return;
    await fetch(`${import.meta.env.VITE_SUPABASE_URL}/rest/v1/edna_responses`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${session.access_token}`,
        apikey: import.meta.env.VITE_SUPABASE_ANON_KEY,
        "Content-Type": "application/json",
        Prefer: "return=minimal",
      },
      body: JSON.stringify({
        user_id: session.user?.id,
        question_id: textQuestionId,
        answer_text: loveText.trim(),
      }),
    });
  };

  const finish = async (toDNA = false) => {
    setSaving(true);
    try {
      if (gender) {
        await supabase.auth.updateUser({ data: { gender } });
      }
      await saveDNA();
      localStorage.setItem("consumed_onboarded", "true");
    } catch {}
    setSaving(false);
    setLocation(toDNA ? "/entertainment-dna" : "/activity");
  };

  const skipAll = () => {
    localStorage.setItem("consumed_onboarded", "true");
    setLocation("/activity");
  };

  return (
    <div className="min-h-screen bg-white flex flex-col">
      {/* Purple app bar */}
      <div
        className="flex items-center justify-between px-5 py-4"
        style={{ background: "linear-gradient(135deg, #1a0a2e 0%, #2d1f4e 100%)" }}
      >
        <img src="/consumed-logo-new.png" alt="Consumed" className="h-8 w-auto" />
        <button
          onClick={skipAll}
          className="text-sm text-white/50 hover:text-white/80 transition-colors"
        >
          Skip All
        </button>
      </div>

      <div className="flex-1 flex flex-col px-5 pt-6 pb-10 max-w-md mx-auto w-full">

        {/* Hook */}
        <div className="mb-8">
          <h1
            className="text-2xl font-bold text-gray-900 leading-tight mb-3"
            style={{ fontFamily: "Poppins, sans-serif" }}
          >
            Your entertainment is everywhere. That's the problem.
          </h1>
          <p className="text-gray-500 text-sm leading-relaxed">
            Consumed brings it all into one place — so you can track what you love, play trivia, cast predictions, and connect with people who are into it too. Let's get started on your entertainment DNA:
          </p>
        </div>

        {/* Gender */}
        <div className="mb-7">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-3">
            I identify as
          </p>
          <div className="flex flex-wrap gap-2">
            {GENDER_OPTIONS.map(opt => (
              <button
                key={opt}
                onClick={() => setGender(g => g === opt ? null : opt)}
                className={`px-4 py-2 rounded-full text-sm font-medium border transition-all ${
                  gender === opt
                    ? "bg-purple-600 border-purple-600 text-white"
                    : "bg-white border-gray-200 text-gray-600 hover:border-purple-300"
                }`}
              >
                {opt}
              </button>
            ))}
          </div>
        </div>

        {/* What do you love */}
        <div className="mb-8">
          <h3 className="text-base font-semibold text-gray-900 mb-1">What do you love?</h3>
          <p className="text-gray-500 text-sm leading-snug mb-3">
            Drop anything you're into lately or always come back to — books, shows, teams, creators, comfort rewatches, guilty pleasures. Whatever feels you.{" "}
            <span className="text-gray-400">(optional)</span>
          </p>
          <textarea
            value={loveText}
            onChange={e => setLoveText(e.target.value)}
            placeholder={"e.g. you watch Friends daily, love Pride & Prejudice, obsessed with Fast & Furious"}
            className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl focus:border-purple-400 focus:ring-1 focus:ring-purple-400 outline-none min-h-[110px] resize-none text-gray-900 placeholder:text-gray-400 text-sm leading-relaxed"
          />
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
          <div className="flex-1 h-px bg-gray-100" />
          <span className="text-xs text-gray-400">want to go deeper?</span>
          <div className="flex-1 h-px bg-gray-100" />
        </div>

        {/* DNA CTA */}
        <button
          onClick={() => finish(true)}
          disabled={saving}
          className="w-full flex items-center justify-between px-4 py-3.5 rounded-2xl bg-gray-50 border border-gray-200 hover:border-purple-300 transition-colors group"
        >
          <div className="text-left">
            <p className="text-sm font-semibold text-gray-900">Find your Entertainment DNA</p>
            <p className="text-xs text-gray-400 mt-0.5">8 quick questions — map your full entertainment personality</p>
          </div>
          <ChevronRight size={16} className="text-gray-300 group-hover:text-purple-400 transition-colors flex-shrink-0" />
        </button>

      </div>
    </div>
  );
}
