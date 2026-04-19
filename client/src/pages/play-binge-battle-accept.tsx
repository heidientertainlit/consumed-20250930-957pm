import { useState, useEffect } from "react";
import { useLocation, useParams } from "wouter";
import { ChevronLeft, Zap, Trophy, AlertCircle, Loader2 } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/lib/supabase";

export default function PlayBingeBattleAccept() {
  const params = useParams<{ battleId: string }>();
  const battleId = params.battleId;
  const [, setLocation] = useLocation();
  const { user } = useAuth();

  const [battle, setBattle] = useState<any>(null);
  const [challengerName, setChallengerName] = useState("");
  const [loading, setLoading] = useState(true);
  const [accepting, setAccepting] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!battleId) return;
    (async () => {
      setLoading(true);
      const { data, error: err } = await supabase
        .from("binge_battles")
        .select("*")
        .eq("id", battleId)
        .single();

      if (err || !data) {
        setError("Battle not found. The link may have expired.");
        setLoading(false);
        return;
      }

      setBattle(data);

      const { data: challenger } = await supabase
        .from("users")
        .select("user_name, display_name")
        .eq("id", data.challenger_id)
        .single();

      setChallengerName(
        challenger?.display_name || challenger?.user_name || "Someone"
      );
      setLoading(false);
    })();
  }, [battleId]);

  async function handleAccept() {
    if (!user?.id || !battle) return;

    if (battle.challenger_id === user.id) {
      setLocation("/play/binge-battle");
      return;
    }

    if (battle.opponent_id && battle.opponent_id !== user.id) {
      setError("This battle already has two competitors.");
      return;
    }

    setAccepting(true);
    const { error: err } = await supabase
      .from("binge_battles")
      .update({ opponent_id: user.id, status: "active", updated_at: new Date().toISOString() })
      .eq("id", battleId)
      .is("opponent_id", null);

    setAccepting(false);

    if (err) {
      setError("Could not join the battle. It may have already started.");
      return;
    }

    // Insert social_posts entry so friends can see the battle started
    const opponentName =
      user.user_metadata?.full_name ||
      user.user_metadata?.display_name ||
      user.user_metadata?.name ||
      user.email?.split("@")[0] ||
      "Someone";

    await supabase.from("social_posts").insert({
      user_id: user.id,
      post_type: "binge_battle",
      content: `${opponentName} and ${challengerName} just started a Binge Battle on ${battle.media_title} — who will finish first?`,
      media_title: battle.media_title,
      media_type: battle.media_type || null,
      image_url: battle.media_poster || null,
      media_external_id: battleId,
      media_external_source: "binge_battle",
    });

    setLocation("/play/binge-battle");
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-[#f8f8fb] flex flex-col items-center justify-center px-6 gap-4">
        <div className="w-14 h-14 rounded-2xl bg-purple-100 flex items-center justify-center">
          <Zap size={24} className="text-purple-600" />
        </div>
        <h2 className="text-[20px] font-black text-gray-900 text-center">Binge Battle Challenge</h2>
        <p className="text-[14px] text-gray-500 text-center">Sign in to accept this challenge and start competing.</p>
        <button
          onClick={() => {
            localStorage.setItem("pendingRoute", `/play/binge-battle/accept/${battleId}`);
            setLocation("/login");
          }}
          className="w-full py-4 rounded-2xl bg-purple-600 text-white font-bold text-[15px] mt-2"
        >
          Sign In to Accept
        </button>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-[#f8f8fb] flex items-center justify-center">
        <Loader2 size={28} className="animate-spin text-purple-400" />
      </div>
    );
  }

  if (error || !battle) {
    return (
      <div className="min-h-screen bg-[#f8f8fb] flex flex-col items-center justify-center px-6 gap-4">
        <div className="w-14 h-14 rounded-full bg-red-100 flex items-center justify-center">
          <AlertCircle size={24} className="text-red-500" />
        </div>
        <h2 className="text-[18px] font-bold text-gray-900 text-center">{error || "Something went wrong"}</h2>
        <button onClick={() => setLocation("/play")} className="text-purple-600 font-semibold text-[14px]">
          Go to Play
        </button>
      </div>
    );
  }

  const isOwner = battle.challenger_id === user.id;
  const isAlreadyOpponent = battle.opponent_id === user.id;
  const isFull = !!battle.opponent_id && !isOwner && !isAlreadyOpponent;
  const isCompleted = battle.status === "completed";

  return (
    <div className="min-h-screen bg-[#f8f8fb] flex flex-col">
      <div className="flex items-center gap-3 px-4 pt-14 pb-3 bg-white border-b border-gray-100">
        <button onClick={() => setLocation("/play")} className="w-8 h-8 flex items-center justify-center rounded-full bg-gray-100">
          <ChevronLeft size={16} className="text-gray-600" />
        </button>
        <h1 className="text-[16px] font-bold text-gray-900">Binge Battle Challenge</h1>
      </div>

      <div className="flex-1 flex flex-col items-center justify-center px-6 gap-5 pb-16">
        {/* Media card */}
        <div className="flex items-center gap-3 bg-white rounded-2xl border border-gray-200 px-4 py-3.5 shadow-sm w-full">
          <div className="w-10 h-14 rounded-lg overflow-hidden bg-purple-100 flex items-center justify-center relative shrink-0">
            <span className="text-[11px] font-black text-purple-300">{battle.media_type?.[0]}</span>
            {battle.media_poster && (
              <img src={battle.media_poster} alt={battle.media_title}
                className="absolute inset-0 w-full h-full object-cover"
                onError={e => { (e.target as HTMLImageElement).style.display = "none"; }} />
            )}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[14px] font-bold text-gray-900 truncate">{battle.media_title}</p>
            <p className="text-[11px] text-gray-500 mt-0.5">{battle.media_sub}</p>
            <p className="text-[11px] text-purple-600 font-semibold mt-0.5">First to finish wins</p>
          </div>
        </div>

        {/* Challenge message */}
        <div className="text-center space-y-1">
          {isOwner && (
            <>
              <p className="text-[18px] font-black text-gray-900">This is your battle</p>
              <p className="text-[13px] text-gray-500">
                {battle.status === "pending" ? "Waiting for someone to accept via your link." : "Battle is already underway."}
              </p>
            </>
          )}
          {isAlreadyOpponent && (
            <>
              <p className="text-[18px] font-black text-gray-900">You're already in this battle</p>
              <p className="text-[13px] text-gray-500">Head to your battle to update your progress.</p>
            </>
          )}
          {isFull && (
            <>
              <p className="text-[18px] font-black text-gray-900">Battle already started</p>
              <p className="text-[13px] text-gray-500">This challenge has two competitors. Start your own!</p>
            </>
          )}
          {!isOwner && !isAlreadyOpponent && !isFull && !isCompleted && (
            <>
              <p className="text-[18px] font-black text-gray-900">{challengerName} challenged you</p>
              <p className="text-[13px] text-gray-500">
                First to finish <span className="font-semibold text-gray-700">{battle.media_title}</span> wins. Accept to start the race.
              </p>
            </>
          )}
        </div>

        {/* Icon */}
        <div className="w-16 h-16 rounded-full bg-purple-100 flex items-center justify-center">
          {isCompleted ? (
            <Trophy size={28} className="text-amber-500" />
          ) : (
            <Zap size={28} className="text-purple-600" />
          )}
        </div>

        {/* CTA */}
        <div className="w-full space-y-3">
          {(isOwner || isAlreadyOpponent) && (
            <button
              onClick={() => setLocation("/play/binge-battle")}
              className="w-full py-4 rounded-2xl font-bold text-[15px] bg-purple-600 text-white flex items-center justify-center gap-2 shadow-lg shadow-purple-200"
            >
              <Zap size={15} /> Go to My Battle
            </button>
          )}
          {!isOwner && !isAlreadyOpponent && !isFull && !isCompleted && (
            <button
              onClick={handleAccept}
              disabled={accepting}
              className="w-full py-4 rounded-2xl font-bold text-[15px] bg-purple-600 text-white flex items-center justify-center gap-2 shadow-lg shadow-purple-200 disabled:opacity-60"
            >
              {accepting ? <Loader2 size={15} className="animate-spin" /> : <Zap size={15} />}
              {accepting ? "Joining..." : "Accept Challenge"}
            </button>
          )}
          {(isFull || isCompleted) && (
            <button
              onClick={() => setLocation("/play/binge-battle")}
              className="w-full py-4 rounded-2xl font-bold text-[15px] bg-purple-600 text-white flex items-center justify-center gap-2 shadow-lg shadow-purple-200"
            >
              <Zap size={15} /> Start My Own Battle
            </button>
          )}
          <button
            onClick={() => setLocation("/play")}
            className="w-full py-3 rounded-2xl font-semibold text-[14px] text-gray-500 text-center"
          >
            Back to Play
          </button>
        </div>
      </div>
    </div>
  );
}
