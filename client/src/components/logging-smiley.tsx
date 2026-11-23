import { IdentityFace } from "./identity-face";
import "./finished-review-completion.css";

/** The same face and one-shot bounce for every confirmed logging action. */
export function LoggingSmiley({ reduceMotion, testId }: { reduceMotion: boolean; testId: string }) {
  return (
    <span className={`finished-review-completion__art${reduceMotion ? "" : " finished-review-completion--animated"}`} aria-hidden="true">
      <svg className="finished-review-completion__bursts" viewBox="0 0 150 150" aria-hidden="true">
        <path className="finished-review-completion__burst finished-review-completion__burst--one" d="M75 8v15" />
        <path className="finished-review-completion__burst finished-review-completion__burst--two" d="m27 31 11 11" />
        <path className="finished-review-completion__burst finished-review-completion__burst--three" d="m123 31-11 11" />
        <path className="finished-review-completion__burst finished-review-completion__burst--four" d="M12 76h16" />
        <path className="finished-review-completion__burst finished-review-completion__burst--five" d="M122 76h16" />
      </svg>
      <span className="finished-review-completion__face" data-testid={testId}>
        <IdentityFace size={84} />
      </span>
    </span>
  );
}
