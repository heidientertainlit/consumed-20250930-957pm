import { useEffect, useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { AlertCircle, Check, ChevronDown, ChevronUp, FlaskConical, Loader2, Save, Settings2, SlidersHorizontal } from "lucide-react";
import {
  DEFAULT_MODE_WEIGHTS,
  deriveSocialVoice,
  POST_MODES,
  validateModeWeights,
  VOICE_OPTIONS,
  type ModeWeights,
  type PersonaConfig,
  type SocialVoice,
} from "../../../../supabase/functions/_shared/persona-generation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase, SUPABASE_URL } from "@/lib/supabase";

type PersonaOption = {
  id: string;
  display_name: string;
  persona_config: PersonaConfig | null;
};

type DryRunDraft = Record<string, unknown> & {
  content?: string;
  post_type?: string;
  rating?: number | null;
  media_title?: string | null;
  media_type?: string | null;
  personaId?: string;
  persona_id?: string;
  persona_user_id?: string;
  persona_display_name?: string;
  persona?: { display_name?: string; user_name?: string };
  media?: { title?: string; type?: string };
  mediaTitle?: string;
  generation?: unknown;
  generationMeta?: unknown;
  ai_notes?: string;
};

type DryRunResult = {
  generated: number;
  drafts: DryRunDraft[];
  errors?: string[];
  dryRun: true;
};

type GeneratorCapabilities = {
  dryRun: boolean;
  generationVersion: number;
};

type Props = {
  personas: PersonaOption[];
  selectedPersonaIds: string[];
  postsPerPersona: number;
  useTrending: boolean;
};

const cardClass = "rounded-xl border border-gray-800 bg-gray-900/80";
const fieldClass = "w-full rounded-md border border-gray-700 bg-gray-950 px-2.5 py-2 text-xs text-gray-100 focus:border-purple-500 focus:outline-none";

async function invokeGenerator(body: Record<string, unknown>) {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.access_token) throw new Error("Your admin session has expired. Sign in again to continue.");
  const response = await fetch(`${SUPABASE_URL}/functions/v1/generate-persona-content`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${session.access_token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
  const result = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(result.error || `Generator request failed (${response.status})`);
  if (result?.error) throw new Error(result.error);
  return result;
}

function labelize(value: string) {
  return value.replace(/([A-Z])/g, " $1").replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase());
}

export default function PersonaGenerationControls({ personas, selectedPersonaIds, postsPerPersona, useTrending }: Props) {
  const queryClient = useQueryClient();
  const [weights, setWeights] = useState<ModeWeights>(DEFAULT_MODE_WEIGHTS);
  const [capabilities, setCapabilities] = useState<GeneratorCapabilities | null>(null);
  const [settingsLoading, setSettingsLoading] = useState(true);
  const [settingsSaving, setSettingsSaving] = useState(false);
  const [settingsError, setSettingsError] = useState("");
  const [settingsMessage, setSettingsMessage] = useState("");
  const [voicePersonaId, setVoicePersonaId] = useState("");
  const [voice, setVoice] = useState<SocialVoice | null>(null);
  const [voiceSaving, setVoiceSaving] = useState(false);
  const [voiceError, setVoiceError] = useState("");
  const [voiceMessage, setVoiceMessage] = useState("");
  const [dryRunLoading, setDryRunLoading] = useState(false);
  const [dryRunError, setDryRunError] = useState("");
  const [dryRunResult, setDryRunResult] = useState<DryRunResult | null>(null);
  const [showSettings, setShowSettings] = useState(false);

  const totalWeight = useMemo(() => Object.values(weights).reduce((sum, n) => sum + n, 0), [weights]);
  const selectedVoicePersona = personas.find(persona => persona.id === voicePersonaId);

  useEffect(() => {
    let cancelled = false;
    const loadSettings = async () => {
      setSettingsLoading(true);
      setSettingsError("");
      try {
        const result = await invokeGenerator({ action: "settings" });
        const validated = validateModeWeights(result.weights);
        if (!cancelled) {
          setWeights(validated);
          setCapabilities(result.capabilities && typeof result.capabilities.dryRun === "boolean"
            ? result.capabilities as GeneratorCapabilities
            : null);
        }
      } catch (error) {
        if (!cancelled) {
          setSettingsError(error instanceof Error
            ? `${error.message} Generation settings are unavailable until the settings action is deployed.`
            : "Could not load generation settings. The settings action may not be deployed yet.");
        }
      } finally {
        if (!cancelled) setSettingsLoading(false);
      }
    };
    void loadSettings();
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    if (!voicePersonaId) {
      setVoice(null);
      return;
    }
    const persona = personas.find(item => item.id === voicePersonaId);
    if (!persona) return;
    try {
      setVoice(deriveSocialVoice(persona.persona_config || {}));
      setVoiceError("");
      setVoiceMessage("");
    } catch (error) {
      setVoice(null);
      setVoiceError(error instanceof Error ? error.message : "This persona's saved voice settings are invalid.");
    }
  }, [voicePersonaId, personas]);

  const updateWeight = (mode: keyof ModeWeights, value: string) => {
    const numeric = value === "" ? 0 : Number(value);
    setWeights(previous => ({ ...previous, [mode]: Number.isFinite(numeric) ? Math.min(100, Math.max(0, numeric)) : 0 }));
    setSettingsMessage("");
  };

  const saveWeights = async () => {
    setSettingsSaving(true);
    setSettingsError("");
    setSettingsMessage("");
    try {
      const validated = validateModeWeights(weights);
      await invokeGenerator({ action: "save-settings", weights: validated });
      setWeights(validated);
      setSettingsMessage("Mode weights saved.");
    } catch (error) {
      setSettingsError(error instanceof Error ? error.message : "Could not save mode weights.");
    } finally {
      setSettingsSaving(false);
    }
  };

  const saveVoice = async () => {
    if (!voice || !selectedVoicePersona) return;
    setVoiceSaving(true);
    setVoiceError("");
    setVoiceMessage("");
    try {
      await invokeGenerator({ action: "save-voice", personaId: selectedVoicePersona.id, voice });
      await queryClient.invalidateQueries({ queryKey: ["admin-personas"] });
      setVoiceMessage(`Voice saved for ${selectedVoicePersona.display_name}.`);
    } catch (error) {
      setVoiceError(error instanceof Error ? error.message : "Could not save this persona's voice.");
    } finally {
      setVoiceSaving(false);
    }
  };

  const runDryRun = async () => {
    if (settingsLoading || !capabilities?.dryRun || capabilities.generationVersion !== 1) {
      setDryRunError("Dry-run preview is unavailable until generator capability version 1 is confirmed.");
      return;
    }
    if (selectedPersonaIds.length === 0) {
      setDryRunError("Select at least one persona before previewing.");
      return;
    }
    setDryRunLoading(true);
    setDryRunError("");
    setDryRunResult(null);
    try {
      const result = await invokeGenerator({
        action: "dry-run",
        previewPersonaIds: selectedPersonaIds,
        previewPostsPerPersona: postsPerPersona,
        useTrending,
      });
      if (result.dryRun !== true || !Array.isArray(result.drafts)) {
        throw new Error(result.error || "The generator did not return a valid dry-run preview.");
      }
      setDryRunResult(result as DryRunResult);
    } catch (error) {
      setDryRunError(error instanceof Error ? error.message : "Dry run failed.");
    } finally {
      setDryRunLoading(false);
    }
  };

  const updateVoiceField = <K extends keyof typeof VOICE_OPTIONS>(key: K, value: SocialVoice[K]) => {
    setVoice(current => current ? { ...current, [key]: value } : current);
    setVoiceMessage("");
  };
  const updateVoiceWeight = (mode: keyof ModeWeights, value: string) => {
    const numeric = value === "" ? 0 : Number(value);
    setVoice(current => current ? {
      ...current,
      preferredModeWeights: {
        ...current.preferredModeWeights,
        [mode]: Number.isFinite(numeric) ? Math.max(0, Math.min(100, numeric)) : 0,
      },
    } : current);
    setVoiceMessage("");
  };

  return (
    <div className="mt-5 space-y-3 border-t border-gray-800 pt-4">
      <div className="flex flex-wrap items-center gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={runDryRun}
          disabled={dryRunLoading || settingsLoading || !capabilities?.dryRun || capabilities.generationVersion !== 1 || selectedPersonaIds.length === 0}
          className="border-purple-700/70 bg-purple-950/40 text-purple-200 hover:bg-purple-900/50"
        >
          {dryRunLoading ? <Loader2 size={14} className="mr-2 animate-spin" /> : <FlaskConical size={14} className="mr-2" />}
          {dryRunLoading ? "Previewing…" : "Dry-run preview"}
        </Button>
        <button
          type="button"
          onClick={() => setShowSettings(value => !value)}
          className="inline-flex min-h-9 items-center gap-2 rounded-md px-2.5 text-xs text-gray-400 hover:bg-gray-800 hover:text-gray-100"
          aria-expanded={showSettings}
        >
          <Settings2 size={14} />
          Tuning controls
          {showSettings ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
        </button>
        <span className="ml-auto text-[11px] text-gray-500">
          {settingsLoading ? "Checking preview support…" : capabilities?.dryRun && capabilities.generationVersion === 1 ? "Preview does not create drafts" : "Preview unavailable"}
        </span>
      </div>
      {!settingsLoading && (!capabilities?.dryRun || capabilities.generationVersion !== 1) && (
        <p role="status" className="rounded-md border border-amber-900/50 bg-amber-950/20 px-3 py-2 text-[11px] text-amber-200">
          Dry-run is disabled until the generator confirms capability version 1. Preview requests will not be sent.
        </p>
      )}

      {dryRunError && (
        <p role="alert" className="flex items-start gap-2 rounded-lg border border-red-900/70 bg-red-950/30 px-3 py-2 text-xs text-red-300">
          <AlertCircle size={14} className="mt-0.5 shrink-0" />{dryRunError}
        </p>
      )}

      {dryRunResult && (
        <section className={`${cardClass} overflow-hidden`} aria-live="polite">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-gray-800 px-4 py-3">
            <div>
              <p className="text-sm font-medium text-gray-100">Preview results</p>
              <p className="text-xs text-gray-500">{dryRunResult.generated} generated · not persisted</p>
            </div>
            <button type="button" onClick={() => setDryRunResult(null)} className="text-xs text-gray-500 hover:text-gray-200">Dismiss</button>
          </div>
          {dryRunResult.errors?.length ? (
            <div className="border-b border-amber-900/50 bg-amber-950/20 px-4 py-3 text-xs text-amber-200">
              <p className="mb-1 font-medium">Some previews could not be generated</p>
              <ul className="list-inside list-disc space-y-1">{dryRunResult.errors.map((error, index) => <li key={`${index}-${error}`}>{error}</li>)}</ul>
            </div>
          ) : null}
          <div className="divide-y divide-gray-800">
            {dryRunResult.drafts.map((draft, index) => {
              const generation = (draft.generation || draft.generationMeta || draft.meta || draft.debug || {}) as Record<string, unknown>;
              const voiceMeta = (generation.voice && typeof generation.voice === "object" ? generation.voice : {}) as Record<string, unknown>;
              const persona = draft.persona?.display_name
                || draft.persona_display_name
                || personas.find(item => item.id === (draft.personaId || draft.persona_id || draft.persona_user_id))?.display_name
                || "Persona";
              const mode = String(generation.modeLabel || generation.mode || draft.post_type || "—");
              const media = String(draft.media_title || draft.mediaTitle || draft.media?.title || draft.title || "—");
              const rating = draft.rating == null ? "—" : `${draft.rating}/5`;
              return (
                <article key={`${index}-${String(draft.personaId || draft.persona_id || "")}`} className="p-4">
                  <div className="mb-2 grid grid-cols-2 gap-x-3 gap-y-1 text-xs sm:grid-cols-4">
                    <div><span className="text-gray-500">Persona</span><p className="mt-0.5 text-gray-200">{persona}</p></div>
                    <div><span className="text-gray-500">Media</span><p className="mt-0.5 text-gray-200">{media}</p></div>
                    <div><span className="text-gray-500">Mode</span><p className="mt-0.5 text-purple-200">{mode}</p></div>
                    <div><span className="text-gray-500">Rating</span><p className="mt-0.5 text-gray-200">{rating}</p></div>
                  </div>
                  <p className="whitespace-pre-wrap text-sm leading-relaxed text-gray-100">{String(draft.content || "(empty content)")}</p>
                  <details className="mt-3">
                    <summary className="cursor-pointer text-[11px] text-gray-500 hover:text-gray-300">Generation debug metadata</summary>
                    <p className="mt-2 text-[11px] text-gray-400">
                      Recently used: {generation.recentlyUsed === true ? "Yes" : generation.recentlyUsed === false ? "No" : "—"}
                      {Object.keys(voiceMeta).length > 0 && (
                        <> · Voice: {String(voiceMeta.length || "—")}, {String(voiceMeta.energy || "—")}, {String(voiceMeta.capitalization || "—")} capitalization, ratings {String(voiceMeta.ratingFrequency || "—")}, questions {String(voiceMeta.questionFrequency || "—")}, sarcasm {String(voiceMeta.sarcasm || "—")}</>
                      )}
                    </p>
                    <pre className="mt-2 max-h-64 overflow-auto whitespace-pre-wrap break-words rounded-md bg-gray-950 p-3 font-mono text-[10px] leading-relaxed text-gray-400">
                      {JSON.stringify(generation, null, 2)}
                    </pre>
                  </details>
                </article>
              );
            })}
            {dryRunResult.drafts.length === 0 && !dryRunResult.errors?.length && (
              <p className="px-4 py-6 text-center text-xs text-gray-500">No preview drafts were returned.</p>
            )}
          </div>
        </section>
      )}

      {showSettings && (
        <div className="grid gap-3 lg:grid-cols-2">
          <section className={`${cardClass} p-4`}>
            <div className="mb-3 flex items-start justify-between gap-2">
              <div className="flex items-center gap-2">
                <SlidersHorizontal size={15} className="text-purple-300" />
                <div>
                  <h3 className="text-sm font-medium text-gray-100">Global mode mix</h3>
                  <p className="text-[11px] text-gray-500">Weights are relative; share is normalized.</p>
                </div>
              </div>
              <span className="rounded-full bg-gray-800 px-2 py-1 text-[10px] text-gray-400">{totalWeight ? `${totalWeight.toFixed(1)} total` : "0 total"}</span>
            </div>
            {settingsLoading ? (
              <div className="space-y-2" aria-label="Loading generation settings">
                {POST_MODES.slice(0, 5).map(mode => <div key={mode.id} className="h-9 animate-pulse rounded bg-gray-800/70" />)}
              </div>
            ) : (
              <>
                <div className="space-y-1.5">
                  {POST_MODES.map(mode => (
                    <label key={mode.id} className="grid grid-cols-[minmax(0,1fr)_74px_48px] items-center gap-2 rounded-md bg-gray-950/70 px-2.5 py-1.5">
                      <span className="min-w-0 truncate text-xs text-gray-300" title={mode.description}>{mode.label}</span>
                      <Input
                        type="number"
                        min="0"
                        max="100"
                        step="0.5"
                        value={weights[mode.id]}
                        onChange={event => updateWeight(mode.id, event.target.value)}
                        aria-label={`${mode.label} weight`}
                        className="h-7 border-gray-700 bg-gray-900 px-2 text-right text-xs text-white"
                      />
                      <span className="text-right text-[10px] tabular-nums text-gray-500">
                        {totalWeight ? `${(weights[mode.id] / totalWeight * 100).toFixed(1)}%` : "0%"}
                      </span>
                    </label>
                  ))}
                </div>
                <div className="mt-3 flex items-center justify-between gap-2">
                  <div className="min-h-5 text-[11px]">
                    {settingsError && <span role="alert" className="text-red-300">{settingsError}</span>}
                    {settingsMessage && <span className="text-emerald-300">{settingsMessage}</span>}
                  </div>
                  <Button size="sm" onClick={saveWeights} disabled={settingsSaving || settingsLoading} className="shrink-0 bg-purple-700 text-white hover:bg-purple-600">
                    {settingsSaving ? <Loader2 size={13} className="mr-1.5 animate-spin" /> : <Save size={13} className="mr-1.5" />}
                    Save weights
                  </Button>
                </div>
              </>
            )}
          </section>

          <section className={`${cardClass} p-4`}>
            <div className="mb-3">
              <h3 className="text-sm font-medium text-gray-100">Persona voice</h3>
              <p className="text-[11px] text-gray-500">Adjust delivery preferences without replacing persona identity.</p>
            </div>
            <label className="mb-3 block text-[11px] text-gray-500">
              Choose persona
              <select value={voicePersonaId} onChange={event => setVoicePersonaId(event.target.value)} className={`${fieldClass} mt-1`}>
                <option value="">Select a persona…</option>
                {personas.map(persona => <option key={persona.id} value={persona.id}>{persona.display_name}</option>)}
              </select>
            </label>
            {voice && (
              <>
                <div className="grid grid-cols-2 gap-2">
                  {(Object.keys(VOICE_OPTIONS) as Array<keyof typeof VOICE_OPTIONS>).map(key => (
                    <label key={key} className="text-[10px] capitalize text-gray-500">
                      {labelize(key)}
                      <select
                        value={voice[key]}
                        onChange={event => updateVoiceField(key, event.target.value as SocialVoice[typeof key])}
                        className={`${fieldClass} mt-1 capitalize`}
                      >
                        {VOICE_OPTIONS[key].map(option => <option key={option} value={option}>{labelize(option)}</option>)}
                      </select>
                    </label>
                  ))}
                </div>
                <details className="mt-3">
                  <summary className="cursor-pointer text-xs text-gray-400 hover:text-gray-200">Preferred mode multipliers</summary>
                  <div className="mt-2 grid grid-cols-2 gap-2">
                    {POST_MODES.map(mode => (
                      <label key={mode.id} className="text-[10px] text-gray-500">
                        {mode.label}
                        <Input
                          type="number"
                          min="0"
                          max="100"
                          step="0.1"
                          value={voice.preferredModeWeights[mode.id]}
                          onChange={event => updateVoiceWeight(mode.id, event.target.value)}
                          className="mt-1 h-8 border-gray-700 bg-gray-950 text-xs text-white"
                        />
                      </label>
                    ))}
                  </div>
                </details>
                <div className="mt-3 flex items-center justify-between gap-2">
                  <div className="min-h-5 text-[11px]">
                    {voiceError && <span role="alert" className="text-red-300">{voiceError}</span>}
                    {voiceMessage && <span className="text-emerald-300">{voiceMessage}</span>}
                  </div>
                  <Button size="sm" onClick={saveVoice} disabled={voiceSaving} className="shrink-0 bg-purple-700 text-white hover:bg-purple-600">
                    {voiceSaving ? <Loader2 size={13} className="mr-1.5 animate-spin" /> : <Check size={13} className="mr-1.5" />}
                    Save voice
                  </Button>
                </div>
              </>
            )}
            {!voice && !voiceError && <p className="rounded-md bg-gray-950/70 px-3 py-4 text-xs text-gray-500">Select a persona to view its derived voice settings.</p>}
            {voiceError && !voice && <p role="alert" className="rounded-md border border-red-900/60 bg-red-950/30 p-3 text-xs text-red-300">{voiceError}</p>}
          </section>
        </div>
      )}
    </div>
  );
}