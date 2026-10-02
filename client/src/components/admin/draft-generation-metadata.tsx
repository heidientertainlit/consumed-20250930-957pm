import { parseGenerationNotes } from "../../../../supabase/functions/_shared/persona-generation";

type Props = { notes: string | null };

export default function DraftGenerationMetadata({ notes }: Props) {
  if (!notes) return null;
  const metadata = parseGenerationNotes(notes);
  if (!metadata) {
    return <p className="mt-1.5 whitespace-pre-wrap break-words text-xs italic text-gray-500">{notes}</p>;
  }

  return (
    <div className="mt-2 space-y-2 rounded-lg border border-purple-900/40 bg-purple-950/20 p-3 text-xs">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <span className="font-medium text-purple-200">{metadata.modeLabel}</span>
        <span className="text-gray-500">{metadata.mediaSource}</span>
        <span className="text-gray-500">{metadata.words} words</span>
        <span className={metadata.recentlyUsed ? "text-amber-300" : "text-gray-500"}>
          Recently used: {metadata.recentlyUsed ? "Yes" : "No"}
        </span>
      </div>
      <p className="text-[11px] text-gray-400">
        Voice: {metadata.voice.length}, {metadata.voice.energy}, {metadata.voice.capitalization} capitalization, {metadata.voice.punctuation} punctuation, ratings {metadata.voice.ratingFrequency}, questions {metadata.voice.questionFrequency}, sarcasm {metadata.voice.sarcasm}
      </p>
      {metadata.warnings.length > 0 && (
        <div className="text-amber-200">
          <span className="font-medium">Generation notes: </span>{metadata.warnings.join(" · ")}
        </div>
      )}
      <details>
        <summary className="cursor-pointer text-[11px] text-gray-500 hover:text-gray-300">Voice and debug details</summary>
        <pre className="mt-2 max-h-56 overflow-auto whitespace-pre-wrap break-words rounded bg-gray-950/70 p-2 font-mono text-[10px] leading-relaxed text-gray-400">
          {JSON.stringify(metadata, null, 2)}
        </pre>
      </details>
    </div>
  );
}