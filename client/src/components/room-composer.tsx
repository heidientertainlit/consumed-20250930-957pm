import { useState } from "react";
import type { ReactNode, ComponentType } from "react";
import { MessageCircle, Flame, Brain, CircleHelp, Loader2 } from "lucide-react";

export type ComposerTag = { label: string; db: string; icon: ComponentType<any>; bg: string; fg: string };

// ── Conversation tags (Discussion is the default). Shared between rooms and
// media-detail so the composer + tag pills stay identical everywhere. ──
export const DISCUSSION_TAGS: ComposerTag[] = [
  { label: "Discussion", db: "discussion", icon: MessageCircle, bg: "#f3effe", fg: "#7c3aed" },
  { label: "Take", db: "take", icon: Flame, bg: "#fff1e8", fg: "#f97316" },
  { label: "Theory", db: "theory", icon: Brain, bg: "#f3effe", fg: "#7c3aed" },
  { label: "Question", db: "question", icon: CircleHelp, bg: "#eaf1ff", fg: "#2563eb" },
];

export const DEFAULT_TAG_DB = "discussion";

// Map a stored DB tag value (incl. legacy values) to a display tag.
export function dbTagToDisplay(dbTag: string | null | undefined) {
  const t = String(dbTag || "").toLowerCase();
  if (t === "take" || t === "hot_take") return DISCUSSION_TAGS[1];
  if (t === "theory") return DISCUSSION_TAGS[2];
  if (t === "question") return DISCUSSION_TAGS[3];
  if (t === "discussion" || t === "debate") return DISCUSSION_TAGS[0];
  return null;
}

interface RoomComposerProps {
  onSubmit: (data: { title: string; body: string; tag: string }) => Promise<boolean | void> | boolean | void;
  posting?: boolean;
  titlePlaceholder?: string;
  bodyPlaceholder?: string;
  tags?: ComposerTag[];
  defaultTag?: string;
  // Extra fields rendered under the body, driven by the active tag (e.g. a star
  // rating for "rate", option inputs for "predict"). Parent owns that state.
  renderExtra?: (activeTag: string) => ReactNode;
  // Custom rule for whether Post is enabled. Defaults to "requires a title".
  canSubmit?: (data: { title: string; body: string; tag: string }) => boolean;
  // Render the tag pills in a lighter, more compact style (smaller pills,
  // tighter spacing). Opt-in so other surfaces keep the default look.
  compactTags?: boolean;
}

export default function RoomComposer({
  onSubmit,
  posting = false,
  titlePlaceholder = "Add a title…",
  bodyPlaceholder = "What's on your mind?",
  tags = DISCUSSION_TAGS,
  defaultTag = DEFAULT_TAG_DB,
  renderExtra,
  canSubmit,
  compactTags = false,
}: RoomComposerProps) {
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [tag, setTag] = useState<string>(defaultTag);

  const allowSubmit = (data: { title: string; body: string; tag: string }) =>
    canSubmit ? canSubmit(data) : !!data.title;

  const submit = async () => {
    const data = { title: title.trim(), body: body.trim(), tag };
    if (posting || !allowSubmit(data)) return;
    const ok = await onSubmit(data);
    if (ok !== false) {
      setTitle("");
      setBody("");
      setTag(defaultTag);
    }
  };

  const disabled = posting || !allowSubmit({ title: title.trim(), body: body.trim(), tag });

  return (
    <div className="rounded-2xl border border-gray-200 bg-white shadow-sm overflow-hidden">
      <div className="px-4 pt-4 pb-3">
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder={titlePlaceholder}
          className="w-full border-0 outline-none bg-transparent text-[17px] font-semibold text-gray-900 placeholder:text-gray-400 mb-2"
        />
        <textarea
          rows={2}
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder={bodyPlaceholder}
          className="w-full resize-none border-0 outline-none bg-transparent text-[15px] text-gray-700 placeholder:text-gray-400"
        />
        {renderExtra && <div>{renderExtra(tag)}</div>}
      </div>
      <div className={`border-t border-gray-100 px-4 ${compactTags ? "py-2.5" : "py-3"}`}>
        <p className={`text-[12px] font-semibold text-gray-400 ${compactTags ? "mb-1.5" : "mb-2.5"}`}>Tag your post</p>
        <div className={`flex flex-wrap items-center ${compactTags ? "gap-1.5" : "gap-2"}`}>
          {tags.map((s) => {
            const Icon = s.icon;
            const active = tag === s.db;
            return (
              <button
                key={s.db}
                type="button"
                onClick={() => setTag(s.db)}
                className={`inline-flex items-center rounded-full font-semibold border transition-all active:scale-95 ${compactTags ? "gap-1 px-2.5 py-1 text-[12px]" : "gap-1.5 px-3 py-1.5 text-[13px]"}`}
                style={active ? { background: s.bg, color: s.fg, borderColor: s.fg } : { background: "#fff", color: "#6b7280", borderColor: "#e5e7eb" }}
              >
                <Icon size={compactTags ? 12 : 14} style={active ? { color: s.fg } : undefined} /> {s.label}
              </button>
            );
          })}
          <button
            type="button"
            onClick={submit}
            disabled={disabled}
            className="ml-auto inline-flex items-center justify-center gap-1.5 rounded-full px-5 py-2 text-[14px] font-semibold text-white active:scale-95 transition-all disabled:opacity-40"
            style={{ background: "#7c3aed" }}
          >
            {posting && <Loader2 size={15} className="animate-spin" />} Post
          </button>
        </div>
      </div>
    </div>
  );
}
