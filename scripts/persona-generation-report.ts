import { parseGenerationNotes, POST_MODES, DEFAULT_MODE_WEIGHTS } from "../supabase/functions/_shared/persona-generation.ts";
import { POST_INTENTS, DEFAULT_INTENT_WEIGHTS } from "../supabase/functions/_shared/persona-post-intents.ts";
import type { MediaResolutionDebug } from "../supabase/functions/_shared/persona-media-candidates.ts";

type Draft = {
  persona_display_name: string; media_title: string; media_type: string; media_creator?: string | null;
  content: string; rating: number | null; ai_notes: string;
};
const escape = (value: unknown) => String(value ?? "").replace(/[&<>"']/g, c =>
  ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!));

/** Presentation only: never edits, sorts, grades or regenerates the batch. */
export function renderPersonaReport(options: {
  drafts: Draft[]; errors: string[]; personaCount: number;
  previousModeCounts?: Record<string, number> | null;
  reportTitle?: string;
  writerOutputs?: { persona: string; raw: string }[];
  mediaResolutionDebug?: MediaResolutionDebug[];
  favoriteIdentityChecks?: { persona: string; expected: { title: string; type: string; creator: string }; verified: boolean; resolved: unknown; purpose: string }[];
}): string {
  const { drafts, errors, personaCount, previousModeCounts } = options;
  const title = options.reportTitle || "Persona author-style batch";
  const cards = drafts.map((draft, i) => {
    const meta = parseGenerationNotes(draft.ai_notes);
    if (!meta) throw new Error(`Post ${i + 1} has no valid generation metadata`);
    const repairs = (meta.emojiRepairs || []).map(repair => `<details class="repair">
      <summary>Emoji-only repair — original writer text</summary>
      <pre>${escape(repair.original)}</pre>
      <p>Removed: ${escape(repair.removed.join(" "))}. All non-emoji text, including whitespace, is unchanged.</p>
    </details>`).join("");
    return `<article id="post-${i + 1}">
      <header><strong>Post ${i + 1}</strong><span class="identity">${escape(draft.persona_display_name)}</span></header>
      <div class="media">${escape(draft.media_title)}${draft.media_creator ? ` — ${escape(draft.media_creator)}` : ""} · ${escape(draft.media_type)} · Rating: ${draft.rating === null ? "None" : escape(`${draft.rating}/5`)}</div>
      <div class="planning"><strong>Persona:</strong> ${escape(draft.persona_display_name)}<br>
        <strong>Media:</strong> ${escape(draft.media_title)}${draft.media_creator ? ` — ${escape(draft.media_creator)}` : ""} · ${escape(draft.media_type)}<br>
        <strong>Intent:</strong> ${escape(meta.intentLabel)} · <strong>Mode:</strong> ${escape(meta.modeLabel)}<br>
        <strong>State:</strong> ${escape(meta.consumption?.state.replace(/_/g, " "))} (${escape(meta.consumption?.source)}) · ${escape(meta.mediaSource)}
      </div>
      <blockquote>${draft.content ? escape(draft.content) : "<i>Rating only — no text</i>"}</blockquote>
      ${meta.warnings.length ? `<ul class="warnings">${meta.warnings.map(w => `<li>${escape(w)}</li>`).join("")}</ul>` : ""}
      ${repairs}
      <details class="debug"><summary>Generation metadata — not a voice-quality score</summary><pre>${escape(JSON.stringify(meta, null, 2))}</pre></details>
    </article>`;
  }).join("");
  const modeTable = POST_MODES.map(({ id, label }) => {
    const count = drafts.filter(d => parseGenerationNotes(d.ai_notes)?.mode === id).length;
    return `<tr><td>${escape(label)}</td><td>${DEFAULT_MODE_WEIGHTS[id]}</td>${previousModeCounts ? `<td>${previousModeCounts[id]}</td>` : ""}<td>${count} (${drafts.length ? Math.round(count / drafts.length * 100) : 0}%)</td></tr>`;
  }).join("");
  const intentTable = POST_INTENTS.map(({ id, label }) => {
    const count = drafts.filter(d => parseGenerationNotes(d.ai_notes)?.intent === id).length;
    return `<tr><td>${escape(label)}</td><td>${DEFAULT_INTENT_WEIGHTS[id]}</td><td>${count} (${drafts.length ? Math.round(count / drafts.length * 100) : 0}%)</td></tr>`;
  }).join("");
  const warnings = drafts.flatMap((d, i) => (parseGenerationNotes(d.ai_notes)?.warnings || []).map(w => `Post ${i + 1}: ${w}`));
  const repairs = drafts.flatMap((d, i) => (parseGenerationNotes(d.ai_notes)?.emojiRepairs || []).map(r => ({ post: i + 1, ...r })));
  return `<!doctype html><html lang="en"><head><meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>Consumed — ${escape(title)}</title>
  <style>
    *{box-sizing:border-box}body{margin:0;background:#0a0e18;color:#edf0f9;font:16px/1.65 system-ui;padding:28px}
    main{max-width:900px;margin:auto}h1{font-size:30px;line-height:1.2}h2{font-size:21px}
    .note,.media{color:#b1b8cd}.media{font-size:14px}.stats{padding:12px 16px;background:#241a40;border-radius:10px}
    .controls{position:sticky;top:0;padding:12px 0;background:#0a0e18;z-index:1}
    button{font:inherit;font-size:14px;color:#fff;background:#6841b5;border:1px solid #ad8def;border-radius:8px;padding:10px 16px;cursor:pointer}
    .grid{display:grid;gap:18px;margin:18px 0 32px}article{padding:22px;border:1px solid #2d354b;background:#141b2b;border-radius:12px}
    article header{display:flex;gap:16px;justify-content:space-between;margin-bottom:6px}.identity{color:#cfb4ff}
    .planning{margin-top:10px;font-size:13px;color:#b1b8cd}blockquote{margin:18px 0;white-space:pre-wrap;font-size:17px}
    summary{font-size:13px;color:#cfb4ff;cursor:pointer}pre{font-size:12px;white-space:pre-wrap;overflow-wrap:anywhere}
    .warnings{font-size:13px;color:#e1c791}.repair{margin:12px 0}.repair p{font-size:13px;color:#b1b8cd}
    body.blind .identity,body.blind .planning,body.blind .debug{display:none}
    section{margin:28px 0}table{width:100%;border-collapse:collapse;font-size:13px}th,td{text-align:left;padding:8px;border-bottom:1px solid #2d354b}th{color:#cfb4ff}
    @media(max-width:480px){body{padding:16px}h1{font-size:26px}article{padding:18px}th,td{padding:6px 4px;font-size:11px}}
  </style></head><body class="blind"><main>
    <h1>${escape(title)}</h1>
    <p class="note">${drafts.length} actual AI-generated posts across ${personaCount} fictional personas. Local-only: no database post saves, scheduling, publishing or deployment.</p>
    <p class="note">Names and planning labels are hidden initially. Read the posts before checking their assignments. Generation order is preserved; no hand-editing, selection of better outputs or profile retuning. The only automatic style edit is the approved emoji-only repair, disclosed with its original text when it occurs.</p>
    <div class="stats">${errors.length ? escape(errors.join("; ")) : "No generation errors."}</div>
    <div class="controls"><button id="toggle" type="button" aria-pressed="false">Reveal personas &amp; planning details</button></div>
    <div class="grid">${cards}</div>
    <section><h2>Reading questions</h2><ol>
      <li>Did making the writer less instructed make the people sound more human?</li><li>Do they have genuinely different reasons for posting?</li>
      <li>Does the writing still fall back into one shared AI/entertainment-copy voice?</li>
      <li>Are the personas distinct without exaggerated characters or repetitive gimmicks?</li>
    </ol><p class="note">Different metadata is not evidence of success. Ordinary posts need not strongly reveal their author.</p></section>
    <section><h2>Intent distribution</h2><table><thead><tr><th>Intent</th><th>Base weight</th><th>This batch</th></tr></thead><tbody>${intentTable}</tbody></table>
      <p class="note">These are assigned intents, not an independent classification of the prose. Weights are unchanged; eligibility and existing soft penalties apply. No quotas.</p></section>
    <section><h2>Mode distribution</h2><table><thead><tr><th>Mode</th><th>Base weight</th>${previousModeCounts ? "<th>Previous batch</th>" : ""}<th>This batch</th></tr></thead><tbody>${modeTable}</tbody></table>
      <p class="note">Fresh random media/intent/mode assignments, not a paired experiment or quality score.</p></section>
    <section><h2>Validation/style warnings</h2>${warnings.length ? `<ul>${warnings.map(w => `<li>${escape(w)}</li>`).join("")}</ul>` : "<p>No validation or style warnings.</p>"}
      <h2>Emoji repairs</h2><p>${repairs.length} emoji-only repair(s). Original and repaired text are preserved in the JSON; any repairs are also disclosed beside their posts.</p></section>
    ${options.writerOutputs ? `<section class="debug"><h2>Raw writer responses — including retries</h2>
      <p>${options.writerOutputs.length} writer response(s) for ${drafts.length} accepted posts. This includes attempts rejected by the unchanged validation pipeline. The JSON also retains the exact writer prompts. No typed-thought scorer, style validator or extra generation pass was added.</p>
      ${options.writerOutputs.map((w, i) => `<details><summary>Response ${i + 1} — ${escape(w.persona)}</summary><pre>${escape(w.raw)}</pre></details>`).join("")}</section>` : ""}
    ${options.mediaResolutionDebug ? `<section class="debug"><h2>Known-favorite identity verification</h2>
      <p>Diagnostic-only lookups do not insert candidates or force assignments. Expected creators are trusted identity hints, not model-suggested artists. Failed verification rejects the work; no title-only fallback.</p>
      <pre>${escape(JSON.stringify(options.favoriteIdentityChecks || [], null, 2))}</pre>
      <details><summary>All provider-resolution results and cache identities</summary><pre>${escape(JSON.stringify(options.mediaResolutionDebug, null, 2))}</pre></details></section>` : ""}
    <p class="note">Checked-in persona definitions and curated author profiles; no live history, configuration or overrides queried. Consumption states are broad fictional assignments. Specific facts use supplied provider context. The illustrative approval samples are not generation examples.</p>
  </main><script>
    document.getElementById('toggle').addEventListener('click',function(){
      const hidden=document.body.classList.toggle('blind');
      this.textContent=hidden?'Reveal personas & planning details':'Hide personas & planning details';
      this.setAttribute('aria-pressed',String(!hidden));
    });
  </script></body></html>`;
}