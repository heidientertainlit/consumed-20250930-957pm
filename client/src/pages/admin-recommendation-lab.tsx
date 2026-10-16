import { useMemo, useState } from "react";
import { Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, BadgeCheck, BookOpen, ChevronDown, ChevronUp, CircleHelp, FlaskConical, RotateCw, ShieldCheck, SlidersHorizontal, Sparkles, TriangleAlert } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/lib/supabase";
import { useRecommendationLab } from "@/hooks/use-recommendation-lab";
import { LAB_REASONS, type LabReason, type LabRun, type LabVariant, type LabWork } from "@shared/recommendation-lab";

const panel = "rounded-2xl border border-gray-800 bg-gray-900/65";
const button = "inline-flex min-h-10 items-center justify-center gap-2 rounded-lg border border-gray-700 px-3 py-2 text-sm font-medium text-gray-200 transition-colors hover:border-teal-700 hover:bg-gray-800 disabled:pointer-events-none disabled:opacity-45";
const input = "w-full rounded-lg border border-gray-700 bg-gray-950 px-3 py-2.5 text-sm text-gray-100 focus:outline-none focus:ring-2 focus:ring-teal-500";
const variants: { key: LabVariant; label: string; short: string; hue: string }[] = [
  { key: "current", label: "CURRENT", short: "Current", hue: "teal" },
  { key: "structured", label: "Structured / provider", short: "Structured", hue: "amber" },
  { key: "semantic", label: "+ Semantic scoring", short: "Semantic", hue: "violet" },
];
const mediaLabels: Record<string, string> = { movie: "Film", tv: "TV", book: "Book", music: "Music", podcast: "Podcast", game: "Game", youtube: "YouTube" };
type Draft = { verdict: "Great" | "Fine" | "Bad" | ""; reasons: LabReason[]; note: string };

function Skeleton() {
  return <div role="status" aria-label="Loading recommendation lab" className="space-y-3">{[0, 1, 2].map(i => <div key={i} className="h-28 animate-pulse rounded-xl bg-gray-800/80" />)}</div>;
}

function safePoster(value: unknown): string | null {
  if (typeof value !== "string") return null;
  try { const url = new URL(value); return url.protocol === "https:" || url.protocol === "http:" ? url.href : null; } catch { return null; }
}

function providerHref(work: LabWork): string | null {
  if (!work.source_verified) return null;
  const id = work.external_id;
  if (work.external_source === "tmdb" && /^\d+$/.test(id) && ["movie", "tv"].includes(work.media_type))
    return `https://www.themoviedb.org/${work.media_type}/${id}`;
  if (work.external_source === "googlebooks") return `https://books.google.com/books?id=${encodeURIComponent(id)}`;
  if (["openlibrary", "open_library"].includes(work.external_source) && /^(?:\/?works\/)?OL\d+W$/.test(id))
    return `https://openlibrary.org/works/${id.replace(/^\/?works\//, "")}`;
  if (work.external_source === "itunes" && /^\d+$/.test(id))
    return work.media_type === "podcast" ? `https://podcasts.apple.com/us/podcast/id${id}` : `https://music.apple.com/us/album/${id}`;
  return null;
}

function Evidence({ work }: { work: LabWork }) {
  const entries = Object.entries(work.profile || {});
  const evidence = Object.entries(work.profile_evidence || {});
  return <div className="mt-3 space-y-3">
    <div>
      <p className="text-[10px] font-semibold uppercase tracking-[.17em] text-gray-500">Profile signals</p>
      {entries.length ? <div className="mt-2 space-y-2">{entries.map(([dimension, values]) => <div key={dimension} className="rounded-lg border border-gray-800 bg-gray-950/55 px-3 py-2"><p className="text-[10px] uppercase tracking-wider text-teal-300">{dimension}</p>{values?.map((value, i) => <p key={i} className="mt-1 text-xs leading-relaxed text-gray-300"><span className="text-gray-100">{value.label}</span>{value.evidence ? ` — ${value.evidence}` : ""}</p>)}</div>)}</div> : <p className="mt-2 text-xs text-gray-500">No profile signals supplied.</p>}
    </div>
    <div>
      <p className="text-[10px] font-semibold uppercase tracking-[.17em] text-gray-500">Evidence record</p>
      {evidence.length ? <div className="mt-2 space-y-2">{evidence.map(([key, value]) => <details key={key} className="rounded-lg border border-gray-800 px-3 py-2"><summary className="cursor-pointer text-xs text-gray-300">{key.replace(/[_-]/g, " ")}</summary><pre className="mt-2 overflow-x-auto whitespace-pre-wrap break-words text-[11px] leading-relaxed text-gray-500">{typeof value === "string" ? value : JSON.stringify(value, null, 2)}</pre></details>)}</div> : <p className="mt-2 text-xs text-gray-500">No additional evidence record.</p>}
    </div>
  </div>;
}

