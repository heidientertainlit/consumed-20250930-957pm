export type DnaComparisonLike = {
  match_score?: number;
  comparison_status?: string;
  comparison_readiness?: { status?: string };
  insights?: { comparison_readiness?: { status?: string } };
} | null | undefined;

export function isDnaComparisonReady(comparison: DnaComparisonLike) {
  const status = comparison?.comparison_status
    || comparison?.comparison_readiness?.status
    || comparison?.insights?.comparison_readiness?.status;
  return status === "ready";
}

export function getDnaComparisonUpdateDetail(
  friendId: string,
  comparison: DnaComparisonLike,
) {
  if (!friendId || !isDnaComparisonReady(comparison)) return null;
  const matchScore = Number(comparison?.match_score);
  if (!Number.isFinite(matchScore)) return null;
  return { friendId, matchScore };
}