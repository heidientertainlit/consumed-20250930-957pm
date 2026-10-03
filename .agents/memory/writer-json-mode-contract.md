---
name: Writer JSON-mode contract
description: Preserve the provider's input-message requirement when simplifying writer instructions
---

When the API uses JSON-object response mode, an actual input message must contain
the word “JSON” (case-insensitive). A literal object example alone is insufficient.
Keep an explicit instruction such as `Return only JSON: {"content":"…"}`.

**Why:** The provider validates this before generation and rejects requests that omit
the word. Local type checks and mocked provider tests do not establish this API contract.

**How to apply:** When reducing writer prose, preserve the explicit JSON-format
instruction and test the assembled messages for it. This is transport/output-format
compatibility, not a prose-quality validator or an extra model pass.