function CandidateCard({ result, variant, run, viewerId, saved, draft, onDraft, onSave, saving }: {
  result: NonNullable<LabRun["results"][LabVariant]>[number]; variant: LabVariant; run: LabRun; viewerId: string;
  saved?: { verdict: "Great" | "Fine" | "Bad"; reasons: LabReason[]; note: string; reviewer_id: string; updated_at: string };
  draft: Draft; onDraft: (next: Draft) => void; onSave: () => void; saving: boolean;
}) {
  const [expanded, setExpanded] = useState(false);
  const work = result.item;
  const poster = safePoster(work.source_metadata?.poster_url);
  // Open the provider, not consumer media-detail: visiting consumer detail can
  // legitimately trigger production enrichment, which this lab must not do.
  const verifiedHref = providerHref(work);
  const trace = result.trace;
  return <article className="overflow-hidden rounded-xl border border-gray-800 bg-gray-950/65">
    <div className="flex gap-3 p-3.5 sm:p-4">
      {poster ? <img src={poster} alt="" loading="lazy" className="h-[5.4rem] w-[4rem] shrink-0 rounded-lg bg-gray-800 object-cover" /> : <div className="flex h-[5.4rem] w-[4rem] shrink-0 items-center justify-center rounded-lg border border-gray-800 bg-gray-900 text-gray-600"><BookOpen size={20} /></div>}
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          {verifiedHref ? <a href={verifiedHref} target="_blank" rel="noopener noreferrer" className="break-words text-sm font-semibold leading-snug text-gray-100 hover:text-teal-300">{work.title}</a> : <p className="break-words text-sm font-semibold leading-snug text-gray-100">{work.title}</p>}
          {work.source_verified && <span className="inline-flex items-center gap-1 text-[10px] text-teal-300"><BadgeCheck size={12} /> Verified</span>}
        </div>
        <p className="mt-1 text-xs text-gray-500">{mediaLabels[work.media_type] || work.media_type} <span className="px-1 text-gray-700">/</span> {work.external_source} · {work.external_id}</p>
        <div className="mt-3 flex items-end justify-between gap-3">
          <div><p className="text-[10px] uppercase tracking-[.16em] text-gray-600">Score</p><p className="font-mono text-lg text-gray-200">{result.score == null ? "—" : result.score.toFixed(3)}</p></div>
          {trace.rank != null && <span className="rounded-md border border-gray-800 px-2 py-1 font-mono text-xs text-gray-500">RANK {trace.rank}</span>}
        </div>
      </div>
    </div>
    <div className="border-t border-gray-800/80 px-3.5 py-3 sm:px-4">
      <div className="flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-gray-500">
        <span>{trace.origins?.length ? `Origins: ${trace.origins.join(", ")}` : "Origins: none supplied"}</span>
        <span>{trace.missing?.length ? `Missing: ${trace.missing.join(", ")}` : "No missing signals reported"}</span>
      </div>
      {trace.notes?.length > 0 && <p className="mt-2 text-xs leading-relaxed text-amber-200/80">{trace.notes.join(" · ")}</p>}
      <button type="button" className="mt-3 inline-flex items-center gap-1.5 text-xs font-medium text-teal-300 hover:text-teal-200" aria-expanded={expanded} onClick={() => setExpanded(v => !v)}>
        {expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />} {expanded ? "Hide scoring trace" : "Inspect scoring trace"}
      </button>
      {expanded && <div className="mt-3 rounded-lg border border-gray-800 bg-gray-900/70 p-3">
        <p className="text-[10px] font-semibold uppercase tracking-[.16em] text-gray-500">Signals</p>
        {Object.keys(trace.signals || {}).length ? <dl className="mt-2 grid grid-cols-2 gap-x-4 gap-y-2 sm:grid-cols-3">{Object.entries(trace.signals).map(([key, value]) => <div key={key} className="min-w-0"><dt className="truncate text-[10px] text-gray-500">{key.replace(/[_-]/g, " ")}</dt><dd className="font-mono text-xs text-gray-200">{value == null ? "not available" : value.toFixed(3)}</dd></div>)}</dl> : <p className="mt-2 text-xs text-gray-500">No signals recorded.</p>}
        <p className="mt-4 text-[10px] font-semibold uppercase tracking-[.16em] text-gray-500">Contribution breakdown</p>
        {Object.keys(trace.contributions || {}).length ? <dl className="mt-2 space-y-1.5">{Object.entries(trace.contributions).map(([key, value]) => <div key={key} className="flex justify-between gap-3 text-xs"><dt className="break-words text-gray-400">{key.replace(/[_-]/g, " ")}</dt><dd className="shrink-0 font-mono text-gray-200">{value.toFixed(4)}</dd></div>)}</dl> : <p className="mt-2 text-xs text-gray-500">No contribution values recorded.</p>}
        <Evidence work={work} />
      </div>}
      <div className="mt-4 border-t border-gray-800/80 pt-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-[10px] font-semibold uppercase tracking-[.16em] text-gray-500">Your judgment</p>
          {saved && <span className="text-[10px] text-gray-500">Saved {new Date(saved.updated_at).toLocaleDateString()}</span>}
        </div>
        <div className="mt-2 grid grid-cols-3 gap-1.5">
          {(["Great", "Fine", "Bad"] as const).map(verdict => <button key={verdict} type="button" aria-pressed={draft.verdict === verdict} className={`min-h-9 rounded-lg border px-2 text-xs font-semibold transition-colors ${draft.verdict === verdict ? verdict === "Great" ? "border-teal-700 bg-teal-950/80 text-teal-200" : verdict === "Bad" ? "border-rose-800 bg-rose-950/50 text-rose-200" : "border-amber-700 bg-amber-950/50 text-amber-200" : "border-gray-800 text-gray-400 hover:bg-gray-900"}`} onClick={() => onDraft({ ...draft, verdict })}>{verdict}</button>)}
        </div>
        <fieldset className="mt-3">
          <legend className="text-[10px] uppercase tracking-[.14em] text-gray-500">Optional reasons</legend>
          <div className="mt-2 flex flex-wrap gap-1.5">{LAB_REASONS.map(reason => <button key={reason} type="button" aria-pressed={draft.reasons.includes(reason)} onClick={() => onDraft({ ...draft, reasons: draft.reasons.includes(reason) ? draft.reasons.filter(x => x !== reason) : [...draft.reasons, reason] })} className={`rounded-full border px-2.5 py-1.5 text-[10px] leading-tight ${draft.reasons.includes(reason) ? "border-teal-800 bg-teal-950/70 text-teal-200" : "border-gray-800 text-gray-500 hover:text-gray-300"}`}>{reason}</button>)}</div>
        </fieldset>
        <label className="mt-3 block text-[10px] uppercase tracking-[.14em] text-gray-500">Optional note</label>
        <textarea value={draft.note} maxLength={500} rows={2} placeholder="What makes this feel connected, or not?" onChange={e => onDraft({ ...draft, note: e.target.value })} className={`${input} mt-1.5 min-h-16 resize-y text-xs`} />
        <div className="mt-2 flex items-center justify-between gap-2">
          <span className="text-[10px] text-gray-600">{draft.note.length}/500</span>
          <button type="button" disabled={!draft.verdict || saving} onClick={onSave} className={`${button} min-h-9 border-teal-800 bg-teal-950/50 px-3 text-xs text-teal-100`}>{saving ? "Saving…" : saved ? "Save changes" : "Save evaluation"}</button>
        </div>
        {saved && <p className="mt-2 text-[10px] text-gray-600">Saved for this reviewer within the private admin lab.</p>}
      </div>
    </div>
  </article>;
}

