import FeedComposerBar from "@/components/feed-composer-bar";

export default function AddMediaPage() {
  return (
    <div className="min-h-screen" style={{ background: 'linear-gradient(160deg, #0a0a0f 0%, #12121f 50%, #2d1f4e 100%)' }}>
      <FeedComposerBar pageMode={true} />
    </div>
  );
}
