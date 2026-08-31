import { Dna } from "lucide-react";
export { isDnaComparisonReady } from "@/lib/dna-comparison-readiness";

export function DnaComparisonDeveloping({ friendName }: { friendName?: string | null }) {
  return (
    <div className="rounded-3xl border border-[#e9e3ee] bg-white px-6 py-9 text-center shadow-[0_8px_24px_rgba(48,32,63,0.08)]">
      <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-violet-100 text-violet-600">
        <Dna size={24} />
      </div>
      <h3 className="font-serif text-[24px] font-normal leading-tight tracking-[-.025em] text-[#30203f]">
        Your shared Entertainment DNA is still developing
      </h3>
      <p className="mx-auto mt-3 max-w-[300px] text-[13px] leading-relaxed text-[#746b7a]">
        Keep tracking and rating what you watch, read, play, and listen to.
        {friendName ? ` Once you and ${friendName} have enough positive history and a title in common, we’ll reveal your comparison.` : " We’ll reveal your comparison when there’s enough shared DNA."}
      </p>
    </div>
  );
}