export default function AdminRecommendationLabPage() {
  const { user, session, loading } = useAuth();
  const profile = useQuery({
    queryKey: ["recommendation-lab-admin-check", user?.id],
    enabled: !!user?.id && !loading,
    queryFn: async ({ signal }) => {
      const { data, error } = await supabase.from("admin_user_profiles").select("id, is_admin").eq("id", user!.id).abortSignal(signal).maybeSingle();
      if (error) throw error;
      return data;
    },
    retry: false, staleTime: 0,
  });
  return <main className="min-h-[100dvh] bg-gray-950 text-gray-100">
    <div className="mx-auto max-w-[1480px] px-4 py-6 sm:px-6 md:py-9">
      <Link href="/admin" className="inline-flex items-center gap-2 text-sm text-gray-400 hover:text-teal-300"><ArrowLeft size={16} /> Admin tools</Link>
      <header className="mt-7 flex flex-col justify-between gap-5 border-b border-gray-800 pb-6 md:flex-row md:items-end">
        <div className="flex gap-4">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border border-teal-800/80 bg-teal-950/70 text-teal-300"><FlaskConical size={23} /></div>
          <div><p className="mb-1.5 text-[10px] font-bold uppercase tracking-[.22em] text-teal-400">Private evaluation bench</p><h1 className="text-3xl font-bold tracking-tight sm:text-4xl">Recommendation lab</h1><p className="mt-2 max-w-2xl text-sm leading-relaxed text-gray-400">Compare what feels connected across entertainment—not just what shares a subject. Inspect the evidence, then record your own read.</p></div>
        </div>
        <div className="flex max-w-md gap-2 rounded-xl border border-amber-900/60 bg-amber-950/25 p-3 text-xs leading-relaxed text-amber-100/80"><CircleHelp size={16} className="mt-0.5 shrink-0 text-amber-300" /><span>Small candidate coverage, for judgment only. Ranking weights are frozen; this lab does not change production recommendations.</span></div>
      </header>
      {loading || profile.isPending ? <div className="mt-8"><Skeleton /></div> : profile.isError ? <div className={`${panel} mt-6 p-5`} role="alert"><p>Admin access could not be verified.</p><button className={`${button} mt-3`} onClick={() => void profile.refetch()}>Retry access check</button></div>
        : !profile.data?.is_admin || !session || session.user.id !== user?.id ? <div className={`${panel} mt-6 p-5`}>Access restricted. A verified admin session is required.</div>
        : <Workspace />}
    </div>
  </main>;
}

