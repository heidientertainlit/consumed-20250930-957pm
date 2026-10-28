import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { ArrowDownToLine, ArrowLeft, Check, CircleHelp, FlaskConical, LoaderCircle, Search, ShieldAlert, TriangleAlert } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/lib/supabase";
import { useRecommendationBakeoff } from "@/hooks/use-recommendation-bakeoff";
import { BAKEOFF_SYSTEM_NAMES, type BakeoffColumn, type BakeoffDashboard, type BakeoffLabel, type BakeoffRating, type BakeoffSource, type BakeoffSystem, type BakeoffTrial, type BakeoffVerdict } from "@shared/recommendation-bakeoff";

const panel = "rounded-2xl border border-slate-800/90 bg-[#111d27]";
const button = "inline-flex min-h-10 items-center justify-center gap-2 rounded-lg border border-slate-700 px-3 py-2 text-sm font-medium text-slate-200 transition-colors hover:border-cyan-800 hover:bg-slate-800/80 disabled:pointer-events-none disabled:opacity-45";
const input = "w-full rounded-lg border border-slate-700 bg-[#0b151d] px-3 py-2.5 text-sm text-slate-100 outline-none placeholder:text-slate-600 focus:border-cyan-700 focus:ring-2 focus:ring-cyan-900/60";
const labels: BakeoffLabel[] = ["A", "B", "C", "D"];
const verdicts: { key: BakeoffVerdict; label: string; style: string; active: string }[] = [
  { key: "great", label: "Great", style: "border-slate-700 text-slate-400 hover:border-emerald-900", active: "border-emerald-800 bg-emerald-950/70 text-emerald-200" },
  { key: "fine", label: "Fine", style: "border-slate-700 text-slate-400 hover:border-amber-900", active: "border-amber-800 bg-amber-950/60 text-amber-200" },
  { key: "bad", label: "Bad", style: "border-slate-700 text-slate-400 hover:border-rose-900", active: "border-rose-900 bg-rose-950/50 text-rose-200" },
];

function Skeleton() {
  return <div role="status" aria-label="Loading bake-off" className="mt-7 space-y-4">{[0, 1, 2].map(i => <div key={i} className="h-32 animate-pulse rounded-2xl bg-slate-900" />)}</div>;
}

function displayError(error: unknown) {
  return error instanceof Error ? error.message : "The request could not be completed.";
}

function formatDate(value?: string) {
  if (!value) return "Not recorded";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString();
}

function safePoster(value?: string) {
  if (!value) return null;
  try {
    const url = new URL(value);
    return url.protocol === "https:" || url.protocol === "http:" ? url.href : null;
  } catch { return null; }
}

function authFailure(error: unknown) {
  const message = displayError(error).toLowerCase();
  return /\b(401|403|unauthori[sz]ed|forbidden|admin only|admin access|required|sign in)\b/.test(message);
}

function actionErrorText(error: unknown) {
  const message = displayError(error);
  return authFailure(error) ? `Sign-in required / admin-only: ${message}` : message;
}

function RatingCard({ item, label, rating, draft, onChange, onSave, saving, saved }: {
  item: BakeoffColumn["items"][number]; label: BakeoffLabel; rating?: BakeoffRating; draft: BakeoffRating;
  onChange: (value: BakeoffRating) => void; onSave: () => void; saving: boolean; saved: boolean;
}) {
  const poster = safePoster(item.poster);
  return <article className="overflow-hidden rounded-xl border border-slate-800 bg-[#0c1720]">
    <div className="flex gap-3 p-3.5">
      {poster ? <img src={poster} alt="" loading="lazy" className="h-[5.25rem] w-[3.75rem] shrink-0 rounded-lg bg-slate-800 object-cover" /> : <div aria-hidden="true" className="flex h-[5.25rem] w-[3.75rem] shrink-0 items-center justify-center rounded-lg border border-slate-800 bg-slate-900 font-mono text-xs text-slate-600">{label}</div>}
      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-2"><h4 className="break-words text-sm font-semibold leading-snug text-slate-100">{item.title}</h4><span className="shrink-0 rounded-md border border-slate-800 px-2 py-1 font-mono text-[10px] text-slate-500">#{item.rank}</span></div>
        <p className="mt-1 text-[11px] capitalize text-slate-500">{item.type}</p>
      </div>
    </div>
    {item.invalidReason ? <div className="border-t border-amber-900/50 bg-amber-950/20 px-3.5 py-3 text-xs leading-relaxed text-amber-100/75"><span className="font-semibold text-amber-200">Not rateable.</span> {item.invalidReason} This original slot remains in place; it is not replaced or counted as a bad recommendation.</div> :
      <div className="border-t border-slate-800/80 px-3.5 py-3">
        <div className="flex items-center justify-between gap-2"><p className="text-[10px] font-semibold uppercase tracking-[.16em] text-slate-500">Your judgment</p>{saved && <span className="inline-flex items-center gap-1 text-[10px] text-emerald-300"><Check size={12} /> Saved</span>}</div>
        <div className="mt-2 grid grid-cols-3 gap-1.5">{verdicts.map(verdict => <button key={verdict.key} type="button" aria-pressed={draft.verdict === verdict.key} onClick={() => onChange({ ...draft, verdict: verdict.key })} className={`min-h-9 rounded-lg border px-2 text-xs font-semibold transition-colors ${draft.verdict === verdict.key ? verdict.active : verdict.style}`}>{verdict.label}</button>)}</div>
        <label className="mt-3 block text-[10px] uppercase tracking-[.14em] text-slate-500">Short note · optional</label>
        <textarea value={draft.note} maxLength={240} rows={2} placeholder="A quick reason, if useful…" onChange={event => onChange({ ...draft, note: event.target.value })} className={`${input} mt-1.5 min-h-16 resize-y text-xs`} />
        <div className="mt-2 flex items-center justify-between gap-2"><span className="text-[10px] text-slate-600">{draft.note.length}/240{rating ? " · existing judgment" : ""}</span><button type="button" disabled={!draft.verdict || saving || (saved && draft.verdict === rating?.verdict && draft.note === rating?.note)} onClick={onSave} className={`${button} min-h-9 border-cyan-900 bg-cyan-950/40 px-3 text-xs text-cyan-100`}>{saving ? "Saving…" : saved ? "Save changes" : "Save rating"}</button></div>
      </div>}
  </article>;
}

