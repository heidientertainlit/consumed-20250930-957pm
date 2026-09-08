---
name: Friend-gated member profiles
description: Privacy boundary between Tribes affinity discovery and full member profile content.
---

Tribes may show a limited affinity preview for discoverable members, including enough identity and match context to support discovery. Opening a member profile must not reveal their Entertainment DNA details, ratings, lists, activity, or current consumption unless the viewer is the profile owner or an accepted friend.

**Why:** The user wants affinity discovery to help people find potential friends without making personal entertainment history broadly visible.

**How to apply:** Keep discovery cards and friend-request actions available to opted-in members. Resolve accepted friendship in either relationship direction before fetching or rendering another member's full profile content.

Intentional public invite links may expose a minimal identity/archetype teaser for discoverable, non-private members, but must not expose the full DNA paragraph, evidence, ratings, lists, or consumption history.

**Why:** Invitations need to work before signup without silently undoing the member-profile friendship boundary. Public teaser information cannot be hidden from a determined blocked person who browses anonymously; never promise otherwise.

**How to apply:** Enforce the boundary both in service-role endpoints and direct database reads. Treat failed privacy/block lookups as denials, not as missing restrictions. Keep privileged admin exports separate from ordinary member reads.