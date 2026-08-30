import { useEffect, useMemo, useState } from "react";
import { useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, Loader2 } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/lib/supabase";
import { ImportReceiptCard, ImportBatch, importBatchSelectFields } from "@/components/import-history";

export default function AdminImportLedgerPage() {
  const { user } = useAuth(); const [, setLocation] = useLocation();
  const [source, setSource] = useState("all"); const [status, setStatus] = useState("all"); const [date, setDate] = useState(""); const [userFilter, setUserFilter] = useState("");
  const profileQuery = useQuery({ queryKey: ["admin-profile-check", user?.id], queryFn: async () => {
    if (!user?.id) return null; const { data, error } = await supabase.from("users").select("id, is_admin").eq("id", user.id).single(); if (error) throw error; return data;
  }, enabled: !!user?.id });
  useEffect(() => { if (!profileQuery.isLoading && profileQuery.data && !profileQuery.data.is_admin) setLocation("/"); }, [profileQuery.data, profileQuery.isLoading, setLocation]);
  const batchesQuery = useQuery({ queryKey: ["admin-import-ledger"], queryFn: async () => {
    const { data, error } = await supabase.from("media_import_batches").select(`user_id, users:users!media_import_batches_user_id_fkey(user_name, display_name), ${importBatchSelectFields}`).order("started_at", { ascending: false }).limit(250);
    if (error) throw error; return (data || []) as (ImportBatch & { user_id?: string })[];
  }, enabled: !!profileQuery.data?.is_admin });
  const batches = useMemo(() => (batchesQuery.data || []).filter(batch => {
    const batchUser = (batch as any).users;
    const userText = `${batch.user_id || ""} ${batchUser?.user_name || ""} ${batchUser?.display_name || ""}`.toLowerCase();
    return (source === "all" || batch.source === source) && (status === "all" || batch.status === status) && (!date || (batch.started_at || "").slice(0, 10) === date) && (!userFilter || userText.includes(userFilter.toLowerCase()));
  }), [batchesQuery.data, source, status, date, userFilter]);
  const totals = useMemo(() => batches.reduce((sum, batch) => ({ batches: sum.batches + 1, imported: sum.imported + (batch.inserted_count || 0), points: sum.points + (batch.imported_points || 0) }), { batches: 0, imported: 0, points: 0 }), [batches]);
  if (profileQuery.isLoading || !user) return <div className="min-h-screen bg-gray-950 flex items-center justify-center"><Loader2 className="animate-spin text-purple-400" /></div>;
  if (!profileQuery.data?.is_admin) return <div className="min-h-screen bg-gray-950 flex items-center justify-center text-gray-400">Access restricted</div>;
  const sources = [...new Set((batchesQuery.data || []).map(batch => batch.source).filter(Boolean))]; const statuses = [...new Set((batchesQuery.data || []).map(batch => batch.status).filter(Boolean))];
  return <div className="min-h-screen bg-gray-950 text-white"><main className="max-w-4xl mx-auto px-4 py-8">
    <button onClick={() => setLocation("/admin")} className="flex items-center gap-1.5 text-sm text-gray-400 hover:text-white mb-5"><ArrowLeft size={15} /> Back to Admin</button>
    <h1 className="text-2xl font-bold">Media import ledger</h1><p className="text-sm text-gray-400 mt-1 mb-5">Recent import batches and reconciliation receipts.</p>
    <div className="grid grid-cols-3 gap-3 mb-5">{[["Batches", totals.batches], ["Imported", totals.imported], ["Points", totals.points]].map(([name, value]) => <div key={String(name)} className="rounded-xl bg-gray-900 border border-gray-800 p-3"><p className="text-xs text-gray-400">{name}</p><p className="text-xl font-bold">{value}</p></div>)}</div>
    <div className="flex flex-wrap gap-2 mb-5"><input value={userFilter} onChange={e => setUserFilter(e.target.value)} placeholder="Filter name or user ID" className="bg-gray-900 border border-gray-700 rounded-lg p-2 text-sm" /><select value={source} onChange={e => setSource(e.target.value)} className="bg-gray-900 border border-gray-700 rounded-lg p-2 text-sm"><option value="all">All sources</option>{sources.map(value => <option key={value} value={value}>{value}</option>)}</select><select value={status} onChange={e => setStatus(e.target.value)} className="bg-gray-900 border border-gray-700 rounded-lg p-2 text-sm"><option value="all">All statuses</option>{statuses.map(value => <option key={value} value={value}>{value}</option>)}</select><input type="date" value={date} onChange={e => setDate(e.target.value)} className="bg-gray-900 border border-gray-700 rounded-lg p-2 text-sm" /></div>
    {batchesQuery.isLoading ? <div className="py-12 flex justify-center"><Loader2 className="animate-spin text-purple-400" /></div> : batchesQuery.isError ? <p className="text-red-300">The import ledger could not be loaded.</p> : <div className="space-y-3">{batches.map(batch => { const batchUser = (batch as any).users; const name = batchUser?.display_name || batchUser?.user_name || "Unknown user"; return <div key={batch.id} className="bg-gray-900 rounded-xl p-1"><p className="px-3 pt-2 text-xs text-gray-500">User: <span className="text-gray-300">{name}</span>{batchUser?.user_name && batchUser.display_name ? ` (@${batchUser.user_name})` : ""} · ID ending {batch.user_id?.slice(-8) || "unknown"}</p><ImportReceiptCard batch={batch} showRows hideFilename /></div>; })}{batches.length === 0 && <p className="text-gray-400 text-sm">No batches match these filters.</p>}</div>}
  </main></div>;
}