function ResultList({ column, trial, drafts, isSaving, onChange, onSave }: {
  column: BakeoffColumn; trial: BakeoffTrial; drafts: Record<string, BakeoffRating>; isSaving: (key: string) => boolean;
  onChange: (label: BakeoffLabel, rank: number, value: BakeoffRating) => void; onSave: (label: BakeoffLabel, rank: number) => void;
}) {
  const isReady = column.status === "available" && column.items.length > 0;
  return <section className={`${panel} min-w-0 overflow-hidden`}>
    <div className={`border-b border-slate-800 px-4 py-4 ${column.status === "available" ? "bg-cyan-950/15" : "bg-slate-900/40"}`}>
      <div className="flex items-start justify-between gap-2"><div><p className="font-mono text-[10px] tracking-[.18em] text-slate-600">BLINDED LIST</p><h3 className="mt-1 font-display text-xl font-semibold text-cyan-100">List {column.label}</h3></div><span className="rounded-md border border-slate-700 px-2 py-1 font-mono text-[10px] text-slate-400">{column.status === "available" ? `${column.items.length} slots` : column.status}</span></div>
      {column.status !== "available" && <p className="mt-3 text-xs leading-relaxed text-slate-400">{column.unavailableReason || (column.status === "error" ? "This capture encountered an error." : "No snapshot was available for this list.")} <span className="text-amber-200/80">Unavailable is not an empty or badly ranked list.</span></p>}
      {column.status === "available" && !column.items.length && <p className="mt-3 text-xs text-slate-400">This available snapshot contains no ranked slots.</p>}
    </div>
    {isReady && <div className="space-y-3 p-3">{column.items.map(item => {
      const key = `${trial.id}:${column.label}:${item.rank}`;
      const rating = column.ratings?.[String(item.rank)];
      const draft = drafts[key] || rating || { verdict: "fine" as BakeoffVerdict, note: "" };
      return <RatingCard key={key} item={item} label={column.label} rating={rating} draft={draft} onChange={value => onChange(column.label, item.rank, value)} onSave={() => onSave(column.label, item.rank)} saving={isSaving(key)} saved={!!rating && draft.verdict === rating.verdict && draft.note === rating.note} />;
    })}</div>}
    {trial.revealedAt && column.system && <div className="border-t border-slate-800 bg-[#0b151d] p-4">
      <p className="text-[10px] font-semibold uppercase tracking-[.15em] text-cyan-300">Source revealed</p><p className="mt-1 text-sm font-semibold text-slate-100">{BAKEOFF_SYSTEM_NAMES[column.system]}</p>
      <dl className="mt-3 space-y-2 text-[11px]">
        <div className="flex justify-between gap-3"><dt className="text-slate-500">Captured</dt><dd className="text-right text-slate-300">{formatDate(column.capturedAt)}</dd></div>
        <div className="flex justify-between gap-3"><dt className="text-slate-500">Fingerprint</dt><dd className="max-w-[65%] break-all text-right font-mono text-slate-400">{column.fingerprint || "Not recorded"}</dd></div>
        {(["great", "fine", "bad"] as const).map(verdict => <div key={verdict} className="flex justify-between gap-3"><dt className="capitalize text-slate-500">{verdict}</dt><dd className="font-mono text-slate-300">{column.counts?.[verdict] ?? 0}</dd></div>)}
      </dl>
      {column.provenance && <p className="mt-3 border-t border-slate-800 pt-3 text-[11px] leading-relaxed text-slate-400">{column.provenance}</p>}
      {column.system === "production" && <p className="mt-2 text-[10px] leading-relaxed text-amber-200/70">Production provenance is historical only: the record distinguishes bundled fallback from an actual shared-cache snapshot. No fresh production recommendation was requested.</p>}
    </div>}
  </section>;
}

