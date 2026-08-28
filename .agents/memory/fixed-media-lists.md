---
name: Fixed media list model
description: The supported personal media lists are fixed; legacy custom lists are historical read-only data.
---

The supported list set is the virtual All view plus five system lists: Currently, Want To, Finished, Did Not Finish, and Favorites. Do not expose custom-list creation or offer legacy custom lists as active destinations. Preserve existing custom-list records as read-only history.

**Why:** The product intentionally uses a simple, consistent progress model instead of user-defined list organization.

**How to apply:** Filter primary list displays, add/move controls, and list selectors to the five system lists (plus All for browsing). Server-side list creation may only restore a missing required system list.