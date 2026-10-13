---
name: Admin Edge session verification
description: Supabase gateway compatibility for admin functions receiving asymmetric session tokens.
---
Admin Edge Functions that perform their own authenticated role checks need an
explicit gateway JWT-verification setting compatible with the app's sessions.

**Why:** This project's legacy gateway verifier can reject asymmetric session
JWTs before the function's authorization code executes. Passing local handler
tests does not establish that signed-in requests can reach that handler.

**How to apply:** Follow the existing self-authorized admin function configuration:
disable gateway verification for that function while retaining mandatory
server-side session validation and authoritative admin checks before data access
or paid work. Test the configuration alongside authorization behavior.
