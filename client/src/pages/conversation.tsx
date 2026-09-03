import { useMemo, useState } from "react";
import { useLocation, useRoute } from "wouter";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Loader2, MessageCircle, Send, ThumbsDown, ThumbsUp } from "lucide-react";
import Navigation from "@/components/navigation";
import MentionInput from "@/components/mention-input";
import { ReportButton } from "@/components/report-button";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/lib/supabase";
import { formatFeedName } from "@/lib/feed-name";
import { useToast } from "@/hooks/use-toast";

type Reply = any;

export default function ConversationPage() {
  const [, params] = useRoute("/conversation/:takeId");
  const [, setLocation] = useLocation();
  const { session } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const takeId = params?.takeId;
  const userId = session?.user?.id;
  const [replyText, setReplyText] = useState("");
  const [parentReplyId, setParentReplyId] = useState<string | null>(null);
  const [sending, setSending] = useState(false);

  const { data: take, isLoading, error } = useQuery({
    queryKey: ["conversation", takeId],
    queryFn: async () => {
      const { data, error } = await supabase.from("room_takes")
        .select("*, users:public_user_profiles(id, display_name, user_name, first_name, last_name)")
        .eq("id", takeId!).maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!takeId && !!userId,
  });
  const { data: replies = [] } = useQuery({
    queryKey: ["conversation-replies", takeId],
    queryFn: async () => {
      const { data, error } = await supabase.from("room_take_replies")
        .select("*, users:public_user_profiles(id, display_name, user_name, first_name, last_name)")
        .eq("take_id", takeId!).order("created_at", { ascending: true });
      if (error) throw error;
      return data || [];
    },
    enabled: !!takeId && !!userId,
  });
  const { data: votes = [] } = useQuery({
    queryKey: ["conversation-votes", takeId, userId],
    queryFn: async () => {
      const { data, error } = await supabase.from("room_take_votes").select("*").eq("user_id", userId!);
      if (error) throw error;
      return data || [];
    },
    enabled: !!takeId && !!userId,
  });

  const children = useMemo(() => {
    const map = new Map<string | null, Reply[]>();
    replies.forEach((reply: Reply) => {
      const key = reply.parent_reply_id || null;
      map.set(key, [...(map.get(key) || []), reply]);
    });
    return map;
  }, [replies]);
  const nameOf = (user: any) => formatFeedName(user?.display_name, user?.user_name, user?.first_name, user?.last_name);
  const myTakeVote = votes.find((vote: any) => vote.take_id === takeId && !vote.reply_id);

  const refresh = () => Promise.all([
    queryClient.invalidateQueries({ queryKey: ["conversation", takeId] }),
    queryClient.invalidateQueries({ queryKey: ["conversation-replies", takeId] }),
    queryClient.invalidateQueries({ queryKey: ["conversation-votes", takeId, userId] }),
  ]);
  const vote = async (target: any, direction: 1 | -1, isReply = false) => {
    if (!userId) return;
    const existing = votes.find((item: any) => isReply ? item.reply_id === target.id : item.take_id === target.id && !item.reply_id);
    const next = existing?.vote === direction ? 0 : direction;
    const delta = next - (existing?.vote || 0);
    const voteChange = !existing
      ? supabase.from("room_take_votes").insert(isReply ? { reply_id: target.id, user_id: userId, vote: direction } : { take_id: target.id, user_id: userId, vote: direction })
      : next === 0 ? supabase.from("room_take_votes").delete().eq("id", existing.id)
        : supabase.from("room_take_votes").update({ vote: next }).eq("id", existing.id);
    const countChange = isReply
      ? supabase.from("room_take_replies").update({
          upvotes: Math.max(0, (target.upvotes || 0) + (next === 1 ? 1 : existing?.vote === 1 ? -1 : 0)),
          downvotes: Math.max(0, (target.downvotes || 0) + (next === -1 ? 1 : existing?.vote === -1 ? -1 : 0)),
        }).eq("id", target.id)
      : supabase.from("room_takes").update({ upvotes: (target.upvotes || 0) + delta }).eq("id", target.id);
    const [voteResult, countResult] = await Promise.all([voteChange, countChange]);
    if (voteResult.error || countResult.error) toast({ title: "Could not save reaction", variant: "destructive" });
    await refresh();
  };
  const submitReply = async () => {
    if (!replyText.trim() || !take || !userId) return;
    setSending(true);
    const { error: replyError } = await supabase.from("room_take_replies").insert({
      take_id: take.id, parent_reply_id: parentReplyId, user_id: userId, content: replyText.trim(),
    });
    if (!replyError) {
      const { error: countError } = await supabase.from("room_takes").update({ reply_count: (take.reply_count || 0) + 1 }).eq("id", take.id);
      if (countError) toast({ title: "Reply saved, but count could not update", variant: "destructive" });
      if (take.user_id && take.user_id !== userId) {
        const { error: notificationError } = await supabase.from("notifications").insert({
          user_id: take.user_id,
          triggered_by_user_id: userId,
          type: "conversation_reply",
          message: `${nameOf(session?.user?.user_metadata) || "Someone"} replied to your conversation`,
          read: false,
          action_url: `/conversation/${take.id}`,
        });
        if (notificationError) console.error("[conversation reply notification]", notificationError);
      }
      setReplyText(""); setParentReplyId(null); await refresh();
    } else toast({ title: "Could not post reply", description: replyError.message, variant: "destructive" });
    setSending(false);
  };
  const renderReply = (reply: Reply, depth = 0): JSX.Element => {
    const mine = votes.find((item: any) => item.reply_id === reply.id)?.vote || 0;
    return <div key={reply.id} className={depth ? "ml-4 border-l border-violet-100 pl-4" : ""}>
      <div className="rounded-xl bg-slate-50 p-3">
        <p className="text-sm font-semibold text-slate-800">{nameOf(reply.users)}</p>
        <p className="mt-1 whitespace-pre-wrap text-[15px] text-slate-700">{reply.content}</p>
        <div className="mt-2 flex items-center gap-2 text-xs text-slate-500">
          <button onClick={() => vote(reply, 1, true)} className={mine === 1 ? "text-violet-700" : ""}><ThumbsUp className="inline h-3.5 w-3.5" /> {reply.upvotes || 0}</button>
          <button onClick={() => vote(reply, -1, true)} className={mine === -1 ? "text-rose-600" : ""}><ThumbsDown className="inline h-3.5 w-3.5" /> {reply.downvotes || 0}</button>
          <button onClick={() => { setParentReplyId(reply.id); setReplyText(""); }} className="font-semibold text-violet-700">Reply</button>
          <ReportButton contentType="comment" contentId={String(reply.id)} className="ml-auto text-slate-400" />
        </div>
      </div>
      <div className="mt-2 space-y-2">{(children.get(reply.id) || []).map((child) => renderReply(child, depth + 1))}</div>
    </div>;
  };

  if (isLoading) return <div className="min-h-screen flex items-center justify-center"><Loader2 className="animate-spin text-violet-600" /></div>;
  if (error || !take) return <div className="min-h-screen p-8 text-center"><p>Conversation not found.</p><button className="mt-3 text-violet-700" onClick={() => setLocation("/activity")}>Back to activity</button></div>;
  return <div className="min-h-screen bg-white"><Navigation /><main className="mx-auto max-w-2xl px-4 pb-24 pt-5">
    <button onClick={() => window.history.length > 1 ? window.history.back() : setLocation("/activity")} className="mb-5 flex items-center gap-1 text-sm font-semibold text-slate-600"><ArrowLeft size={16} /> Back</button>
    <article className="rounded-2xl border border-slate-200 p-5 shadow-sm">
      {take.media_title && <p className="mb-2 text-sm font-semibold text-violet-700">{take.media_title}{take.media_type ? ` · ${take.media_type}` : ""}</p>}
      <p className="text-sm font-semibold text-slate-600">{nameOf(take.users)}</p>
      <h1 className="mt-2 text-xl font-bold text-slate-900">{take.title}</h1>
      {take.body && <p className="mt-3 whitespace-pre-wrap text-slate-700">{take.body}</p>}
      <div className="mt-4 flex items-center gap-3 text-sm text-slate-500">
        <button onClick={() => vote(take, 1)} className={myTakeVote?.vote === 1 ? "font-bold text-violet-700" : ""}><ThumbsUp className="inline h-4 w-4" /> {take.upvotes || 0}</button>
        <button onClick={() => vote(take, -1)} className={myTakeVote?.vote === -1 ? "font-bold text-rose-600" : ""}><ThumbsDown className="inline h-4 w-4" /></button>
        <span><MessageCircle className="inline h-4 w-4" /> {take.reply_count || 0}</span>
        <ReportButton contentType="post" contentId={String(take.id)} className="ml-auto text-slate-400" />
      </div>
    </article>
    <section className="mt-6"><h2 className="mb-3 font-bold text-slate-900">Replies</h2><div className="space-y-3">{(children.get(null) || []).map((reply) => renderReply(reply))}</div></section>
    <section className="sticky bottom-0 mt-5 border-t bg-white py-3">
      {parentReplyId && <div className="mb-1 flex justify-between text-xs text-violet-700">Replying in thread <button onClick={() => setParentReplyId(null)}>Cancel</button></div>}
      <div className="flex gap-2"><MentionInput value={replyText} onChange={setReplyText} session={session} onSubmit={submitReply} placeholder="Add to the conversation…" className="flex-1" testId="conversation-reply-input" /><button onClick={submitReply} disabled={sending || !replyText.trim()} className="rounded-full bg-violet-600 p-3 text-white disabled:opacity-50"><Send size={16} /></button></div>
    </section>
  </main></div>;
}