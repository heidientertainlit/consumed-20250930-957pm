import { useRef, useState } from "react";
import { Star } from "lucide-react";

interface InlineFeedStarRaterProps {
  onRate: (rating: number) => void;
}

/** Keep the half-star hit areas stationary while previewing a rating. */
export function InlineFeedStarRater({ onRate }: InlineFeedStarRaterProps) {
  const [preview, setPreview] = useState(0);
  const starsRef = useRef<HTMLDivElement>(null);
  const touchId = useRef<number | null>(null);
  const ignoreMouseUntil = useRef(0);

  const ratingAt = (clientX: number) => {
    const stars = starsRef.current?.children;
    if (!stars?.length) return 0;
    for (let index = 0; index < stars.length; index++) {
      const rect = stars[index].getBoundingClientRect();
      if (clientX < rect.left + rect.width / 2) return index + 0.5;
      if (clientX <= rect.right) return index + 1;
      const next = stars[index + 1]?.getBoundingClientRect();
      if (next && clientX < (rect.right + next.left) / 2) return index + 1;
    }
    return 5;
  };

  return (
    <div
      className="flex items-center gap-2 mb-3 mx-3 py-3 px-3 bg-violet-50 rounded-xl select-none"
      onClick={(event) => event.stopPropagation()}
    >
      <span className="w-10 shrink-0 text-[10px] font-bold text-violet-600 tracking-widest uppercase">
        Your Turn
      </span>
      <div
        ref={starsRef}
        role="group"
        aria-label="Choose your star rating"
        className="flex flex-1 min-w-0 max-w-[196px] gap-1 touch-none"
        onMouseLeave={() => { if (touchId.current === null) setPreview(0); }}
        onBlur={(event) => {
          if (!event.currentTarget.contains(event.relatedTarget)) setPreview(0);
        }}
        onTouchStart={(event) => {
          event.stopPropagation();
          ignoreMouseUntil.current = performance.now() + 800;
          if (event.touches.length !== 1) {
            touchId.current = null;
            setPreview(0);
            return;
          }
          const touch = event.touches[0];
          touchId.current = touch.identifier;
          setPreview(ratingAt(touch.clientX));
        }}
        onTouchMove={(event) => {
          event.stopPropagation();
          const touch = Array.from(event.touches).find(t => t.identifier === touchId.current);
          if (touch) setPreview(ratingAt(touch.clientX));
        }}
        onTouchEnd={(event) => {
          event.stopPropagation();
          // A touch commits once here, not again through the generated mouse click.
          event.preventDefault();
          ignoreMouseUntil.current = performance.now() + 800;
          const touch = Array.from(event.changedTouches).find(t => t.identifier === touchId.current);
          touchId.current = null;
          if (touch) onRate(ratingAt(touch.clientX));
          setPreview(0);
        }}
        onTouchCancel={(event) => {
          event.stopPropagation();
          touchId.current = null;
          ignoreMouseUntil.current = performance.now() + 800;
          setPreview(0);
        }}
      >
        {[1, 2, 3, 4, 5].map(star => (
          <div key={star} className="relative flex-1 min-w-0 aspect-square">
            <Star className="absolute inset-0 w-full h-full text-violet-200 pointer-events-none" />
            <Star
              className="absolute inset-0 w-full h-full fill-yellow-400 text-yellow-400 pointer-events-none"
              style={{ clipPath: `inset(0 ${preview >= star ? 0 : preview >= star - 0.5 ? 50 : 100}% 0 0)` }}
            />
            {[star - 0.5, star].map((rating, half) => (
              <button
                key={rating}
                type="button"
                aria-label={`Rate ${rating}`}
                className={`absolute inset-y-0 w-1/2 z-10 rounded-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-violet-600 ${half ? "right-0" : "left-0"}`}
                onMouseEnter={() => {
                  if (performance.now() >= ignoreMouseUntil.current) setPreview(rating);
                }}
                onFocus={() => setPreview(rating)}
                onClick={(event) => {
                  event.stopPropagation();
                  if (event.detail !== 0 && performance.now() < ignoreMouseUntil.current) return;
                  onRate(rating);
                }}
              />
            ))}
          </div>
        ))}
      </div>
      <span
        className={`w-8 shrink-0 text-xs text-gray-400 tabular-nums ${preview ? "" : "invisible"}`}
        aria-hidden={!preview}
      >
        {preview || 0}/5
      </span>
    </div>
  );
}