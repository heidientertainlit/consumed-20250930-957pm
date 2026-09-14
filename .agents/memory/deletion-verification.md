---
name: Production deletion verification
description: Why deletion needs executable, rollback-scoped negative-control tests against the live schema.
---

Do not equate a deletion-source review or foreign-key inventory with a working deletion flow. Execute a rollback-scoped disposable-target/control test against the actual schema before claiming first-party deletion works.

**Why:** Production-only type differences, derived views, and statement-level immutable-audit triggers caused runtime failures that static tracing missed. An immutable statement trigger can reject an UPDATE even when it matches no rows.

**How to apply:** Keep exact-target assertions and independent control relationships; distinguish expected removal of relationships to the deleted target from unrelated control data. Prevent fixture creation from emitting provider events, restore normal database enforcement before exercising deletion, and verify rollback removed all fixtures. Preserve immutable audit protections and disclose justified retained provenance rather than bypassing protections to make a test pass. Database-only tests never establish external-provider erasure.