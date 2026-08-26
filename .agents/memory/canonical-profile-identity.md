---
name: Canonical profile identity
description: Security and onboarding rules for confirming names and usernames across OAuth and email signup.
---

Require every authenticated account to explicitly confirm first name, last name, and a username once before using an authenticated app surface. Existing DNA proves DNA completion, not identity confirmation; after confirming, established users return to the app without repeating DNA. Email prefixes may be suggested but must never be silently treated as a confirmed handle.

**Why:** OAuth bypasses the email signup fields, and lazy profile creation previously copied the email prefix into `user_name`. Auth user metadata is client-editable and therefore cannot prove identity completion; availability prechecks alone also cannot prevent concurrent case-variant username claims.

**How to apply:** Gate every authenticated route/action on a server-managed profile confirmation field, write it only through an authenticated service-role function, enforce uniqueness with a database index on `lower(user_name)`, and keep database/backend checks on share-link mutations that remain guest-viewable.