---
name: Terms consent and native recovery
description: Consent integrity depends on classifying recovery before native session restoration.
---

Native recovery must be identified before restoring its session, and callback-routing infrastructure must remain outside the terms gate.

**Why:** Native recovery can emit SIGNED_IN before the reset route is entered. Path-only classification can mistake recovery for normal OAuth login and consume a stale consent attempt. A gate surrounding callback handlers can also prevent recovery navigation entirely.

**How to apply:** Clear pending consent for recovery, preserve explicit recovery classification, bind OAuth consent to the actual attempt/account/provider, and verify both warm and cold callbacks when editing authentication or legal acceptance. Do not infer acceptance from onboarding, an existing session, or user-editable metadata.