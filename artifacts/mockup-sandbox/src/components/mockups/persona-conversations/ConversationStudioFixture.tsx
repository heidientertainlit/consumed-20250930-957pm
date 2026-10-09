import { useCallback, useRef } from "react";
import { ConversationStudio, ConversationWorkspaceView, type ConversationState, type ConversationRun } from "../../../../../../client/src/components/admin/persona-conversation-controls";

const fixture: ConversationState = {
  personas: [
    { id: "p-1", user_name: "mara_reads", display_name: "Mara Ellis", persona_config: { tone: "warmly skeptical", interests: ["adaptations", "character arcs"] }, gender: "woman" },
    { id: "p-2", user_name: "devon_film", display_name: "Devon Park", persona_config: { tone: "dry, observant", interests: ["science fiction", "sound design"] }, gender: "unset" },
    { id: "p-3", user_name: "inez_afterdark", display_name: "Inez Ruiz", persona_config: { tone: "curious and direct", interests: ["morally messy stories", "independent cinema"] }, gender: "nonbinary" },
  ],
  runs: [
    {
      id: "fixture-thread-01",
      topic: "Can a faithful adaptation still improve on the book?",
      status: "approved",
      subject: { id: "subject-1", title: "The Left Hand of Darkness", type: "book", creator: "Ursula K. Le Guin" },
      provenance: { provider: "fixture", selection: "manual review" },
      participant_ids: ["p-1", "p-2", "p-3"],
      opening_author_id: "p-1",
      revision: 3,
      approved_revision: 3,
      created_at: "2025-02-14T16:20:00.000Z",
      messages: [
        { client_id: "m-1", participant_id: "p-1", parent_client_id: null, body: "The book's interiority is the whole point, but I think a film could make the silences do some of that work instead of explaining everything.", offset_seconds: 0, public_id: "public-1", delivered_at: null },
        { client_id: "m-2", participant_id: "p-2", parent_client_id: "m-1", body: "Only if it trusts the audience. The best adaptation choice might be leaving a few things unresolved.", offset_seconds: 720, delivered_at: null },
        { client_id: "m-3", participant_id: "p-3", parent_client_id: "m-2", body: "That would be the brave version. I would miss the narrator's voice, though.", offset_seconds: 1800, delivered_at: null },
        { client_id: "m-4", participant_id: "p-1", parent_client_id: "m-3", body: "Same. Maybe the question is what a camera can notice that a narrator can't.", offset_seconds: 3300, delivered_at: null },
      ],
      history: [
        { action: "generated", at: "2025-02-14T16:20:00.000Z", message: "Draft created from a manually selected book." },
        { action: "edited", at: "2025-02-14T16:31:00.000Z", message: "Reply graph and wording updated." },
        { action: "approved", at: "2025-02-14T16:38:00.000Z", message: "Revision 3 approved; not yet scheduled." },
      ],
    },
    {
      id: "fixture-thread-02",
      topic: "What makes a finale feel earned rather than tidy?",
      status: "paused",
      participant_ids: ["p-2", "p-3"],
      opening_author_id: "p-2",
      revision: 1,
      approved_revision: 1,
      start_at: "2025-02-16T19:30:00.000Z",
      created_at: "2025-02-14T17:05:00.000Z",
      messages: [
        { client_id: "m-5", participant_id: "p-2", parent_client_id: null, body: "A finale should close the emotional question, not every single plot door.", offset_seconds: 0, delivered_at: null },
        { client_id: "m-6", participant_id: "p-3", parent_client_id: "m-5", body: "Yes. A little unfinished business can feel more honest than a neat bow.", offset_seconds: 540, delivered_at: null },
      ],
      history: [
        { action: "scheduled", at: "2025-02-14T17:12:00.000Z", message: "Scheduled for a later window." },
        { action: "paused", at: "2025-02-14T17:16:00.000Z", error: "Delivery window paused by admin." },
      ],
    },
  ],
};

export default function ConversationStudioFixture() {
  const data = useRef(structuredClone(fixture));
  const transport = useCallback(async (action: string, values: Record<string, unknown>) => {
    if (action === "state") return structuredClone(data.current);
    if (action === "gender") {
      const persona = data.current.personas.find(p => p.id === values.personaId);
      if (persona) persona.gender = String(values.gender);
      return {};
    }
    if (action === "search") return { items: [{ id: "fixture-subject", title: "Selected Album", type: "music", creator: "Fixture Artist", externalId: "fixture-album", externalSource: "itunes" }] };
    if (action === "suggest") return { suggestions: [{ id: "fixture-subject", topic: "What makes this book's pacing work?", subject: { title: "Fixture Book", type: "book", creator: "Fixture Author" }, provenance: [{ provider: "Open Library", fetchedAt: new Date().toISOString() }] }],
      coverage: [{ provider: "Open Library", types: ["book"], status: "ok", fetchedAt: new Date().toISOString() }, { provider: "TMDB", types: ["movie", "tv"], status: "failed", fetchedAt: new Date().toISOString(), error: "Fixture provider unavailable" }] };
    if (action === "generate") {
      const ids = values.participantIds as string[];
      const opening = String(values.openingAuthorId);
      const count = Number(values.replyCount) + 1;
      const run: ConversationRun = { id: "fixture-generated", topic: String(values.topic), status: "draft",
        subject: values.subjectId ? { id: "fixture-subject", title: "Selected Album", type: "music", creator: "Fixture Artist" } : undefined,
        provenance: [{ provider: "Local fixture only", fetchedAt: new Date().toISOString() }],
        participant_ids: ids, opening_author_id: opening, revision: 1, approved_revision: null,
        messages: Array.from({ length: count }, (_, i) => ({ client_id: `g${i}`, participant_id: i === 0 ? opening : ids[i % ids.length],
          parent_client_id: i === 0 ? null : i > 1 ? `g${i - 1}` : "g0",
          body: i === 0 ? "What do you think about the pacing?" : "A connected fixture reply.",
          offset_seconds: Math.round(i * Number(values.durationMinutes) * 60 / (count - 1)) })) };
      data.current.runs.unshift(run);
      return structuredClone(run);
    }
    const run = data.current.runs.find(r => r.id === values.runId);
    if (!run || run.revision !== values.revision) throw new Error("Fixture revision changed");
    run.revision++;
    if (action === "edit") { run.messages = structuredClone(values.messages as ConversationRun["messages"]); run.status = "draft"; run.approved_revision = null; }
    if (action === "approve") { run.status = "approved"; run.approved_revision = run.revision; }
    if (action === "schedule") { run.status = "scheduled"; run.start_at = String(values.startAt); run.approved_revision = run.revision; }
    if (action === "pause") { run.status = "paused"; run.approved_revision = run.revision; }
    if (action === "cancel") run.status = "cancelled";
    if (action === "reject") run.status = "rejected";
    run.history = [...(run.history || []), { action, at: new Date().toISOString() }];
    return structuredClone(run);
  }, []);
  return <main className="min-h-screen bg-gray-950 p-4 text-white sm:p-8">
    <div className="mx-auto max-w-4xl rounded-2xl border border-violet-900/40 bg-gradient-to-br from-violet-950/20 via-gray-900 to-gray-900 p-4 sm:p-6">
      <p className="mb-4 text-[10px] font-semibold uppercase tracking-[.2em] text-gray-500">Local fixture · no API requests</p>
      <ConversationWorkspaceView state={fixture} showSnapshots={false} />
      <div className="mt-5"><ConversationStudio state={fixture} transport={transport} /></div>
    </div>
  </main>;
}
