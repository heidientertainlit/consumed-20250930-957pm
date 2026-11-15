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
    <div className="flex min-w-0 flex-1 items-center gap-2 rounded-xl border border-[#e8e1eb] bg-[#faf8fb] px-3 py-2">
      <div className="min-w-0 flex-1">
        <MentionInput
          value={value}
          onChange={onChange}
          placeholder="Add a comment…"
          session={session}
          disabled={submitting}
          testId="rating-comment-input"
          onSubmit={submit}
          className="h-9 w-full min-w-0 rounded-none border-0 bg-transparent px-0 py-0 text-[13px] font-normal text-[#362c3c] shadow-none outline-none placeholder:text-[#9b8fa1] focus-visible:border-transparent focus-visible:ring-0 focus-visible:ring-offset-0 disabled:opacity-60 md:text-[13px]"
        />
      </div>
      <button
        type="button"
        onClick={(event) => { event.stopPropagation(); submit(); }}
        disabled={!canSend}
        aria-label="Send reply"
        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[#7526b2] transition-colors hover:bg-violet-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-400 focus-visible:ring-offset-2 disabled:opacity-30"
      >
        <Send size={14} className="text-white" aria-hidden="true" />
      </button>
    </div>
  );
}
