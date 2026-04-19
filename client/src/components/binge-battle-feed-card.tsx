import { Zap } from "lucide-react";
import { useLocation } from "wouter";

interface BingeBattleFeedCardProps {
  post: {
    id: string;
    content: string;
    image_url?: string;
    media_title?: string;
    timestamp?: string;
    user?: {
      displayName?: string;
      username?: string;
    };
  };
}

export default function BingeBattleFeedCard({ post }: BingeBattleFeedCardProps) {
  const [, setLocation] = useLocation();

  return (
    <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden mb-4">
      <div className="p-4">
        <div className="flex items-start gap-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5 mb-2">
              <div className="w-5 h-5 rounded-md bg-purple-100 flex items-center justify-center shrink-0">
                <Zap size={11} className="text-purple-600" />
              </div>
              <span className="text-[11px] font-bold text-purple-600 uppercase tracking-wide">Binge Battle</span>
            </div>
            <p className="text-[14px] font-semibold text-gray-900 leading-snug">{post.content}</p>
            {post.media_title && (
              <p className="text-[12px] text-gray-400 mt-1">{post.media_title}</p>
            )}
          </div>
          {post.image_url && (
            <div className="w-12 h-16 rounded-lg overflow-hidden shrink-0 bg-gray-100">
              <img
                src={post.image_url}
                alt={post.media_title || ""}
                className="w-full h-full object-cover"
                onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
              />
            </div>
          )}
        </div>
      </div>
      <div className="border-t border-gray-100 px-4 py-2.5">
        <button
          onClick={() => setLocation("/play/binge-battle")}
          className="w-full py-2 rounded-xl bg-purple-600 text-white font-semibold text-[13px] flex items-center justify-center gap-1.5"
        >
          <Zap size={13} />
          Start Your Own Battle
        </button>
      </div>
    </div>
  );
}
