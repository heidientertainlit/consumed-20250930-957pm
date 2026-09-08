interface RatingSaveFeedbackProps {
  saving: boolean;
  pendingRating: number | null;
  error: string | null;
  justSaved?: boolean;
  onRetry: () => void;
}

export function RatingSaveFeedback({ saving, pendingRating, error, justSaved, onRetry }: RatingSaveFeedbackProps) {
  return (
    <div className="mx-3" onClick={event => event.stopPropagation()}>
      <p role="status" aria-live="polite" className="text-xs text-violet-600">
        {saving ? `Saving ${pendingRating}/5…` : justSaved ? `Saved ${pendingRating}/5` : ""}
      </p>
      {error && (
        <div role="alert" className="flex items-center gap-2 py-2 text-xs text-red-700">
          <span>{error}</span>
          <button type="button" disabled={saving} onClick={onRetry} className="shrink-0 font-semibold underline">
            Retry
          </button>
        </div>
      )}
    </div>
  );
}