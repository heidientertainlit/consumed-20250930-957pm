import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ChevronDown, FileCheck2, Loader2 } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/auth";

export type ImportReceipt = {
  batchId?: string;
  source?: string;
  status?: string;
  mediaTypeCounts?: Record<string, number>;
  importedPoints?: number;
  imported?: number;
  skipped?: number;
  failed?: number;
  total?: number;
  ratingsImported?: number;
  ratingsPreserved?: number;
  ratingsFailed?: number;
};

export type ImportBatch = {
  id: string; source?: string; status?: string; original_filename?: string; started_at?: string;
  completed_at?: string; source_rows?: number; parsed_rows?: number; unique_rows?: number;
  inserted_count?: number; skipped_existing_count?: number; skipped_duplicate_count?: number;
  failed_count?: number; rejected_count?: number; ratings_imported_count?: number;
  ratings_preserved_count?: number; ratings_failed_count?: number; media_type_counts?: Record<string, number> | null;
  points_by_media_type?: Record<string, number> | null; imported_points?: number; error_summary?: string[] | string | null;
};

type ImportRow = {
  id: number;
  source_row_index: number;
  title?: string | null;
  media_type?: string | null;
  outcome: string;
  error_message?: string | null;
  rating_outcome?: string | null;
};

const selectFields = "id, source, status, original_filename, started_at, completed_at, source_rows, parsed_rows, unique_rows, inserted_count, skipped_existing_count, skipped_duplicate_count, failed_count, rejected_count, ratings_imported_count, ratings_preserved_count, ratings_failed_count, media_type_counts, points_by_media_type, imported_points, error_summary, is_legacy";

export function receiptFromResponse(data: any): ImportReceipt | undefined {
  const receipt = data?.receipt || {};
  const batch = data?.batch || {};
  if (!data?.receipt && !data?.batch && !data?.batchId) return undefined;
  return {
    batchId: receipt.batchId || receipt.id || batch.batchId || batch.id || data.batchId,
    source: receipt.source || batch.source || data.source,
    status: receipt.status || batch.status || data.status,
    mediaTypeCounts: receipt.mediaTypeCounts || batch.mediaTypeCounts || batch.media_type_counts || data.mediaTypeCounts,
    importedPoints: receipt.importedPoints ?? batch.importedPoints ?? batch.imported_points ?? data.importedPoints,
    imported: data?.imported, skipped: data?.skipped, failed: data?.failed, total: data?.total,
    ratingsImported: data?.ratingsImported, ratingsPreserved: data?.ratingsPreserved,
    ratingsFailed: receipt.ratingsFailedCount ?? batch.ratings_failed_count ?? data?.ratingsFailed,
  };
}

function label(value?: string) {
  return (value || "import").replace(/[_-]/g, " ").replace(/\b\w/g, char => char.toUpperCase());
}

function BatchDetails({ batch, receipt, rows, rowsLoading }: { batch?: ImportBatch; receipt?: ImportReceipt; rows?: ImportRow[]; rowsLoading?: boolean }) {
  const counts = receipt?.mediaTypeCounts || batch?.media_type_counts || {};
  const imported = receipt?.imported ?? batch?.inserted_count ?? 0;
  const skipped = receipt?.skipped ?? ((batch?.skipped_existing_count || 0) + (batch?.skipped_duplicate_count || 0));
  const failed = receipt?.failed ?? ((batch?.failed_count || 0) + (batch?.rejected_count || 0));
  const points = receipt?.importedPoints ?? batch?.imported_points ?? 0;
  const ratingsImported = receipt?.ratingsImported ?? batch?.ratings_imported_count ?? 0;
  const ratingsPreserved = receipt?.ratingsPreserved ?? batch?.ratings_preserved_count ?? 0;
  const ratingsFailed = receipt?.ratingsFailed ?? batch?.ratings_failed_count ?? 0;
  return <div className="mt-3 pt-3 border-t border-gray-100 text-xs text-gray-600 space-y-2">
    <div className="grid grid-cols-3 gap-2"><span><b className="text-gray-900">{imported}</b> imported</span><span><b className="text-gray-900">{skipped}</b> skipped</span><span><b className="text-gray-900">{failed}</b> not imported</span></div>
    {Object.keys(counts).length > 0 && <div><span className="font-semibold text-gray-700">Media: </span>{Object.entries(counts).map(([type, count]) => `${label(type)} ${count}`).join(" · ")}</div>}
    <div className="flex flex-wrap gap-x-3 gap-y-1">
      <span><b className="text-purple-700">{points}</b> points added</span>
      {(ratingsImported > 0 || ratingsPreserved > 0 || ratingsFailed > 0) && <span>{ratingsImported} ratings imported · {ratingsPreserved} preserved{ratingsFailed > 0 ? ` · ${ratingsFailed} unresolved` : ""}</span>}
    </div>
    {batch?.error_summary && (
      <p className="text-red-600">
        {Array.isArray(batch.error_summary) ? batch.error_summary.join(" · ") : batch.error_summary}
      </p>
    )}
    {rowsLoading && <div className="flex items-center gap-1 text-gray-500"><Loader2 size={12} className="animate-spin" /> Loading row outcomes…</div>}
    {!!rows?.length && (
      <div className="space-y-1">
        <p className="font-semibold text-gray-700">Row outcomes</p>
        <div className="max-h-52 overflow-y-auto divide-y divide-gray-100 rounded-lg border border-gray-100">
          {rows.map((row) => (
            <div key={row.id} className="grid grid-cols-[3rem_1fr_auto] gap-2 px-2 py-1.5">
              <span className="text-gray-400">#{row.source_row_index + 1}</span>
              <span className="truncate text-gray-700">{row.title || "Untitled"}{row.media_type ? ` · ${label(row.media_type)}` : ""}</span>
              <span className={row.outcome === "failed" ? "text-red-600" : "text-gray-500"} title={row.error_message || undefined}>
                {label(row.outcome)}
                {row.rating_outcome && !["none", "pending"].includes(row.rating_outcome) ? ` · Rating ${label(row.rating_outcome)}` : ""}
              </span>
            </div>
          ))}
        </div>
        {rows.length === 250 && <p className="text-gray-400">Showing the first 250 rows.</p>}
      </div>
    )}
  </div>;
}

