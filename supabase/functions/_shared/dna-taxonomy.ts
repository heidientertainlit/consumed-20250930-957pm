// ============================================================
// Consumed Entertainment DNA — Taxonomy Constants
// ============================================================
// This file is the single source of truth for all pre-defined
// DNA system labels. AI must assign from this list — never invent.
// Shared across edge functions via Deno import.
// ============================================================

export interface DnaArchetype {
  key: string;
  displayName: string;
  oneLiner: string;
  description: string;
  sampleFlavor: string;
  signalHints: string[];
}

export interface FlavorTrait {
  key: string;
  label: string;
}

export interface EraLabel {
  key: string;
  label: string;
}

export interface ReputationTitle {
  key: string;
  displayName: string;
  meaning: string;
  signals: string[];
  tiers: {
    bronze: string;
    silver: string;
    gold: string;
    elite: string;
  };
}

// ============================================================
// 18 CORE DNA ARCHETYPES
// ============================================================

export const DNA_ARCHETYPES: DnaArchetype[] = [
  {
    key: "theory_crafter",
    displayName: "The Theory Crafter",
    oneLiner: "You don't just watch. You build cases.",
    description:
      "You notice the detail everyone else missed, rewind scenes, predict endings, and turn every twist into evidence. You are the person who has a theory before the group chat has recovered.",
    sampleFlavor:
      "You're not just following the story. You're investigating it. Your taste leans toward shows, books, and movies that reward attention, reward patience, and make every small detail feel suspicious.",
    signalHints: [
      "high prediction participation and accuracy",
      "mystery, thriller, true crime, sci-fi, or lore-heavy engagement",
      "strong trivia performance",
      "rewatching or revisiting complex titles",
      "comments using theory, prediction, clue, ending, twist language",
    ],
  },
  {
    key: "comfort_rewatcher",
    displayName: "The Comfort Rewatcher",
    oneLiner: "You know exactly where to go when you need something that feels like home.",
    description:
      "New is fine, but familiar is sacred. You return to shows, books, movies, and music that know you back. Your taste has a comfort shelf, and it is well-loved.",
    sampleFlavor:
      "You don't rewatch because you ran out of options. You rewatch because certain stories still work every time. Your entertainment life has emotional landmarks, and you know exactly which ones to return to.",
    signalHints: [
      "repeat tracking of same titles",
      "high ratings for familiar or nostalgic titles",
      "sitcom, rom-com, family, cozy, comfort, childhood signals",
      "lower novelty-seeking behavior",
      "high saves or adds to finished or favorites lists",
    ],
  },
  {
    key: "prestige_detective",
    displayName: "The Prestige Detective",
    oneLiner: "You like your stories smart, layered, and a little morally complicated.",
    description:
      "You gravitate toward sharp writing, slow-burn tension, prestige drama, morally messy characters, and stories that trust the audience to keep up.",
    sampleFlavor:
      "You are drawn to stories that feel like they are hiding something under the surface. You like tension, subtext, complicated people, and endings that leave you thinking longer than expected.",
    signalHints: [
      "high ratings for prestige drama, limited series, literary fiction, award-adjacent media",
      "strong completion rate for slower or complex titles",
      "high engagement with ratings and thoughtful takes",
      "low tolerance for shallow or rushed storytelling",
      "character-first or writing-first language in posts",
    ],
  },
  {
    key: "emotional_binger",
    displayName: "The Emotional Binger",
    oneLiner: "You are here to feel something.",
    description:
      "Character arcs wreck you. Finales matter. You care less about whether a story is perfect and more about whether it lands emotionally.",
    sampleFlavor:
      "Your best entertainment experiences are the ones that get under your skin. You follow the emotional thread, root hard for characters, and judge a story by whether it actually made you feel something.",
    signalHints: [
      "high completion rate on dramas, romance, memoir, emotionally intense content",
      "high ratings tied to emotional posts or reviews",
      "comments using cried, wrecked, felt, heartbreaking, beautiful, devastated language",
      "binge behavior on character-driven content",
    ],
  },
  {
    key: "first_episode_judge",
    displayName: "The First Episode Judge",
    oneLiner: "You know fast. Usually very fast.",
    description:
      "You are decisive with your time. If something does not grab you, you move on. Your taste is specific, your standards are clear, and your abandoned list says as much about you as your favorites.",
    sampleFlavor:
      "You do not need six episodes to know if something is for you. Your entertainment radar is fast, specific, and usually right. When you do stay, it means the story earned your attention.",
    signalHints: [
      "high started-but-not-finished ratio",
      "many early ratings or quick reactions",
      "strong negative or mixed reactions after first episodes",
      "selective high ratings",
      "low patience for slow starts unless strongly aligned with taste",
    ],
  },
  {
    key: "hidden_gem_hunter",
    displayName: "The Hidden Gem Hunter",
    oneLiner: "You found it before everyone else did.",
    description:
      "You love discovering the under-the-radar thing before it becomes obvious. Your taste is curious, exploratory, and not overly dependent on what everyone else is watching.",
    sampleFlavor:
      "You have a radar for things that deserve more attention. You do not need the whole internet to validate your taste first. You would rather find the thing people will be talking about later.",
    signalHints: [
      "adds or ratings of lower-popularity or niche titles",
      "wide variety across genres or formats",
      "early tracking before popularity spikes",
      "strong discovery behavior",
      "saves from search rather than only trending lists",
    ],
  },
  {
    key: "dark_season_devotee",
    displayName: "The Dark Season Devotee",
    oneLiner: "Your watchlist is not exactly beach reading.",
    description:
      "Psychological, intense, morally complicated, true crime, noir, heavy — you are drawn to the darker corners of storytelling.",
    sampleFlavor:
      "You are not scared of the heavy stuff. In fact, you seem to trust stories more when they are willing to go somewhere uncomfortable, complicated, or emotionally shadowy.",
    signalHints: [
      "thriller, true crime, noir, dystopian, psychological, horror, dark drama signals",
      "high engagement with darker polls, trivia, and predictions",
      "high ratings for heavy themes",
      "low engagement with light or comfort genres",
    ],
  },
  {
    key: "story_sharer",
    displayName: "The Story Sharer",
    oneLiner: "You watch so you can talk about it.",
    description:
      "You send clips, quote scenes, text people mid-episode, and need someone to process the finale with. Entertainment is not finished for you until it has been shared.",
    sampleFlavor:
      "For you, entertainment is social oxygen. A good story becomes better when someone else is there to react, argue, laugh, or emotionally recover with you.",
    signalHints: [
      "high posting and commenting behavior",
      "high shares and recommendations",
      "frequent reviews and takes",
      "strong friend interaction",
      "engagement across social surfaces and rooms",
    ],
  },
  {
    key: "slow_burn_devotee",
    displayName: "The Slow Burn Devotee",
    oneLiner: "You trust the process.",
    description:
      "You have patience for stories that build. You do not need everything explained immediately. You like atmosphere, tension, layered character work, and payoff that earns itself.",
    sampleFlavor:
      "You are willing to sit with a story while it gathers power. You do not mind quiet episodes, complicated setups, or delayed payoff — as long as the ending earns the wait.",
    signalHints: [
      "strong completion rates on long-form, prestige, foreign, literary, or slow-starting content",
      "low abandonment for slower titles",
      "high ratings for complex pacing",
      "comments about payoff, patience, build, atmosphere, character development",
    ],
  },
  {
    key: "genre_loyalist",
    displayName: "The Genre Loyalist",
    oneLiner: "You know your lane, and your lane knows you.",
    description:
      "You have deep knowledge in the genres you love. You do not need to watch everything. You need the right thing, and your friends probably ask you for recommendations in your category.",
    sampleFlavor:
      "Your taste is not random. It has a home base. You know the patterns, the classics, the weak spots, and the hidden gems inside your favorite lane.",
    signalHints: [
      "one genre or media type dominates activity",
      "high trivia accuracy in that genre",
      "strong rating and comment history within a category",
      "repeat engagement in genre-specific rooms",
      "high confidence recommendation behavior",
    ],
  },
  {
    key: "era_hopper",
    displayName: "The Era Hopper",
    oneLiner: "Your taste has seasons.",
    description:
      "You move through phases and go all in. One month it is true crime, next month fantasy romance, then suddenly you are deep in documentaries or 90s movies.",
    sampleFlavor:
      "Your entertainment identity moves in chapters. You do not just like things — you enter phases. When something catches you, you follow the thread until your next obsession takes over.",
    signalHints: [
      "frequent genre shifts across 30 and 60-day windows",
      "wide media-type variety",
      "high discovery, search, and add behavior",
      "lower repeat behavior",
      "strong recent trend changes",
    ],
  },
  {
    key: "taste_signaler",
    displayName: "The Taste Signaler",
    oneLiner: "Your ratings mean something.",
    description:
      "You are selective, opinionated, and people notice. When you give something five stars, it carries weight. You are not trying to be a critic, but your taste has become a signal.",
    sampleFlavor:
      "You do not throw five stars around casually. Your taste has a point of view, and people can feel it. When something earns your approval, it feels like a real endorsement.",
    signalHints: [
      "selective high ratings",
      "high alignment between user ratings and friend or community reactions",
      "highly engaged reviews and takes",
      "friends adding media after user activity",
      "strong influence or trusted recommender behavior",
    ],
  },
  {
    key: "chaos_watcher",
    displayName: "The Chaos Watcher",
    oneLiner: "You love when everything goes off the rails.",
    description:
      "Reality TV, messy ensemble drama, shocking twists, unhinged characters, unpredictable group dynamics — you like entertainment with energy, tension, and chaos.",
    sampleFlavor:
      "You are drawn to stories and shows where the energy is alive. You like big reactions, messy choices, social dynamics, and the kind of episodes people immediately need to discuss.",
    signalHints: [
      "reality TV, competition, drama, guilty pleasure, soap, messy ensemble signals",
      "high poll and reaction engagement",
      "strong use of hot take, down, and up reactions",
      "comments on drama, conflict, chaos, villains, shocking moments",
    ],
  },
  {
    key: "lore_diver",
    displayName: "The Lore Diver",
    oneLiner: "You do not skim the universe. You enter it.",
    description:
      "You love worlds with depth — franchises, fantasy, sci-fi, adaptations, mythology, canon, backstory, timelines, and theories.",
    sampleFlavor:
      "You like stories that feel bigger than one title. You want the rules, the history, the hidden connections, and the details that make a fictional world feel real.",
    signalHints: [
      "fantasy, sci-fi, franchise, adaptation, gaming, lore-heavy media",
      "high trivia engagement in franchise categories",
      "repeat activity around same universes",
      "posts and comments about canon, books vs show, worldbuilding, timeline, theories",
    ],
  },
  {
    key: "completionist",
    displayName: "The Completionist",
    oneLiner: "If you start the journey, you want to finish it.",
    description:
      "You like closing the loop. Full seasons, full series, full catalogs, full lists. You are motivated by progress, closure, and knowing the whole story.",
    sampleFlavor:
      "You do not just sample stories. You finish them. You like the satisfaction of seeing the whole arc, closing the loop, and knowing exactly how it ends.",
    signalHints: [
      "high completion rate",
      "low abandonment rate",
      "multiple items finished within same series, franchise, author, or artist",
      "strong list usage",
      "progress updates",
    ],
  },
  {
    key: "mood_matcher",
    displayName: "The Mood Matcher",
    oneLiner: "You pick entertainment based on the feeling you need.",
    description:
      "Your taste is emotional and situational. Sometimes you need comfort, sometimes intensity, sometimes background joy, sometimes a full emotional reset.",
    sampleFlavor:
      "Your entertainment choices are less about category and more about emotional timing. You know what kind of story you need for the version of yourself who shows up that day.",
    signalHints: [
      "wide genre variety but strong mood consistency",
      "saves and adds across different formats serving similar emotional purposes",
      "survey answers emphasizing mood, feeling, vibe, escape, comfort",
      "context and time-based patterns",
    ],
  },
  {
    key: "culture_tracker",
    displayName: "The Culture Tracker",
    oneLiner: "You like knowing what everyone is talking about.",
    description:
      "You follow the cultural conversation. You want to understand the moment, join the discourse, and have an opinion while it still matters.",
    sampleFlavor:
      "You are tuned into the entertainment conversation while it is happening. Part of the fun is knowing the reference, having the take, and being in the room when everyone else is reacting.",
    signalHints: [
      "adds and ratings of trending titles",
      "high activity around new releases, current events, live shows",
      "participation in polls around popular media",
      "social engagement near release dates",
    ],
  },
  {
    key: "nostalgia_keeper",
    displayName: "The Nostalgia Keeper",
    oneLiner: "Your past has a watchlist.",
    description:
      "You have a soft spot for the things that shaped you — childhood favorites, old comfort shows, throwback music, early fandoms, and stories that still carry memory.",
    sampleFlavor:
      "Your taste carries memory. Certain stories are not just entertainment for you — they are emotional time machines, and you like finding out which ones still hold up.",
    signalHints: [
      "older titles, childhood media, classic comfort titles",
      "rewatching older content",
      "high ratings for nostalgic properties",
      "comments about growing up, memories, childhood, still holds up",
    ],
  },
];