function Workspace() {
  const { state, prepare, compare, evaluate } = useRecommendationLab();
  const lab = state.data;
  const [sourceKey, setSourceKey] = useState("");
  const [variantFilter, setVariantFilter] = useState<Record<LabVariant, string>>({ current: "", structured: "", semantic: "" });
  const [drafts, setDrafts] = useState<Record<string, Draft>>({});
  const [savingKey, setSavingKey] = useState("");
  const [actionError, setActionError] = useState("");
  const selectedSourceKey = sourceKey || lab?.sources[0]?.key || "";
  const relevantRuns = useMemo(() => (lab?.runs || []).filter(run => run.configuration?.sourceKey === selectedSourceKey || run.configuration?.source_key === selectedSourceKey), [lab?.runs, selectedSourceKey]);
  const newestFirst = (runs: LabRun[]) => [...runs].sort((a, b) => {
    const aTime = Date.parse((a as LabRun & { created_at?: string }).created_at || "");
    const bTime = Date.parse((b as LabRun & { created_at?: string }).created_at || "");
    return Number.isFinite(aTime) && Number.isFinite(bTime) ? bTime - aTime : 0;
  });
  const personalRun = newestFirst(relevantRuns.filter(run => run.created_by === lab?.viewer_id))[0];
  const baselineRun = newestFirst(relevantRuns.filter(run => run.created_by !== lab?.viewer_id))[0];
  const run = personalRun || baselineRun;
  const isBaseline = !!run && run.created_by !== lab?.viewer_id;
  const source = lab?.sources.find(s => s.key === selectedSourceKey);
  const sourceItem = lab?.items.find(item => item.id === run?.source_item_id);
  const filteredResults = useMemo(() => {
    const results = {} as Record<LabVariant, NonNullable<LabRun["results"][LabVariant]>>;
    for (const variant of variants) results[variant.key] = (run?.results?.[variant.key] || []).filter(row => !variantFilter[variant.key] || row.item.media_type === variantFilter[variant.key]);
    return results;
  }, [run, variantFilter]);

  function evalKey(variant: LabVariant, candidateId: string) { return `${variant}:${candidateId}:${lab?.viewer_id || ""}`; }
  function evaluationFor(variant: LabVariant, candidateId: string) {
    const key = evalKey(variant, candidateId);
    const saved = run?.evaluations?.[key];
    return saved?.reviewer_id === lab?.viewer_id ? saved : undefined;
  }
  function draftFor(variant: LabVariant, candidateId: string): Draft {
    const key = evalKey(variant, candidateId);
    if (drafts[key]) return drafts[key];
    const saved = evaluationFor(variant, candidateId);
    return { verdict: saved?.verdict || "", reasons: saved?.reasons || [], note: saved?.note || "" };
  }
  function changeDraft(variant: LabVariant, candidateId: string, draft: Draft) {
    const key = evalKey(variant, candidateId);
    setDrafts(current => ({ ...current, [key]: draft }));
  }
  async function saveEvaluation(variant: LabVariant, candidateId: string) {
    if (!run || !lab) return;
    const key = evalKey(variant, candidateId);
    const draft = draftFor(variant, candidateId);
    if (!draft.verdict) return;
    setSavingKey(key); setActionError("");
    try {
      await evaluate.mutateAsync({ runId: run.id, variant, candidateId, verdict: draft.verdict, reasons: draft.reasons, note: draft.note });
    } catch (error) {
      setActionError(error instanceof Error ? error.message : "Could not save this evaluation. Your edits are still here.");
    } finally { setSavingKey(""); }
  }
  async function doAction(action: "prepare" | "compare") {
    setActionError("");
    try { if (action === "prepare") await prepare.mutateAsync(); else if (selectedSourceKey) await compare.mutateAsync(selectedSourceKey); }
    catch (error) { setActionError(error instanceof Error ? error.message : "The lab action failed. Please retry."); }
  }

  if (state.isPending) return <div className="mt-7 space-y-4"><Skeleton /><div className="h-32 animate-pulse rounded-2xl bg-gray-900" /></div>;
  if (state.isError) return <div className={`${panel} mt-7 p-5`} role="alert"><div className="flex gap-3"><TriangleAlert className="text-rose-300" /><div><p className="font-semibold">Lab state unavailable</p><p className="mt-1 text-sm text-gray-400">{state.error instanceof Error ? state.error.message : "Could not load the recommendation lab."}</p><button className={`${button} mt-4`} onClick={() => void state.refetch()}><RotateCw size={14} /> Retry</button></div></div></div>;
  if (!lab) return <div className={`${panel} mt-7 p-5`}>No lab state was returned.</div>;

  return <div className="mt-6 space-y-5">
    {actionError && <div role="alert" className="flex items-start justify-between gap-3 rounded-xl border border-rose-900/70 bg-rose-950/30 p-3 text-sm text-rose-200"><p>{actionError}</p><button className="shrink-0 text-xs underline" onClick={() => setActionError("")}>Dismiss</button></div>}
    <section className={`${panel} overflow-hidden`}>
      <div className="grid divide-y divide-gray-800 sm:grid-cols-2 sm:divide-x sm:divide-y-0 xl:grid-cols-[1.2fr_.8fr_.8fr]">
        <div className="p-4 sm:p-5">
          <div className="flex items-center gap-2"><SlidersHorizontal size={15} className="text-teal-300" /><p className="text-xs font-semibold uppercase tracking-[.16em] text-gray-300">Run controls</p></div>
          <label htmlFor="lab-source" className="mt-4 block text-xs text-gray-500">Starting point</label>
          <select id="lab-source" value={selectedSourceKey} onChange={e => { setSourceKey(e.target.value); setActionError(""); }} className={`${input} mt-1.5`}>
            {lab.sources.length ? lab.sources.map(item => <option key={item.key} value={item.key}>{item.title} · {item.type}</option>) : <option value="">No sources configured</option>}
          </select>
          {source && <div className="mt-3 rounded-lg border border-gray-800 bg-gray-950/55 p-3"><p className="text-xs font-semibold text-gray-200">{source.title}</p><p className="mt-1 text-[11px] text-gray-500">{source.type}{source.creator ? ` · ${source.creator}` : ""}</p><p className="mt-2 text-xs leading-relaxed text-gray-400">{source.why || "No source rationale supplied."}</p></div>}
          <div className="mt-4 flex flex-wrap gap-2">
            <button className={`${button} border-teal-800 bg-teal-950/50 text-teal-100`} disabled={prepare.isPending || compare.isPending || !lab.sources.length || !!lab.ledger.progress.preparation_complete} onClick={() => void doAction("prepare")}><Sparkles size={14} />{lab.ledger.progress.preparation_complete ? "Preparation complete" : prepare.isPending ? "Preparing one step…" : "Prepare one step"}</button>
            {(!run || isBaseline) && <button className={button} disabled={compare.isPending || prepare.isPending || !selectedSourceKey || !lab.ledger.progress.preparation_complete} onClick={() => void doAction("compare")}>{compare.isPending ? "Capturing…" : "Capture comparison for me"}</button>}
          </div>
          <p className="mt-2 text-[10px] leading-relaxed text-gray-600">Preparation is explicit and bounded. Each click runs one step only; no automatic model calls.</p>
        </div>
        <div className="p-4 sm:p-5">
          <p className="text-xs font-semibold uppercase tracking-[.16em] text-gray-300">Coverage ledger</p>
          <div className="mt-3 grid grid-cols-2 gap-x-4 gap-y-3">
            {[["Spent", lab.ledger.spent], ["Reserved", lab.ledger.reserved], ["Cap", lab.ledger.cap], ["Prepared", lab.ledger.prepared]].map(([label, value]) => <div key={String(label)}><p className="text-[10px] uppercase tracking-wider text-gray-600">{label}</p><p className="mt-0.5 font-mono text-lg text-gray-200">{typeof value === "number" ? label === "Prepared" ? value.toLocaleString() : `$${value.toFixed(4)}` : "—"}</p></div>)}
          </div>
          <div className="mt-3 border-t border-gray-800 pt-3 text-xs text-gray-500"><span>Limit: </span><span className="font-mono text-gray-300">{lab.ledger.max_items}</span><span> items · </span><span className="capitalize">{lab.ledger.status || "status unavailable"}</span></div>
          <p className="mt-2 text-[10px] text-gray-600">USD from recorded model usage at token rates; not invoice reconciliation. Reservations are separate.</p>
          {lab.ledger.progress.summary && <p className="mt-2 text-xs text-gray-400">{lab.ledger.progress.summary.embedded} works have semantic evidence; missing dimensions are not inferred.</p>}
        </div>
        <div className="p-4 sm:p-5 sm:col-span-2 xl:col-span-1">
          <p className="text-xs font-semibold uppercase tracking-[.16em] text-gray-300">Comparison context</p>
          {run ? <><p className={`mt-3 inline-flex rounded-full border px-2.5 py-1 text-[10px] font-semibold tracking-wide ${isBaseline ? "border-amber-900/70 bg-amber-950/30 text-amber-200" : "border-teal-900/70 bg-teal-950/30 text-teal-200"}`}>{isBaseline ? "OTHER ADMIN'S BASELINE" : "CURRENT · YOUR CAPTURE"}</p><p className="mt-2 text-sm font-medium text-gray-200">{run.label || "Recommendation run"}</p><p className="mt-1 break-all font-mono text-[10px] text-gray-600">{run.id}</p></> : <div className="mt-3 rounded-lg border border-dashed border-gray-800 p-3 text-xs leading-relaxed text-gray-500">No comparison run for this starting point yet. A personal capture is made explicitly with “Capture comparison for me.”</div>}
          {sourceItem && <details className="mt-3 rounded-lg border border-gray-800 bg-gray-950/45 p-3"><summary className="cursor-pointer text-xs font-medium text-gray-300">Inspect source profile & evidence</summary><div className="mt-3"><p className="text-sm font-semibold text-gray-200">{sourceItem.title}</p><p className="mt-1 text-[10px] text-gray-600">{sourceItem.media_type} · {sourceItem.external_source} / {sourceItem.external_id}</p><Evidence work={sourceItem} /></div></details>}
        </div>
      </div>
    </section>
    {run && isBaseline && <div className="rounded-xl border border-amber-900/60 bg-amber-950/20 px-4 py-3 text-xs leading-relaxed text-amber-100/80">This is another admin’s stored baseline, not your personal CURRENT. Capture a comparison to generate and compare your CURRENT before interpreting the three-way view.</div>}
    {run && <div className="rounded-xl border border-gray-800 px-4 py-3 text-xs leading-relaxed text-gray-400">CURRENT replays the consumer generation prompt, model and settings, but uses isolated read-only provider verification—not shared search or a consumer cache snapshot. Coverage can differ. {run.results.current?.length || 0} verified results from {run.diagnostics.baseline_generated?.length || 0} generated suggestions. Candidate links open providers, not consumer enrichment pages.</div>}
    {source && lab.ledger.progress.processed?.[source.key]?.status === "unavailable" && <div role="status" className="rounded-xl border border-amber-900/60 bg-amber-950/20 px-4 py-3 text-xs text-amber-100">This source could not be verified for this checkpoint. No substitute was invented. Details: {(lab.ledger.progress.processed[source.key].errors || []).join("; ")}</div>}
    {!run && <section className={`${panel} border-dashed p-6 text-center sm:p-10`}><div className="mx-auto flex h-11 w-11 items-center justify-center rounded-xl border border-gray-800 bg-gray-950 text-gray-500"><FlaskConical size={20} /></div><h2 className="mt-4 text-lg font-semibold">No comparison to inspect</h2><p className="mx-auto mt-2 max-w-lg text-sm leading-relaxed text-gray-500">Choose a source above. Prepare a single bounded step if coverage is needed, then capture your comparison. Results and judgments remain tied to the saved run.</p></section>}
    {run && <section>
      <div className="mb-3 flex flex-col justify-between gap-2 sm:flex-row sm:items-end"><div><p className="text-[10px] font-semibold uppercase tracking-[.18em] text-teal-400">Three-way comparison</p><h2 className="mt-1 text-xl font-semibold">Same source. Different evidence paths.</h2></div><p className="text-xs text-gray-500">Stored rankings only · no reranking</p></div>
      <div className="grid items-start gap-4 lg:grid-cols-3">
        {variants.map((variant, index) => {
          const rows = filteredResults[variant.key];
          const types = Array.from(new Set((run.results?.[variant.key] || []).map(row => row.item.media_type))).sort();
          return <section key={variant.key} className={`${panel} min-w-0 overflow-hidden`}>
            <div className={`border-b border-gray-800 px-4 py-4 ${variant.key === "current" ? "bg-teal-950/20" : variant.key === "structured" ? "bg-amber-950/10" : "bg-violet-950/10"}`}>
              <div className="flex items-start justify-between gap-2"><div><p className="font-mono text-[10px] tracking-[.16em] text-gray-600">PATH 0{index + 1}</p><h3 className={`mt-1 text-sm font-bold ${variant.key === "current" ? "text-teal-200" : variant.key === "structured" ? "text-amber-200" : "text-violet-200"}`}>{variant.label}</h3></div><span className="rounded-md border border-gray-800 px-2 py-1 font-mono text-[10px] text-gray-500">{rows.length} titles</span></div>
              <label className="mt-3 block text-[10px] uppercase tracking-wider text-gray-500">Filter by media</label><select aria-label={`${variant.short} media type filter`} value={variantFilter[variant.key]} onChange={e => setVariantFilter(old => ({ ...old, [variant.key]: e.target.value }))} className={`${input} mt-1.5 min-h-9 py-1.5 text-xs`}><option value="">All media</option>{types.map(type => <option key={type} value={type}>{mediaLabels[type] || type}</option>)}</select>
            </div>
            <div className="space-y-3 p-3">
              {!rows.length ? <div className="rounded-lg border border-dashed border-gray-800 p-4 text-xs leading-relaxed text-gray-500">{variantFilter[variant.key] ? "No results for this media type." : `No ${variant.short} results were stored for this run.`}</div> : rows.map((result, i) => {
                const saved = evaluationFor(variant.key, result.item.id);
                const key = evalKey(variant.key, result.item.id);
                return <CandidateCard key={`${variant.key}:${result.item.id}`} result={result} variant={variant.key} run={run!} viewerId={lab.viewer_id} saved={saved} draft={draftFor(variant.key, result.item.id)} onDraft={next => changeDraft(variant.key, result.item.id, next)} onSave={() => void saveEvaluation(variant.key, result.item.id)} saving={savingKey === key} />;
              })}
            </div>
          </section>;
        })}
      </div>
    </section>}
  </div>;
}