export function ImportReceiptCard({ receipt, batch, showRows = false, hideFilename = false }: { receipt?: ImportReceipt; batch?: ImportBatch; showRows?: boolean; hideFilename?: boolean }) {
  const [open, setOpen] = useState(!!receipt);
  const id = receipt?.batchId || batch?.id;
  const date = batch?.completed_at || batch?.started_at;
  const rowsQuery = useQuery({
    queryKey: ["media-import-rows", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("media_import_rows")
        .select("id, source_row_index, title, media_type, outcome, error_message, rating_outcome")
        .eq("batch_id", id!)
        .order("source_row_index", { ascending: true })
        .limit(250);
      if (error) throw error;
      return (data || []) as ImportRow[];
    },
    enabled: showRows && open && !!id,
  });
  return <div className="rounded-xl border border-gray-200 bg-white p-3">
    <button type="button" onClick={() => setOpen(value => !value)} className="w-full flex items-center gap-3 text-left">
      <FileCheck2 size={17} className="text-purple-600 shrink-0" />
      <div className="min-w-0 flex-1"><p className="text-sm font-semibold text-gray-900 truncate">{!hideFilename && batch?.original_filename ? batch.original_filename : `${label(receipt?.source || batch?.source)} import`}</p><p className="text-xs text-gray-500">{label(receipt?.status || batch?.status || "completed")} {date ? `· ${new Date(date).toLocaleDateString()}` : ""}{id ? ` · Receipt ${id.slice(0, 8)}` : ""}</p></div>
      <ChevronDown size={16} className={`text-gray-400 transition-transform ${open ? "rotate-180" : ""}`} />
    </button>
    {open && <BatchDetails batch={batch} receipt={receipt} rows={rowsQuery.data} rowsLoading={rowsQuery.isLoading} />}
  </div>;
}

export default function ImportHistory({ receipt, limit = 5 }: { receipt?: ImportReceipt; limit?: number }) {
  const { session } = useAuth();
  const history = useQuery({
    queryKey: ["media-import-batches", "own", limit],
    queryFn: async () => {
      const { data, error } = await supabase.from("media_import_batches").select(selectFields).order("started_at", { ascending: false }).limit(limit);
      if (error) throw error;
      return (data || []) as ImportBatch[];
    },
    enabled: !!session?.access_token,
  });
  const duplicateReceipt = receipt?.batchId && history.data?.some(batch => batch.id === receipt.batchId);
  return <section className="space-y-2" aria-label="Import receipts">
    <div className="flex items-center justify-between"><h3 className="text-sm font-semibold text-gray-800">Recent import receipts</h3>{history.isLoading && <Loader2 size={14} className="animate-spin text-gray-400" />}</div>
    {receipt && !duplicateReceipt && <ImportReceiptCard receipt={receipt} />}
    {history.data?.map(batch => <ImportReceiptCard key={batch.id} batch={batch} />)}
    {!history.isLoading && !receipt && history.data?.length === 0 && <p className="text-xs text-gray-500">Your completed imports will appear here.</p>}
    {history.isError && <p className="text-xs text-red-600">Couldn’t load import receipts.</p>}
  </section>;
}

export { selectFields as importBatchSelectFields };