// ============================================================
// 40 FLAVOR TRAITS
// ============================================================

export const DNA_FLAVOR_TRAITS: FlavorTrait[] = [
  { key: "slow_burn_devotee", label: "Slow-burn devotee" },
  { key: "twist_seeker", label: "Twist-seeker" },
  { key: "character_first", label: "Character-first" },
  { key: "earned_ending_required", label: "Earned ending required" },
  { key: "comfort_in_chaos", label: "Comfort in chaos" },
  { key: "finale_sensitive", label: "Finale-sensitive" },
  { key: "emotionally_invested", label: "Emotionally invested" },
  { key: "detail_noticer", label: "Detail-noticer" },
  { key: "lore_curious", label: "Lore-curious" },
  { key: "dark_but_cozy", label: "Dark but cozy" },
  { key: "rewatch_ready", label: "Rewatch-ready" },
  { key: "hard_to_impress", label: "Hard to impress" },
  { key: "soft_spot_for_nostalgia", label: "Soft spot for nostalgia" },
  { key: "deep_cut_finder", label: "Deep-cut finder" },
  { key: "prestige_leaning", label: "Prestige-leaning" },
  { key: "plot_allergic_weak_characters", label: "Plot allergic when characters are weak" },
  { key: "loves_messy_ensemble", label: "Loves a messy ensemble" },
  { key: "needs_someone_to_discuss", label: "Needs someone to discuss it with" },
  { key: "likes_the_book_better", label: "Likes the book better" },
  { key: "pilot_episode_judge", label: "Pilot episode judge" },
  { key: "mood_led_picker", label: "Mood-led picker" },
  { key: "all_in_phase_person", label: "All-in phase person" },
  { key: "ratings_with_standards", label: "Ratings with standards" },
  { key: "crowd_resistant_taste", label: "Crowd-resistant taste" },
  { key: "secretly_sentimental", label: "Secretly sentimental" },
  { key: "pacing_sensitive", label: "Pacing-sensitive" },
  { key: "theory_prone", label: "Theory-prone" },
  { key: "genre_faithful", label: "Genre faithful" },
  { key: "recommends_aggressively", label: "Recommends aggressively" },
  { key: "saves_more_than_finishes", label: "Saves more than finishes" },
  { key: "finishes_what_they_start", label: "Finishes what they start" },
  { key: "quote_repeater", label: "Quote repeater" },
  { key: "villain_apologist", label: "Villain apologist" },
  { key: "ending_examiner", label: "Ending examiner" },
  { key: "adaptation_comparer", label: "Adaptation comparer" },
  { key: "under_the_radar_finder", label: "Under-the-radar finder" },
  { key: "awards_curious", label: "Awards curious" },
  { key: "social_viewer", label: "Social viewer" },
  { key: "emotional_payoff_seeker", label: "Emotional payoff seeker" },
  { key: "always_has_a_take", label: "Always has a take" },
];

