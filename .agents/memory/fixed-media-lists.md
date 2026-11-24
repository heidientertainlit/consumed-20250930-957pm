---
name: Fixed media list model
description: The supported personal media lists are fixed; legacy custom lists are historical read-only data.
---

The supported list set is the virtual All view plus five system lists: Currently, Want To, Finished, Did Not Finish, and Favorites. Do not expose custom-list creation or offer legacy custom lists as active destinations. Preserve existing custom-list records as read-only history.

**Why:** The product intentionally uses a simple, consistent progress model instead of user-defined list organization.

Want To is permanent product terminology. Retire Queue completely as a system-list concept; do not maintain two names or competing system-list definitions. Automatically migrate only confirmed legacy system lists, not user-created custom lists.

Preserve the existing `queue` API identifier wherever it is a working contract, with consistent mapping to Want To. Preserve functioning `want_to` references. Do not perform an application-wide identifier rename or introduce another identifier layer for this repair.

**Why:** The user explicitly required one canonical Want To identity and protection for custom lists.

**How to apply:** Cover database creation, retrieval, restoration, API identifiers, frontend fallbacks, and regression tests together. Keep any old-link or old-client handling isolated from canonical list identity; do not treat compatibility as permission to recreate Queue.

Repair the existing five-list implementation in place; do not add overlapping
provisioning mechanisms or another five-list architecture.

**Why:** The user explicitly required reconciliation after repeated repairs left
competing live signup writers alongside newer readers.

**How to apply:** Audit active trigger attachments and indirect app-user
provisioning as well as literal Queue references. Reuse the authoritative
restoration path, retire obsolete writers, and distinguish locally tested
definitions from verified live application before calling a repair complete.

Do not use trigger depth as proof that a call is trusted for system-list
provisioning. Keep no-JWT signup private and the API path independently
authorized.

**Why:** Live client roles have object-creation privileges in `public`, even
without trigger rights on the actual signup tables. The Auth handler also
catches downstream errors, so Auth success does not prove app setup worked.

**How to apply:** Preserve existing RLS and grants. Test that Auth creates the
app profile and all five system lists, that the privileged signup path is
inaccessible to API roles, and that only signed owner/service calls can restore.

Saved-list checkmarks are informational: keep already-saved destinations tappable and reuse the existing library entry rather than creating a second entry.

**Why:** The user explicitly chose “Keep existing entry” while requesting a checkmark without disabling repeat taps.

**How to apply:** Preserve the existing follow-up flow on repeat taps; do not turn the saved indicator into a disabled row or implement repeat-consumption records without a separate request.

**How to apply:** Filter primary list displays, add/move controls, and list selectors to the five system lists (plus All for browsing). Server-side list creation may only restore a missing required system list.

Required destination availability must be normalized when consuming shared list
data, not only inside one caller's fetch function.

**Why:** Other screens populate the same query cache without that caller's
normalization. A warm cache can therefore omit a standard destination even when
the picker's own cold-fetch path would restore it.

**How to apply:** Verify pickers against incomplete cached data as well as fresh
responses. Preserve existing list IDs and restore only missing standard
destinations through the existing authorized save path.