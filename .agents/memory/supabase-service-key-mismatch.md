---
name: Supabase service key mismatch
description: The workspace service-role credential does not belong to the Supabase project used by the app.
---

The configured service-role credential targets a different Supabase project than the app's URL and anonymous credentials. Do not assume service-role REST failures indicate missing app data.

**Why:** App-project REST requests with that credential return an invalid-key response even though its JWT is unexpired; its project claim differs from the app credentials.

**How to apply:** For read-only app-project diagnostics, use the configured Supabase management access path. If application code ever needs the service-role credential, repair the workspace secret through the secrets flow rather than copying credentials into code or chat.