// ============================================================
// 25 CURRENT ERA LABELS
// ============================================================

export const DNA_ERA_LABELS: EraLabel[] = [
  { key: "psychological_thriller_era", label: "In your psychological thriller era" },
  { key: "comfort_rewatch_era", label: "In your comfort rewatch era" },
  { key: "reality_chaos_era", label: "In your reality chaos era" },
  { key: "prestige_drama_era", label: "In your prestige drama era" },
  { key: "fantasy_worldbuilding_era", label: "In your fantasy worldbuilding era" },
  { key: "book_to_screen_era", label: "In your book-to-screen era" },
  { key: "emotionally_devastating_era", label: "In your emotionally devastating era" },
  { key: "cozy_mystery_era", label: "In your cozy mystery era" },
  { key: "true_crime_rabbit_hole_era", label: "In your true crime rabbit hole era" },
  { key: "rom_com_reset_era", label: "In your rom-com reset era" },
  { key: "documentary_deep_dive_era", label: "In your documentary deep-dive era" },
  { key: "nostalgia_era", label: "In your nostalgia era" },
  { key: "awards_season_era", label: "In your awards-season era" },
  { key: "slow_burn_era", label: "In your slow-burn era" },
  { key: "plot_twist_era", label: "In your plot twist era" },
  { key: "comfort_sitcom_era", label: "In your comfort sitcom era" },
  { key: "character_study_era", label: "In your character study era" },
  { key: "franchise_lore_era", label: "In your franchise lore era" },
  { key: "hidden_gem_era", label: "In your hidden gem era" },
  { key: "culture_catch_up_era", label: "In your culture catch-up era" },
  { key: "music_discovery_era", label: "In your music discovery era" },
  { key: "podcast_spiral_era", label: "In your podcast spiral era" },
  { key: "gaming_quest_era", label: "In your gaming quest era" },
  { key: "reality_competition_era", label: "In your reality competition era" },
  { key: "need_something_lighter_era", label: "In your \"I need something lighter\" era" },
];

