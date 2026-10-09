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
