import { useRef, useState } from "react";
import { Star, X } from "lucide-react";

interface StarRaterProps {
  value: number;
  onChange: (value: number) => void;
  label?: string;
  size?: number;
}

export function StarRater({ value, onChange, label = "Add Rating", size = 36 }: StarRaterProps) {
  const [hover, setHover] = useState(0);
  const rowRef = useRef<HTMLDivElement>(null);
  const draggingRef = useRef(false);

  const active = hover || value;

  const valueFromX = (clientX: number): number => {
    if (!rowRef.current) return 0;
    const rect = rowRef.current.getBoundingClientRect();
    const x = Math.max(0, Math.min(rect.width - 1, clientX - rect.left));
    const starWidth = rect.width / 5;
    const starIndex = Math.floor(x / starWidth);
    const withinStar = (x % starWidth) / starWidth;
    const val = starIndex + (withinStar < 0.5 ? 0.5 : 1);
    return Math.max(0.5, Math.min(5, Math.round(val * 2) / 2));
  };

  return (
    <div>
      <p className="text-[12px] font-semibold text-gray-400 mb-1.5">
        {label} <span className="font-normal">(optional)</span>
      </p>
      <div className="flex items-center gap-3">
        <div
          ref={rowRef}
          className="flex gap-1.5 touch-none select-none"
          onMouseLeave={() => setHover(0)}
          onTouchStart={(e) => {
            draggingRef.current = true;
            setHover(valueFromX(e.touches[0].clientX));
          }}
          onTouchMove={(e) => {
            if (!draggingRef.current) return;
            e.stopPropagation();
            setHover(valueFromX(e.touches[0].clientX));
          }}
          onTouchEnd={(e) => {
            draggingRef.current = false;
            const val = valueFromX(e.changedTouches[0].clientX);
            if (val > 0) onChange(val);
            setHover(0);
          }}
        >
          {[1, 2, 3, 4, 5].map((star) => {
            const isFull = active >= star;
            const isHalf = !isFull && active >= star - 0.5;
            return (
              <div key={star} className="relative" style={{ width: size, height: size }}>
                <Star size={size} className="absolute inset-0 text-gray-300" />
                {(isFull || isHalf) && (
                  <div
                    className="absolute inset-0 overflow-hidden pointer-events-none"
                    style={{ width: isFull ? "100%" : "50%" }}
                  >
                    <Star size={size} className="fill-yellow-400 text-yellow-400" />
                  </div>
                )}
                <button
                  type="button"
                  aria-label={`Rate ${star - 0.5} stars`}
                  className="absolute inset-y-0 left-0 w-1/2 z-10"
                  onClick={() => onChange(star - 0.5)}
                  onMouseEnter={() => setHover(star - 0.5)}
                />
                <button
                  type="button"
                  aria-label={`Rate ${star} stars`}
                  className="absolute inset-y-0 right-0 w-1/2 z-10"
                  onClick={() => onChange(star)}
                  onMouseEnter={() => setHover(star)}
                />
              </div>
            );
          })}
        </div>
        {active > 0 && (
          <span className="text-[15px] font-bold text-gray-700 min-w-[32px]">{active.toFixed(1)}</span>
        )}
        {value > 0 && (
          <button
            type="button"
            aria-label="Clear rating"
            onClick={() => onChange(0)}
            className="flex items-center gap-0.5 text-[11px] font-medium text-gray-400 hover:text-gray-600 px-2 py-1 rounded-full bg-gray-100"
          >
            <X size={11} /> Clear
          </button>
        )}
      </div>
    </div>
  );
}
