---
name: PostHog API scope
description: Distinguish a project-scoped API key's endpoint restrictions from absent analytics or recording access.
---

A denial from the account-wide project-list endpoint does not establish that the configured credential cannot read project analytics.

**Why:** PostHog returned HTTP 403 with `API keys with scoped projects are only supported on project-based endpoints.` for an account-wide project-list request.

**How to apply:** Obtain the relevant project ID from a verified project URL or configuration and try the corresponding project-specific read endpoint before proposing broader permissions or new credentials. Do not attribute this error to missing user events, recording failures, or the creator's UI permissions. Source-code identity conventions are not proof that a particular user was captured or identified in PostHog.
