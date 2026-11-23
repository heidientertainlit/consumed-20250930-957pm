---
name: Cross-endpoint fixture fidelity
description: Why forwarding-contract tests should execute the reused endpoint rather than replace it with canned results
---
For integrations between existing endpoints, exercise the reused handler's real
request interpretation while mocking its external providers and database.

**Why:** A canned title-search response hid an incompatible UI "All" filter:
the studio appeared to attach titles in tests while the actual provider handler
searched nothing. Testing the complete local forwarding path exposed the mismatch.

**How to apply:** Include default selections as well as explicit typed filters.
Stub transports and storage, not the downstream endpoint's branching contract,
when verifying that a chosen result can reach subsequent generation.

Shared-dialog tests must also exercise the real data shape from each entry
surface, not just mount the dialog with idealized props.

**Why:** The Finished review tests passed for Add search, but Now feed cards
supplied a different media-type alias. The rating service correctly rejected
the resulting missing type despite the shared form itself working.

**How to apply:** Cover feed-card and search/detail handoffs separately, require
the downstream endpoint's mandatory fields in transport doubles, and verify
that both the initial library save and subsequent rating/post retain the type.
Do not hide a missing type by assuming every title is a movie.