function CohortPanel({ dashboard, cohortKey }: { dashboard: BakeoffDashboard; cohortKey: "providers" | "production" | "full" }) {
  const cohort = dashboard.cohorts.find(value => value.key === cohortKey);
  const membership = (trial: BakeoffTrial) => cohortKey === "full" ? trial.cohort?.full : cohortKey === "production" ? trial.cohort?.production : trial.cohort?.providers;
  const trials = dashboard.completed.filter(membership);
  const winners = new Map<BakeoffSystem, number>();
  const unavailable = new Map<BakeoffSystem, number>();
  const failures = new Map<BakeoffSystem, number>();
  for (const trial of trials) for (const column of trial.columns) {
    if (column.system && (column.status === "unavailable" || column.status === "error")) {
      const map = column.status === "error" ? failures : unavailable;
      map.set(column.system, (map.get(column.system) || 0) + 1);
    }
    if (trial.preference !== "none" && trial.preference && trial.revealedAt) {
      const chosen = trial.columns.find(row => row.label === trial.preference)?.system;
      if (chosen) winners.set(chosen, (winners.get(chosen) || 0) + 1);
    }
  }
  const noneWins = trials.filter(trial => trial.preference === "none").length;
  return <section className={`${panel} overflow-hidden`}>
    <div className="flex flex-wrap items-end justify-between gap-3 border-b border-slate-800 px-4 py-4 sm:px-5">
      <div><p className="font-mono text-[10px] uppercase tracking-[.17em] text-cyan-300">{cohortKey} cohort</p><h3 className="mt-1 text-lg font-semibold text-slate-100">{cohort?.name || "Cohort statistics"}</h3></div>
      <p className="font-mono text-xs text-slate-400">{cohort?.sources ?? 0} completed sources · {noneWins} None</p>
    </div>
    {cohortKey === "providers" && <p className="border-b border-slate-800/80 px-4 py-3 text-xs leading-relaxed text-slate-400 sm:px-5">TMDB Recommendations and TMDB Similar, with provider systems only. Existing Production also appears as part of the Production cohort below.</p>}
    {cohortKey === "production" && <p className="border-b border-slate-800/80 px-4 py-3 text-xs leading-relaxed text-slate-400 sm:px-5">TMDB Recommendations, TMDB Similar, and the existing Production snapshot.</p>}
    {cohortKey === "full" && <p className="border-b border-slate-800/80 px-4 py-3 text-xs leading-relaxed text-slate-400 sm:px-5">All four systems, including Saved Experimental (GPT-4.1, same-media).</p>}
    <div className="divide-y divide-slate-800/80">
      {(cohort?.systems || []).map(stat => <div key={stat.system} className="grid gap-3 px-4 py-4 sm:grid-cols-[minmax(0,1.25fr)_repeat(5,minmax(0,.7fr))] sm:items-center sm:px-5">
        <div className="min-w-0"><p className="text-sm font-semibold text-slate-200">{BAKEOFF_SYSTEM_NAMES[stat.system]}</p><p className="mt-1 text-[10px] leading-relaxed text-slate-500">{unavailable.get(stat.system) || 0} unavailable · {failures.get(stat.system) || 0} errors among {trials.length} completed source(s)</p></div>
        {[["Rated", stat.rated], ["Great", `${stat.great} · ${stat.greatPct}%`], ["Fine", `${stat.fine} · ${stat.finePct}%`], ["Bad", `${stat.bad} · ${stat.badPct}%`], ["Wins", stat.wins ?? winners.get(stat.system) ?? 0]].map(([label, value]) => <div key={String(label)} className="flex items-center justify-between gap-2 sm:block"><p className="text-[10px] uppercase tracking-wider text-slate-600">{label}</p><p className="font-mono text-sm text-slate-200">{value}</p></div>)}
      </div>)}
      {!cohort?.systems.length && <div className="p-5 text-sm text-slate-500">No cohort summary is available yet.</div>}
    </div>
    <p className="border-t border-slate-800 px-4 py-3 text-[10px] leading-relaxed text-slate-600 sm:px-5">Great / Fine / Bad percentages use each system’s saved, valid ratings as the denominator; invalid slots and unavailable captures are excluded. Coverage is shown separately above.</p>
    <div className="border-t border-slate-800 bg-[#0c1720] px-4 py-3 sm:px-5">
      <p className="text-[10px] font-semibold uppercase tracking-[.15em] text-slate-500">Completed source decisions</p>
      {trials.length ? <div className="mt-2 divide-y divide-slate-800/70">{trials.map(trial => {
        const winnerColumn = trial.preference && trial.preference !== "none" ? trial.columns.find(column => column.label === trial.preference) : undefined;
        return <details key={trial.id} className="group py-2">
          <summary className="flex cursor-pointer list-none flex-wrap items-center justify-between gap-x-4 gap-y-1 text-xs"><span className="min-w-0 flex-1 truncate text-slate-300">{trial.source.title} <span className="text-slate-600">· {trial.source.type}{trial.source.year ? ` · ${trial.source.year}` : ""}</span></span><span className="text-slate-500">{winnerColumn?.system ? BAKEOFF_SYSTEM_NAMES[winnerColumn.system] : trial.preference === "none" ? "None preferred" : "No preference recorded"}</span></summary>
          <div className="mt-2 rounded-lg border border-slate-800 bg-[#09131b] p-3">
            <div className="flex flex-wrap justify-between gap-2 text-[10px] text-slate-500"><span>Completed {formatDate(trial.revealedAt)}</span><span className="font-mono">Trial {trial.id}</span></div>
            <div className="mt-2 grid gap-1.5 sm:grid-cols-2">{trial.columns.map(column => <div key={column.label} className="rounded-md border border-slate-800/80 px-2.5 py-2 text-[10px]">
              <p className="font-semibold text-slate-300">List {column.label} · {column.system ? BAKEOFF_SYSTEM_NAMES[column.system] : "Source not mapped"}</p>
              <p className="mt-1 text-slate-500">{column.status === "available" ? `${column.items.length} ranked slots` : `${column.status}: ${column.unavailableReason || "snapshot missing"}`} · Great ${column.counts?.great ?? 0} · Fine ${column.counts?.fine ?? 0} · Bad ${column.counts?.bad ?? 0}</p>
              <p className="mt-1 text-slate-600">Captured {formatDate(column.capturedAt)}{column.fingerprint ? ` · ${column.fingerprint}` : ""}</p>
            </div>)}</div>
          </div>
        </details>;
      })}</div> : <p className="mt-2 text-xs text-slate-600">No completed sources in this cohort.</p>}
    </div>
  </section>;
}

