// One-time, read-only export for the local consumer test. Never run on startup.
// Export only public card fields, not profiles, evaluations, actors or usage.
import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import { query } from "./lib/recommendation-lab-admin.ts";

const rows = await query(`
  select jsonb_build_object('title',i.title,'type',i.media_type,
    'external_source',i.external_source,'external_id',i.external_id) as source,
    r.results->'semantic' as results
  from public.recommendation_lab_items i
  cross join lateral (
    select results from public.recommendation_lab_runs
    where experiment_key='small-lab-1' and source_item_id=i.id and status='complete'
      and jsonb_typeof(results->'semantic')='array'
    order by created_at desc,id desc limit 1
  ) r
  where i.source_verified=true and i.verification->>'source_key' is not null
  order by i.media_type,i.title`);
assert.equal(rows.length, 11, "Expected the existing eleven prepared sources; do not expand the pool");
const snapshot = rows.map((row: any) => ({
  source: row.source,
  recommendations: row.results.slice(0, 6).map(({ item }: any) => {
    assert.equal(item.source_verified, true);
    assert.ok(item.external_source && item.external_id && item.media_type && item.title);
    return {
      title: item.title, type: item.media_type, external_source: item.external_source,
      external_id: item.external_id, poster_url: item.source_metadata?.poster_url || "",
    };
  }),
}));
await mkdir("client/src/data", { recursive: true });
await writeFile("client/src/data/prepared-similar-media.json", JSON.stringify(snapshot, null, 2) + "\n");
console.log(`Exported saved rankings for ${snapshot.length} sources; read-only, no models or preparation.`);
for (const row of snapshot) console.log(`${row.source.title}: /media/${row.source.type}/${row.source.external_source}/${row.source.external_id}`);
