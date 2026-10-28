import type { LabWork } from "../../../shared/recommendation-lab.ts";
import type { LabStore } from "./recommendation-lab-models.ts";
import { sameWork } from "./recommendation-lab-ranking.ts";
import { similarityIdentity, similarityKey } from "../../../shared/media-similarity.ts";

// The model and instructions used by the saved "List B" experiment.
export const B_MODEL = "gpt-4.1-2025-04-14";
export const B_RESERVATION_USD = 0.12;
export const B_SYSTEM_PROMPT = `You are making holistic entertainment recommendations, not matching labels.
Question: If someone loved the experience of consuming SOURCE, which of these supplied legitimate candidates are they most likely to enjoy?
Consider the overall experience, voice/humor, relationships, intensity/warmth, community/world, consumability and payoff where you have a basis. Same plot/genre/setting is not sufficient, but meaningful differences are not automatic disqualifiers. No required experimental dimensions or scoring formula.
Select and rank ONLY supplied candidate IDs. Never invent a work, introduce outside title names, or substitute an edition. Recommend zero to eight. Do not fill slots with weak matches. It is valid to reject a provider recommendation or abstain completely.
Use factual catalog context and provenance provided. No experimental profile labels are supplied. Catalog descriptions are marketing/premise evidence, not measured audience effects. Provider rank is a discovery signal, not proof of fit.
You MAY use prior familiarity for nuanced judgment, but mark that basis model_familiarity, not catalog evidence. Mark predictive/subjective connections as inference. Never claim factual evidence proves chemistry, comfort, attachment, pace or payoff when it does not. Do not invent plot/production facts or audience research.
For each recommendation give canonical candidate ID, rank, recommend=true, concise reason, important difference/caveat, self-rated confidence (not a calibrated probability), and evidence_used with work_id, field and basis. Include up to three strongest considered rejections with recommend=false and rank=0, the same fields, and an honest reason. Unselected candidates need not all be rejected explicitly.
All IDs and evidence work_ids must be from this packet. Cross-media candidates must be judged as entertainment alternatives, not merely commentary, advice, explainers or soundtrack tie-ins. If retrieval supplies weak possibilities, do not manufacture a strong list.
Return JSON matching the enforced schema, no prose outside it.`;

const fields = ["synopsis", "genres", "keywords", "creator", "collection", "provider_provenance", "prior_familiarity"];
const bases = ["catalog", "model_familiarity", "inference"];
const text = (value: unknown, limit: number) => typeof value === "string" ? value.slice(0, limit) : "";
const strings = (value: unknown) => Array.isArray(value)
  ? value.filter((x): x is string => typeof x === "string").slice(0, 16).map(x => x.slice(0, 100)) : [];

export function bPacket(source: LabWork, candidates: LabWork[], positions = new Map<string, number>()) {
  const eligible = new Map<string, LabWork>();
  const identities = new Set<string>();
  for (const work of candidates) {
    if (!work.source_verified || work.media_type !== source.media_type || sameWork(source, work) ||
        !work.id || !work.title || eligible.has(work.id)) continue;
    let identity: string;
    try { identity = similarityKey(similarityIdentity({ type: work.media_type, source: work.external_source, externalId: work.external_id })); }
    catch { continue; }
    if (identities.has(identity)) continue;
    identities.add(identity);
    eligible.set(work.id, work);
    if (eligible.size >= 32) break;
  }
  const catalog = (work: LabWork, isSource = false) => {
    const m = work.source_metadata, description = text(m.description, 1200);
    const position = positions.get(work.id);
    return {
      id: work.id, title: text(work.title, 200), type: work.media_type,
      creator: text(m.creator, 250), year: m.release_year || null,
      genres: strings(m.subjects), keywords: strings(m.keywords),
      collection: text(m.collection, 200) || null,
      synopsis: description, synopsis_truncated: typeof m.description === "string" && m.description.length > description.length,
      provider_provenance: isSource ? "source" : position ? `TMDB direct #${position}` : "Existing catalog retrieval",
      provider_position: position ?? null,
    };
  };
  return { eligible, input: { source: catalog(source, true), candidates: [...eligible.values()].map(w => catalog(w)) } };
}

function schema(candidateIds: string[], workIds: string[]) {
  return {
    type: "object", additionalProperties: false,
    properties: {
      decisions: { type: "array", maxItems: 11, items: {
        type: "object", additionalProperties: false,
        properties: {
          candidate_id: { type: "string", enum: candidateIds }, rank: { type: "integer", minimum: 0, maximum: 8 },
          recommend: { type: "boolean" }, reason: { type: "string" }, caveat: { type: "string" },
          confidence: { type: "string", enum: ["low", "medium", "high"] },
          evidence_used: { type: "array", items: {
            type: "object", additionalProperties: false,
            properties: { work_id: { type: "string", enum: workIds },
              field: { type: "string", enum: fields }, basis: { type: "string", enum: bases } },
            required: ["work_id", "field", "basis"],
          } },
        },
        required: ["candidate_id", "rank", "recommend", "reason", "caveat", "confidence", "evidence_used"],
      } },
      pool_assessment: { type: "string" },
    },
    required: ["decisions", "pool_assessment"],
  };
}

