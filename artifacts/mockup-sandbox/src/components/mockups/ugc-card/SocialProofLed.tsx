import { useState } from "react";
import { Star, Heart, MessageCircle, ChevronDown } from "lucide-react";

const SAMPLE = {
  mediaTitle: "Anxious People",
  mediaType: "Book",
  friendCount: 3,
  friendsAvg: 4.5,
  friends: [
    { name: "Kimberly Woods", rating: 4.5, review: "Life-changing read." },
    { name: "hulabear23", rating: 4.0, review: null },
    { name: "Jeeppler", rating: 5.0, review: "Perfect." },
  ],
  ratingDist: { 5: 52, 4: 31, 3: 12, 2: 3, 1: 2 },
  likes: 0,
  commentCount: 4,
};

function TinyStars({ rating, size = 12 }: { rating: number; size?: number }) {
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

export function SocialProofLed() {
  const [showStars, setShowStars] = useState(false);
  const [userRating, setUserRating] = useState(0);
  const [hover, setHover] = useState(0);
  const [submitted, setSubmitted] = useState(false);
  const [liked, setLiked] = useState(false);
  const [likeCount, setLikeCount] = useState(SAMPLE.likes);
  const display = hover || userRating;

  return (
    <div className="flex items-start justify-center min-h-screen bg-gray-100 p-4">
      <div className="w-[340px] bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">

        {/* Social proof lead — friends count is the hero */}
        <div className="bg-gray-50 px-4 pt-4 pb-4 border-b border-gray-100">
          <div className="flex items-start gap-3">
            <div className="w-10 h-14 rounded-lg bg-gradient-to-br from-amber-400 to-orange-500 flex-shrink-0 flex items-center justify-center shadow-sm">
              <span className="text-white text-[10px] font-black text-center leading-tight px-1">AP</span>
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1.5 mb-0.5">
                <span className="text-[9px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded-full bg-violet-100 text-violet-700 border border-violet-200">
                  {SAMPLE.mediaType}
                </span>
              </div>
              <p className="text-gray-900 font-bold text-[15px] leading-tight">{SAMPLE.mediaTitle}</p>
              {/* Social proof headline */}
              <div className="flex items-center gap-1.5 mt-1">
                <span className="text-[12px] font-bold text-violet-600">{SAMPLE.friendCount} friends</span>
                <span className="text-[12px] text-gray-500">rated this</span>
                <span className="text-gray-300">·</span>
                <span className="text-[12px] font-bold text-yellow-500">{SAMPLE.friendsAvg}★</span>
                <span className="text-[11px] text-gray-400">avg</span>
              </div>
            </div>
          </div>
        </div>

        {/* Rating distribution mini-chart */}
        <div className="px-4 pt-3 pb-2">
          <div className="flex flex-col gap-1">
            {[5, 4, 3].map((star) => (
              <div key={star} className="flex items-center gap-2">
                <span className="text-[10px] text-gray-400 w-3 text-right">{star}</span>
                <Star size={9} className="fill-yellow-400 text-yellow-400 flex-shrink-0" />
                <div className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-yellow-400 rounded-full"
                    style={{ width: `${SAMPLE.ratingDist[star as keyof typeof SAMPLE.ratingDist]}%` }}
                  />
                </div>
                <span className="text-[10px] text-gray-400 w-6 text-right">
                  {SAMPLE.ratingDist[star as keyof typeof SAMPLE.ratingDist]}%
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Friend rows — no avatars */}
        <div className="border-t border-gray-100 px-4 pt-2.5 pb-3">
          <p className="text-[10px] font-bold text-gray-400 tracking-widest uppercase mb-2">Your circle</p>
          <div className="flex flex-col gap-2">
            {SAMPLE.friends.map((f) => (
              <div key={f.name} className="flex items-center justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <span className="text-xs font-semibold text-gray-800">{f.name}</span>
                  {f.review && (
                    <span className="text-[11px] text-gray-400 ml-1.5 italic">"{f.review}"</span>
                  )}
                </div>
                <TinyStars rating={f.rating} />
              </div>
            ))}
          </div>
        </div>

        {/* Progressive star reveal — collapsed by default */}
        <div className="border-t border-gray-100 px-4 py-3">
          {!showStars ? (
            <button
              onClick={() => setShowStars(true)}
              className="w-full flex items-center justify-between text-violet-600 hover:text-violet-700"
            >
              <span className="text-xs font-bold">Rate it · +10 pts</span>
              <ChevronDown size={14} />
            </button>
          ) : submitted ? (
            <div className="flex items-center gap-3">
              <div className="flex gap-1">
                {[1, 2, 3, 4, 5].map((s) => (
                  <Star key={s} size={30} className={userRating >= s ? "fill-yellow-400 text-yellow-400" : "text-gray-200"} />
                ))}
              </div>
              <span className="text-green-600 text-xs font-semibold">✓ Rated!</span>
            </div>
          ) : (
            <div>
              <p className="text-[10px] font-bold text-violet-600 tracking-widest uppercase mb-2">What's Your Take?</p>
              <div
                className="flex gap-1"
                onMouseLeave={() => setHover(0)}
              >
                {[1, 2, 3, 4, 5].map((s) => (
                  <button
                    key={s}
                    onMouseEnter={() => setHover(s)}
                    onClick={() => { setUserRating(s); setSubmitted(true); }}
                  >
                    <Star
                      size={30}
                      className={display >= s ? "fill-yellow-400 text-yellow-400" : "text-violet-200"}
                    />
                  </button>
                ))}
              </div>
            </div>
          )}
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
            <span className="text-xs">{SAMPLE.commentCount} replies</span>
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
