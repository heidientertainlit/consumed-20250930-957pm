export type BakeoffVerdict = "great" | "fine" | "bad";
export type BakeoffLabel = "A" | "B" | "C" | "D";
export type BakeoffSystem = "tmdb_recommendations" | "tmdb_similar" | "production" | "experimental";
export const BAKEOFF_SYSTEM_NAMES: Record<BakeoffSystem, string> = {
  tmdb_recommendations: "TMDB Recommendations", tmdb_similar: "TMDB Similar",
  production: "Existing Production snapshot", experimental: "Saved Experimental (GPT-4.1, same-media)",
};
export type BakeoffSource = { id: string; title: string; type: "movie" | "tv"; externalId: string; year?: string; poster?: string };
export type BakeoffItem = { rank: number; title: string; type: string; id: string; poster?: string; invalidReason?: string };
export type BakeoffRating = { verdict: BakeoffVerdict; note: string };
export type BakeoffColumn = {
  label: BakeoffLabel; status: "available" | "unavailable" | "error"; items: BakeoffItem[];
  ratings: Record<string, BakeoffRating>; system?: BakeoffSystem; provenance?: string; capturedAt?: string;
  unavailableReason?: string; fingerprint?: string; counts?: Record<BakeoffVerdict, number>;
};
export type BakeoffTrial = {
  id: string; source: BakeoffSource; columns: BakeoffColumn[]; createdAt: string; revealedAt?: string;
  preference: BakeoffLabel | "none" | null; canReveal: boolean;
  cohort?: { providers: boolean; production: boolean; full: boolean };
};
export type BakeoffSystemStats = {
  system: BakeoffSystem; sources: number; rated: number; great: number; fine: number; bad: number;
  greatPct: number; finePct: number; badPct: number; averageGreat: number; wins: number;
};
export type BakeoffDashboard = {
  cohorts: { key: "providers" | "production" | "full"; name: string; sources: number; noneWins: number; outsideCohortWins: number; systems: BakeoffSystemStats[] }[];
  completed: BakeoffTrial[]; pendingCount: number;
};
