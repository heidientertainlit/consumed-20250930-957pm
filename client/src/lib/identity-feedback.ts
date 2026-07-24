type FeedbackContext = 'trivia' | 'prediction';

const ARCHETYPE_FEEDBACK: Record<string, Record<FeedbackContext, string[]>> = {
  theory_crafter: {
    trivia: [
      "That's the Theory Crafter in you.",
      "You don't just watch — you study.",
      "Your instinct to dig deeper is paying off.",
    ],
    prediction: [
      "The theory held up.",
      "Evidence-based and accurate.",
      "Your read on this one was airtight.",
    ],
  },
  comfort_rewatcher: {
    trivia: [
      "You know your favorites inside out.",
      "Deep familiarity. That's your edge.",
      "Rewatching pays dividends.",
    ],
    prediction: [
      "You know how these stories go.",
      "Familiar patterns, reliable instincts.",
      "You've seen enough to know.",
    ],
  },
  prestige_detective: {
    trivia: [
      "Sharp taste comes with sharp recall.",
      "Quality in, quality out.",
      "You curate well — and it shows.",
    ],
    prediction: [
      "High standards, accurate predictions.",
      "Discerning and correct.",
      "You pick the right things — in every sense.",
    ],
  },
  emotional_binger: {
    trivia: [
      "You felt that one.",
      "You don't just watch — you live it.",
      "Connection runs deep with you.",
    ],
    prediction: [
      "You called it from the gut — and the gut was right.",
      "You felt where this was going.",
      "Invested deeply. Paid off.",
    ],
  },
  genre_purist: {
    trivia: [
      "Genre mastery on full display.",
      "Domain expertise, activated.",
      "You've gone deep so it pays off.",
    ],
    prediction: [
      "Genre conventions work in your favor.",
      "You know the playbook.",
      "Domain mastery = prediction mastery.",
    ],
  },
  social_watcher: {
    trivia: [
      "Always in the cultural conversation.",
      "Never out of the loop.",
      "You pick up on what everyone's talking about.",
    ],
    prediction: [
      "The crowd's read aligned with yours.",
      "You're dialed into the cultural pulse.",
      "Always in step with the moment.",
    ],
  },
  completionist: {
    trivia: [
      "You see it through — and it shows.",
      "Thoroughness is its own reward.",
      "Completion unlocked. As expected.",
    ],
    prediction: [
      "Full attention, full credit.",
      "You saw it through and called it right.",
      "No detail missed.",
    ],
  },
  first_episode_judge: {
    trivia: [
      "Fast and accurate — very on-brand.",
      "Snap judgment, confirmed.",
      "Your gut check is usually right.",
    ],
    prediction: [
      "Called it early. Called it right.",
      "Fast, accurate, decisive.",
      "Your first impressions are rarely wrong.",
    ],
  },
  cultural_decoder: {
    trivia: [
      "You see the layers others miss.",
      "Pattern recognition working as intended.",
      "Context is everything — and you have it.",
    ],
    prediction: [
      "You read between the lines.",
      "Subtext decoded. Prediction confirmed.",
      "Context is your edge.",
    ],
  },
  dark_content_seeker: {
    trivia: [
      "You go where others won't. Pays off.",
      "Darkness studied, knowledge earned.",
      "The edge has its own rewards.",
    ],
    prediction: [
      "You saw the dark turn coming.",
      "Tension read correctly.",
      "You navigate complexity well.",
    ],
  },
  nostalgia_archivist: {
    trivia: [
      "The archives never fail.",
      "History lesson, passed.",
      "You preserve the good stuff.",
    ],
    prediction: [
      "History repeating — and you knew it.",
      "Archive knowledge, applied.",
      "The patterns from the past came through.",
    ],
  },
  discovery_engine: {
    trivia: [
      "You find what others overlook.",
      "Your radar was right.",
      "Early adopter energy, confirmed.",
    ],
    prediction: [
      "You were ahead of this one.",
      "Ahead of the curve, again.",
      "Early signal, correct call.",
    ],
  },
  world_builder_fan: {
    trivia: [
      "You've memorized the map.",
      "You don't visit — you live there.",
      "Lore mastery activated.",
    ],
    prediction: [
      "Lore consistency does the work.",
      "You know the universe well enough to predict it.",
      "Your dedication to the world paid off.",
    ],
  },
  sports_crossover: {
    trivia: [
      "Cross-genre fluency on display.",
      "Both worlds, one brain.",
      "You don't silo your fandoms.",
    ],
    prediction: [
      "Cross-cultural pattern, spotted.",
      "Multi-domain call. Nailed it.",
      "You bridge fandoms — and predict across them.",
    ],
  },
  music_lens: {
    trivia: [
      "You hear what others see.",
      "Sound and screen, decoded.",
      "The soundtrack clued you in.",
    ],
    prediction: [
      "You heard the direction before it was announced.",
      "Tone read correctly.",
      "Sound predicts story.",
    ],
  },
  book_first_reader: {
    trivia: [
      "The source material advantage.",
      "You read ahead — it shows.",
      "Adaptation spotted.",
    ],
    prediction: [
      "You read ahead in more ways than one.",
      "Source material mapped to this outcome.",
      "The adaptation pattern held.",
    ],
  },
  franchise_loyalist: {
    trivia: [
      "Franchise knowledge runs deep.",
      "Loyalty rewarded.",
      "You stick around long enough to master it.",
    ],
    prediction: [
      "Franchise trajectory, predicted.",
      "Loyalty means knowing the long game.",
      "You know where these things go.",
    ],
  },
  chaotic_omnivore: {
    trivia: [
      "Everything, everywhere — and you know all of it.",
      "No genre left behind.",
      "Breadth is its own expertise.",
    ],
    prediction: [
      "You pulled from everywhere to land this.",
      "Breadth meets accuracy.",
      "Cross-genre intuition, locked in.",
    ],
  },
};

