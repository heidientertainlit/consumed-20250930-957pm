---
name: Supabase management log queries
description: Read-only historical request investigation through the replacement Management API logs endpoint.
---

Use `/analytics/endpoints/logs`, not the retired `/analytics/endpoints/logs.all`, with URL-encoded `sql`, `iso_timestamp_start`, and `iso_timestamp_end` parameters.

**Why:** The old endpoint returns HTTP 410. The replacement uses ClickHouse SQL. On this project's live endpoint, old source tables, `source_name`, `metadata`, and wildcard result columns were rejected, despite broader examples in provider documentation.

**How to apply:** Start with explicitly selected `timestamp,event_message` from `logs`, use narrow UTC time bounds with `toDateTime64`, filter relevant messages, and cap rows. Console events and HTTP request events can both appear. Successful historical rating-request events establish the provider, ID, and type received before identity resolution, but do not establish what the user saw or tapped. Nearby events must not be attributed to the same user without identity evidence. Never expose credentials or raw request headers.
