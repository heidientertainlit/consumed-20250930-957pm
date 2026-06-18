---
name: Supabase query builder has no .catch() at runtime
description: Why calling .catch() directly on a supabase query silently breaks the query
---

# Supabase PostgrestBuilder: `.then()` exists, `.catch()`/`.finally()` do NOT (runtime)

In `@supabase/postgrest-js` (v2.90.x), the query/RPC builder returned by
`supabase.from(...).insert(...)`, `supabase.rpc(...)`, etc. is a *thenable*: it
defines a `.then()` method but **does not define `.catch()` or `.finally()`**.

## The trap
`supabase.rpc('fn', args).catch(() => {})` throws `TypeError: ....catch is not a
function` at runtime. Worse: a Supabase query only actually executes when `.then()`
is called on it. If you call `.catch()` *instead of* `.then()`, the builder throws
before `.then()` is ever reached — so **the query never runs at all**. The throw
often gets swallowed by an outer `.catch()` higher in the chain, so it fails silently.

`.then(onF).catch(onR)` IS fine at runtime, because `.then()` returns a real native
Promise (which has `.catch`). But TypeScript types `.then()`'s return as
`PromiseLike<T>`, which has no `.catch` — so a trailing `.catch` is a *type-only*
error (TS2339 "Property 'catch' does not exist on type 'PromiseLike'") that works
at runtime.

## How to apply
- Award/side-effect calls must use `await supabase.rpc(...)` (optionally wrapped in
  try/catch), NEVER `.catch()` directly on the builder.
- **Why:** the daily-play trivia (`TodaysPlayGame.handleConfirm` in
  `daily-hero-section.tsx`) used `.rpc('increment_trivia_points').catch(()=>{})`,
  so lifetime `user_points.trivia_points` was never credited from that path while
  4 other call sites using `await` worked fine — visible as user_points totals
  lagging behind summed `user_predictions.points_earned`.
- To swallow errors without a type error, use `.then(onFulfilled, onRejected)`
  (second arg) instead of a trailing `.catch`.
