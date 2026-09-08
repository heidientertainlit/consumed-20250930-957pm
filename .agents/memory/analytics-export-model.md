---
name: Analytics export model
description: Preferred structure for complete, anonymous, pivot-friendly admin data exports.
---

Keep the master export at one row per anonymous user, with dimensions and aggregate measures. Put raw ratings, media activity, poll answers, DNA Moment answers, and other repeating events in separate long-form exports joined by the same anonymous user ID.

**Why:** Packing repeated records into semicolon-delimited master cells is readable but poor for pivots, while adding one column per dynamic question creates an unstable and excessively wide schema.

**How to apply:** Preserve summary counts in the master file; expose event-level records in linked fact-table CSVs. A future “Download All Data” action should package the related CSVs together rather than flattening every event into the master row.