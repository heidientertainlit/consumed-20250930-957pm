import { Activity, ArrowRight, Dna, Flame, Trophy } from "lucide-react";
import { FeedIdentityHero, HeroCTAButtons, IdentityFace } from "@/components/feed-identity-hero";

export function FeedIdentityZone({ isGuestMode }: { isGuestMode: boolean }) {
  if (isGuestMode) {
    return (
      <div className="bg-gradient-to-r from-[#0a0a0f] via-[#12121f] to-[#2d1f4e] pb-4 -mt-px">
        <div className="max-w-4xl mx-auto px-4 pt-4">
          <div className="rounded-2xl border border-purple-500/25 bg-white/[0.04] p-5" data-testid="guest-dna-teaser">
            <div className="flex items-start gap-1.5">
              <div className="flex flex-col">
                <p className="text-purple-300 text-[11px] font-semibold uppercase tracking-[0.18em]">
                  Your Entertainment DNA™
                </p>
                <span className="mt-0.5 text-[8px] font-medium uppercase tracking-[0.12em] text-purple-300/65">
                  Profile
                </span>
              </div>
              <Dna className="mt-0.5 w-3.5 h-3.5 text-purple-300" />
            </div>
            <div className="flex items-center justify-between gap-4 mt-3">
              <div className="min-w-0">
                <p className="text-white/90 text-2xl font-medium leading-none">The</p>
                <p className="text-white text-3xl font-bold leading-tight mt-0.5">Emotional Binger</p>
                <p className="text-purple-300/90 text-sm italic mt-2.5">with shades of</p>
                <p className="text-purple-100 text-sm font-medium mt-0.5">
                  Comfort Rewatcher <span className="text-purple-400">•</span> Prestige Detective
                </p>
              </div>
              <IdentityFace size={80} />
            </div>
            <button className="mt-4 w-full bg-[linear-gradient(135deg,#7c3aed_0%,#4f46e5_55%,#2563eb_100%)] text-white text-sm font-bold rounded-full py-2.5 shadow-[0_7px_20px_rgba(50,42,180,.38)] transition active:scale-[.98] active:brightness-95 flex items-center justify-center gap-2" data-testid="button-guest-dna-cta">
              See My DNA
              <ArrowRight className="w-4 h-4" />
            </button>
            <div className="grid grid-cols-3 divide-x divide-white/10 border-t border-white/10 mt-4 pt-4">
              <div className="flex flex-col items-center gap-1.5 px-1 text-center">
                <div className="w-8 h-8 rounded-full border border-purple-400/50 flex items-center justify-center">
                  <Flame className="w-4 h-4 text-purple-300" />
                </div>
                <p className="text-purple-200 text-xs font-semibold leading-tight">Play daily</p>
                <p className="text-purple-300/70 text-[11px] leading-tight">build a streak</p>
              </div>
              <div className="flex flex-col items-center gap-1.5 px-1 text-center">
                <div className="w-8 h-8 rounded-full border border-purple-400/50 flex items-center justify-center">
                  <Trophy className="w-4 h-4 text-purple-300" />
                </div>
                <p className="text-purple-200 text-xs font-semibold leading-tight">See your rank</p>
                <p className="text-purple-300/70 text-[11px] leading-tight">leaderboard</p>
              </div>
              <div className="flex flex-col items-center gap-1.5 px-1 text-center">
                <div className="w-8 h-8 rounded-full border border-purple-400/50 flex items-center justify-center">
                  <Activity className="w-4 h-4 text-purple-300" />
                </div>
                <p className="text-purple-200 text-xs font-semibold leading-tight">Track your taste</p>
                <p className="text-purple-300/70 text-[11px] leading-tight">every rating counts</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="-mt-px" style={{ background: "linear-gradient(to right, #0a0a0f, #12121f, #2d1f4e)" }}>
      <div className="max-w-4xl mx-auto px-4 pt-6 pb-6">
        <div>
          <FeedIdentityHero />
          <div className="mt-4">
            <HeroCTAButtons />
          </div>
        </div>
      </div>
    </div>
  );
}
