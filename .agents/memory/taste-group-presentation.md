---
name: Taste group presentation
description: Product rule for presenting Tribe clusters to users without manufactured identities.
---

Present Tribe clusters as unnamed, affinity-defined groups beneath the original Tribes section heading. Lead with the actual overlap percentage, then an explicit taxonomy label such as “People who share your taste across entertainment,” “People who share your taste in books,” “People who love the same genres,” or “People who rate things like you do.” Follow with one plain sentence explaining the connection, three recognizable media covers, concrete media/genre labels, member previews and count, and “See what they’re into.” Keep generated names, cute labels, and abstract evidence labels out of the user-facing identity.

**Why:** Generated or emotional labels can obscure what actually defines a group. Naming the affinity type directly creates a clear, scalable taxonomy while concrete media and people keep each group credible.

**How to apply:** Backend names and stable IDs may remain for clustering and routing, but cards and detail views must describe the actual affinity type. Use the actual fit percentage; never invent separate category percentages.

Use **Follow group / Following**, not Join group. Following is a lightweight personalization signal: it should eventually increase group recommendations, takes, and activity in Now without implying membership, participation, or a private community.

Tribe detail links use stable `/people/tribes/{id}` paths. Continue resolving legacy `?tab=tribes&tribe={slug}` links, but do not expose generated-name slugs in new navigation or shares.

**Why:** The group’s collective taste—not membership—is the product value, and stable IDs prevent discarded generated names from remaining in public URLs.

Detail pages present the payoff in this order: shared connection media, unseen group-loved media, recent group trends, public takes, then visible high-fit people. Omit any payoff section that has no real records.

**How to apply:** Live-score privacy-filtered People candidates for each group, then derive discovery and conversation content from their bounded ratings, tracked media, and public posts. Exclude the viewer’s consumed titles; never duplicate editorial covers, show missing-data placeholders, or fabricate counts or activity.