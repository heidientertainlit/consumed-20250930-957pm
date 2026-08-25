---
name: Canonical profile identity
description: Security and onboarding rules for confirming names and usernames across OAuth and email signup.
---

Require first-time users without an existing DNA profile to confirm first name, last name, and a username before entering DNA onboarding or any authenticated app surface. Email prefixes may be suggested but must never be silently treated as a confirmed handle.

**Why:** OAuth bypasses the email signup fields, and lazy profile creation previously copied the email prefix into `user_name`. Auth user metadata is client-editable and therefore cannot prove identity completion; availability prechecks alone also cannot prevent concurrent case-variant username claims.

**How to apply:** Gate on a server-managed profile confirmation field (existing DNA profiles are grandfathered), write it only through an authenticated service-role function, enforce uniqueness with a database index on `lower(user_name)`, and keep a database trigger protecting the confirmation field from future client update policies.