---
name: Creator follows feed DNA & recs
description: Rules for wiring taste sources (like followed creators) into DNA signals and prompts
---
- `user_dna_signals` is rebuilt by extract-dna-signals with delete-all-then-reinsert. **Never write signal rows from other functions** — they'd be wiped on next extraction. Derive new signal sources inside extract-dna-signals instead.
  **Why:** a follow-time signal write was considered and rejected after spotting the wipe; future taste features will hit the same trap.
- User-controlled text (creator names, survey answers) must be sanitized (strip newlines/markdown tokens, cap length) before interpolation into DNA/recommendation LLM prompts — prompt-injection vector flagged in review.
- The Add nav tab opens the feed composer overlay, not pages/add.tsx — UI added only to pages/add.tsx will never be seen from the Add tab.
