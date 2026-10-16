---
name: Conversation studio selection
description: Admin conversation UX and persona-selection requirements; consumer search is reuse-only.
---

Use the existing media search without modifying its function or consumer experience. Bind the selected title and optional season/episode to exact catalog identities, not topic-text inference.

**Why:** The user explicitly said not to change their current media search function, only use it, and wants conversations about a specific media item and season.

**How to apply:** Keep selection adaptations inside the admin conversation tool; verify scope server-side before drafting.

Use one Context field, not separate Angle and Context inputs. Choose participants from existing personas' relevant saved interests/favorites and show the reasons in the draft.

**Why:** The user does not want to remember each persona's interests or manually choose the roster.

**How to apply:** Do not fill insufficient matches with arbitrary personas or invent interests. Keep review, approval and scheduling explicit and separate. Preserve legacy drafts' stored rosters.
