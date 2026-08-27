---
name: Affinity query bounds
description: PostgREST request-size and pagination constraints for People affinity candidate readiness.
---

Count tracked items for affinity readiness by querying `list_items.user_id` in small user chunks and paginating every chunk through the API row cap. Never resolve every list and place hundreds of list IDs into one `.in()` filter.

**Why:** A high-activity account produced an oversized PostgREST URL with hundreds of UUIDs; the edge runtime failed at the transport layer before PostgREST could answer. Unpaginated selects also silently cap rows and undercount readiness.

**How to apply:** Keep filter URLs bounded, paginate result sets used for counts, and use direct ownership columns when they exist instead of expanding an intermediate relation.