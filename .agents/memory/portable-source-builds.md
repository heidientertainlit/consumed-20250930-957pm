---
name: Portable source builds
description: Verify external-host builds without workspace-only uploads.
---

Production source must not depend on ignored upload files. Copy approved document content into version-controlled application assets without changing its bytes.

**Why:** A legal-document replacement passed the local production build because the uploaded files existed in the workspace, but failed from a clean Git checkout where uploads were absent.

**How to apply:** For imported uploads and external-host build investigations, verify a clean source export without ignored workspace assets. A successful workspace build alone does not prove deployment portability.