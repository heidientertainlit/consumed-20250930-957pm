import { useEffect, useMemo, useState } from "react";
import { useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, CheckCircle2, ExternalLink, Loader2, MessageSquareText, RefreshCw, ShieldCheck, Sparkles, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/lib/supabase";

type Source = { name?: string; url?: string; published_at?: string; fetched_at?: string };
type Starter = { id: string; title: string; summary?: string; source?: Source; safety?: string; freshness?: string };
type Room = { id: string; name: string; description?: string; invite_code?: string };
type Reply = { id?: string; persona_name: string; handle?: string; content: string; parent_id?: string | null; order?: number };
type PreviewSource = { source: string; url?: string; publishedAt?: string | null; fetchedAt?: string | null; safety?: string };
type Preview = { id: string; opening_id: string; opening_post: string; opening_persona_name?: string; opening_handle?: string; replies: Reply[]; participant_count?: number; sources: PreviewSource[] };
type Persona = { id: string; user_name: string; display_name: string };
type TopicResponse = { suggestions?: { id: string; topic: string; summary?: string; source: string; url: string; publishedAt?: string | null; fetchedAt?: string; safety?: string }[] };
type AssembleResponse = { personas?: Persona[]; deficit?: number };
type GenerateResponse = { runId?: string; status?: string; messages?: { client_id: string; participant_id: string; parent_client_id?: string | null; body: string }[]; sourceAttribution?: PreviewSource[]; message?: string };
type PublishResponse = { runId?: string; takeId?: string; status?: string };

async function roomConversations<T>(body: Record<string, unknown>): Promise<T> {
  const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
  if (sessionError || !sessionData.session?.access_token) {
    throw new Error("Your admin session expired. Please sign in again.");
  }
  const { data, error } = await supabase.functions.invoke("admin-room-conversations", {
    body,
    headers: { Authorization: `Bearer ${sessionData.session.access_token}` },
  });
  if (error) {
    let message = error.message;
    const context = (error as any).context;
    if (context instanceof Response) {
      try {
        const payload = await context.clone().json();
        message = payload?.error || message;
      } catch {
        // Keep the SDK error when the response body is not JSON.
      }
    }
    throw new Error(message);
  }
  if (data?.error) throw new Error(data.error);
  return data as T;
}

function safeCustomStarter(value: string) {
  const text = value.trim();
  if (text.length < 12) return "Write at least 12 characters so personas have a useful prompt.";
  if (text.length > 500) return "Keep the starter under 500 characters.";
  if (/(doxx|self-harm|suicide|kill yourself|racial slur)/i.test(text)) return "This starter needs to be revised for safety.";
  return null;
}

function ReplyRow({ reply, index, depth }: { reply: Reply; index: number; depth: number }) {
  return <div className={`rounded-xl border border-gray-800 bg-gray-950/70 p-3 ${depth > 0 ? "border-l-purple-500/50" : ""}`} style={{ marginLeft: `${Math.min(depth, 4) * 18}px` }}>
    <div className="flex items-center gap-2 text-xs mb-1.5">
      <span className="font-semibold text-purple-300">{index + 1}. {reply.persona_name}</span>
      {reply.handle && <span className="text-gray-500">@{reply.handle.replace(/^@/, "")}</span>}
      {depth > 0 && <span className="text-gray-600">↳ nested reply</span>}
    </div>
    <p className="text-sm leading-relaxed text-gray-200">{reply.content}</p>
  </div>;
}

export default function AdminRoomConversationsPage() {
  const { user } = useAuth();
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [selectedStarter, setSelectedStarter] = useState<string>("");
  const [customStarter, setCustomStarter] = useState("");
  const [preview, setPreview] = useState<Preview | null>(null);
  const [deficit, setDeficit] = useState<number | null>(null);
  const [approval, setApproval] = useState(false);
  const [working, setWorking] = useState<"preview" | "publish" | null>(null);
  const [publishedUrl, setPublishedUrl] = useState<string | null>(null);
  const [publishApproval, setPublishApproval] = useState(false);
  const [generationStartedAt, setGenerationStartedAt] = useState<number | null>(null);
  const [generationSeconds, setGenerationSeconds] = useState(0);

  useEffect(() => {
    if (!generationStartedAt) {
      setGenerationSeconds(0);
      return;
    }
    const update = () => setGenerationSeconds(Math.floor((Date.now() - generationStartedAt) / 1000));
    update();
    const interval = window.setInterval(update, 1000);
    return () => window.clearInterval(interval);
  }, [generationStartedAt]);

  const { data: currentProfile, isLoading: profileLoading } = useQuery({
    queryKey: ["admin-profile-check", user?.id],
    queryFn: async () => {
      if (!user?.id) return null;
      const { data, error } = await supabase.from("users").select("id, user_name, is_admin").eq("id", user.id).single();
      if (error) throw error;
      return data;
    },
    enabled: !!user?.id,
  });
  useEffect(() => {
    if (!profileLoading && currentProfile && !currentProfile.is_admin) setLocation("/");
  }, [currentProfile, profileLoading, setLocation]);

  const roomQuery = useQuery<Room | null>({
    queryKey: ["admin-room-conversations-room"],
    queryFn: async () => {
      const { data, error } = await supabase.from("pools").select("id, name, description, invite_code").eq("is_official", true).eq("series_tag", "true-crime").maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!currentProfile?.is_admin,
  });
  const room = roomQuery.data;
  const topicsQuery = useQuery<TopicResponse>({
    queryKey: ["admin-room-conversations-topics", room?.id],
    queryFn: () => roomConversations({ action: "suggest-topics", roomId: room!.id }),
    enabled: !!room?.id,
  });
  const assembleQuery = useQuery<AssembleResponse>({
    queryKey: ["admin-room-conversations-personas", room?.id],
    queryFn: () => roomConversations({ action: "assemble-personas", roomId: room!.id }),
    enabled: !!room?.id,
  });
  const suggestions: Starter[] = (topicsQuery.data?.suggestions ?? []).map((item, index) => ({
    id: item.id || `${index}-${item.topic}`,
    title: item.topic,
    summary: item.summary,
    source: { name: item.source, url: item.url, published_at: item.publishedAt || undefined, fetched_at: item.fetchedAt },
    freshness: item.publishedAt ? new Date(item.publishedAt).toLocaleDateString() : "Live source check",
    safety: item.safety || "Safety-screened",
  }));
  const starter = useMemo(() => suggestions.find(item => item.id === selectedStarter), [suggestions, selectedStarter]);
  const customError = customStarter ? safeCustomStarter(customStarter) : null;
  const participantCount = preview ? (preview.participant_count ?? new Set(preview.replies.map(reply => reply.handle || reply.persona_name)).size) : 0;
  const personaDeficit = deficit ?? assembleQuery.data?.deficit ?? null;
  const replyDepths = useMemo(() => {
    const depths = new Map<string, number>();
    if (!preview) return depths;
    depths.set(preview.opening_id, -1);
    for (const reply of [...preview.replies].sort((a, b) => (a.order ?? 0) - (b.order ?? 0))) {
      const parentDepth = reply.parent_id ? depths.get(reply.parent_id) : -1;
      if (reply.id) depths.set(reply.id, Math.max(0, (parentDepth ?? -1) + 1));
    }
    return depths;
  }, [preview]);

  async function generatePreview() {
    const prompt = customStarter.trim();
    if (!room) return;
    if (assembleQuery.isError) {
      toast({ title: "Participants could not be loaded", description: (assembleQuery.error as Error)?.message || "Refresh the participant list and try again.", variant: "destructive" });
      return;
    }
    if (!prompt && !starter) { toast({ title: "Choose a starter", description: "Select a sourced suggestion or write a custom starter.", variant: "destructive" }); return; }
    if (prompt && customError) { toast({ title: "Custom starter needs revision", description: customError, variant: "destructive" }); return; }
    setWorking("preview");
    setGenerationStartedAt(Date.now());
    setPublishedUrl(null);
    toast({ title: "Creating private conversation", description: "Writing 20 persona messages and reviewing them before display. This may take up to two minutes." });
    try {
      let people = assembleQuery.data?.personas ?? [];
      const currentDeficit = Math.max(0, 20 - people.length);
      if (currentDeficit > 0) {
        setDeficit(currentDeficit);
        if (!approval) return;
        const provisioned = await roomConversations<AssembleResponse>({ action: "provision-personas", roomId: room.id, approvedDeficit: currentDeficit });
        people = provisioned.personas ?? [];
      }
      if (people.length !== 20) throw new Error("The service could not assemble exactly 20 personas.");
      const topic = prompt || starter?.title || "";
      const data = await roomConversations<GenerateResponse>({
        action: "generate-preview",
        roomId: room.id,
        topic,
        suggestionId: prompt ? undefined : starter?.id,
        participantIds: people.map(person => person.id),
      });
      if (!data.runId || !data.messages?.length) throw new Error(data.message || "No preview was returned.");
      const peopleById = new Map(people.map(person => [person.id, person]));
      const opening = data.messages[0];
      const openingPerson = peopleById.get(opening.participant_id);
      setPreview({ id: data.runId, opening_id: opening.client_id, opening_post: opening.body, opening_persona_name: openingPerson?.display_name, opening_handle: openingPerson?.user_name, participant_count: new Set(data.messages.map(message => message.participant_id)).size, sources: data.sourceAttribution || [], replies: data.messages.slice(1).map((message, order) => {
        const person = peopleById.get(message.participant_id);
        return { id: message.client_id, persona_name: person?.display_name || "Persona", handle: person?.user_name, content: message.body, parent_id: message.parent_client_id, order };
      }) });
      setDeficit(null);
      setPublishApproval(false);
    } catch (error: any) {
      toast({ title: "Could not generate preview", description: error.message, variant: "destructive" });
    } finally {
      setWorking(null);
      setGenerationStartedAt(null);
    }
  }

  async function publish() {
    if (!preview || !room) return;
    setWorking("publish");
    try {
      await roomConversations({
        action: "approve-preview",
        runId: preview.id,
        roomId: room.id,
      });
      const data = await roomConversations<PublishResponse>({ action: "publish", runId: preview.id });
      if (data.status !== "published") throw new Error("The conversation was not published.");
      setPublishedUrl(`/room/${room.id}/conversation/${data.takeId}`);
      toast({ title: "Conversation published", description: "The True Crime room is now live." });
    } catch (error: any) {
      toast({ title: "Could not publish conversation", description: error.message, variant: "destructive" });
    } finally { setWorking(null); }
  }

  if (profileLoading || !user) return <div className="min-h-screen bg-gray-950 flex items-center justify-center"><Loader2 className="animate-spin text-purple-400" /></div>;
  if (!currentProfile?.is_admin) return <div className="min-h-screen bg-gray-950 flex items-center justify-center text-gray-400">Access restricted</div>;

  return <div className="min-h-screen bg-gray-950 text-white"><main className="max-w-4xl mx-auto px-4 py-8">
    <button onClick={() => setLocation("/admin")} className="flex items-center gap-1.5 text-sm text-gray-400 hover:text-white mb-5"><ArrowLeft size={15} /> Back to Admin</button>
    <header className="mb-7"><div className="flex items-center gap-3"><div className="rounded-xl p-2.5 bg-purple-900/40"><MessageSquareText className="text-purple-300" /></div><div><h1 className="text-2xl font-bold">True Crime Conversation</h1><p className="text-sm text-gray-400">Build a reviewed, 20-persona room conversation from current sources.</p></div></div></header>
    {roomQuery.isLoading ? <div className="py-16 flex justify-center"><Loader2 className="animate-spin text-purple-400" /></div> : roomQuery.isError || !room ? <div className="rounded-2xl border border-red-900/60 bg-red-950/30 p-6"><p className="font-medium">True Crime room unavailable</p><p className="text-sm text-gray-400 mt-1">{(roomQuery.error as Error)?.message || "The official True Crime room could not be loaded."}</p><Button variant="outline" className="mt-4" onClick={() => roomQuery.refetch()}>Try again</Button></div> : <>
      <section className="rounded-2xl border border-gray-800 bg-gray-900 p-5 mb-5 flex flex-wrap justify-between gap-4"><div><p className="text-xs uppercase tracking-wider text-purple-300 font-semibold">Target room</p><h2 className="text-lg font-semibold mt-1">{room.name}</h2><p className="text-sm text-gray-400 mt-1">{room.description || "Official True Crime community"}</p></div><span className="self-start rounded-full bg-purple-500/15 px-3 py-1 text-xs text-purple-200 border border-purple-500/30">Private preview first</span></section>
      <section className="rounded-2xl border border-gray-800 bg-gray-900 p-5 mb-5"><div className="flex justify-between gap-3 mb-4"><div><h2 className="font-semibold">1. Choose a conversation starter</h2><p className="text-sm text-gray-400">Select a current sourced topic or write your own.</p></div><Button size="sm" variant="ghost" onClick={() => topicsQuery.refetch()}><RefreshCw size={14} className="mr-1" /> Refresh</Button></div>
        {topicsQuery.isLoading ? <div className="py-6 flex justify-center"><Loader2 className="animate-spin text-purple-400" /></div> : topicsQuery.isError ? <p className="rounded-xl bg-red-950/30 p-4 text-sm text-red-300">Conversation starters could not be loaded. Refresh the page or write your own starter.</p> : suggestions.length === 0 ? <p className="rounded-xl bg-gray-950 p-4 text-sm text-gray-400">No sourced starters are available right now. You can still write your own.</p> : <div className="space-y-2" role="radiogroup" aria-label="Conversation starters">{suggestions.map(item => <div key={item.id} className={`rounded-xl border p-4 transition-colors ${selectedStarter === item.id && !customStarter ? "border-purple-500 bg-purple-950/30" : "border-gray-800 bg-gray-950 hover:border-gray-700"}`}><label className="flex gap-3 cursor-pointer"><input type="radio" name="conversation-starter" checked={selectedStarter === item.id && !customStarter} onChange={() => { setSelectedStarter(item.id); setCustomStarter(""); }} className="mt-1 accent-purple-500" /><span><span className="font-medium text-sm block">{item.title}</span>{item.summary && <span className="text-sm text-gray-400 mt-1 block">{item.summary}</span>}</span></label><div className="flex flex-wrap gap-x-3 gap-y-1 mt-3 pl-6 text-xs text-gray-500">{item.source?.name && <span>Source: {item.source.url ? <a className="text-purple-300 hover:underline" href={item.source.url} target="_blank" rel="noreferrer">{item.source.name} <ExternalLink className="inline" size={10} /></a> : item.source.name}</span>}{(item.freshness || item.source?.published_at || item.source?.fetched_at) && <span>Freshness: {item.freshness || new Date(item.source?.published_at || item.source?.fetched_at || "").toLocaleDateString()}</span>}</div></div>)}</div>}
        <div className="mt-4"><label className="text-xs uppercase tracking-wider text-gray-400">Or write your own starter</label><Textarea value={customStarter} onChange={e => { setCustomStarter(e.target.value); setSelectedStarter(""); }} placeholder="Ask a specific True Crime discussion question…" className="mt-2 bg-gray-950 border-gray-700 min-h-[84px]" maxLength={500} />{customError ? <p className="text-xs text-red-400 mt-1">{customError}</p> : customStarter && <p className="text-xs text-emerald-400 mt-1"><CheckCircle2 className="inline mr-1" size={12} />Ready to generate. Click the button below.</p>}
          {(customStarter || starter) && <Button onClick={generatePreview} disabled={working !== null || assembleQuery.isError || !!customError || (!!personaDeficit && !approval)} className="mt-4 w-full bg-purple-600 hover:bg-purple-700">{working === "preview" ? <><Loader2 className="animate-spin mr-2" size={15} />Creating conversation…</> : <><Sparkles className="mr-2" size={15} />Generate private preview</>}</Button>}
        </div>
      </section>
      <section className="rounded-2xl border border-gray-800 bg-gray-900 p-5 mb-5"><div className="flex items-start gap-3"><Users className="text-purple-300 mt-0.5" size={19} /><div><h2 className="font-semibold">2. Assemble participants automatically</h2><p className="text-sm text-gray-400 mt-1">The service selects 20 interested, distinct personas—no manual persona selection.</p></div></div>{personaDeficit !== null && personaDeficit > 0 && <div className="mt-4 rounded-xl border border-amber-700/50 bg-amber-950/30 p-4"><p className="font-medium text-amber-200">Approval required: {personaDeficit} persona{personaDeficit === 1 ? "" : "s"} must be created.</p><p className="text-sm text-amber-100/70 mt-1">Only exactly this deficit will be created, then the service will assemble 20 participants.</p><label className="mt-3 flex gap-2 text-sm text-gray-200"><input type="checkbox" checked={approval} onChange={e => setApproval(e.target.checked)} /> I approve creation of exactly {personaDeficit} persona{personaDeficit === 1 ? "" : "s"}.</label></div>}
        <Button onClick={generatePreview} disabled={working !== null || assembleQuery.isError || (!!personaDeficit && !approval)} className="mt-5 bg-purple-600 hover:bg-purple-700">{working === "preview" ? <><Loader2 className="animate-spin mr-2" size={15} />Creating conversation…</> : <><Sparkles className="mr-2" size={15} />{preview ? "Regenerate private preview" : "Generate private preview"}</>}</Button>
        {working === "preview" && <div role="status" aria-live="polite" className="mt-4 rounded-xl border border-purple-700/50 bg-purple-950/30 p-4">
          <div className="flex items-center gap-2 font-medium text-purple-200"><Loader2 className="animate-spin" size={16} />Creating private conversation</div>
          <p className="mt-1 text-sm text-gray-300">Writing 20 distinct persona messages and reviewing them before display. Nothing is public.</p>
          <p className="mt-2 text-xs text-gray-500">Elapsed: {generationSeconds}s · Please keep this page open for up to two minutes.</p>
        </div>}</section>
      {preview && <section className="rounded-2xl border border-purple-700/40 bg-gray-900 p-5"><div className="flex flex-wrap justify-between gap-3 mb-5"><div><h2 className="font-semibold">3. Private conversation preview</h2><p className="text-sm text-gray-400">Opening post and ordered nested replies. Nothing is public yet.</p></div><span className={`rounded-full px-3 py-1 text-xs border ${participantCount === 20 ? "text-emerald-300 bg-emerald-900/30 border-emerald-700/40" : "text-amber-200 bg-amber-900/30 border-amber-700/40"}`}><Users className="inline mr-1" size={12} />{participantCount} distinct participants {participantCount === 20 ? <CheckCircle2 className="inline ml-1" size={12} /> : ""}</span></div>{preview.sources.length > 0 && <div className="rounded-xl border border-gray-800 bg-gray-950/70 p-3 mb-3"><p className="text-xs uppercase tracking-wide text-gray-400 mb-2">Starter provenance</p>{preview.sources.map((source, index) => <div key={`${source.source}-${index}`} className="text-xs text-gray-400">{source.url ? <a href={source.url} target="_blank" rel="noreferrer" className="text-purple-300 hover:underline">{source.source} <ExternalLink className="inline" size={10} /></a> : source.source}{source.publishedAt && <span> · published {new Date(source.publishedAt).toLocaleDateString()}</span>}{source.safety && <span className="text-emerald-400"> · {source.safety}</span>}</div>)}</div>}<div className="rounded-xl bg-purple-950/30 border border-purple-800/40 p-4 mb-3"><p className="text-xs uppercase text-purple-300 font-semibold mb-2">Opening post</p><p className="text-xs text-purple-200 mb-2">{preview.opening_persona_name}{preview.opening_handle && ` @${preview.opening_handle}`}</p><p className="text-sm leading-relaxed text-gray-100">{preview.opening_post}</p></div><div className="space-y-2">{[...preview.replies].sort((a, b) => (a.order ?? 0) - (b.order ?? 0)).map((reply, i) => <ReplyRow key={reply.id || `${reply.handle}-${i}`} reply={reply} index={i} depth={reply.id ? replyDepths.get(reply.id) ?? 0 : 0} />)}</div><div className="mt-5 pt-5 border-t border-gray-800"><label className="flex items-start gap-2 text-sm text-gray-200 mb-4"><input type="checkbox" checked={publishApproval} onChange={event => setPublishApproval(event.target.checked)} className="mt-1 accent-emerald-500" /> I reviewed this complete 20-person conversation and approve publishing it to the True Crime room.</label><div className="flex flex-wrap gap-3"><Button onClick={generatePreview} disabled={working !== null} variant="outline" className="border-gray-700"><RefreshCw className="mr-2" size={15} />Regenerate</Button><Button onClick={publish} disabled={working !== null || participantCount !== 20 || !publishApproval || !!publishedUrl} className="bg-emerald-600 hover:bg-emerald-700">{working === "publish" ? <Loader2 className="animate-spin mr-2" size={15} /> : <CheckCircle2 className="mr-2" size={15} />}Publish approved conversation</Button></div></div>{participantCount !== 20 && <p className="text-xs text-amber-300 mt-3">Publishing is locked until the preview contains 20 distinct participants.</p>}{publishedUrl && <a href={publishedUrl} className="mt-4 inline-flex items-center gap-2 text-sm text-emerald-300 hover:underline">View published True Crime room <ExternalLink size={14} /></a>}</section>}
    </>}</main></div>;
}