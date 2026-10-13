import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, ArrowUp, ArrowDown, BookOpen, Search, ExternalLink, Trash2, Copy, ShieldCheck } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { supabase, getSupabaseFunctionUrl, SUPABASE_ANON_KEY } from "@/lib/supabase";
import { createResearchRequestGate, isResearchChart, isResearchResult, isResearchTitle, safeResearchUrl } from "@/lib/content-research";
import { researchAngles, researchTypes, researchExport, hasFactualClaim, type ResearchAngle, type ResearchType, type ResearchTitle, type ResearchChart, type ResearchResult, type CuratedPick } from "@shared/content-research";

const labels: Record<ResearchType, string> = { movie: "Movies", tv: "TV", book: "Books", music: "Music", podcast: "Podcasts", game: "Games", youtube: "YouTube" };
const button = "inline-flex items-center justify-center gap-2 rounded-lg border border-gray-700 px-3 py-2 text-sm text-gray-200 hover:bg-gray-800 disabled:opacity-40 disabled:cursor-not-allowed";
const input = "w-full rounded-lg border border-gray-700 bg-gray-950 px-3 py-2.5 text-sm text-gray-100 focus:outline-none focus:ring-2 focus:ring-teal-500";
const panel = "rounded-2xl border border-gray-800 bg-gray-900/60 p-5 md:p-6";
type Seed = ResearchTitle & { chart?: ResearchChart };
type Snapshot = { result: ResearchResult; angle: ResearchAngle; types: ResearchType[] };

function Chart({ chart }: { chart: ResearchChart }) {
  return <div className="mt-2 text-xs leading-relaxed text-gray-400">
    <span className={chart.status === "current" ? "text-teal-300" : "text-amber-300"}>{chart.status.toUpperCase()}</span>
    {" · "}{chart.source_label} · {chart.chart_country || "Country not supplied"} · {chart.chart_date || "Date not supplied"}
    {chart.status === "stale" && <p className="text-amber-300">Historical chart data; not a current ranking.</p>}
    {chart.status === "unavailable" && <p className="text-amber-300">Chart unavailable; this cannot be used as a trending seed.</p>}
  </div>;
}

function Identity({ title }: { title: ResearchTitle }) {
  return <div className="min-w-0">
    <p className="font-semibold text-gray-100 break-words">{title.title}</p>
    <p className="mt-1 text-xs text-gray-400">{labels[title.type]}{title.media_subtype ? ` / ${title.media_subtype}` : ""} · {title.creator || "Creator not supplied"}{title.year ? ` · ${title.year}` : ""}</p>
    <a href={safeResearchUrl(title.source_url)} target="_blank" rel="noopener noreferrer" className="mt-2 inline-flex items-center gap-1 text-xs text-teal-300 hover:underline break-all">
      {title.external_source} · {title.external_id}<ExternalLink size={12} />
    </a>
  </div>;
}

function Skeleton() {
  return <div role="status" aria-label="Loading research" className="space-y-3 py-4">{[0, 1, 2].map(n => <div key={n} className="animate-pulse rounded-xl bg-gray-800/70 h-20" />)}</div>;
}

export default function AdminContentResearchPage() {
  const { user, session, loading } = useAuth();
  const profile = useQuery({
    queryKey: ["content-research-admin-check", user?.id],
    enabled: !!user?.id && !loading,
    queryFn: async ({ signal }) => {
      const { data, error } = await supabase.from("admin_user_profiles").select("id, is_admin").eq("id", user!.id).abortSignal(signal).maybeSingle();
      if (error) throw error;
      return data;
    },
    retry: false,
    staleTime: 0,
  });
  return <main className="min-h-[100dvh] bg-gray-950 text-gray-100">
    <div className="mx-auto max-w-6xl px-4 py-8 md:py-12">
      <Link href="/admin" className="inline-flex items-center gap-2 text-sm text-gray-400 hover:text-teal-300"><ArrowLeft size={16} /> Admin tools</Link>
      <header className="mt-7 mb-8 flex gap-4 items-start">
        <div className="rounded-xl border border-teal-800 bg-teal-950 p-3 text-teal-300"><BookOpen size={25} /></div>
        <div><p className="text-xs uppercase tracking-[0.2em] text-teal-400 mb-2">Editorial workspace</p><h1 className="text-3xl font-bold">Content Research</h1><p className="mt-2 text-sm text-gray-400 max-w-xl">Real titles. Thoughtful connections. Explore across media without personal DNA, then curate an outline for editorial review.</p></div>
      </header>
      {loading || profile.isPending ? <Skeleton /> : profile.isError ? <div className={panel} role="alert"><p>Admin access could not be verified.</p><button className={`${button} mt-3`} onClick={() => void profile.refetch()}>Retry access check</button></div>
        : !profile.data?.is_admin || !session || session.user.id !== user?.id ? <div className={panel}>Access restricted. A verified admin session is required.</div>
        : <ResearchWorkspace key={`${user.id}:${session.access_token}`} token={session.access_token} />}
    </div>
  </main>;
}

