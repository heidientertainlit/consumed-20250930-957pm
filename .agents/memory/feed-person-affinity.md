---
name: Feed person affinity
description: Keeps reviewer alignment percentages consistent with the People affinity system.
---

Feed reviewer alignment must use the authoritative People affinity algorithm and its cached pair comparison. Do not calculate a separate percentage from exact catalog-ID overlap in the client.

**Why:** Exact-ID overlap is too sparse and caused percentages to disappear for eligible people even though their DNA signals supported a valid People affinity score. It also made feed percentages inconsistent with People and Friends.

**How to apply:** Any surface showing person-to-person entertainment alignment should request or read the shared pair score. Keep eligibility, privacy, blocking, algorithm versioning, and cache rules server-side.