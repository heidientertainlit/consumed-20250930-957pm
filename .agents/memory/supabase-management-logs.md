---
name: Supabase management log queries
description: Read-only historical request investigation through the replacement Management API logs endpoint.
---

Use `/analytics/endpoints/logs`, not the retired `/analytics/endpoints/logs.all`, with URL-encoded `sql`, `iso_timestamp_start`, and `iso_timestamp_end` parameters.

**Why:** The old endpoint returns HTTP 410. The replacement uses ClickHouse SQL. On this project's live endpoint, old source tables, `source_name`, `metadata`, and wildcard result columns were rejected, despite broader examples in provider documentation.

**How to apply:** Start with explicitly selected `timestamp,event_message` from `logs`, use narrow UTC time bounds with `toDateTime64`, filter relevant messages, and cap rows. Console events and HTTP request events can both appear. Successful historical rating-request events establish the provider, ID, and type received before identity resolution, but do not establish what the user saw or tapped. Nearby events must not be attributed to the same user without identity evidence. Never expose credentials or raw request headers.

Filter the top-level `source` column and read service-specific fields from the
string-valued `log_attributes` map, not bare columns or legacy `metadata`.

**Why:** Request and runtime deployment versions and execution identifiers were
available through the map even though queries selecting bare field names failed.
The authoritative field reference is
https://supabase.com/docs/guides/observability/log-field-reference .

**How to apply:** Use `source='function_edge_logs'` with
`log_attributes['request_id']` and `log_attributes['version']` to identify a
request's deployed version. For console output, use `source='function_logs'`
and `log_attributes['execution_id']`. Match identifiers before attributing
nearby log entries to a request; one runtime execution can contain multiple
requests. Empty error logs do not prove success when the handler silently
returns on upstream HTTP failures or invalid JSON.
