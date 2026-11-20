---
name: Post-add feedback and explicit reactions
description: Non-blocking feedback across all add-media flows; presentation rules for explicit rating and review controls.
---

## Current post-add policy

Use a brief animated “Added to…” acknowledgment across **all add-media flows**.
Do not automatically open Finished rating/reaction, recommendation, sharing or
progress follow-up dialogs after saving. Keep the explicit rating/review controls
available before saving and separately invoked progress controls.

**Why:** The user asked for “think duoloingo style” responsiveness but explicitly
said this is not a celebration for Consumed, and selected “All add-media flows.”

**How to apply:** Acknowledge confirmed saves only, without confetti, cheering,
points, an extra tap, focus changes or blocked navigation. Feedback disappears
on its own, respects reduced motion, and survives the return from Add to Now.
Preserve failure behavior and do not replace batch/partial-error information
with a misleading successful-add message.

## Explicit reaction form presentation

The following presentation rules apply when someone explicitly chooses to rate
or review; they do not authorize restoring an automatic post-add dialog.
Reaction and rating are independently optional; skipping must leave the saved
entry intact, and omitting stars must not delete an existing rating.

Use the existing logging form's presentation, not a newly designed follow-up: list grid with Finished marked, stars above the reaction box, and familiar wording. Keep both fields visibly optional. Display TV in uppercase.

Place Save at the bottom with Not now directly underneath, not beside it. Keep both visible above navigation; retain the close X at the top.

**Why:** The user found Save at the top confusing and explicitly asked, “move save to the bottom and do 'not now' under it.”

Include the existing TV season and episode selection above the list grid. Do not call the dialog consistent with Log while omitting those controls.

**Why:** The user repeated that the season and episode selector was still missing and provided the logging form as the reference again.

Retain a Contains spoilers control in both Add to list follow-ups and Add Media → search forms, including season/episode reactions. Marked text stays blurred until explicitly revealed.

**Why:** The user asked to restore the former spoiler warning and blur behavior, not just add a visual warning to the composer.

Use visibly blurred text behind a compact lavender “Spoiler” pill with a crossed-out eye, rather than an opaque block hiding the text's appearance.

**Why:** The user supplied this as the former style and asked to make it “more enticing.”

Spoiler-marked posts protect their entire actual comment/reply thread. Clicking any Spoiler pill reveals that discussion together. Keep author identity, stars, and actions visible.

**Why:** The user selected “Reveal whole discussion” after discussing how replies can expose an otherwise hidden original post.

**How to apply:** Separate reviews of the same title keep independent settings and reveal state, including their own replies. Do not reveal other posts, and do not persist spoiler consent to the database.

**How to apply:** Verify the current rating/review card and additional conversation reviews, not only the older text-card renderer. The user reported that a visible spoiler checkbox was not sufficient when the active feed card bypassed blur/reveal.

Do not restore the “Already saved to Finished. Rating and reaction are optional.” message or the explanatory feed-blur and public-visibility paragraphs.

**Why:** The user explicitly asked to remove these messages while keeping the spoiler checkbox and optional field labels.

**Why:** The user rejected the separate reaction-first design and said, “I just want things to look as similar as possible from place to place. so it's easier on the mind to know what to do.”

For scoped completion, the user leaned toward marking only the selected season finished: “maybe only that season.” Do not interpret finishing a season as finishing the whole show.

**Why:** They want season/series/book/podcast scope choices to represent what was actually consumed, not merely change the reaction label.

**Why:** The user wants people to say what they thought, not merely leave stars, and explicitly limited this change to Finished rather than all lists.

**How to apply:** Preserve other lists' behavior and public posting behavior without restoring the removed explanatory copy. Keep both user-identified entry paths consistent; do not rewrite unrelated Currently Consuming flows. Never create real posts or library entries merely to verify the dialog.