export default function AdminRecommendationBakeoffPage() {
  const { user, session, loading } = useAuth();
  const profile = useQuery({
    queryKey: ["recommendation-bakeoff-admin-check", user?.id],
    enabled: !!user?.id && !loading,
    queryFn: async ({ signal }) => {
      const { data, error } = await supabase.from("admin_user_profiles").select("id, is_admin").eq("id", user!.id).abortSignal(signal).maybeSingle();
      if (error) throw error;
      return data;
    },
    retry: false, staleTime: 0,
  });
  return <main className="min-h-[100dvh] bg-[#09131b] text-slate-100">
    <div className="mx-auto max-w-[1500px] px-4 py-6 sm:px-6 md:py-9">
      <Link href="/admin" className="inline-flex items-center gap-2 text-sm text-slate-400 transition-colors hover:text-cyan-300"><ArrowLeft size={16} /> Admin tools</Link>
      <header className="mt-7 flex flex-col justify-between gap-5 border-b border-slate-800 pb-6 md:flex-row md:items-end">
        <div className="flex gap-4"><div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border border-cyan-900/80 bg-cyan-950/50 text-cyan-300"><FlaskConical size={23} /></div><div><p className="mb-1.5 text-[10px] font-bold uppercase tracking-[.22em] text-cyan-400">Private · blinded evaluation</p><h1 className="font-display text-3xl font-bold tracking-tight sm:text-4xl">Recommendation bake-off</h1><p className="mt-2 max-w-2xl text-sm leading-relaxed text-slate-400">Taste four frozen lists side by side. Judge the titles first; the source mapping stays hidden until you reveal it.</p></div></div>
        <div className="flex max-w-md gap-2 rounded-xl border border-amber-900/50 bg-amber-950/20 p-3 text-xs leading-relaxed text-amber-100/80"><CircleHelp size={16} className="mt-0.5 shrink-0 text-amber-300" /><span>Captures use stored snapshots only. No refresh, reranking, production cache updates, or ranking changes.</span></div>
      </header>
      {loading || profile.isPending ? <Skeleton /> : profile.isError ? <div role="alert" className={`${panel} mt-7 p-5`}><p className="font-semibold">Admin access could not be verified.</p><p className="mt-1 text-sm text-slate-400">{displayError(profile.error)}</p><button type="button" className={`${button} mt-4`} onClick={() => void profile.refetch()}>Retry access check</button></div>
        : !profile.data?.is_admin || !session || session.user.id !== user?.id ? <div className={`${panel} mt-7 p-5`}><p className="font-semibold">Sign-in required / admin-only</p><p className="mt-1 text-sm text-slate-400">A verified administrator session is required to open this private evaluation tool.</p></div>
        : <Workspace />}
    </div>
  </main>;
}

