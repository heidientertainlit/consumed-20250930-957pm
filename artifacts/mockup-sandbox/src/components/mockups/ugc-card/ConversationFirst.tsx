import { useState } from "react";
import { Star, Send, MessageCircle, Heart, Flag } from "lucide-react";

const SAMPLE = {
  mediaTitle: "Anxious People",
  mediaType: "Book",
  author: "Kimberly Woods",
  authorRating: 4.5,
  authorReview: "Genuinely one of the most moving books I've ever read. Funny and heartbreaking at once.",
  friends: [
    { name: "hulabear23", rating: 4.0, diff: "= avg" },
    { name: "Jeeppler", rating: 5.0, diff: "↑ 0.5 above avg" },
  ],
  existingComments: [
    { name: "hulabear23", text: "The ending had me in tears honestly" },
  ],
  likes: 0,
  commentCount: 3,
};

function MiniStars({ rating, size = 12 }: { rating: number; size?: number }) {
  return (
    <span className="flex items-center gap-[2px]">
      {[1, 2, 3, 4, 5].map((s) => {
        const filled = rating >= s;
        const half = !filled && rating >= s - 0.5;
        return (
          <span key={s} className="relative inline-block" style={{ width: size, height: size }}>
            <Star size={size} className="text-gray-200 absolute" />
            <span className="absolute inset-0 overflow-hidden" style={{ width: filled ? "100%" : half ? "50%" : "0%" }}>
              <Star size={size} className="fill-yellow-400 text-yellow-400" />
            </span>
          </span>
        );
      })}
    </span>
  );
}

function BigStars({ onRate }: { onRate: (v: number) => void }) {
  const [hover, setHover] = useState(0);
  const [selected, setSelected] = useState(0);
  const display = hover || selected;
  return (
    <div className="flex items-center gap-2" onMouseLeave={() => setHover(0)}>
      {[1, 2, 3, 4, 5].map((s) => (
        <button
          key={s}
          onMouseEnter={() => setHover(s)}
          onClick={() => { setSelected(s); onRate(s); }}
        >
          <Star
            size={40}
            className={display >= s ? "fill-yellow-400 text-yellow-400" : "text-violet-200"}
          />
        </button>
      ))}
    </div>
  );
}

