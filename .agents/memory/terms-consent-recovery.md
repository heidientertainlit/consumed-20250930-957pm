---
name: Terms consent and native recovery
description: Consent integrity depends on classifying recovery before native session restoration.
---

Native recovery must be identified before restoring its session, and callback-routing infrastructure must remain outside the terms gate. Returning-user sign-in must not itself record consent; authenticate first, then let the authoritative acceptance gate decide whether agreement is current.

**Why:** Native recovery can emit SIGNED_IN before the reset route is entered. Path-only classification can mistake recovery for normal OAuth login and consume a stale consent attempt. A gate surrounding callback handlers can also prevent recovery navigation entirely.

**How to apply:** Clear pending consent for recovery, preserve explicit recovery classification, bind OAuth consent to the actual attempt/account/provider, and keep native callback correlation separate from whether that attempt included consent. Require explicit pre-auth consent for signup, query the server after sign-in, and verify both warm and cold callbacks when editing authentication or legal acceptance. Do not infer acceptance from onboarding, an existing session, or user-editable metadata.