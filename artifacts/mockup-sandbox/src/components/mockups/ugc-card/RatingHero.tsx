import { useState } from "react";
import { Star, Heart, MessageCircle } from "lucide-react";

const SAMPLE = {
  mediaTitle: "Anxious People",
  mediaType: "Book",
  communityAvg: 4.3,
  friendsAvg: 4.2,
  totalRatings: 128,
  friends: [
    { name: "Kimberly Woods", rating: 4.5, diff: "= avg" },
    { name: "hulabear23", rating: 4.0, diff: "↓ 0.5 below avg" },
    { name: "Jeeppler", rating: 5.0, diff: "↑ 0.5 above avg" },
  ],
  likes: 0,
  commentCount: 4,
};

function TinyStars({ rating }: { rating: number }) {
  return (
    <span className="flex items-center gap-[2px]">
      {[1, 2, 3, 4, 5].map((s) => {
        const filled = rating >= s;
        const half = !filled && rating >= s - 0.5;
        return (
          <span key={s} className="relative inline-block" style={{ width: 12, height: 12 }}>
            <Star size={12} className="text-gray-200 absolute" />
            <span className="absolute inset-0 overflow-hidden" style={{ width: filled ? "100%" : half ? "50%" : "0%" }}>
              <Star size={12} className="fill-yellow-400 text-yellow-400" />
            </span>
          </span>
        );
      })}
    </span>
  );
}

export function RatingHero() {
  const [userRating, setUserRating] = useState(0);
  const [hover, setHover] = useState(0);
  const [submitted, setSubmitted] = useState(false);
  const [liked, setLiked] = useState(false);
  const [likeCount, setLikeCount] = useState(SAMPLE.likes);
  const display = hover || userRating;

  return (
    <div className="flex items-start justify-center min-h-screen bg-gray-100 p-4">
      <div className="w-[340px] bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">

        {/* Media info — compact header */}
        <div className="px-4 pt-4 pb-3">
          <div className="flex items-start justify-between gap-2">
            <div className="flex-1 min-w-0">
              <h2 className="text-gray-900 font-black text-[20px] leading-tight">{SAMPLE.mediaTitle}</h2>
              <div className="flex items-center gap-2 mt-1">
                <span className="text-[9px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded-full bg-violet-100 text-violet-700 border border-violet-200">
                  {SAMPLE.mediaType}
                </span>
                <span className="text-[11px] text-gray-400">
                  Community <span className="text-yellow-500 font-bold">{SAMPLE.communityAvg}★</span>
                </span>
                <span className="text-[11px] text-gray-400">
                  Friends <span className="text-violet-600 font-bold">{SAMPLE.friendsAvg}★</span>
                </span>
              </div>
            </div>
            <div className="w-10 h-14 rounded-lg bg-gradient-to-br from-amber-400 to-orange-500 flex-shrink-0 flex items-center justify-center shadow-sm">
              <span className="text-white text-[10px] font-black text-center leading-tight px-1">AP</span>
            </div>
          </div>
        </div>

        {/* BIG star rating hero — in violet bg section */}
        <div className="bg-gray-50 px-4 py-4 border-y border-gray-100">
          <p className="text-[10px] font-bold text-violet-600 tracking-widest uppercase mb-3">Your Turn · +10 pts</p>
          {submitted ? (
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-1">
                {[1, 2, 3, 4, 5].map((s) => (
                  <Star key={s} size={36} className={userRating >= s ? "fill-yellow-400 text-yellow-400" : "text-gray-200"} />
                ))}
              </div>
              <span className="text-green-600 text-xs font-semibold">✓ Saved!</span>
            </div>
          ) : (
            <>
              <div
                className="flex items-center gap-1"
                onMouseLeave={() => setHover(0)}
              >
                {[1, 2, 3, 4, 5].map((s) => (
                  <button
                    key={s}
                    onMouseEnter={() => setHover(s)}
                    onClick={() => { setUserRating(s); setSubmitted(true); }}
                  >
                    <Star
                      size={36}
                      className={display >= s ? "fill-yellow-400 text-yellow-400" : "text-violet-200"}
                    />
                  </button>
                ))}
              </div>
              <p className="text-[11px] text-gray-400 mt-1.5">
                {hover > 0 ? `${hover} / 5` : "Tap to rate"}
              </p>
            </>
          )}
        </div>

        {/* Friend ratings — no avatars, compact text rows */}
        <div className="px-4 pt-3 pb-1">
          <p className="text-[10px] font-bold text-gray-400 tracking-widest uppercase mb-2">From your friends</p>
        </div>
        <div className="px-4 pb-3 flex flex-col gap-2.5">
          {SAMPLE.friends.map((f) => (
            <div key={f.name} className="flex items-center justify-between">
              <span className="text-xs font-semibold text-gray-800">{f.name}</span>
              <div className="flex flex-col items-end">
                <TinyStars rating={f.rating} />
                <span className="text-[10px] text-gray-400 mt-0.5">{f.diff}</span>
              </div>
            </div>
          ))}
        </div>

        {/* Action bar */}
        <div className="border-t border-gray-100 px-4 py-2.5 flex items-center gap-4">
          <button
            onClick={() => { setLiked((v) => !v); setLikeCount((c) => c + (liked ? -1 : 1)); }}
            className={`flex items-center gap-1.5 ${liked ? "text-red-500" : "text-gray-400"}`}
          >
            <Heart size={15} fill={liked ? "currentColor" : "none"} />
            <span className="text-xs">{likeCount}</span>
          </button>
          <button className="flex items-center gap-1.5 text-gray-400">
            <MessageCircle size={15} />
            <span className="text-xs">{SAMPLE.commentCount}</span>
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
