export const LAB_REASONS = [
  "same subject, wrong experience", "weak connection", "good but obvious",
  "surprising/great connection", "identity/data problem", "already know this",
] as const;
export type LabReason = typeof LAB_REASONS[number];
export type LabVerdict = "Great" | "Fine" | "Bad";
export type LabVariant = "current" | "structured" | "semantic";
export type LabDimension = "subject" | "themes" | "tone" | "experience" | "style" | "appeal";
export type LabProfile = Partial<Record<LabDimension, { label: string; evidence: string }[]>>;
export interface LabWork {
  id: string; external_source: string; external_id: string; media_type: string; title: string;
  existing_canonical_id?: string | null; source_verified: boolean; destination_path: string;
  source_metadata: Record<string, any>; verification: Record<string, any>;
  profile: LabProfile; profile_evidence?: Record<string, any>; status: string;
  appeal_embedding?: number[] | string | null; tone_style_embedding?: number[] | string | null;
  subject_theme_embedding?: number[] | string | null;
}
export interface LabResult {
  item: LabWork; score: number | null;
  trace: { origins: string[]; signals: Record<string, number | null>; contributions: Record<string, number>;
    missing: string[]; notes: string[]; rank?: number };
}
export interface LabEvaluation {
  verdict: LabVerdict; reasons: LabReason[]; note: string; reviewer_id: string; updated_at: string;
}
export interface LabRun {
  id: string; label: string; source_item_id: string | null; created_by: string; status: string;
  configuration: Record<string, any>;
  results: Partial<Record<LabVariant, LabResult[]>>;
  diagnostics: Record<string, any>; evaluations: Record<string, LabEvaluation>;
}
export interface LabSource { key: string; title: string; type: string; creator: string; why: string }
export interface LabState {
  stage: string; sources: LabSource[]; items: LabWork[]; runs: LabRun[];
  ledger: { id?: string; status: string; spent: number; reserved: number; cap: number; prepared: number;
    max_items: number; progress: Record<string, any> };
  viewer_id: string;
}