function Workspace() {
  const bakeoff = useRecommendationBakeoff();
  const [trial, setTrial] = useState<BakeoffTrial | null>(null);
  const [selectedSource, setSelectedSource] = useState("");
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<BakeoffSource[]>([]);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState("");
  const [drafts, setDrafts] = useState<Record<string, BakeoffRating>>({});
  const draftRef = useRef<Record<string, BakeoffRating>>({});
  const [pendingKeys, setPendingKeys] = useState<Record<string, boolean>>({});
  const [actionError, setActionError] = useState("");
  const [actionNotice, setActionNotice] = useState("");
  const [exporting, setExporting] = useState(false);
  const writeQueue = useRef<Promise<void>>(Promise.resolve());
  const sources = bakeoff.sources.data?.sources || [];
  const dashboard = bakeoff.dashboard.data;
  const authError = authFailure(bakeoff.sources.error) || authFailure(bakeoff.dashboard.error);
  const allColumns = useMemo(() => trial ? labels.map(label => trial.columns.find(column => column.label === label) || ({
    label, status: "unavailable" as const, items: [], ratings: {}, unavailableReason: "No snapshot record was returned for this list.",
  } satisfies BakeoffColumn)) : [], [trial]);
  const currentSelected = sources.find(source => source.id === selectedSource);

  useEffect(() => {
    if (!sources.length || selectedSource) return;
    setSelectedSource(sources[0].id);
  }, [sources, selectedSource]);

  useEffect(() => {
    const trimmed = query.trim();
    setSearchError("");
    if (trimmed.length < 2) { setResults([]); setSearching(false); return; }
    setResults([]);
    const controller = new AbortController();
    setSearching(true);
    const timer = window.setTimeout(() => {
      void bakeoff.search(trimmed, controller.signal).then(response => {
        if (!controller.signal.aborted) setResults(response.results || []);
      }).catch(error => {
        if (!controller.signal.aborted) { setResults([]); setSearchError(actionErrorText(error)); }
      }).finally(() => { if (!controller.signal.aborted) setSearching(false); });
    }, 250);
    return () => { window.clearTimeout(timer); controller.abort(); };
  }, [query]);

  function updateDraft(label: BakeoffLabel, rank: number, value: BakeoffRating) {
    if (!trial) return;
    const key = `${trial.id}:${label}:${rank}`;
    const next = { ...draftRef.current, [key]: value };
    draftRef.current = next;
    setDrafts(next);
  }

  function enqueueWrite(key: string, action: () => Promise<void>) {
    setPendingKeys(current => ({ ...current, [key]: true }));
    writeQueue.current = writeQueue.current.catch(() => undefined).then(action).finally(() => {
      setPendingKeys(current => ({ ...current, [key]: false }));
    });
    return writeQueue.current;
  }

  async function saveRating(label: BakeoffLabel, rank: number) {
    if (!trial) return;
    const savedTrial = trial;
    const key = `${savedTrial.id}:${label}:${rank}`;
    setActionError(""); setActionNotice("");
    try {
      await enqueueWrite(key, async () => {
        const draft = draftRef.current[key];
        if (!draft?.verdict) throw new Error("Choose Great, Fine, or Bad before saving.");
        const updated = await bakeoff.save.mutateAsync({ id: savedTrial.id, label, rank, rating: draft });
        setTrial(updated);
        setActionNotice(`List ${label}, rank ${rank} saved.`);
      });
    } catch (error) { setActionError(`${actionErrorText(error)} Your note and selection remain on screen.`); }
  }

  async function savePreference(value: BakeoffLabel | "none") {
    if (!trial || trial.revealedAt) return;
    const column = value === "none" ? undefined : trial.columns.find(row => row.label === value);
    if (value !== "none" && (!column || column.status !== "available" || column.items.length === 0)) return;
    const currentTrial = trial;
    setActionError(""); setActionNotice("");
    try {
      await enqueueWrite(`${currentTrial.id}:preference`, async () => {
        const updated = await bakeoff.save.mutateAsync({ id: currentTrial.id, preference: value });
        setTrial(updated);
        setActionNotice(value === "none" ? "No-preference response saved." : `List ${value} preference saved.`);
      });
    } catch (error) { setActionError(`${actionErrorText(error)} The current trial remains open.`); }
  }

  async function capture(source: BakeoffSource | undefined) {
    if (!source || bakeoff.capture.isPending) return;
    setActionError(""); setActionNotice(""); setTrial(null); setDrafts({}); draftRef.current = {};
    try {
      const saved = await bakeoff.capture.mutateAsync(source);
      setTrial(saved);
      setActionNotice(`Loaded the saved tasting for ${saved.source.title}. Existing source captures are reused.`);
    } catch (error) { setActionError(actionErrorText(error)); }
  }

  async function reveal() {
    if (!trial?.canReveal || bakeoff.reveal.isPending) return;
    setActionError(""); setActionNotice("");
    try {
      const result = await bakeoff.reveal.mutateAsync(trial.id);
      setTrial(result);
      setActionNotice("The source mapping is now revealed for this completed trial.");
    } catch (error) { setActionError(actionErrorText(error)); }
  }

  async function exportDashboard() {
    setExporting(true); setActionError(""); setActionNotice("");
    try {
      const data: BakeoffDashboard = await bakeoff.exportResults();
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url; anchor.download = "consumed-recommendation-bakeoff.json"; anchor.click();
      URL.revokeObjectURL(url);
      setActionNotice("Revealed evaluation results exported as JSON.");
    } catch (error) { setActionError(actionErrorText(error)); }
    finally { setExporting(false); }
  }

  if (bakeoff.loading || bakeoff.sources.isPending) return <Skeleton />;
  if (authError) return <div role="alert" className={`${panel} mt-7 p-5`}><div className="flex gap-3"><ShieldAlert className="shrink-0 text-amber-300" /><div><p className="font-semibold">Sign-in required / admin-only</p><p className="mt-1 text-sm text-slate-400">{displayError(bakeoff.sources.error || bakeoff.dashboard.error)}</p><p className="mt-2 text-xs text-slate-500">This private endpoint requires a valid signed-in administrator session.</p><button type="button" className={`${button} mt-4`} onClick={() => void bakeoff.sources.refetch()}>Retry access</button></div></div></div>;
  if (bakeoff.sources.isError) return <div role="alert" className={`${panel} mt-7 p-5`}><div className="flex gap-3"><TriangleAlert className="shrink-0 text-rose-300" /><div><p className="font-semibold">Source list unavailable</p><p className="mt-1 text-sm text-slate-400">{displayError(bakeoff.sources.error)}</p><button type="button" className={`${button} mt-4`} onClick={() => void bakeoff.sources.refetch()}>Retry loading sources</button></div></div></div>;

  return <div className="mt-6 space-y-6">
    {actionError && <div role="alert" className="flex items-start justify-between gap-3 rounded-xl border border-rose-900/70 bg-rose-950/25 p-3 text-sm text-rose-200"><p>{actionError}</p><button type="button" className="shrink-0 text-xs underline" onClick={() => setActionError("")}>Dismiss</button></div>}
    {actionNotice && <div role="status" className="flex items-center justify-between gap-3 rounded-xl border border-emerald-900/60 bg-emerald-950/20 p-3 text-xs text-emerald-200"><span>{actionNotice}</span><button type="button" className="shrink-0 text-slate-500 hover:text-slate-200" onClick={() => setActionNotice("")}>Dismiss</button></div>}
    {bakeoff.dashboard.isError && !authError && <div role="alert" className="flex items-center justify-between gap-3 rounded-xl border border-amber-900/60 bg-amber-950/20 p-3 text-xs text-amber-100"><span>Dashboard could not load: {displayError(bakeoff.dashboard.error)}</span><button type="button" className="underline" onClick={() => void bakeoff.dashboard.refetch()}>Retry</button></div>}

    <section className={`${panel} overflow-hidden`}>
      <div className="grid divide-y divide-slate-800 md:grid-cols-[1fr_1fr] md:divide-x md:divide-y-0 xl:grid-cols-[1.1fr_1fr_1fr]">
        <div className="p-4 sm:p-5"><p className="text-[10px] font-bold uppercase tracking-[.18em] text-cyan-300">01 / Choose a source</p><label htmlFor="bakeoff-source" className="mt-3 block text-xs text-slate-500">Existing source list · {sources.length} available</label><select id="bakeoff-source" value={selectedSource} onChange={event => setSelectedSource(event.target.value)} className={`${input} mt-1.5`}>
          {sources.length ? sources.map(source => <option key={source.id} value={source.id}>{source.title} · {source.type}{source.year ? ` · ${source.year}` : ""}</option>) : <option value="">No sources configured</option>}
        </select>
        <button type="button" disabled={!currentSelected || bakeoff.capture.isPending} onClick={() => void capture(currentSelected)} className={`${button} mt-3 w-full border-cyan-900 bg-cyan-950/40 text-cyan-100`}>{bakeoff.capture.isPending ? <><LoaderCircle size={15} className="animate-spin" /> Loading saved capture…</> : "Open saved tasting"}</button>
        <p className="mt-2 text-[10px] leading-relaxed text-slate-600">Choosing an already captured source returns its existing trial. Nothing is refreshed or reranked.</p></div>
        <div className="p-4 sm:p-5"><div className="flex items-center gap-2"><Search size={14} className="text-cyan-300" /><p className="text-[10px] font-bold uppercase tracking-[.18em] text-slate-300">02 / Search entertainment</p></div>
          <label htmlFor="bakeoff-search" className="mt-3 block text-xs text-slate-500">Search/add a Film or TV source</label><div className="relative mt-1.5"><input id="bakeoff-search" value={query} onChange={event => setQuery(event.target.value)} placeholder="Title, year, or phrase…" className={`${input} pr-10`} /><span className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500">{searching ? <LoaderCircle size={15} className="animate-spin" /> : <Search size={15} />}</span></div>
          {searchError && <p role="alert" className="mt-2 text-xs text-rose-300">{searchError}</p>}
          {query.trim().length > 0 && query.trim().length < 2 && <p className="mt-2 text-[11px] text-slate-600">Enter at least two characters.</p>}
          {results.length > 0 && <div className="mt-2 max-h-44 space-y-1 overflow-y-auto rounded-lg border border-slate-800 bg-[#0b151d] p-1">{results.map(source => <button type="button" key={source.id} disabled={bakeoff.capture.isPending} onClick={() => { setSelectedSource(source.id); setQuery(""); setResults([]); void capture(source); }} className="flex w-full items-center justify-between gap-3 rounded-md px-3 py-2 text-left text-xs text-slate-300 hover:bg-slate-800/70 disabled:opacity-50"><span className="truncate">{source.title} <span className="text-slate-600">· {source.type}{source.year ? ` · ${source.year}` : ""}</span></span><span className="shrink-0 text-cyan-300">Capture</span></button>)}</div>}
          {!!query.trim() && !searching && !searchError && query.trim().length >= 2 && !results.length && <p className="mt-2 text-xs text-slate-600">No Film or TV sources found. Try another title.</p>}
        </div>
        <div className="p-4 sm:p-5 md:col-span-2 xl:col-span-1"><p className="text-[10px] font-bold uppercase tracking-[.18em] text-slate-300">03 / Trial status</p>{trial ? <><p className="mt-3 text-sm font-semibold text-slate-100">{trial.source.title}</p><p className="mt-1 text-xs text-slate-500">{trial.source.type}{trial.source.year ? ` · ${trial.source.year}` : ""} · opened {formatDate(trial.createdAt)}</p><div className="mt-3 flex flex-wrap items-center gap-2"><span className={`rounded-full border px-2.5 py-1 text-[10px] font-semibold ${trial.revealedAt ? "border-emerald-900 bg-emerald-950/40 text-emerald-200" : "border-cyan-900 bg-cyan-950/30 text-cyan-200"}`}>{trial.revealedAt ? "REVEALED" : "BLINDED"}</span><span className="font-mono text-[10px] text-slate-600">{trial.columns.filter(column => column.status === "available").length}/4 snapshots available</span></div></> : <div className="mt-3 rounded-lg border border-dashed border-slate-800 p-3 text-xs leading-relaxed text-slate-500">Open a source capture to begin. The lists are labelled A–D until the reveal action.</div>}
          {trial && <div className="mt-4 border-t border-slate-800 pt-3"><p className="text-[10px] font-semibold uppercase tracking-[.15em] text-slate-500">List preference</p><div className="mt-2 flex flex-wrap gap-1.5">{labels.map(label => {
            const column = trial.columns.find(row => row.label === label);
            const enabled = !!column && column.status === "available" && column.items.length > 0 && !trial.revealedAt;
            return <button key={label} type="button" disabled={!enabled || pendingKeys[`${trial.id}:preference`]} aria-pressed={trial.preference === label} onClick={() => void savePreference(label)} className={`min-h-9 min-w-10 rounded-lg border px-3 font-mono text-xs ${trial.preference === label ? "border-cyan-700 bg-cyan-950/60 text-cyan-100" : "border-slate-700 text-slate-400 hover:bg-slate-800"} disabled:pointer-events-none disabled:opacity-35`}>{label}</button>;
          })}<button type="button" disabled={!!trial.revealedAt || pendingKeys[`${trial.id}:preference`]} aria-pressed={trial.preference === "none"} onClick={() => void savePreference("none")} className={`min-h-9 rounded-lg border px-3 text-xs ${trial.preference === "none" ? "border-cyan-700 bg-cyan-950/60 text-cyan-100" : "border-slate-700 text-slate-400 hover:bg-slate-800"} disabled:pointer-events-none disabled:opacity-35`}>None</button></div>
            <p className="mt-2 text-[10px] leading-relaxed text-slate-600">Unavailable, errored, and empty lists cannot be preferred. None remains an explicit choice.</p>
          </div>}</div>
      </div>
      {trial && <div className="flex flex-col gap-3 border-t border-slate-800 bg-[#0d1922] p-4 sm:flex-row sm:items-center sm:justify-between sm:px-5">
        <p className="max-w-2xl text-xs leading-relaxed text-slate-500">Rate only valid ranked items. Invalid slots keep their original rank and are not rated or substituted. Missing snapshots remain unavailable; they are not empty or bad-ranked results.</p>
        <button type="button" disabled={!trial.canReveal || bakeoff.reveal.isPending || !!Object.values(pendingKeys).some(Boolean)} onClick={() => void reveal()} className={`${button} shrink-0 border-emerald-900 bg-emerald-950/35 text-emerald-100`}>{bakeoff.reveal.isPending ? <><LoaderCircle size={14} className="animate-spin" /> Revealing…</> : "Reveal source mapping"}</button>
      </div>}
    </section>

    {trial && <section>
      <div className="mb-3 flex flex-col justify-between gap-2 sm:flex-row sm:items-end"><div><p className="text-[10px] font-bold uppercase tracking-[.18em] text-cyan-400">Blinded tasting</p><h2 className="mt-1 font-display text-xl font-semibold text-slate-100">Four captured lists. No source clues.</h2></div><p className="text-xs text-slate-500">Original rank retained · source identity withheld</p></div>
      <div className="grid items-start gap-4 md:grid-cols-2 xl:grid-cols-4">{allColumns.map(column => <ResultList key={column.label} column={column} trial={trial} drafts={drafts} isSaving={key => !!pendingKeys[key]} onChange={updateDraft} onSave={(label, rank) => void saveRating(label, rank)} />)}</div>
    </section>}

    <section className="space-y-4">
      <div className="flex flex-col justify-between gap-3 border-b border-slate-800 pb-3 sm:flex-row sm:items-end"><div><p className="text-[10px] font-bold uppercase tracking-[.18em] text-cyan-400">Tasting ledger</p><h2 className="mt-1 font-display text-xl font-semibold text-slate-100">Cohort dashboard</h2><p className="mt-1 text-xs text-slate-500">Server-scoped judgments; these ratings never write to production caches.</p></div><button type="button" disabled={exporting} onClick={() => void exportDashboard()} className={button}>{exporting ? <LoaderCircle size={14} className="animate-spin" /> : <ArrowDownToLine size={14} />}{exporting ? "Preparing…" : "Export revealed results"}</button></div>
      {bakeoff.dashboard.isPending && <div className="space-y-3">{[0, 1].map(i => <div key={i} className="h-24 animate-pulse rounded-xl bg-slate-900" />)}</div>}
      {dashboard && <>
        <div className="grid gap-3 sm:grid-cols-2"><div className="rounded-xl border border-slate-800 bg-[#111d27] p-4"><p className="text-[10px] uppercase tracking-[.16em] text-slate-500">Pending reveal</p><p className="mt-1 font-mono text-2xl text-slate-100">{dashboard.pendingCount}</p></div><div className="rounded-xl border border-slate-800 bg-[#111d27] p-4"><p className="text-[10px] uppercase tracking-[.16em] text-slate-500">Completed trials</p><p className="mt-1 font-mono text-2xl text-slate-100">{dashboard.completed.length}</p></div></div>
        <div className="grid gap-4 xl:grid-cols-2"><CohortPanel dashboard={dashboard} cohortKey="providers" /><CohortPanel dashboard={dashboard} cohortKey="production" /><div className="xl:col-span-2"><CohortPanel dashboard={dashboard} cohortKey="full" /></div></div>
      </>}
      {!dashboard && !bakeoff.dashboard.isPending && <div className={`${panel} p-5 text-sm text-slate-500`}>No dashboard data is available yet.</div>}
      <div className="rounded-xl border border-slate-800/80 bg-[#0d1922] p-4 text-xs leading-relaxed text-slate-500"><p className="font-semibold text-slate-300">Historical production snapshots only</p><p className="mt-1">When revealed, production provenance differentiates a bundled fallback from an actual historical shared-cache capture. This tool does not fetch fresh production recommendations. Unavailable source snapshots are shown as coverage gaps and never treated as empty or poor results.</p></div>
    </section>
  </div>;
}
