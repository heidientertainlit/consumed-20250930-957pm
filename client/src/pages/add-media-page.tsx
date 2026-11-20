import FeedComposerBar from "@/components/feed-composer-bar";

export default function AddMediaPage({ onReturnToNow, onMediaAdded, backgroundOnly = false }: {
  onReturnToNow?: () => void;
  onMediaAdded?: () => void;
  backgroundOnly?: boolean;
}) {
  return (
    <div className={backgroundOnly ? "contents" : "min-h-screen bg-[#fbf8f5]"}>
      <FeedComposerBar pageMode={true} onReturnToNow={onReturnToNow} onMediaAdded={onMediaAdded} backgroundOnly={backgroundOnly} />
    </div>
  );
}
