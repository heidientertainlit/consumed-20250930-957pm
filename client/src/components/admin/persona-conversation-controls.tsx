import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/lib/supabase";
import { deriveSocialVoice, type PersonaConfig } from "../../../../supabase/functions/_shared/persona-generation";
import {
  AlertCircle, CalendarClock, Check, CirclePause, Clock3, Loader2, MessageCircle,
  RefreshCw, RotateCcw, Search,
  Sparkles, X,
} from "lucide-react";

export type ConversationPersona = {
  id: string;
  user_name: string;
  display_name: string;
  persona_config: PersonaConfig | null;
  gender?: "unset" | "woman" | "man" | "nonbinary" | "other";
};
export type ConversationMessage = {
  client_id: string;
  participant_id: string;
  parent_client_id: string | null;
  body: string;
  offset_seconds: number;
  public_id?: string;
  delivered_at?: string | null;
  error?: string | null;
};
export type ConversationRun = {
  id: string;
  topic: string;
  status: string;
  subject?: { id?: string; title?: string; type?: string; creator?: string } | null;
  provenance?: unknown;
  participant_ids: string[];
  opening_author_id: string;
  messages: ConversationMessage[];
  revision: number;
  approved_revision?: number | null;
  start_at?: string | null;
  last_error?: string | null;
  created_at: string;
  history?: Array<{ action: string; at: string; message?: string; error?: string }>;
};
export type ConversationCoverage = { provider: string; types: string[]; status: string; fetchedAt?: string; error?: string };
export type ConversationState = { personas: ConversationPersona[]; runs: ConversationRun[] };
export type SearchItem = { id: string; title: string; type: string; creator?: string; externalId?: string; externalSource?: string };
type ConversationSuggestion = { id: string; topic: string; subject?: SearchItem; provenance?: unknown };

function localDateTimeValue(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}T${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;
}
function normalizeSuggestionSubject(raw: unknown): SearchItem | undefined {
  if (!raw || typeof raw !== "object") return undefined;
  const value = raw as Record<string, unknown>;
  const candidate = (value.item && typeof value.item === "object" ? value.item : value) as Record<string, unknown>;
  if (typeof candidate.id !== "string" || typeof candidate.title !== "string") return undefined;
  return {
    id: candidate.id, title: candidate.title, type: typeof candidate.type === "string" ? candidate.type : "title",
    creator: typeof candidate.creator === "string" ? candidate.creator : undefined,
    externalId: typeof candidate.externalId === "string" ? candidate.externalId : undefined,
    externalSource: typeof candidate.externalSource === "string" ? candidate.externalSource : undefined,
  };
}
const panel = "rounded-xl border border-gray-800 bg-gray-900";
const field = "w-full rounded-lg border border-gray-700 bg-gray-950 px-3 py-2 text-sm text-gray-100 placeholder:text-gray-600 focus:border-violet-500 focus:outline-none";
const smallButton = "inline-flex items-center justify-center gap-1.5 rounded-lg border border-gray-700 px-3 py-2 text-xs font-medium text-gray-200 transition-colors hover:border-gray-500 hover:bg-gray-800 disabled:cursor-not-allowed disabled:opacity-40";

function voiceNotes(persona: ConversationPersona): string[] {
  try {
    const voice = deriveSocialVoice(persona.persona_config || {});
    const config = persona.persona_config as Record<string, unknown> | null;
    const authorStyle = config?.author_style as Record<string, unknown> | undefined;
    const interests = Array.isArray(config?.interests) ? config.interests.map(String) : [];
    return [
      typeof config?.tone === "string" ? config.tone : "",
      ...interests.slice(0, 3),
      `${voice.length} · ${voice.energy}`,
      ...Object.entries(authorStyle || {}).slice(0, 2).map(([key, value]) => `${key}: ${String(value)}`),
    ].filter(Boolean);
  } catch {
    const config = persona.persona_config as Record<string, unknown> | null;
    const values = [config?.tone, config?.interests, config?.social_voice, config?.author_attributes];
    return values.flatMap(value => Array.isArray(value) ? value.map(String) : typeof value === "string" ? [value] : []);
  }
}

