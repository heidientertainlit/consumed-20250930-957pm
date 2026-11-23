---
name: Post-add feedback and Finished reactions
description: Finished quick-add opens the shared optional review after Consumed; other saves keep brief acknowledgments.
---

## Current post-add policy

Use a brief, substantial, centered **“Logged!” animation**, except **Finished
shows “Consumed” with a checkmark**, with a
rounded purple/lavender DNA-icon pulse across **all add-media flows**, not a small toast or
“Added to Currently” notification.
For **poster + → Finished**, save first, then immediately open the shared
Finished rating/review form. No separate Consumed screen, animation delay, or
Consumed/Added to Finished/DNA strip at the top. The selected Finished row
already communicates where the item was saved. Include **Not now**;
skipping leaves Finished saved. Do not track it again or repeat the prompt after
the person has already supplied a rating/review.
Other destinations, batches, imports, and saves that already included a
rating/review retain acknowledgment-only behavior. Do not add automatic
recommendation, sharing, or progress dialogs.

**Why:** The user explicitly approved this narrow Finished follow-up, superseding
the earlier no-automatic-dialog rule for this path only. They asked to replace
the boxed lime rail with the app's existing rounded DNA navigation icon.

**Why:** After trying consecutive screens and an inline confirmation header,
the user rejected the redundant top strip because Finished is already shown
under Add to a list. Other flows retain their acknowledgments.

**Why:** The user asked for “think duoloingo style” responsiveness, selected
“All add-media flows,” and then explicitly rejected the small notification:
“I want it to be a bigger animation and experience,” with the word large in
the middle, something fun, and a DNA progress bar. Their reference was a rough
example they did not love, not an exact design to copy. They previously said
this is not a celebration for Consumed.
They explicitly chose “logged for everything EXCEPT for 'finished'” and
“Consumed” with a checkmark for Finished.

**How to apply:** Acknowledge confirmed saves only, without confetti, cheering,
or points. The acknowledgment itself remains non-blocking and disappears
on its own outside the Finished review, respects reduced motion, and survives
the return from Add to Now. The eligible Finished review has no acknowledgment
animation or header to block or shift its content.
Make the playful motion noticeable without inventing numerical DNA progress,
scores, or backend-processing status.
Keep the approved large centered experience, but remove decorative background
circles/rings when refining it. Favor more satisfying, physical-feeling motion.
The user approved “stamp and snap”: a fast arrival, slight compression, one
rebound, and a synchronized DNA pulse, with a light native haptic where supported.
Keep “Logged!” quicker and visually lighter, while Finished retains the full
“Consumed” moment.

**Why:** The user said “ok I love that but not the circle thing in the
background” and asked how to make it feel more satisfying and “physical.”
They then explicitly selected “Try stamp and snap.”
They also approved a quicker, lighter acknowledgment for routine saves so
completion feels more meaningful and repeated additions feel less intrusive.

Preserve failure behavior and do not replace batch/partial-error information
with a misleading successful-add message.

## Explicit reaction form presentation

The following presentation rules apply to the shared rating/review form,
including the approved Finished follow-up.
Reaction and rating are independently optional; skipping must leave the saved
entry intact, and omitting stars must not delete an existing rating.

Keep the implementation shared, but give the Finished follow-up its own
full-viewport white presentation without a dark backdrop or an outer reaction
box. Lead with large **“Okay, let's hear it.”** and smaller
**“You've got thoughts.”**. Put **Your rating (optional)** above a much larger,
open paragraph-style **Your reaction (optional)** writing area, not a gray box.
Move poster/title/year and TV scope below the reaction, near Add to a list.
Use subtle season/episode dropdowns rather than prominent pills in this
follow-up only. Its order is **rating → reaction → media/scope → list → Share to NOW**.
The selected list starts as Finished, with
**Change** expanding the existing list choices; apply changes only on Save.
Share to NOW is positive wording (checked means sharing on), followed by Save
and Not now. Keep normal, non-follow-up forms' existing order and labels.

**Why:** The user wants the screen to focus on writing rather than aggressive
tracking controls, explicitly moving “the black doves, seasons & episodes down
by add to a list” and providing the new heading/subheading reference. This
supersedes earlier top-of-form media placement and “What did you think?” copy.

**How to apply:** Preserve optional fields, spoilers, season/episode controls,
drafts on failure, saved Finished status on skip, and no duplicate tracking.
Do not copy the reference mockup's “Copy selections” or concept disclaimer.
Keep the originating page unchanged through the combined confirmation/review; defer
any Now-origin return until Save, Not now, close, or eligibility suppression.

**Why:** The user asked that the follow-up appear on the same page as Consumed.

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

**Why:** The user rejected a separate follow-up design and said, “I just want things to look as similar as possible from place to place. so it's easier on the mind to know what to do.”

For scoped completion, the user leaned toward marking only the selected season finished: “maybe only that season.” Do not interpret finishing a season as finishing the whole show.

**Why:** They want season/series/book/podcast scope choices to represent what was actually consumed, not merely change the reaction label.

**Why:** The user wants people to say what they thought, not merely leave stars, and explicitly limited this change to Finished rather than all lists.

**How to apply:** Preserve other lists' behavior and public posting behavior without restoring the removed explanatory copy. Keep both user-identified entry paths consistent; do not rewrite unrelated Currently Consuming flows. Never create real posts or library entries merely to verify the dialog.
