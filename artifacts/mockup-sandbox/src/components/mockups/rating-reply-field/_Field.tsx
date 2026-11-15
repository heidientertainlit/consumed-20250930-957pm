import { Send } from "lucide-react";
import MentionInput from "./_MentionInput";

interface RatingCommentFieldProps {
  value: string;
  onChange: (value: string) => void;
  onSubmit: () => void;
  session: any;
  submitting: boolean;
}

export default function RatingCommentField({
  value,
  onChange,
  onSubmit,
  session,
  submitting,
}: RatingCommentFieldProps) {
  const canSend = !submitting && !!value.trim();
  const submit = () => {
    if (canSend) onSubmit();
  };

  return (
    <div className="flex h-9 min-w-0 flex-1 items-center gap-2 rounded-full border border-[#e5e5eb] bg-transparent pl-3 pr-1">
      <div className="min-w-0 flex-1">
        <MentionInput
          value={value}
          onChange={onChange}
          placeholder="Add a comment…"
          session={session}
          disabled={submitting}
          testId="rating-comment-input"
          onSubmit={submit}
          className="h-8 w-full min-w-0 rounded-none border-0 bg-transparent px-0 py-0 text-[13px] font-normal text-[#362c3c] shadow-none outline-none placeholder:text-[#9a9ba3] focus-visible:border-transparent focus-visible:ring-0 focus-visible:ring-offset-0 disabled:opacity-60 md:text-[13px]"
        />
      </div>
      <button
        type="button"
        onClick={(event) => { event.stopPropagation(); submit(); }}
        disabled={!canSend}
        aria-label="Send reply"
        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[#9d88b2] transition-colors hover:text-violet-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-400 disabled:opacity-60"
      >
        <Send size={16} strokeWidth={1.75} aria-hidden="true" />
      </button>
    </div>
  );
}