/** Pure, fixture-safe overview used by the studio and the mockup sandbox. */
export function ConversationWorkspaceView({ state, loading = false, error = "", onRefresh, showSnapshots = true }: {
  state: ConversationState;
  loading?: boolean;
  error?: string;
  onRefresh?: () => void;
  showSnapshots?: boolean;
}) {
  return <div className="space-y-5">
    <header className="flex flex-wrap items-end justify-between gap-3">
      <div><div className="mb-2 inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-[.18em] text-violet-300"><MessageCircle size={14} /> Conversation studio</div>
        <h2 className="text-xl font-semibold text-white">Generate conversations</h2>
        <p className="mt-1 max-w-2xl text-sm text-gray-400">Build a fictional, editable thread. Nothing is approved or scheduled until you explicitly choose to do so.</p></div>
      {onRefresh && <button type="button" onClick={onRefresh} className={smallButton}><RefreshCw size={13} /> Refresh</button>}
    </header>
    {error && <div role="alert" className="flex items-start gap-2 rounded-lg border border-red-900/70 bg-red-950/30 p-3 text-sm text-red-300"><AlertCircle size={15} className="mt-0.5 shrink-0" />{error}</div>}
    {loading && !state.personas.length && <div className="grid gap-3 md:grid-cols-2"><div className="h-24 animate-pulse rounded-xl bg-gray-800/60" /><div className="h-24 animate-pulse rounded-xl bg-gray-800/60" /></div>}
    {!loading && state.personas.length === 0 && <div className={`${panel} p-5 text-sm text-gray-400`}>Persona roster could not be loaded. Refresh to try again.</div>}
    {state.personas.length > 0 && <div className="grid gap-3 sm:grid-cols-[1fr_1fr_auto]">
      <div className="rounded-lg border border-gray-800 bg-gray-950/60 px-3 py-2"><p className="text-[10px] uppercase tracking-wider text-gray-500">Roster</p><p className="mt-1 text-sm text-gray-200">{state.personas.length} personas <span className="text-gray-500">· explicitly configured</span></p></div>
      <div className="rounded-lg border border-gray-800 bg-gray-950/60 px-3 py-2"><p className="text-[10px] uppercase tracking-wider text-gray-500">Review queue</p><p className="mt-1 text-sm text-gray-200">{state.runs.length} threads <span className="text-gray-500">· approval stays manual</span></p></div>
      <div className="flex items-center gap-1.5 text-xs text-gray-500"><span className="h-2 w-2 rounded-full bg-emerald-400" /> Thread snapshots</div>
    </div>}
    {showSnapshots && <div className="space-y-2">{state.runs.map(run => <article key={run.id} className={`${panel} overflow-hidden`}>
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-gray-800 px-4 py-3"><div><h3 className="text-sm font-semibold text-gray-100">{run.topic}</h3><p className="mt-1 text-[10px] text-gray-500">{run.messages.length} messages · revision {run.revision} · {run.participant_ids.map(id => state.personas.find(persona => persona.id === id)?.display_name || "Persona").join(" · ")}</p></div><Status status={run.status} /></div>
      <div className="divide-y divide-gray-800/80">{run.messages.slice(0, 4).map(message => <div key={message.client_id} className={`px-4 py-3 ${message.parent_client_id ? "pl-8 sm:pl-12" : ""}`}><p className="mb-1 text-[10px] font-medium text-violet-200">{state.personas.find(persona => persona.id === message.participant_id)?.display_name || "Participant"} <span className="ml-1 font-normal text-gray-600">+{message.offset_seconds}s</span></p><p className="whitespace-pre-wrap text-xs leading-relaxed text-gray-300">{message.body}</p></div>)}</div>
      {run.history?.length ? <p className="px-4 pb-3 text-[10px] text-gray-500">Latest event: {run.history[run.history.length - 1].action} · {new Date(run.history[run.history.length - 1].at).toLocaleString()}</p> : null}
    </article>)}</div>}
  </div>;
}

