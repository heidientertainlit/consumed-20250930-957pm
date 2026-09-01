# Consumed / Section Selector Exploration

## Grounding

The current selectors are structurally the same on all three surfaces: a full-width, icon-over-label row on warm ivory (`#fbf8f5`), with a short centered purple underline. Play supports a roving-tab keyboard model (arrow keys, Home, End); People and profile currently use `role="tab"` and click state but do not yet mirror that keyboard behavior. The proposed patterns retain labels and existing state/routing:

- **Play:** All, Trivia, Cast Your Vote, Debate the Rank, Seen It
- **People:** Friends & Matches, Tribes, Artists & Creators
- **Profile:** DNA + My Media / Their Media

They belong below—not over—the existing rich purple hero/profile regions.

## A — Inset segmented control

**Layout paradigm:** compact control.  
**Mood:** tactile editorial utility.

A single, low `44px` rounded-rectangle rail sits 16px below the hero. Its surface is a pale lilac-grey (`#f1ecf2`) with an inset hairline, deliberately calmer than a pill cluster. Segments fill the rail edge-to-edge, separated only by 1px translucent dividers. The selected segment becomes a warm paper card (`#fffaf6`), raised by 1px with a fine plum outline; its label is deep aubergine and a 14px icon sits before it. Inactive labels are smoky violet-grey, icons at 60% opacity. No underline.

- **Hierarchy:** selected destination reads first through the paper insert; the rail is a single component, so it does not compete with the hero or first feed module.
- **Mobile:** Play is a horizontally scrollable rail with `scroll-snap`, 12px internal side padding, and a visible partial next segment to signal more content. People and profile fit without scrolling. Each target remains at least 44px tall.
- **Adaptation:** Play uses concise visible labels exactly as supplied, allowing “Cast Your Vote” and “Debate the Rank” two lines only below 390px. People uses three equal segments, icons retained. Profile uses a two-up rail; “My Media” / “Their Media” take visual parity with DNA.
- **Accessibility:** preserve tab semantics, selected state, panel linkage, focus-visible plum ring, and Play’s arrow/Home/End model; apply the same roving keyboard pattern to People and profile.
- **Trade-off:** exceptionally clear and space-efficient, especially for a five-option Play switcher. It signals “view filter,” however, so it slightly understates the fact that People’s Tribes and Creators are meaningful destinations.

## B — Editorial category strip

**Layout paradigm:** editorial index.  
**Mood:** cultural magazine masthead.

This becomes a typographic index pinned to the first line of content rather than a control. A thin, soft-plum rule spans the content width at the top. Each label is left-aligned in an even grid (not icon-centered); a small numbered kicker—`01` through `05`—sits above or before the label in compact mono. Icons disappear by default, except for a tiny DNA glyph on profile and an optional 12px marker on People. The active item is deep aubergine, set in a semibold display face, and has a thick 3px purple rule that continues into the top border of the content panel below. Inactive items are muted but fully legible; hover underlines them with a 120ms transform.

- **Hierarchy:** section names become editorial headings. The continuous active rule visibly “binds” the chosen index item to its feed, solving the current detached-underline problem.
- **Mobile:** retain an intentional horizontal index, but use text-first widths instead of equal narrow icon stacks. The active item aligns to the leading content edge; `scroll-padding-inline: 16px`, snap points, and a subtle clipped final label indicate continuation. Five Play labels remain readable at 13px instead of collapsing into tiny type. People and profile distribute evenly when they fit.
- **Adaptation:** Play uses the full five-part index and benefits most from numbered discovery. People loses the numbers if they feel too formal and uses compact upper kickers (“CONNECT,” “GATHER,” “FOLLOW”) only as decorative context, while preserving the given labels as the clickable names. Profile uses just two oversized destinations, `DNA` and `MY MEDIA`/`THEIR MEDIA`, turning the switch into a chapter break.
- **Accessibility:** use buttons/tabs with visible 2px focus treatment that does not rely on the active rule; announce state exactly as today. Arrow navigation moves focus and selection; mobile scrolling never traps focus.
- **Trade-off:** the sharpest expression of Consumed’s entertainment-editorial identity and the least dashboard-like option. It offers slightly less immediate “button” affordance than a segmented control, so its selected state and focus state must be executed with precision.

## C — Destination cards

**Layout paradigm:** destination navigation.  
**Mood:** collector’s shelf / cultural field guide.

The selector is a shallow row of compact tiles, `72–84px` tall, aligned with the content column. Each tile holds a 16px icon in a colored square, a label, and a one-line purpose descriptor taken from the existing data where available. The cards use ivory paper, 1px lavender-grey edges, and asymmetric radii (for example 18px / 8px) to avoid dashboard uniformity. The active card gets a deep plum fill with cream type, while its icon tile flips to apricot; inactive cards remain paper with a faint tinted icon tile. A restrained `1px` bottom rail below the row leads into the feed.

- **Hierarchy:** active tile behaves as a small cover for the current room; descriptions make Play’s distinctions immediately understandable.
- **Mobile:** cards form a touch-friendly horizontal carousel with 84% viewport card width on narrow screens and 12px gap; first/last cards have side insets. On tablet, Play uses five compressed tiles or a two-row masonry-like grid only if horizontal scrolling is explicitly rejected. People’s three cards can be a compact horizontal row; profile’s two cards become a balanced two-up pair.
- **Adaptation:** Play uses all five descriptions already present (`Everything happening in Play`, `Think you know it? Prove it.`, and so on). People needs short supporting copy such as “Taste overlap, made social,” “Find your corner of culture,” and “Follow the people behind it.” Profile uses personal ownership: “Your taste, decoded” and “Everything you’ve logged,” with “Their media” adapting automatically.
- **Accessibility:** each tile is a semantic tab/button with a clear selected label, robust focus ring, and equivalent arrow-key behavior. Descriptors are visible text rather than tooltip-only information.
- **Trade-off:** strongest orientation and strongest personality for sparse destinations—especially People. At five Play choices it can become a second content carousel before the real feed, consuming vertical attention and slightly delaying play.

## Recommendation — B, the Editorial Category Strip

Choose **B**. It best fits Consumed as a culturally sharp identity product: it turns navigation into a piece of the page’s editorial voice instead of another utility widget, while the extended active rule creates a credible visual handoff from purple identity region to warm-ivory feed. It also scales most gracefully from two profile chapters to five Play modes without pretending every choice needs the same weight or a dashboard card.

Implement it as a shared `SectionIndex` primitive, parameterized by labels, active ID, and existing callbacks/routes. Preserve all current tab IDs and panel relationships. Bring Play’s roving arrow/Home/End navigation to People and profile for behavioral consistency. Keep icons optional and secondary—none on Play by default, a restrained semantic mark only where it reinforces DNA/People recognition.
