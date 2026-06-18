---
name: TanStack Query v5 refetchInterval callback
description: In v5 the refetchInterval function receives the Query object, not the data — using it like data silently disables polling.
---

In TanStack Query v5, a function-form `refetchInterval` (and `refetchIntervalInBackground`) receives the **Query object**, NOT the resolved data.

- WRONG (silently never polls): `refetchInterval: (data) => data?.isGenerating ? 10000 : false`
- RIGHT: `refetchInterval: (query) => query.state.data?.isGenerating ? 10000 : false`

Return a number (ms) to keep polling, or `false` to stop.

**Why:** v4 passed `data` to this callback; v5 changed it to pass the full Query. Code migrated from v4 (or written by habit) compiles fine at runtime but `query.isGenerating` is `undefined`, so the ternary always returns `false` and polling never happens — a silent no-op, not a crash. TypeScript does flag it (Property 'X' does not exist on type 'Query<...>').

**How to apply:** Any time a query should auto-poll until some `data` flag flips, reach through `query.state.data`. If a "poll while loading/generating" feature seems dead, check this first.
