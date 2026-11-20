---
name: Book series response format
description: Live AI response formatting can make a series disappear independently of dropdown interaction.
---

Verify that the live search response contains the book-series row separately
from verifying that its dropdown expands safely.

**Why:** Temporary, title-scoped production diagnostics captured successful
upstream HTTP responses whose contents began with Markdown code fences.
The plain-JSON parser rejected them and silently omitted the series. Other
responses parsed successfully. A prompt demanding JSON without Markdown did
not enforce that format. Fixtures always supplying a series row could not
detect this availability failure.

**How to apply:** Cover plain JSON, Markdown-wrapped JSON, null and malformed
responses. Check real All and Books responses before claiming end-to-end
dropdown availability. Successful regional probes followed by failed default
probes are not sufficient to blame routing: both outcomes occurred in the
same deployed version and runtime. Correlate per-request diagnostic stages
before naming the cause. Keep temporary diagnostics narrowly scoped, avoid
raw provider text or credentials, and remove them after the investigation.

Accept only a complete outer JSON-labelled or unlabelled Markdown fence;
leave malformed, truncated and prose-wrapped responses rejected.

**Why:** Normalizing the observed response-format variation must not become
speculative metadata repair or broader series discovery.