const GENERIC_FEEDBACK: Record<FeedbackContext, string[]> = {
  trivia: [
    "Sharp as ever.",
    "Your instincts are on point.",
    "Knowledge pays off.",
  ],
  prediction: [
    "Called it.",
    "Your read was right.",
    "Instincts confirmed.",
  ],
};

export function getIdentityFeedback(
  archetypeKey: string | null | undefined,
  context: FeedbackContext
): string {
  const pool =
    archetypeKey && ARCHETYPE_FEEDBACK[archetypeKey]
      ? ARCHETYPE_FEEDBACK[archetypeKey][context]
      : GENERIC_FEEDBACK[context];

  return pool[Math.floor(Math.random() * pool.length)];
}

// ── Phase 6: Alignment signals ────────────────────────────────────────────────

const GAME_ALIGNMENT: Record<string, Record<string, string>> = {
  trivia: {
    theory_crafter:     'In your wheelhouse.',
    cultural_decoder:   'Lots to decode here.',
    nostalgia_archivist:'Right from the archives.',
    world_builder_fan:  'Lore knowledge incoming.',
    franchise_loyalist: 'Franchise knowledge pays off.',
    prestige_detective: 'Quality content you\'ve studied.',
    genre_purist:       'Deep knowledge advantage.',
    book_first_reader:  'Source material edge.',
    completionist:      'Another one checked off.',
  },
  vote: {
    social_watcher:     'The crowd wants your read.',
    emotional_binger:   'Make the emotional call.',
    chaotic_omnivore:   'Pulling from everywhere for this one.',
    sports_crossover:   'Cross-fandom perspective ready.',
    comfort_rewatcher:  'You\'ve thought about this.',
    first_episode_judge:'Quick verdict incoming.',
  },
  predict: {
    theory_crafter:     'The evidence is in.',
    first_episode_judge:'First impression, locked in.',
    discovery_engine:   'Called it early.',
    dark_content_seeker:'You saw it coming.',
    prestige_detective: 'Informed take inbound.',
  },
};

const MEDIA_ALIGNMENT: Record<string, Record<string, string>> = {
  tv: {
    comfort_rewatcher:  'Comfort rewatch potential.',
    emotional_binger:   'Could be a feelings situation.',
    social_watcher:     'Everyone\'s talking about this.',
    world_builder_fan:  'A world worth living in.',
    franchise_loyalist: 'Franchise energy detected.',
    completionist:      'Another series to finish.',
    theory_crafter:     'Worth deep-analyzing.',
  },
  movie: {
    prestige_detective: 'We think you\'ll appreciate this one.',
    first_episode_judge:'You\'ll know in 10 minutes.',
    cultural_decoder:   'Layers to unpack here.',
    dark_content_seeker:'Right in your territory.',
    nostalgia_archivist:'A piece of the archive.',
    genre_purist:       'Genre credentials under review.',
  },
  book: {
    book_first_reader:  'You\'ve got the source material edge.',
    theory_crafter:     'Source material acquired.',
    prestige_detective: 'High-signal read incoming.',
    nostalgia_archivist:'Adding to the archive.',
    cultural_decoder:   'Layers incoming.',
  },
  music: {
    music_lens:         'Your ears will have opinions.',
    sports_crossover:   'Cross-cultural listening.',
    chaotic_omnivore:   'Another genre conquered.',
    emotional_binger:   'Music hits different with you.',
  },
};

export function getGameAlignment(
  archetypeKey: string | null | undefined,
  gameType: string
): string | null {
  if (!archetypeKey) return null;
  return GAME_ALIGNMENT[gameType]?.[archetypeKey] ?? null;
}

export function getMediaAlignment(
  archetypeKey: string | null | undefined,
  mediaType: string | null | undefined
): string | null {
  if (!archetypeKey || !mediaType) return null;
  const key = mediaType.toLowerCase().replace(/show/, 'tv');
  return MEDIA_ALIGNMENT[key]?.[archetypeKey] ?? null;
}
