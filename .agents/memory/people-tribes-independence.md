---
name: People Tribes independence
description: Product boundary between the new People/Tribes destination and the legacy Rooms system.
---

Tribes must be designed and stored as a separate People-domain concept. Never rename, wrap, or reuse Rooms, pools, room follows, Room notifications, or Room conversations as Tribes.

**Why:** Rooms are being removed from primary navigation while their existing data and deep links remain intact. Coupling Tribes to Rooms would leak old terminology and behavior into People and make both systems harder to evolve safely.

**How to apply:** Build Tribe definitions, memberships, interests, discovery, and future Tribe-specific behavior on dedicated People-domain entities. Existing Friends and creator systems may be reused additively, and authoritative DNA comparisons may be shown, but Room-domain tables and behaviors must remain isolated.