function ResearchWorkspace({ token }: { token: string }) {
  const [mode, setMode] = useState<"search" | "trending">("search");
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<ResearchType | "">("");
  const [items, setItems] = useState<Seed[]>([]);
  const [searched, setSearched] = useState(false);
  const [discoveryFeedback, setDiscoveryFeedback] = useState<string[]>([]);
  const [seed, setSeed] = useState<Seed | null>(null);
  const [angle, setAngle] = useState<ResearchAngle>("themes");
  const [types, setTypes] = useState<ResearchType[]>([...researchTypes]);
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null);
  const [picks, setPicks] = useState<CuratedPick[]>([]);
  const [busy, setBusy] = useState<"search" | "trending" | "generate" | null>(null);
  const [failure, setFailure] = useState<{ action: "search" | "trending" | "generate"; message: string } | null>(null);
  const [notice, setNotice] = useState("");
  const [copyFeedback, setCopyFeedback] = useState("");
  const [fallback, setFallback] = useState("");
  const [authInvalid, setAuthInvalid] = useState(false);
  const gate = useRef(createResearchRequestGate());
  const authValid = useRef(true);
  const copyGeneration = useRef(0);

  function cancel() {
    gate.current.cancel();
    setBusy(null);
  }
  function changed() {
    cancel();
    setFailure(null);
    setNotice("");
    setFallback("");
    setCopyFeedback("");
    copyGeneration.current++;
  }
  useEffect(() => {
    authValid.current = true;
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.access_token !== token) {
        authValid.current = false;
        gate.current.cancel();
        copyGeneration.current++;
        setAuthInvalid(true);
        setSeed(null); setSnapshot(null); setPicks([]); setItems([]); setFallback("");
      }
    });
    return () => { authValid.current = false; gate.current.cancel(); copyGeneration.current++; subscription.unsubscribe(); };
  }, [token]);

  const exported = useMemo(() => snapshot ? researchExport(snapshot.result.seed, picks, snapshot.angle) : { count: 0, excluded: 0, outline: "", caption: "" }, [snapshot, picks]);
  const isOld = !!snapshot && (seed?.external_id !== snapshot.result.seed.external_id || seed?.external_source !== snapshot.result.seed.external_source || seed?.type !== snapshot.result.seed.type || angle !== snapshot.angle || types.join() !== snapshot.types.join());

  async function run(action: "search" | "trending" | "generate") {
    if (!authValid.current || authInvalid) return;
    if (action === "search" && (query.trim().length < 2 || query.trim().length > 150)) return;
    if (action === "generate" && (!seed || !types.length || seed.chart?.status === "unavailable")) return;
    const request = gate.current.begin();
    const requestedAngle = angle;
    const requestedTypes = [...types];
    setBusy(action); setFailure(null); setNotice(""); setCopyFeedback(""); setFallback("");
    copyGeneration.current++;
    const timeout = window.setTimeout(() => {
      if (request.current()) {
        gate.current.cancel(); setBusy(null);
        setFailure({ action, message: "The provider request timed out. Retry when ready; no results were invented." });
      }
    }, 105000);
    try {
      const body = action === "search" ? { action, query: query.trim(), ...(filter ? { type: filter } : {}) }
        : action === "trending" ? { action }
        : { action, seed, ...(seed?.chart ? { chart: seed.chart } : {}), angle: requestedAngle, types: requestedTypes };
      const response = await fetch(getSupabaseFunctionUrl("admin-content-research"), {
        method: "POST", credentials: "include", signal: request.signal,
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}`, apikey: SUPABASE_ANON_KEY },
        body: JSON.stringify(body),
      });
      const data = await response.json().catch(() => null);
      if (!request.current() || !authValid.current) return;
      if (!response.ok) {
        const detail = typeof data?.error === "string" ? data.error : typeof data?.message === "string" ? data.message : "";
        const status = response.status === 429 ? "Request limit reached. Please wait before retrying." : response.status === 401 || response.status === 403 ? "Admin authorization was denied. Refresh your session or check access." : `Provider request failed (${response.status}).`;
        throw new Error(`${status}${detail ? ` ${detail.slice(0, 1000)}` : ""}`);
      }
      if (action === "generate") {
        if (!isResearchResult(data)) throw new Error("The provider returned an invalid research response. No unverified results were displayed.");
        setSnapshot({ result: data, angle: requestedAngle, types: requestedTypes });
        setPicks(data.picks.map(p => ({ ...p, selected: true })));
        if (!data.picks.length) setNotice("No verified connections were returned. Try a different angle or media selection.");
      } else {
        const list: unknown = action === "search" ? data?.results : data?.items;
        if (!Array.isArray(list) || !list.every(p => isResearchTitle(p) && (action !== "trending" || isResearchChart((p as Seed).chart)))) throw new Error("The provider returned invalid catalog data. Please retry.");
        setItems(list as Seed[]); setSearched(true);
        setDiscoveryFeedback(Array.isArray(data?.feedback) ? data.feedback.filter((f: unknown) => typeof f === "string") : []);
      }
    } catch (error) {
      if (request.current() && authValid.current) setFailure({ action, message: error instanceof Error ? error.message : "Research unavailable. Check your connection and retry." });
    } finally {
      window.clearTimeout(timeout);
      if (request.current()) setBusy(null);
    }
  }

  function updatePicks(next: CuratedPick[]) {
    cancel();
    copyGeneration.current++; setCopyFeedback(""); setFallback(""); setPicks(next);
  }
  function move(index: number, direction: number) {
    const next = [...picks];
    const target = index + direction;
    if (target < 0 || target >= next.length) return;
    [next[index], next[target]] = [next[target], next[index]];
    updatePicks(next);
  }
  async function copy(text: string) {
    const generation = ++copyGeneration.current;
    setCopyFeedback(""); setFallback("");
    try {
      if (!navigator.clipboard?.writeText) throw new Error("Clipboard unavailable");
      await navigator.clipboard.writeText(text);
      if (generation === copyGeneration.current && authValid.current) setCopyFeedback("Copied to clipboard.");
    } catch {
      if (generation === copyGeneration.current && authValid.current) {
        setFallback(text); setCopyFeedback("Clipboard access failed. Select the text below and copy it manually.");
      }
    }
  }
  if (authInvalid) return <div className={panel} role="alert">Session changed. Research has been cleared. Reload to verify admin access again.</div>;

  return <div className="space-y-6">
    <div className="flex flex-wrap gap-x-5 gap-y-2 rounded-xl border border-gray-800 px-4 py-3 text-xs text-gray-400"><span>Session-only draft</span><span>No personal DNA</span><span>No posts or schedules written</span><span>Catalog facts ≠ editorial opinion</span></div>
    {failure && <div role="alert" className="rounded-xl border border-red-800/60 bg-red-950/30 p-4 text-sm text-red-200"><p className="break-words">{failure.message}</p><button className={`${button} mt-3`} onClick={() => void run(failure.action)} disabled={!!busy}>Retry {failure.action}</button></div>}
    {notice && <p role="status" className="text-sm text-amber-300">{notice}</p>}
    <div className="grid gap-6 md:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)]">
      <section className={panel}>
        <h2 className="font-semibold text-lg"><span className="text-teal-400 mr-2">01</span>Find a starting point</h2>
        <div className="flex gap-2 mt-5 mb-4" aria-label="Seed discovery mode">{(["search", "trending"] as const).map(m => <button key={m} aria-pressed={mode === m} className={`${button} ${mode === m ? "border-teal-700 bg-teal-950 text-teal-200" : ""}`} onClick={() => { changed(); setMode(m); setItems([]); setSearched(false); setDiscoveryFeedback([]); }}>{m === "search" ? "Search catalogs" : "Trending charts"}</button>)}</div>
        {mode === "search" ? <form onSubmit={e => { e.preventDefault(); void run("search"); }} className="space-y-3">
          <label className="block text-xs text-gray-400" htmlFor="research-query">Title or creator · 2–150 characters</label>
          <input id="research-query" value={query} maxLength={150} placeholder="Find a real title or creator…" className={input} onChange={e => { changed(); setQuery(e.target.value); setItems([]); setSearched(false); setDiscoveryFeedback([]); }} />
          <div className="flex gap-2"><select aria-label="Search media type" value={filter} className={input} onChange={e => { changed(); setFilter(e.target.value as ResearchType | ""); setItems([]); setSearched(false); setDiscoveryFeedback([]); }}><option value="">All media types</option>{researchTypes.map(t => <option key={t} value={t}>{labels[t]}</option>)}</select><button type="submit" className={button} disabled={query.trim().length < 2 || !!busy}><Search size={16} /> Search</button></div>
        </form> : <div><p className="text-sm text-gray-400 mb-3">Provider charts retain their source, country, date, and availability. They are not a universal popularity ranking.</p><button className={button} disabled={!!busy} onClick={() => void run("trending")}>Load provider charts</button></div>}
        {busy && busy !== "generate" ? <Skeleton /> : <div className="mt-4 space-y-3 max-h-[32rem] overflow-y-auto">
          {discoveryFeedback.map((f, i) => <p key={i} className="text-sm text-amber-300" role="status">{f}</p>)}
          {searched && !items.length && <div className="rounded-xl border border-dashed border-gray-700 p-5 text-sm text-gray-400">{mode === "search" ? "No catalog matches returned. Try another title, creator, or type." : "No chart titles available. Check provider feedback or use catalog search."}</div>}
          {!searched && <p className="py-4 text-sm text-gray-500">Search a catalog or load charts to choose a seed. Only provider-returned titles appear here.</p>}
          {items.map((item, i) => <div key={`${item.external_source}:${item.external_id}:${i}`} className="rounded-xl border border-gray-800 p-4"><Identity title={item} />{item.chart && <Chart chart={item.chart} />}<button className={`${button} mt-3`} disabled={item.chart?.status === "unavailable"} onClick={() => { changed(); setSeed(item); }}>Use as seed</button></div>)}
        </div>}
      </section>
      <section className={panel}>
        <h2 className="font-semibold text-lg"><span className="text-teal-400 mr-2">02</span>Choose the editorial lens</h2>
        <div className="my-5 rounded-xl border border-teal-900 bg-teal-950/30 p-4">{seed ? <><Identity title={seed} />{seed.chart && <Chart chart={seed.chart} />}<button className={`${button} mt-3`} onClick={() => { changed(); setSeed(null); }}>Clear seed</button></> : <p className="text-sm text-gray-400">Choose a seed from search or a provider chart.</p>}</div>
        <label htmlFor="research-angle" className="block text-sm text-gray-300 mb-2">Connection angle</label>
        <select id="research-angle" value={angle} className={input} onChange={e => { changed(); setAngle(e.target.value as ResearchAngle); }}>{researchAngles.map(a => <option key={a} value={a}>{a}</option>)}</select>
        <fieldset className="mt-5"><legend className="text-sm text-gray-300 mb-3">Output media types</legend><div className="flex flex-wrap gap-2">{researchTypes.map(t => <button key={t} type="button" aria-pressed={types.includes(t)} className={`${button} ${types.includes(t) ? "bg-teal-950 border-teal-800 text-teal-200" : ""}`} onClick={() => { changed(); setTypes(current => researchTypes.filter(type => type === t ? !current.includes(t) : current.includes(type))); }}>{labels[t]}</button>)}</div></fieldset>
        {!types.length && <p className="text-xs text-amber-300 mt-2">Choose at least one output type.</p>}
        <p className="mt-4 text-xs text-gray-500 leading-relaxed">Availability depends on real catalog providers. Unsupported or unavailable sources may produce a partial result, not invented titles. The seed is checked again during generation.</p>
        <button className={`${button} w-full mt-5 bg-teal-900/60 border-teal-700 text-teal-100`} disabled={!seed || !types.length || !!busy} onClick={() => void run("generate")}>Research connections</button>
      </section>
    </div>
    {busy && <div role="status" className={panel}><div className="flex items-center justify-between gap-3"><p className="text-sm text-teal-200">{busy === "generate" ? "Checking the seed and researching catalog connections…" : "Contacting catalog providers…"}</p><button className={button} onClick={() => { cancel(); setNotice("Request canceled. Any previously reviewed draft is unchanged."); }}>Cancel</button></div>{busy === "generate" && <Skeleton />}</div>}
    <section className={panel}>
      <div className="flex flex-wrap items-start justify-between gap-4"><div><h2 className="text-lg font-semibold"><span className="text-teal-400 mr-2">03</span>Review & curate</h2><p className="mt-2 text-sm text-gray-400">Identity is catalog-verified. Similarity is subjective; rationale text is never verified.</p></div>{snapshot && <span className="rounded-full border border-gray-700 px-3 py-1 text-xs text-gray-400">{picks.filter(p => p.selected).length} selected · {picks.length} remaining</span>}</div>
      {!snapshot ? <div className="mt-5 rounded-xl border border-dashed border-gray-700 p-7 text-gray-400 text-sm">Your research draft will appear here. Choose a seed and lens above; nothing is published.</div> : <>
        <div className="mt-5 border-l-2 border-teal-700 pl-4"><p className="text-xs text-gray-500 mb-2">THIS DRAFT'S SEED · {snapshot.angle}</p><Identity title={snapshot.result.seed} />{snapshot.result.chart && <Chart chart={snapshot.result.chart} />}</div>
        {isOld && <p role="status" className="mt-4 text-sm text-amber-300">Inputs have changed. This draft and its export still use the seed and angle from the last completed request.</p>}
        {snapshot.result.feedback.map((f, i) => <p key={i} className="mt-3 text-sm text-amber-300" role="status">{f}</p>)}
        {!picks.length && <p className="mt-5 text-sm text-gray-400">No picks in this draft. Check provider feedback, adjust your inputs, or research again.</p>}
        <div className="mt-5 space-y-4">{picks.map((pick, index) => <article key={`${pick.external_source}:${pick.external_id}:${index}`} className="rounded-xl border border-gray-800 bg-gray-950/60 p-4 md:p-5">
          <div className="flex items-start gap-3"><input type="checkbox" className="mt-1 accent-teal-500 h-4 w-4" aria-label={`Include ${pick.title} in export`} checked={pick.selected} onChange={e => updatePicks(picks.map((p, i) => i === index ? { ...p, selected: e.target.checked } : p))} /><div className="flex-1 min-w-0"><Identity title={pick} /><span className="mt-2 inline-flex gap-1 items-center text-xs text-teal-300"><ShieldCheck size={13} /> Catalog identity verified</span></div></div>
          <label htmlFor={`rationale-${index}`} className="block mt-4 mb-2 text-xs text-gray-400">Editorial similarity · {pick.edited ? "admin-edited" : "subjective"} · prose not verified</label>
          <textarea id={`rationale-${index}`} rows={3} maxLength={2000} className={`${input} resize-y`} value={pick.rationale} onChange={e => updatePicks(picks.map((p, i) => i === index ? { ...p, rationale: e.target.value, edited: true } : p))} />
          <p className="text-xs text-gray-500 mt-1">{pick.rationale.length}/2,000 characters</p>
          {hasFactualClaim(pick.rationale) && <p className="mt-2 text-xs text-amber-300">Excluded from export while selected: this prose contains an official or factual relationship claim without evidence. Rewrite as a subjective connection.</p>}
          <div className="flex flex-wrap gap-2 mt-3"><button className={button} aria-label={`Move ${pick.title} up`} disabled={index === 0} onClick={() => move(index, -1)}><ArrowUp size={14} /> Up</button><button className={button} aria-label={`Move ${pick.title} down`} disabled={index === picks.length - 1} onClick={() => move(index, 1)}><ArrowDown size={14} /> Down</button><button className={button} onClick={() => { if (window.confirm(`Remove "${pick.title}" from this session draft?`)) updatePicks(picks.filter((_, i) => i !== index)); }}><Trash2 size={14} /> Remove</button></div>
        </article>)}</div>
      </>}
    </section>
    <section className={panel}>
      <h2 className="text-lg font-semibold"><span className="text-teal-400 mr-2">04</span>Preview & copy</h2>
      <p className="text-sm text-gray-400 mt-2">{exported.count} eligible picks. Copy only; no posting or scheduling.</p>
      {!!exported.excluded && <p className="mt-3 text-sm text-amber-300" role="status">{exported.excluded} selected {exported.excluded === 1 ? "pick is" : "picks are"} excluded for unsupported factual or official claims. Those claims are not exported.</p>}
      {exported.count ? <div className="grid gap-5 mt-5 md:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">{([{ label: "Carousel outline", text: exported.outline }, { label: "Caption", text: exported.caption }]).map(part => <div key={part.label}><div className="flex items-center justify-between gap-3 mb-3"><h3 className="text-sm font-medium">{part.label}</h3><button className={button} onClick={() => void copy(part.text)}><Copy size={14} /> Copy</button></div><textarea aria-label={`${part.label} preview`} readOnly rows={12} value={part.text} className={`${input} leading-relaxed resize-y`} onFocus={e => e.currentTarget.select()} /></div>)}</div> : <div className="mt-5 rounded-xl border border-dashed border-gray-700 p-5 text-sm text-gray-400">Select at least one eligible catalog pick to preview an outline and caption. Unsupported claims stay out of the export.</div>}
      {copyFeedback && <p className="mt-4 text-sm text-teal-200" role="status">{copyFeedback}</p>}
      {fallback && <textarea aria-label="Manual copy fallback" className={`${input} mt-3`} readOnly rows={8} value={fallback} onFocus={e => e.currentTarget.select()} />}
    </section>
  </div>;
}
