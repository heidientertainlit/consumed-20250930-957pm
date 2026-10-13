/** Catalog facts and editorial prose deliberately have separate trust levels. */
export const researchTypes = ["movie", "tv", "book", "music", "podcast", "game", "youtube"] as const;
export type ResearchType = typeof researchTypes[number];
export const researchAngles = ["themes", "mood", "setting", "storytelling style", "creative connections"] as const;
export type ResearchAngle = typeof researchAngles[number];
export interface ResearchTitle {
  title: string;
  type: ResearchType;
  external_source: string;
  external_id: string;
  creator?: string;
  year?: string;
  media_subtype?: string;
  source_url: string;
  image?: string;
}
export interface ResearchChart {
  source_label: string;
  source_key: string;
  chart_country: string;
  chart_date: string;
  status: "current" | "stale" | "unavailable";
}
export interface ResearchPick extends ResearchTitle {
  catalog_verified: true;
  rationale: string;
  relationship: "editorial similarity";
}
export interface ResearchResult {
  seed: ResearchTitle;
  chart?: ResearchChart;
  picks: ResearchPick[];
  feedback: string[];
}
export interface CuratedPick extends ResearchPick {
  selected: boolean;
  edited?: boolean;
}
// No factual relationships are exported without evidence. This conservative
// first version excludes those claims rather than upgrading AI prose to fact.
export function hasFactualClaim(text: string): boolean {
  return /\b(adapt(?:ation|ed|s)?|based on|soundtrack|score (?:for|of)|sequel|prequel|spin[ -]?off|remake|official|inspired by|same (?:director|creator|author|universe)|from the (?:director|creator|author)|written by|directed by|created by|produced by|features? (?:the|a) same)\b/i.test(text);
}
export function researchExport(seed: ResearchTitle, picks: CuratedPick[], angle: ResearchAngle) {
  const eligible = picks.filter(p => p.selected && p.catalog_verified === true && !hasFactualClaim(p.rationale));
  const entries = eligible.map((p, index) =>
    `Slide ${index + 2}: ${p.title} (${p.type}${p.media_subtype ? ` / ${p.media_subtype}` : ""})${p.creator ? ` — ${p.creator}` : ""}\nEditorial similarity${p.edited ? " (admin-edited; prose not verified)" : " (subjective; prose not verified)"}: ${p.rationale}\nCatalog source: ${p.source_url}`);
  return {
    count: eligible.length,
    excluded: picks.filter(p => p.selected).length - eligible.length,
    outline: eligible.length ? [`Slide 1: If you enjoyed ${seed.title}\nConnections through ${angle}.`, ...entries].join("\n\n") : "",
    caption: eligible.length ? `If you enjoyed ${seed.title}, explore ${eligible.map(p => p.title).join(", ")} through ${angle}.\n\nEditorial suggestions, not official relationships or personal match predictions. Catalog identity checked; similarity and edited prose are subjective.` : "",
  };
}