export function ConversationStudio({ state, transport }: {
  state: ConversationState;
  /** Local fixture transport only; the production wrapper never supplies it. */
  transport?: (action: string, values: Record<string, unknown>) => Promise<any>;
}) {
  const [runs, setRuns] = useState(state.runs);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [tab, setTab] = useState<"create" | "runs">("create");
  const [topic, setTopic] = useState("");
  const [angle, setAngle] = useState("");
  const [context, setContext] = useState("");
  const [participants, setParticipants] = useState<string[]>([]);
  const [opener, setOpener] = useState("");
  const [personaFilter, setPersonaFilter] = useState("");
  const [genderFilter, setGenderFilter] = useState("all");
  const [energyFilter, setEnergyFilter] = useState("all");
  const [replyCount, setReplyCount] = useState(6);
  const [duration, setDuration] = useState(90);
  const [maxWords, setMaxWords] = useState(65);
  const [suggestions, setSuggestions] = useState<ConversationSuggestion[]>([]);
  const [coverage, setCoverage] = useState<ConversationCoverage[]>([]);
  const [selectedSuggestion, setSelectedSuggestion] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [searchType, setSearchType] = useState("all");
  const [searchItems, setSearchItems] = useState<SearchItem[]>([]);
  const [selectedSubject, setSelectedSubject] = useState<SearchItem | null>(null);
  const [busy, setBusy] = useState(false);
  const [dirtyRuns, setDirtyRuns] = useState<Set<string>>(new Set());
  const dirtyRunsRef = useRef(dirtyRuns);
  const runsRef = useRef(runs);
  dirtyRunsRef.current = dirtyRuns;
  runsRef.current = runs;
  useEffect(() => {
    const preserve = dirtyRunsRef.current;
    if (!preserve.size) {
      setRuns(state.runs);
      return;
    }
    const localDirty = runsRef.current.filter(run => preserve.has(run.id));
    const localById = new Map(localDirty.map(run => [run.id, run]));
    const merged = state.runs.map(run => localById.get(run.id) || run);
    for (const run of localDirty) if (!merged.some(item => item.id === run.id)) merged.unshift(run);
    setRuns(merged);
  }, [state.runs]);
  const [error, setError] = useState("");
  const [pollError, setPollError] = useState("");
  const [notice, setNotice] = useState("");
  const [genderBusy, setGenderBusy] = useState<string | null>(null);
  const [genderSelections, setGenderSelections] = useState<Record<string, string>>({});
  useEffect(() => {
    setGenderSelections(Object.fromEntries(state.personas.map(persona => [persona.id, persona.gender || "unset"])));
  }, [state.personas]);

  const invoke = useCallback(async (action: string, values: Record<string, unknown> = {}) => {
    if (transport) return transport(action, values);
    const { data, error: invokeError } = await supabase.functions.invoke("admin-persona-conversations", { body: { action, ...values } });
    if (invokeError) throw invokeError;
    if (data?.error) throw new Error(data.error);
    return data;
  }, [transport]);
  const refresh = useCallback(async (replaceDirtyIds: string[] = []) => {
    const data = await invoke("state") as ConversationState;
    const fresh = data.runs || [];
    const preserve = new Set([...dirtyRunsRef.current].filter(id => !replaceDirtyIds.includes(id)));
    if (preserve.size) {
      const localDirty = runsRef.current.filter(run => preserve.has(run.id));
      const localById = new Map(localDirty.map(run => [run.id, run]));
      const merged = fresh.map(run => localById.get(run.id) || run);
      for (const run of localDirty) if (!merged.some(item => item.id === run.id)) merged.unshift(run);
      setRuns(merged);
    } else setRuns(fresh);
    setPollError("");
  }, [invoke]);
  const selectedRun = runs.find(run => run.id === activeId) || null;
  const scheduledExists = runs.some(run => run.status === "scheduled");
  useEffect(() => {
    if (!scheduledExists) return;
    const timer = window.setInterval(() => {
      void refresh().catch(cause => setPollError(cause instanceof Error ? cause.message : "Scheduled conversation status could not be refreshed."));
    }, 15000);
    return () => window.clearInterval(timer);
  }, [scheduledExists, refresh]);
  const personasById = useMemo(() => new Map(state.personas.map(persona => [persona.id, persona])), [state.personas]);
  const filteredPersonas = state.personas.filter(persona => {
    const gender = genderSelections[persona.id] || persona.gender || "unset";
    let energy = "unknown";
    try { energy = deriveSocialVoice(persona.persona_config || {}).energy; } catch { /* Invalid config stays visibly unknown. */ }
    return (genderFilter === "all" || gender === genderFilter) &&
      (energyFilter === "all" || energy === energyFilter) &&
      `${persona.display_name} ${persona.user_name} ${voiceNotes(persona).join(" ")}`.toLowerCase().includes(personaFilter.toLowerCase());
  });
  const doAction = async (label: string, action: string, values: Record<string, unknown> = {}) => {
    setBusy(true); setError(""); setNotice("");
    try {
      const result = await invoke(action, values);
      if (action === "generate" && result?.id) {
        const generatedRun = result as ConversationRun;
        setRuns(current => [generatedRun, ...current.filter(run => run.id !== generatedRun.id)]);
        setActiveId(generatedRun.id); setTab("runs");
      } else {
        if (action === "edit") {
          setDirtyRuns(current => { const next = new Set(current); next.delete(String(values.runId)); return next; });
          await refresh([String(values.runId)]);
        } else await refresh();
      }
      setNotice(label);
      return true;
    } catch (cause) { setError(cause instanceof Error ? cause.message : "The conversation request failed."); }
    finally { setBusy(false); }
    return false;
  };
  const search = async () => {
    setBusy(true); setError("");
    try {
      const data = await invoke("search", { query: searchTerm, type: searchType });
      setSearchItems(data.items || []);
      setCoverage(data.coverage || []);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Title search failed."); }
    finally { setBusy(false); }
  };
  const suggest = async () => {
    setBusy(true); setError("");
    try {
      const data = await invoke("suggest");
      setSuggestions((data.suggestions || []).map((suggestion: ConversationSuggestion) => ({
        ...suggestion, subject: normalizeSuggestionSubject(suggestion.subject ? { ...suggestion.subject, id: suggestion.id } : undefined),
      })));
      setCoverage(data.coverage || []);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Could not load suggestions."); }
    finally { setBusy(false); }
  };
  const toggleParticipant = (id: string) => {
    setParticipants(current => current.includes(id) ? current.filter(value => value !== id) : current.length < 12 ? [...current, id] : current);
  };
  const generate = () => {
    if (participants.length < 2 || participants.length > 12) { setError("Choose between 2 and 12 participants."); return; }
    if (!opener || !participants.includes(opener)) { setError("Choose the opening author from the participant roster."); return; }
    void doAction("Conversation generated. Review the thread before approval.", "generate", {
      topic, subjectId: selectedSubject?.id, suggestionId: selectedSuggestion || undefined, angle, context,
      participantIds: participants, openingAuthorId: opener, replyCount, durationMinutes: duration, maxWords,
    });
  };
  const saveGender = async (personaId: string, gender: string) => {
    setGenderBusy(personaId); setError("");
    try { await invoke("gender", { personaId, gender }); setGenderSelections(current => ({ ...current, [personaId]: gender })); setNotice("Fictional persona gender saved."); await refresh(); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "Could not save the explicit gender setting."); }
    finally { setGenderBusy(null); }
  };
  const updateMessage = (messageId: string, patch: Partial<ConversationMessage>) => {
    if (!selectedRun) return;
    setDirtyRuns(current => new Set(current).add(selectedRun.id));
    setRuns(current => current.map(run => run.id === selectedRun.id ? { ...run, messages: run.messages.map(message => message.client_id === messageId ? { ...message, ...patch } : message) } : run));
  };
  const saveEdits = async () => {
    if (!selectedRun) return;
    const saved = await doAction("Conversation edits saved. Approval remains a separate step.", "edit", {
      runId: selectedRun.id, revision: selectedRun.revision, messages: selectedRun.messages,
    });
    if (saved) setDirtyRuns(current => { const next = new Set(current); next.delete(selectedRun.id); return next; });
  };

  return <div className="space-y-4">
    <div className="flex gap-2 border-b border-gray-800">
      {(["create", "runs"] as const).map(key => <button type="button" key={key} onClick={() => setTab(key)} className={`border-b-2 px-3 py-2 text-sm ${tab === key ? "border-violet-400 text-white" : "border-transparent text-gray-500 hover:text-gray-300"}`}>{key === "create" ? "New conversation" : `Review queue${runs.length ? ` · ${runs.length}` : ""}`}</button>)}
    </div>
    {notice && <p role="status" className="rounded-lg border border-emerald-900/60 bg-emerald-950/30 px-3 py-2 text-xs text-emerald-300">{notice}</p>}
    {pollError && <p role="alert" className="rounded-lg border border-amber-900/60 bg-amber-950/30 px-3 py-2 text-xs text-amber-200">Scheduled status refresh failed: {pollError} <button type="button" onClick={() => void refresh().catch(cause => setPollError(cause instanceof Error ? cause.message : "Refresh failed."))} className="ml-2 underline">Retry</button></p>}
    {tab === "create" && <div className="grid gap-4 lg:grid-cols-[minmax(0,1.25fr)_minmax(280px,.75fr)]">
      <section className={`${panel} p-4 sm:p-5`}>
        <div className="mb-4 flex items-center justify-between"><div><h3 className="text-sm font-semibold text-white">Set the scene</h3><p className="mt-1 text-xs text-gray-500">Only generate when you are ready to review a draft.</p></div><button type="button" onClick={suggest} disabled={busy} className={smallButton}><Sparkles size={13} /> Suggest</button></div>
        <label className="mb-3 block text-xs text-gray-400">Conversation topic
          <input value={topic} onChange={event => { setTopic(event.target.value); setSelectedSuggestion(null); }} className={`${field} mt-1`} placeholder="A specific question worth disagreeing about…" />
        </label>
        <div className="mb-3 grid gap-2 sm:grid-cols-[1fr_120px_auto]">
          <input value={searchTerm} onChange={event => setSearchTerm(event.target.value)} onKeyDown={event => event.key === "Enter" && void search()} className={field} placeholder="Find a film, book, album…" aria-label="Search titles" />
          <select value={searchType} onChange={event => setSearchType(event.target.value)} className={field} aria-label="Title type"><option value="all">All types</option>{["movie", "tv", "book", "music", "podcast", "youtube"].map(type => <option key={type}>{type}</option>)}</select>
          <button type="button" onClick={search} disabled={busy || !searchTerm.trim()} className={smallButton}><Search size={14} /> Search</button>
        </div>
        {(searchItems.length > 0 || selectedSubject) && <div className="mb-3 rounded-lg border border-gray-800 bg-gray-950 p-2">
          {selectedSubject && <div className="mb-2 flex items-center justify-between text-xs text-violet-200">Attached: {selectedSubject.title}<button type="button" onClick={() => { setSelectedSubject(null); setSelectedSuggestion(null); }} className="text-gray-500 hover:text-white">Remove</button></div>}
          {searchItems.slice(0, 7).map(item => <button key={item.id} type="button" onClick={() => { setSelectedSubject(item); setSelectedSuggestion(null); setSearchItems([]); }} className="flex w-full items-start justify-between gap-2 rounded-md px-2 py-2 text-left text-xs hover:bg-gray-800"><span className="text-gray-200">{item.title}<span className="ml-2 capitalize text-gray-500">{item.type}</span>{item.creator && <span className="text-gray-500"> · {item.creator}</span>}</span><span className="text-violet-300">Select</span></button>)}
        </div>}
        {suggestions.length > 0 && <div className="mb-3 space-y-1 rounded-lg border border-violet-900/50 bg-violet-950/15 p-2">{suggestions.map(suggestion => <button key={suggestion.id} type="button" onClick={() => { setSelectedSuggestion(suggestion.id); setTopic(suggestion.topic); if (suggestion.subject) setSelectedSubject(suggestion.subject); }} className={`block w-full rounded px-2 py-2 text-left text-xs ${selectedSuggestion === suggestion.id ? "bg-violet-900/40 text-violet-100" : "text-gray-300 hover:bg-gray-800"}`}>{suggestion.topic}{suggestion.subject?.title && <span className="ml-2 text-gray-500">· {suggestion.subject.title}</span>}<span className="ml-2 text-[10px] text-gray-600">{suggestion.provenance ? `Source: ${JSON.stringify(suggestion.provenance)}` : ""}</span></button>)}</div>}
        {coverage.length > 0 && <div className="mb-4 rounded-lg border border-gray-800 bg-gray-950/70 p-3"><p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-gray-500">Source coverage</p><div className="grid gap-2 sm:grid-cols-2">{coverage.map(item => <div key={item.provider} className="text-xs"><span className="text-gray-200">{item.provider}</span><span className={`ml-2 ${item.status === "error" ? "text-red-300" : "text-emerald-300"}`}>{item.status}</span><p className="mt-0.5 text-gray-500">{item.types.join(", ")}{item.fetchedAt ? ` · fetched ${new Date(item.fetchedAt).toLocaleString()}` : ""}{item.error ? ` · ${item.error}` : ""}</p></div>)}</div></div>}
        <label className="mb-3 block text-xs text-gray-400">Angle<input value={angle} onChange={event => setAngle(event.target.value)} className={`${field} mt-1`} placeholder="A tension, question, or perspective to explore" /></label>
        <label className="mb-4 block text-xs text-gray-400">Context<textarea value={context} onChange={event => setContext(event.target.value)} className={`${field} mt-1 min-h-20 resize-y`} placeholder="Optional context or guardrails" /></label>
        <div className="mb-4 grid grid-cols-3 gap-2">
          <label className="text-[11px] text-gray-500">Replies · 2–19<input type="number" min={2} max={19} value={replyCount} onChange={event => setReplyCount(Math.max(2, Math.min(19, Number(event.target.value))))} className={`${field} mt-1`} /></label>
          <label className="text-[11px] text-gray-500">Duration · min<input type="number" min={5} max={10080} value={duration} onChange={event => setDuration(Math.max(5, Math.min(10080, Number(event.target.value))))} className={`${field} mt-1`} /></label>
          <label className="text-[11px] text-gray-500">Max words<input type="number" min={10} max={120} value={maxWords} onChange={event => setMaxWords(Math.max(10, Math.min(120, Number(event.target.value))))} className={`${field} mt-1`} /></label>
        </div>
        <button type="button" onClick={generate} disabled={busy || participants.length < 2 || !topic.trim()} className="inline-flex min-h-10 w-full items-center justify-center gap-2 rounded-lg bg-violet-600 px-4 text-sm font-semibold text-white hover:bg-violet-500 disabled:opacity-40"><Sparkles size={15} /> Generate draft</button>
      </section>
      <section className={`${panel} p-4 sm:p-5`}>
        <div className="mb-1 flex items-center justify-between"><h3 className="text-sm font-semibold text-white">Participants</h3><span className="text-xs tabular-nums text-gray-500">{participants.length}/12 · min 2</span></div>
        <p className="mb-3 text-xs text-gray-500">Tone and interests are derived from saved persona attributes. Gender is never inferred.</p>
        <div className="mb-3 space-y-2">
          <input aria-label="Filter persona name, tone or interests" value={personaFilter} onChange={event => setPersonaFilter(event.target.value)} placeholder="Name, tone or interest…" className={field} />
          <div className="grid grid-cols-2 gap-2">
            <select aria-label="Persona gender filter" value={genderFilter} onChange={event => setGenderFilter(event.target.value)} className={field}>
              <option value="all">Any gender</option><option value="unset">Unset / unknown</option><option value="woman">Woman</option><option value="man">Man</option><option value="nonbinary">Nonbinary</option><option value="other">Other</option>
            </select>
            <select aria-label="Persona energy filter" value={energyFilter} onChange={event => setEnergyFilter(event.target.value)} className={field}>
              <option value="all">Any energy</option>{["restrained", "casual", "enthusiastic", "expressive"].map(value => <option key={value}>{value}</option>)}
            </select>
          </div>
          <p className="text-[10px] text-gray-500">Energy reflects saved social voice or existing tone—not a new personality diagnosis.</p>
        </div>
        <div className="max-h-[440px] space-y-2 overflow-y-auto pr-1">{filteredPersonas.map(persona => {
          const selected = participants.includes(persona.id);
          return <article key={persona.id} className={`rounded-lg border p-3 ${selected ? "border-violet-700/70 bg-violet-950/20" : "border-gray-800 bg-gray-950/50"}`}>
            <div className="flex items-start gap-2"><button type="button" disabled={!selected && participants.length >= 12} onClick={() => toggleParticipant(persona.id)} className="mt-0.5 flex min-w-0 flex-1 items-start gap-2 text-left disabled:cursor-not-allowed disabled:opacity-45"><span className={`mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded border ${selected ? "border-violet-400 bg-violet-500 text-white" : "border-gray-600"}`}>{selected && <Check size={11} />}</span><span className="min-w-0"><span className="block truncate text-sm font-medium text-gray-100">{persona.display_name}</span><span className="text-[11px] text-gray-500">@{persona.user_name}</span></span></button>
              <select aria-label={`Explicit fictional gender for ${persona.display_name}`} disabled={genderBusy === persona.id} value={genderSelections[persona.id] || "unset"} onChange={event => void saveGender(persona.id, event.target.value)} className="max-w-[118px] rounded-md border border-gray-700 bg-gray-950 px-2 py-1.5 text-[10px] text-gray-300"><option value="unset">Gender: unset</option><option value="woman">Woman</option><option value="man">Man</option><option value="nonbinary">Nonbinary</option><option value="other">Other</option></select></div>
            {selected && <div className="ml-6 mt-2 flex flex-wrap gap-1">{voiceNotes(persona).slice(0, 5).map((note, index) => <span key={`${note}-${index}`} className="rounded-full bg-gray-800 px-2 py-1 text-[10px] text-gray-400">{note}</span>)}</div>}
          </article>;
        })}{!filteredPersonas.length && <p className="text-xs text-gray-500">No matching personas.</p>}</div>
        <div className="mt-3 flex flex-wrap gap-1" aria-label="Actual selected roster">{participants.map(id => <button type="button" key={id} onClick={() => toggleParticipant(id)} className="rounded-full border border-violet-800 px-2 py-1 text-xs text-violet-200">{personasById.get(id)?.display_name} ×</button>)}</div>
        <label className="mt-4 block text-xs text-gray-400">Opening author
          <select value={opener} onChange={event => setOpener(event.target.value)} className={`${field} mt-1`}><option value="">Choose a participant…</option>{state.personas.filter(persona => participants.includes(persona.id)).map(persona => <option key={persona.id} value={persona.id}>{persona.display_name}</option>)}</select>
        </label>
      </section>
    </div>}
    {tab === "runs" && <section className={`${panel} overflow-hidden`}>
      <div className="grid divide-y divide-gray-800 lg:grid-cols-[280px_1fr] lg:divide-x lg:divide-y-0">
        <aside className="max-h-[700px] overflow-y-auto p-3">{runs.length === 0 ? <div className="rounded-lg border border-dashed border-gray-700 p-5 text-center text-xs text-gray-500">No conversations yet. Draft one when ready.</div> : runs.map(run => <button key={run.id} type="button" onClick={() => setActiveId(run.id)} className={`mb-1 block w-full rounded-lg p-3 text-left ${run.id === activeId ? "bg-gray-800" : "hover:bg-gray-800/60"}`}><div className="flex items-center justify-between gap-2"><span className="truncate text-sm font-medium text-gray-200">{run.topic || "Untitled thread"}</span><Status status={run.status} /></div><div className="mt-1 text-[10px] text-gray-500">{run.messages.length} messages · rev {run.revision}</div></button>)}</aside>
        <div className="min-w-0 p-4 sm:p-5">{selectedRun ? <RunEditor run={selectedRun} personas={personasById} busy={busy} dirty={dirtyRuns.has(selectedRun.id)} onUpdate={updateMessage} onSave={saveEdits} onAction={doAction} onRegenerate={() => doAction("New revision generated.", "regenerate", { runId: selectedRun.id, revision: selectedRun.revision })} /> : <div className="flex min-h-48 flex-col items-center justify-center text-center"><MessageCircle size={22} className="mb-2 text-gray-600" /><p className="text-sm text-gray-400">Select a conversation to inspect its thread.</p></div>}</div>
      </div>
    </section>}
  </div>;
}

function Status({ status }: { status: string }) {
  const style = status === "approved" || status === "scheduled" ? "bg-emerald-950 text-emerald-300" : status === "rejected" || status === "cancelled" ? "bg-red-950 text-red-300" : status === "paused" ? "bg-amber-950 text-amber-300" : "bg-gray-800 text-gray-300";
  return <span className={`shrink-0 rounded-full px-2 py-1 text-[9px] uppercase tracking-wide ${style}`}>{status}</span>;
}

function RunEditor({ run, personas, busy, dirty, onUpdate, onSave, onAction, onRegenerate }: {
  run: ConversationRun; personas: Map<string, ConversationPersona>; busy: boolean; dirty: boolean;
  onUpdate: (id: string, patch: Partial<ConversationMessage>) => void; onSave: () => void;
  onAction: (label: string, action: string, values?: Record<string, unknown>) => Promise<boolean>; onRegenerate: () => void;
}) {
  const hasDeliveredMessages = run.messages.some(message => Boolean(message.delivered_at));
  const canEdit = ["draft", "approved", "paused"].includes(run.status) && !hasDeliveredMessages;
  const canApprove = run.status === "draft";
  const canSchedule = (run.status === "paused" || run.status === "approved") && run.approved_revision === run.revision;
  const canPause = run.status === "scheduled";
  const canCancel = run.status === "scheduled" || run.status === "paused";
  const [showSchedule, setShowSchedule] = useState(false);
  const [startAt, setStartAt] = useState(run.start_at ? localDateTimeValue(new Date(run.start_at)) : "");
  useEffect(() => {
    setStartAt(run.start_at ? localDateTimeValue(new Date(run.start_at)) : "");
    setShowSchedule(false);
  }, [run.id, run.start_at]);
  const parentOptions = [{ client_id: "", label: "Root message" }, ...run.messages.map(message => ({ client_id: message.client_id, label: (personas.get(message.participant_id)?.display_name || "Persona") + " · " + message.body.slice(0, 42) }))];
  const roleOrder = (message: ConversationMessage, index: number) => message.parent_client_id ? "reply" : index === 0 ? "opening message" : "root message";
  return <div>
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3"><div className="min-w-0"><div className="mb-1 flex items-center gap-2"><Status status={run.status} /><span className="text-[10px] text-gray-500">Revision {run.revision}{run.approved_revision ? ` · approved ${run.approved_revision}` : ""}</span></div><h3 className="text-lg font-semibold text-white">{run.topic}</h3>{run.subject?.title && <p className="mt-1 text-xs text-gray-400">Re: {run.subject.title}{run.subject.type ? ` · ${run.subject.type}` : ""}</p>}<p className="mt-1 text-[10px] text-gray-500">{run.participant_ids.map(id => personas.get(id)?.display_name || "Unknown persona").join(" · ")}</p></div>
      <div className="flex flex-wrap gap-2">{canEdit && <button type="button" onClick={onRegenerate} disabled={busy || dirty} className={smallButton}><RotateCcw size={13} /> Regenerate</button>}{canEdit && <button type="button" onClick={onSave} disabled={busy || !dirty} className={smallButton}><Check size={13} /> Save edits</button>}</div></div>
    {run.provenance != null && <details className="mb-3 rounded-lg border border-gray-800 bg-gray-950/60 p-3"><summary className="cursor-pointer text-[10px] text-gray-500">Generation provenance</summary><pre className="mt-2 whitespace-pre-wrap break-words text-[10px] text-gray-400">{JSON.stringify(run.provenance, null, 2)}</pre></details>}
    {run.last_error && <p role="alert" className="mb-3 rounded-lg border border-red-900/60 bg-red-950/30 p-3 text-xs text-red-300">Run error: {run.last_error}</p>}
    {run.history?.length ? <details className="mb-3 rounded-lg border border-gray-800 bg-gray-950/60 p-3"><summary className="cursor-pointer text-xs text-gray-400">Delivery & action history · {run.history.length}</summary><ol className="mt-3 space-y-2">{run.history.map((item, index) => <li key={`${item.at}-${item.action}-${index}`} className="grid gap-x-3 gap-y-0.5 text-[10px] sm:grid-cols-[130px_90px_1fr]"><time className="text-gray-500">{new Date(item.at).toLocaleString()}</time><span className="font-medium text-gray-300">{item.action}</span><span className={item.error ? "text-red-300" : "text-gray-500"}>{item.error || item.message || "Recorded"}</span></li>)}</ol></details> : null}
    <div className="space-y-3">{run.messages.map((message, index) => <article key={message.client_id} className={`rounded-xl border p-3 ${message.parent_client_id ? "ml-5 border-gray-800 bg-gray-950/40 sm:ml-9" : "border-gray-700 bg-gray-950/70"}`}>
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2"><div className="flex items-center gap-2 text-xs"><span className="rounded-full bg-violet-950/70 px-2 py-1 text-violet-200">{personas.get(message.participant_id)?.display_name || "Unknown participant"}</span><span className="text-gray-600">{roleOrder(message, index)}</span></div><label className="inline-flex items-center gap-1.5 text-[10px] text-gray-500"><Clock3 size={12} /><input type="number" min={0} value={message.offset_seconds} disabled={!canEdit} onChange={event => onUpdate(message.client_id, { offset_seconds: Math.max(0, Number(event.target.value)) })} className="w-20 rounded border border-gray-700 bg-gray-950 px-2 py-1 text-right tabular-nums text-gray-300" /> sec</label></div>
      <div className="mb-2 grid gap-2 sm:grid-cols-2"><label className="text-[10px] text-gray-500">Participant<select disabled={!canEdit} value={message.participant_id} onChange={event => onUpdate(message.client_id, { participant_id: event.target.value })} className={`${field} mt-1 py-1.5 text-xs`}>{run.participant_ids.map(id => <option key={id} value={id}>{personas.get(id)?.display_name || "Unknown"}</option>)}</select></label><label className="text-[10px] text-gray-500">Reply to<select disabled={!canEdit} value={message.parent_client_id || ""} onChange={event => onUpdate(message.client_id, { parent_client_id: event.target.value || null })} className={`${field} mt-1 py-1.5 text-xs`}>{parentOptions.filter(item => item.client_id !== message.client_id).map(item => <option key={item.client_id || "root"} value={item.client_id}>{item.label}</option>)}</select></label></div>
      <textarea disabled={!canEdit} value={message.body} onChange={event => onUpdate(message.client_id, { body: event.target.value })} className={`${field} min-h-[78px] resize-y leading-relaxed`} aria-label={`Message content ${index + 1}`} />
      <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-[10px] text-gray-500"><span>Delivery: {message.delivered_at ? new Date(message.delivered_at).toLocaleString() : "Not delivered"}</span>{message.public_id && <span>Public ID: {message.public_id}</span>}{message.error && <span className="text-red-300">Error: {message.error}</span>}</div>
    </article>)}</div>
    <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-gray-800 pt-4">
      {canApprove && <button type="button" onClick={() => void onAction("Approved revision.", "approve", { runId: run.id, revision: run.revision })} disabled={busy || dirty} className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-700 px-3 py-2 text-xs font-semibold text-white hover:bg-emerald-600 disabled:opacity-40"><Check size={13} /> Approve revision</button>}
      {run.status === "draft" && <button type="button" onClick={() => void onAction("Conversation rejected.", "reject", { runId: run.id, revision: run.revision })} disabled={busy || dirty} className={smallButton}><X size={13} /> Reject</button>}
      {canSchedule && <button type="button" disabled={dirty} onClick={() => setShowSchedule(value => !value)} className={smallButton}><CalendarClock size={13} /> Schedule approved conversation</button>}
      {canPause && <button type="button" onClick={() => void onAction("Schedule paused.", "pause", { runId: run.id, revision: run.revision })} disabled={busy} className={smallButton}><CirclePause size={13} /> Pause schedule</button>}
      {canCancel && <button type="button" onClick={() => void onAction("Schedule cancelled.", "cancel", { runId: run.id, revision: run.revision })} disabled={busy} className={smallButton}><X size={13} /> Cancel schedule</button>}
      {showSchedule && canSchedule && <div className="flex w-full flex-wrap items-end gap-2 rounded-lg border border-gray-800 bg-gray-950 p-3"><label className="min-w-[220px] flex-1 text-[10px] text-gray-500">Future start date & time<input type="datetime-local" min={localDateTimeValue(new Date())} value={startAt} onChange={event => setStartAt(event.target.value)} className={`${field} mt-1`} /></label><button type="button" disabled={busy || dirty || !startAt || new Date(startAt).getTime() <= Date.now()} onClick={() => void onAction(run.status === "paused" ? "Schedule resumed." : "Approved conversation scheduled.", "schedule", { runId: run.id, revision: run.revision, startAt: new Date(startAt).toISOString() })} className="inline-flex items-center gap-1.5 rounded-lg bg-violet-600 px-3 py-2 text-xs font-semibold text-white disabled:opacity-40"><CalendarClock size={13} />{run.status === "paused" ? "Resume schedule" : "Schedule conversation"}</button></div>}
      {run.start_at && ["scheduled", "paused"].includes(run.status) && <span className="ml-auto inline-flex items-center gap-1 text-[10px] text-gray-500"><CalendarClock size={12} />{new Date(run.start_at).toLocaleString()}</span>}
    </div>
    <p className="mt-3 text-[10px] leading-relaxed text-gray-600">{hasDeliveredMessages ? "This thread has delivered messages; content editing and regeneration are locked." : "Save edits before approval. Approval and scheduling are separate, explicit actions."}{run.status === "paused" && hasDeliveredMessages ? " You can still choose a new future time to resume." : ""}</p>
  </div>;
}

export default function PersonaConversationControls() {
  const [state, setState] = useState<ConversationState>({ personas: [], runs: [] });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const refresh = useCallback(async () => {
    setError("");
    try {
      const { data, error: invokeError } = await supabase.functions.invoke("admin-persona-conversations", { body: { action: "state" } });
      if (invokeError) throw invokeError;
      if (data?.error) throw new Error(data.error);
      setState({ personas: data.personas || [], runs: data.runs || [] });
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Conversation state could not be loaded."); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { void refresh(); }, [refresh]);
  return <section className="mb-6 rounded-2xl border border-violet-900/40 bg-gradient-to-br from-violet-950/20 via-gray-900 to-gray-900 p-4 sm:p-6">
    {loading && <div className="mb-3 flex items-center gap-2 text-xs text-gray-500"><Loader2 size={13} className="animate-spin" />Loading conversation studio…</div>}
    <ConversationWorkspaceView state={state} loading={loading} error={error} showSnapshots={false} onRefresh={() => { setLoading(true); void refresh(); }} />
    <div className="mt-5 border-t border-gray-800 pt-5"><ConversationStudio state={state} /></div>
  </section>;
}