// ============================================================
// 12 REPUTATION TITLES
// ============================================================

export const REPUTATION_TITLES: ReputationTitle[] = [
  {
    key: "master_predictor",
    displayName: "Master Predictor",
    meaning: "You correctly predict outcomes, twists, winners, or story direction.",
    signals: [
      "prediction participation",
      "prediction accuracy",
      "correct streaks",
      "category-specific accuracy",
    ],
    tiers: {
      bronze: "5 correct predictions",
      silver: "15 correct predictions + 60% accuracy",
      gold: "30 correct predictions + 70% accuracy",
      elite: "Top 10% accuracy in a category",
    },
  },
  {
    key: "theory_crafter_rep",
    displayName: "Theory Crafter",
    meaning: "You generate or engage deeply with theories and predictions.",
    signals: [
      "posts or comments with theory language",
      "high engagement on prediction or theory posts",
      "participating in theory-based rooms",
    ],
    tiers: {
      bronze: "10 theory-style posts or comments",
      silver: "25 theory posts with meaningful engagement",
      gold: "50 theory posts, strong community engagement",
      elite: "Top 5% theory engagement platform-wide",
    },
  },
  {
    key: "hot_take_magnet",
    displayName: "Hot Take Magnet",
    meaning: "Your opinions spark reactions.",
    signals: [
      "high hot take reactions received",
      "high comment rate on takes",
      "mixed agreement and disagreement patterns",
    ],
    tiers: {
      bronze: "5 posts with 3+ reactions",
      silver: "15 posts with mixed reactions",
      gold: "30 posts with strong engagement",
      elite: "Top 10% reaction volume",
    },
  },
  {
    key: "trusted_recommender",
    displayName: "Trusted Recommender",
    meaning: "People act on your taste.",
    signals: [
      "friends add media after your rating or review",
      "high agreement with your ratings",
      "saves from your activity",
      "repeat influence",
    ],
    tiers: {
      bronze: "3 friends added something after your rating",
      silver: "10 influence actions across friends",
      gold: "25 influence actions, 70%+ rating agreement",
      elite: "Top 10% influence in your circle",
    },
  },
  {
    key: "crowd_favorite",
    displayName: "Crowd Favorite",
    meaning: "Your takes often resonate with the community.",
    signals: [
      "high up or agree reactions",
      "high alignment with friend and community consensus",
      "high comment positivity",
    ],
    tiers: {
      bronze: "10 posts with majority-agree reactions",
      silver: "25 posts, 70%+ agree rate",
      gold: "50 posts, consistent community alignment",
      elite: "Top 10% consensus alignment",
    },
  },
  {
    key: "debate_starter",
    displayName: "Debate Starter",
    meaning: "You get people talking.",
    signals: [
      "high comment threads on posts",
      "balanced reaction split (agree and disagree)",
      "replies on posts and takes",
    ],
    tiers: {
      bronze: "5 posts with 5+ comments",
      silver: "15 posts with active comment threads",
      gold: "30 posts, strong debate patterns",
      elite: "Top 10% comment volume triggered",
    },
  },
  {
    key: "first_to_know",
    displayName: "First to Know",
    meaning: "You discover or log things before your circle.",
    signals: [
      "early adds before friend or community activity",
      "low-popularity discoveries",
      "hidden gem engagement",
    ],
    tiers: {
      bronze: "3 items tracked before friends",
      silver: "10 early discoveries",
      gold: "25 early discoveries, consistent pattern",
      elite: "Top 5% discovery lead time",
    },
  },
  {
    key: "genre_expert",
    displayName: "Genre Expert",
    meaning: "You have unusually deep engagement in a specific category.",
    signals: [
      "genre concentration in activity",
      "high trivia accuracy in genre",
      "strong rating and review history in genre",
    ],
    tiers: {
      bronze: "20+ items in one genre",
      silver: "50 items + 70% trivia accuracy in genre",
      gold: "100 items + strong review history",
      elite: "Top 5% engagement in that genre",
    },
  },
  {
    key: "completionist_rep",
    displayName: "Completionist",
    meaning: "You finish what you start.",
    signals: [
      "high completion rate",
      "series and franchise completion",
      "low abandoned rate",
    ],
    tiers: {
      bronze: "10 fully completed series or books",
      silver: "25 completions, 80%+ completion rate",
      gold: "50 completions, consistent pattern",
      elite: "Top 5% completion rate platform-wide",
    },
  },
  {
    key: "taste_twin_finder",
    displayName: "Taste Twin Finder",
    meaning: "You have strong taste alignment with others.",
    signals: [
      "multiple high-alignment friends",
      "strong match explanations",
      "shared ratings and favorites",
    ],
    tiers: {
      bronze: "1 Taste Twin (90%+ alignment)",
      silver: "3 Taste Twins",
      gold: "5 Taste Twins",
      elite: "Top 10% alignment network",
    },
  },
  {
    key: "conversation_starter",
    displayName: "Conversation Starter",
    meaning: "You turn media into discussion.",
    signals: [
      "posts, comments, and replies",
      "review and take creation",
      "room participation",
    ],
    tiers: {
      bronze: "20 posts or comments",
      silver: "75 posts or comments with engagement",
      gold: "200 contributions with active replies",
      elite: "Top 10% contribution volume",
    },
  },
  {
    key: "deep_cut_finder",
    displayName: "Deep Cut Finder",
    meaning: "You consistently find under-the-radar content.",
    signals: [
      "niche and low-popularity titles tracked",
      "low-popularity content with high personal ratings",
      "friends discover things through you",
    ],
    tiers: {
      bronze: "5 niche titles tracked and rated",
      silver: "15 niche discoveries",
      gold: "30 niche discoveries, friends follow",
      elite: "Top 5% discovery of non-trending content",
    },
  },
];

// ============================================================
// ARCHETYPE KEYS (for type safety)
// ============================================================

export const ARCHETYPE_KEYS = DNA_ARCHETYPES.map((a) => a.key);
export const FLAVOR_TRAIT_KEYS = DNA_FLAVOR_TRAITS.map((t) => t.key);
export const ERA_LABEL_KEYS = DNA_ERA_LABELS.map((e) => e.key);
export const REPUTATION_TITLE_KEYS = REPUTATION_TITLES.map((r) => r.key);

// ============================================================
// HELPER: look up by key
// ============================================================

export function getArchetype(key: string): DnaArchetype | undefined {
  return DNA_ARCHETYPES.find((a) => a.key === key);
}

export function getFlavorTrait(key: string): FlavorTrait | undefined {
  return DNA_FLAVOR_TRAITS.find((t) => t.key === key);
}

export function getEraLabel(key: string): EraLabel | undefined {
  return DNA_ERA_LABELS.find((e) => e.key === key);
}

export function getReputationTitle(key: string): ReputationTitle | undefined {
  return REPUTATION_TITLES.find((r) => r.key === key);
}