export function ConversationFirst() {
  const [rated, setRated] = useState(false);
  const [liked, setLiked] = useState(false);
  const [likeCount, setLikeCount] = useState(SAMPLE.likes);
  const [showComments, setShowComments] = useState(false);
  const [comment, setComment] = useState("");
  const [extraComments, setExtraComments] = useState<{ name: string; text: string }[]>([]);

  const allComments = [...SAMPLE.existingComments, ...extraComments];

  const submitComment = () => {
    if (!comment.trim()) return;
    setExtraComments((c) => [...c, { name: "You", text: comment }]);
    setComment("");
  };

  return (
    <div className="flex items-start justify-center min-h-screen bg-gray-100 p-4">
      <div className="w-[340px] bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">

        {/* Action section — gray bg */}
        <div className="bg-gray-50 px-4 pt-4 pb-4">
          <div className="flex items-center gap-2 mb-2">
            <p className="text-[10px] font-bold text-violet-600 tracking-widest uppercase">What's Your Take?</p>
            <span className="text-[9px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded-full bg-violet-100 text-violet-700 border border-violet-200">
              {SAMPLE.mediaType}
            </span>
          </div>
          {/* Media row */}
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-14 rounded-lg bg-gradient-to-br from-amber-400 to-orange-500 flex-shrink-0 flex items-center justify-center shadow-sm">
              <span className="text-white text-[10px] font-black text-center leading-tight px-1">AP</span>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-bold text-gray-900">{SAMPLE.mediaTitle}</p>
              <p className="text-[11px] text-gray-400 mt-0.5">Have you seen it? Rate it.</p>
            </div>
            <div className="flex items-center px-2 py-1 rounded-full bg-gray-100 border border-gray-200 flex-shrink-0">
              <span className="text-[10px] font-bold text-gray-500">+10 pts</span>
            </div>
          </div>
          {/* Stars */}
          {rated ? (
            <p className="text-xs text-green-600 font-semibold py-1">✓ Rated! Thanks for sharing.</p>
          ) : (
            <BigStars onRate={() => setRated(true)} />
          )}
        </div>

        {/* "From your friends" divider — replaces "From your feed" */}
        <div className="px-4 pt-3 pb-1">
          <p className="text-[10px] font-bold text-gray-400 tracking-widest uppercase">
            From your friends
          </p>
        </div>

        {/* Friend rows — no avatars, just names + stars + diff */}
        <div className="px-4 pb-3 flex flex-col gap-2.5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-gray-800">{SAMPLE.author}</span>
            <div className="flex flex-col items-end">
              <MiniStars rating={SAMPLE.authorRating} />
              <span className="text-[10px] text-gray-400 mt-0.5">= Average rating</span>
            </div>
          </div>
          {SAMPLE.friends.map((f) => (
            <div key={f.name} className="flex items-center justify-between">
              <span className="text-xs font-semibold text-gray-700">{f.name}</span>
              <div className="flex flex-col items-end">
                <MiniStars rating={f.rating} />
                <span className="text-[10px] text-gray-400 mt-0.5">{f.diff}</span>
              </div>
            </div>
          ))}
        </div>

        {/* Inline comment preview — always visible, no expand needed */}
        <div className="border-t border-gray-100 px-4 pt-2.5 pb-2">
          {allComments.slice(0, 2).map((c, i) => (
            <div key={i} className="flex items-baseline gap-1.5 mb-1.5">
              <span className="text-[11px] font-bold text-gray-600">{c.name}</span>
              <span className="text-[11px] text-gray-500 line-clamp-1">{c.text}</span>
            </div>
          ))}
          {SAMPLE.commentCount > 1 && (
            <button
              onClick={() => setShowComments((v) => !v)}
              className="text-[10px] text-violet-500 font-semibold"
            >
              {showComments ? "Hide" : `View all ${SAMPLE.commentCount} comments`}
            </button>
          )}
        </div>

        {/* Always-visible comment input */}
        <div className="border-t border-gray-100 px-3 py-2.5 flex items-center gap-2">
          <input
            type="text"
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && submitComment()}
            placeholder="Add your take..."
            className="flex-1 text-[12px] bg-gray-50 text-gray-800 placeholder:text-gray-400 rounded-full px-3 py-1.5 focus:outline-none focus:ring-1 focus:ring-violet-400 border border-gray-200"
          />
          <button
            onClick={submitComment}
            disabled={!comment.trim()}
            className="w-7 h-7 rounded-full bg-violet-600 disabled:opacity-30 flex items-center justify-center flex-shrink-0"
          >
            <Send size={12} className="text-white" />
          </button>
        </div>

        {/* Action bar */}
        <div className="border-t border-gray-100 px-4 py-2.5 flex items-center gap-4">
          <button
            onClick={() => { setLiked((v) => !v); setLikeCount((c) => c + (liked ? -1 : 1)); }}
            className={`flex items-center gap-1.5 text-sm ${liked ? "text-red-500" : "text-gray-400"}`}
          >
            <Heart size={15} fill={liked ? "currentColor" : "none"} />
            <span className="text-xs">{likeCount}</span>
          </button>
          <button className="flex items-center gap-1.5 text-gray-400">
            <MessageCircle size={15} />
            <span className="text-xs">{allComments.length}</span>
          </button>
          <div className="ml-auto flex items-center gap-2 text-gray-400 text-xs">
            <span className="font-semibold text-amber-500">Book</span>
            <span>10h</span>
          </div>
        </div>
      </div>
    </div>
  );
}
