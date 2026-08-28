export const AFFINITY_ALGORITHM_VERSION = "dense-overlap-jaccard-v4";

export type AffinitySignal = {
  signal_type: string;
  signal_value: string;
  strength: number | string;
};

const TYPE_WEIGHT: Record<string, number> = {
  show: 1.2,
  creator: 1.15,
  genre: 1,
  media_type: 0.25,
};

export function scoreAffinitySignals(left: AffinitySignal[], right: AffinitySignal[]) {
  const usable = (rows: AffinitySignal[]) => rows
    .filter((signal) => signal.signal_type !== "engagement")
    .map((signal) => [
      `${signal.signal_type}:${String(signal.signal_value).toLowerCase().trim()}`,
      Math.max(0, Math.min(1, Number(signal.strength) || 0)),
    ] as const);
  const a = new Map(usable(left));
  const b = new Map(usable(right));
  let intersection = 0;
  let union = 0;
  let hasSubstantiveOverlap = false;
  let substantiveOverlapCount = 0;
  const shared_genres: string[] = [];
  const shared_creators: string[] = [];
  const user_unique: string[] = [];
  const friend_unique: string[] = [];

  for (const key of new Set([...a.keys(), ...b.keys()])) {
    const separator = key.indexOf(":");
    const type = key.slice(0, separator);
    const value = key.slice(separator + 1);
    const leftStrength = a.get(key) || 0;
    const rightStrength = b.get(key) || 0;
    const weight = TYPE_WEIGHT[type] || 0.7;
    intersection += Math.min(leftStrength, rightStrength) * weight;
    union += Math.max(leftStrength, rightStrength) * weight;

    if (leftStrength > 0 && rightStrength > 0) {
      if (type !== "media_type") {
        hasSubstantiveOverlap = true;
        substantiveOverlapCount += 1;
      }
      if (type === "genre") shared_genres.push(value);
      if (type === "creator") shared_creators.push(value);
    } else if (leftStrength >= 0.15) {
      user_unique.push(`${type}: ${value}`);
    } else if (rightStrength >= 0.15) {
      friend_unique.push(`${type}: ${value}`);
    }
  }

  const rawScore = union ? intersection / union : 0;
  // DNA vectors are intentionally sparse and high-dimensional. Calibrate a
  // genuine title/genre/creator intersection while leaving media-type-only
  // overlap on the unadjusted low scale.
  const overlapDensityBonus = Math.min(0.2, Math.max(0, substantiveOverlapCount - 2) * 0.02);
  const calibratedScore = hasSubstantiveOverlap
    ? Math.min(1, Math.pow(rawScore, 0.45) + overlapDensityBonus)
    : rawScore;
  return {
    match_score: Math.round(calibratedScore * 100),
    shared_genres: shared_genres.slice(0, 10),
    shared_creators: shared_creators.slice(0, 10),
    differences: {
      user_unique: user_unique.slice(0, 5),
      friend_unique: friend_unique.slice(0, 5),
    },
    insights: { algorithm_version: AFFINITY_ALGORITHM_VERSION },
  };
}