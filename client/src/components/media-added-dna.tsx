import { Dna } from "lucide-react";
import "./media-added-dna.css";

export interface MediaAddedDnaProps {
  reduceMotion: boolean;
  impactDelayMs: number;
}

export function MediaAddedDna({ reduceMotion, impactDelayMs }: MediaAddedDnaProps) {
  const delay = Math.max(0, impactDelayMs);

  return (
    <span
      className={`media-added-dna${reduceMotion ? " media-added-dna--reduced-motion" : ""}`}
      aria-hidden="true"
    >
      <Dna
        key={delay}
        className="media-added-dna__icon"
        style={{ animationDelay: `${delay}ms` }}
        strokeWidth={1.8}
      />
      <span className="media-added-dna__caption">Entertainment DNA</span>
    </span>
  );
}
