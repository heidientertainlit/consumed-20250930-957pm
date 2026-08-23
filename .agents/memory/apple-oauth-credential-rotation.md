---
name: Apple OAuth credential rotation
description: Operational rules for generating and renewing the Apple client secret used by Supabase Auth.
---

Supabase's Apple provider secret is an ES256 client-secret JWT signed with the Sign in with Apple `.p8` key. Generate it with the Apple Team ID as issuer, Services ID as subject, Apple as audience, and an expiration no more than 180 days out.

**Why:** The current provider configuration will stop accepting Apple sign-ins when this JWT expires. Secure text-entry forms may also flatten PEM line breaks; validate the key structure and reconstruct standard 64-character PEM wrapping in memory when necessary.

**How to apply:** Rotate the signed client secret before its roughly six-month expiration and update Supabase Auth securely. Keep the `.p8` only in Secrets, never in workspace files, logs, chat, or memory.