export function validateB(raw: any, source: LabWork, eligible: Map<string, LabWork>): LabWork[] {
  if (!Array.isArray(raw?.decisions) || raw.decisions.length > 11 || typeof raw.pool_assessment !== "string")
    throw new Error("Invalid B selection envelope");
  const seen = new Set<string>(), selected: { rank: number; work: LabWork }[] = [];
  let rejected = 0;
  for (const d of raw.decisions) {
    const work = eligible.get(d?.candidate_id);
    if (!work || seen.has(d.candidate_id) || typeof d.recommend !== "boolean" ||
        typeof d.reason !== "string" || typeof d.caveat !== "string" ||
        !["low", "medium", "high"].includes(d.confidence) || !Array.isArray(d.evidence_used) ||
        d.evidence_used.some((e: any) => !e || (e.work_id !== source.id && !eligible.has(e.work_id)) ||
          !fields.includes(e.field) || !bases.includes(e.basis)))
      throw new Error("B returned an unknown, duplicate or invalid candidate/evidence ID");
    seen.add(d.candidate_id);
    if (d.recommend) {
      if (!Number.isInteger(d.rank) || d.rank < 1 || d.rank > 8) throw new Error("Invalid B rank");
      selected.push({ rank: d.rank, work });
    } else if (d.rank !== 0 || ++rejected > 3) throw new Error("Invalid B rejection");
  }
  selected.sort((a, b) => a.rank - b.rank);
  if (selected.length > 8 || selected.some((x, i) => x.rank !== i + 1)) throw new Error("B ranks must be contiguous and unique");
  return selected.map(x => x.work);
}

export async function selectWithB(source: LabWork, candidates: LabWork[], store: LabStore,
  key: string | undefined, fetcher: typeof fetch = fetch, positions = new Map<string, number>()): Promise<LabWork[]> {
  if (!key) throw new Error("B credential unavailable");
  if (!["movie", "tv"].includes(source.media_type)) throw new Error("B is limited to film and TV");
  if (!source.source_verified) throw new Error("B requires a verified source");
  const { eligible, input } = bPacket(source, candidates, positions);
  if (eligible.size < 2) throw new Error("Insufficient verified candidates for B");
  const body = {
    model: B_MODEL, temperature: 0.2, max_tokens: 3500,
    messages: [{ role: "system", content: B_SYSTEM_PROMPT }, { role: "user", content: JSON.stringify(input) }],
    response_format: { type: "json_schema", json_schema: {
      name: "similar_selection_b", strict: true, schema: schema([...eligible.keys()], [source.id, ...eligible.keys()]),
    } },
  };
  let encoded = JSON.stringify(body);
  if (new TextEncoder().encode(encoded).byteLength > 40_000) {
    // Keep the candidate pool rather than drop lower provider positions merely
    // because some synopses are long. Truncation stays explicit in the packet.
    for (const work of input.candidates) {
      if (work.synopsis.length > 500) { work.synopsis = work.synopsis.slice(0, 500); work.synopsis_truncated = true; }
      work.keywords = work.keywords.slice(0, 8);
    }
    body.messages[1].content = JSON.stringify(input);
    encoded = JSON.stringify(body);
  }
  // Bounds both request size and maximum possible charge at $2/$8 per million
  // input/output tokens. This sits INSIDE the existing $0.25/title reservation.
  if (new TextEncoder().encode(encoded).byteLength > 40_000) throw new Error("B input exceeds its preparation bound");
  const token = crypto.randomUUID();
  await store("reserve", { token, kind: "selection_b", amount: B_RESERVATION_USD });
  // No automatic retries. Unknown transport/server outcomes keep the reservation.
  const response = await fetcher("https://api.openai.com/v1/chat/completions", {
    method: "POST", headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: encoded, signal: AbortSignal.timeout(50_000),
  });
  if (!response.ok) {
    if (response.status < 500) await store("settle", { token, actual: 0, usage: { http_status: response.status } });
    throw new Error(`B request failed (${response.status})`);
  }
  const data = await response.json(), usage = data.usage;
  if (!Number.isInteger(usage?.prompt_tokens) || usage.prompt_tokens < 0 ||
      !Number.isInteger(usage?.completion_tokens) || usage.completion_tokens < 0)
    throw new Error("B usage missing; reservation retained");
  await store("settle", { token, actual: (usage.prompt_tokens * 2 + usage.completion_tokens * 8) / 1e6,
    usage: { ...usage, model: data.model || B_MODEL, kind: "selection_b", provider: "openai" } });
  if (data.model !== B_MODEL) throw new Error("B response model does not match the approved model");
  if (data.choices?.[0]?.finish_reason !== "stop") throw new Error("B response incomplete");
  return validateB(JSON.parse(data.choices[0].message?.content || "null"), source, eligible);
}
