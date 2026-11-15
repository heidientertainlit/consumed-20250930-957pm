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
    <>
      <div className="min-w-0 flex-1">
        <MentionInput
          value={value}
          onChange={onChange}
          placeholder="Join the conversation..."
          session={session}
          disabled={submitting}
          testId="rating-comment-input"
          onSubmit={submit}
          className="h-11 w-full min-w-0 rounded-full border border-[#e7e5e9] bg-white px-4 py-0 text-[14px] font-normal text-gray-700 shadow-none placeholder:text-gray-400 focus-visible:border-violet-300 focus-visible:ring-2 focus-visible:ring-violet-100 focus-visible:ring-offset-0 disabled:opacity-60"
        />
      </div>
      <button
        type="button"
        onClick={(event) => { event.stopPropagation(); submit(); }}
        disabled={!canSend}
        aria-label="Send reply"
        className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-400 focus-visible:ring-offset-2 ${
          canSend
            ? "bg-violet-600 hover:bg-violet-700 active:bg-violet-800"
            : "bg-[#eee8ff]"
        }`}
      >
        <Send size={18} strokeWidth={1.75} className="ml-px text-white" aria-hidden="true" />
      </button>
    </>
  );
}
