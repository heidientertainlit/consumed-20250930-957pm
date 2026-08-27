-- Named, multi-signal entertainment communities. These are intentionally
-- independent from Rooms/pools and from person-to-person affinity matches.

create table if not exists public.people_tribes (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  description text not null,
  identity_statement text not null,
  accent_color text not null,
  accent_color_2 text not null,
  sort_order integer not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.people_tribe_signals (
  id uuid primary key default gen_random_uuid(),
  tribe_id uuid not null references public.people_tribes(id) on delete cascade,
  signal_group text not null,
  signal_type text not null check (signal_type in ('genre', 'creator', 'show', 'media_type')),
  signal_value text not null,
  display_label text not null,
  weight numeric(5,4) not null default 1 check (weight > 0 and weight <= 2),
  min_strength numeric(5,4) not null default 0 check (min_strength >= 0 and min_strength <= 1),
  sort_order integer not null default 0,
  unique (tribe_id, signal_type, signal_value)
);

create table if not exists public.people_tribe_media (
  id uuid primary key default gen_random_uuid(),
  tribe_id uuid not null references public.people_tribes(id) on delete cascade,
  title text not null,
  media_type text not null,
  creator text,
  image_url text,
  external_id text,
  external_source text,
  editorial_reason text,
  sort_order integer not null default 0,
  unique (tribe_id, title)
);

create table if not exists public.people_tribe_recommendations (
  tribe_id uuid not null references public.people_tribes(id) on delete cascade,
  user_id uuid not null references public.users(id) on delete cascade,
  fit_score integer not null check (fit_score >= 0 and fit_score <= 100),
  matched_groups text[] not null default '{}',
  evidence jsonb not null default '[]'::jsonb,
  algorithm_version text not null,
  computed_at timestamptz not null default now(),
  primary key (tribe_id, user_id)
);

create table if not exists public.people_tribe_members (
  tribe_id uuid not null references public.people_tribes(id) on delete cascade,
  user_id uuid not null references public.users(id) on delete cascade,
  status text not null default 'active' check (status in ('active', 'left')),
  membership_source text not null default 'user_join' check (membership_source in ('user_join', 'invite', 'admin')),
  join_score integer check (join_score is null or (join_score >= 0 and join_score <= 100)),
  joined_at timestamptz not null default now(),
  left_at timestamptz,
  updated_at timestamptz not null default now(),
  primary key (tribe_id, user_id)
);

create index if not exists people_tribe_signals_tribe_idx on public.people_tribe_signals(tribe_id, signal_group, sort_order);
create index if not exists people_tribe_media_tribe_idx on public.people_tribe_media(tribe_id, sort_order);
create index if not exists people_tribe_recommendations_user_idx on public.people_tribe_recommendations(user_id, fit_score desc);
create index if not exists people_tribe_members_user_idx on public.people_tribe_members(user_id, status);
create index if not exists people_tribe_members_tribe_idx on public.people_tribe_members(tribe_id, status, joined_at);

alter table public.people_tribes enable row level security;
alter table public.people_tribe_signals enable row level security;
alter table public.people_tribe_media enable row level security;
alter table public.people_tribe_recommendations enable row level security;
alter table public.people_tribe_members enable row level security;

revoke all on public.people_tribes from anon, authenticated;
revoke all on public.people_tribe_signals from anon, authenticated;
revoke all on public.people_tribe_media from anon, authenticated;
revoke all on public.people_tribe_recommendations from anon, authenticated;
revoke all on public.people_tribe_members from anon, authenticated;

grant select on public.people_tribes to authenticated;
grant select on public.people_tribe_signals to authenticated;
grant select on public.people_tribe_media to authenticated;
grant select on public.people_tribe_recommendations to authenticated;

drop policy if exists "Authenticated users can read active tribes" on public.people_tribes;
create policy "Authenticated users can read active tribes"
  on public.people_tribes for select to authenticated
  using (is_active = true);

drop policy if exists "Authenticated users can read active tribe signals" on public.people_tribe_signals;
create policy "Authenticated users can read active tribe signals"
  on public.people_tribe_signals for select to authenticated
  using (exists (
    select 1 from public.people_tribes t
    where t.id = tribe_id and t.is_active = true
  ));

drop policy if exists "Authenticated users can read active tribe media" on public.people_tribe_media;
create policy "Authenticated users can read active tribe media"
  on public.people_tribe_media for select to authenticated
  using (exists (
    select 1 from public.people_tribes t
    where t.id = tribe_id and t.is_active = true
  ));

drop policy if exists "Users can read their tribe recommendations" on public.people_tribe_recommendations;
create policy "Users can read their tribe recommendations"
  on public.people_tribe_recommendations for select to authenticated
  using (user_id = auth.uid());

insert into public.people_tribes
  (slug, name, description, identity_statement, accent_color, accent_color_2, sort_order)
values
  ('cozy-escapists', 'Cozy Escapists',
   'Comfort stories, warm ensembles, gentle mysteries, and worlds you return to when real life gets loud.',
   'You choose entertainment that feels inhabited, familiar, and quietly restorative.',
   '#6f4a76', '#b87873', 10),
  ('lore-hunters', 'Lore Hunters',
   'Expansive worlds, hidden histories, fan theories, and the kind of stories that reward a second map.',
   'You do not just follow a story. You learn its rules, histories, and unanswered questions.',
   '#313f73', '#76518f', 20),
  ('beautifully-devastated', 'Beautifully Devastated',
   'Character studies, aching romances, literary adaptations, and stories worth the emotional damage.',
   'You want art to leave a mark, even when that means sitting with it long after the credits.',
   '#713f59', '#a86673', 30),
  ('chaos-connoisseurs', 'Chaos Connoisseurs',
   'Big personalities, social experiments, dark comedy, and situations that unravel in public.',
   'You appreciate the precise moment composure disappears and the group chat comes alive.',
   '#8b3f68', '#c86f58', 40),
  ('prestige-sleuths', 'Prestige Sleuths',
   'Moral ambiguity, meticulous investigations, psychological tension, and mysteries built for close reading.',
   'You like evidence, atmosphere, and stories that trust you to notice what is not being said.',
   '#294f5a', '#526a86', 50),
  ('nostalgia-keepers', 'Nostalgia Keepers',
   'Formative favorites, generational touchstones, animated classics, and the soundtracks that bring whole eras back.',
   'Your taste has a memory, and revisiting it is part comfort, part cultural archaeology.',
   '#80512f', '#a97c55', 60)
on conflict (slug) do update set
  name = excluded.name,
  description = excluded.description,
  identity_statement = excluded.identity_statement,
  accent_color = excluded.accent_color,
  accent_color_2 = excluded.accent_color_2,
  sort_order = excluded.sort_order,
  is_active = true,
  updated_at = now();

insert into public.people_tribe_signals
  (tribe_id, signal_group, signal_type, signal_value, display_label, weight, min_strength, sort_order)
select t.id, seed.signal_group, seed.signal_type, seed.signal_value, seed.display_label, seed.weight, seed.min_strength, seed.sort_order
from (
  values
    ('cozy-escapists', 'comfort', 'genre', 'comedy', 'Comfort comedy', 1.1, 0.08, 10),
    ('cozy-escapists', 'comfort', 'show', 'friends', 'Familiar ensembles', 1.2, 0.02, 20),
    ('cozy-escapists', 'warmth', 'genre', 'romance', 'Warm-hearted romance', 1.0, 0.04, 30),
    ('cozy-escapists', 'warmth', 'genre', 'family', 'Gentle, all-ages stories', 0.8, 0.03, 40),
    ('cozy-escapists', 'ritual', 'media_type', 'book', 'Books as a reset', 0.45, 0.08, 50),
    ('cozy-escapists', 'ritual', 'media_type', 'tv', 'Comfort rewatches', 0.45, 0.08, 60),

    ('lore-hunters', 'worlds', 'genre', 'fantasy', 'Fantasy worlds', 1.2, 0.04, 10),
    ('lore-hunters', 'worlds', 'genre', 'science fiction', 'Speculative futures', 1.2, 0.04, 20),
    ('lore-hunters', 'quest', 'genre', 'adventure', 'Quest-driven stories', 0.9, 0.04, 30),
    ('lore-hunters', 'anchors', 'show', 'the lord of the rings', 'Middle-earth', 1.25, 0.01, 40),
    ('lore-hunters', 'anchors', 'show', 'dune', 'Dune', 1.25, 0.01, 50),
    ('lore-hunters', 'formats', 'media_type', 'book', 'Deep-reading worlds', 0.4, 0.08, 60),
    ('lore-hunters', 'formats', 'media_type', 'game', 'Playable worlds', 0.55, 0.04, 70),

    ('beautifully-devastated', 'emotion', 'genre', 'drama', 'Character-driven drama', 1.1, 0.12, 10),
    ('beautifully-devastated', 'emotion', 'genre', 'romance', 'Earnest romance', 0.9, 0.04, 20),
    ('beautifully-devastated', 'weight', 'genre', 'history', 'Stories shaped by history', 0.8, 0.03, 30),
    ('beautifully-devastated', 'anchors', 'show', 'fleabag', 'Fleabag', 1.3, 0.01, 40),
    ('beautifully-devastated', 'anchors', 'show', 'parasite', 'Parasite', 1.1, 0.01, 50),
    ('beautifully-devastated', 'formats', 'media_type', 'book', 'Literary immersion', 0.45, 0.08, 60),
    ('beautifully-devastated', 'formats', 'media_type', 'music', 'Music for the aftermath', 0.45, 0.04, 70),

    ('chaos-connoisseurs', 'spectacle', 'genre', 'reality', 'Reality spectacle', 1.3, 0.03, 10),
    ('chaos-connoisseurs', 'spectacle', 'genre', 'comedy', 'Comedy under pressure', 0.8, 0.08, 20),
    ('chaos-connoisseurs', 'stakes', 'genre', 'crime', 'Bad decisions, real stakes', 0.7, 0.03, 30),
    ('chaos-connoisseurs', 'anchors', 'show', 'the office', 'Workplace chaos', 1.0, 0.01, 40),
    ('chaos-connoisseurs', 'formats', 'media_type', 'tv', 'Episodic obsession', 0.55, 0.10, 50),
    ('chaos-connoisseurs', 'formats', 'media_type', 'podcast', 'Recap and debate', 0.5, 0.03, 60),

    ('prestige-sleuths', 'investigation', 'genre', 'mystery', 'Layered mysteries', 1.2, 0.05, 10),
    ('prestige-sleuths', 'investigation', 'genre', 'crime', 'Crime and consequence', 1.0, 0.04, 20),
    ('prestige-sleuths', 'tension', 'genre', 'thriller', 'Psychological tension', 1.1, 0.05, 30),
    ('prestige-sleuths', 'truth', 'genre', 'documentary', 'Documentary evidence', 0.8, 0.02, 40),
    ('prestige-sleuths', 'anchors', 'show', 'the x-files', 'The X-Files', 0.9, 0.01, 50),
    ('prestige-sleuths', 'formats', 'media_type', 'book', 'Close-reading mysteries', 0.4, 0.06, 60),
    ('prestige-sleuths', 'formats', 'media_type', 'podcast', 'Investigative listening', 0.5, 0.03, 70),

    ('nostalgia-keepers', 'memory', 'genre', 'family', 'Formative family stories', 1.0, 0.03, 10),
    ('nostalgia-keepers', 'memory', 'genre', 'animation', 'Animated touchstones', 1.0, 0.03, 20),
    ('nostalgia-keepers', 'return', 'genre', 'comedy', 'Rewatchable comedy', 0.8, 0.08, 30),
    ('nostalgia-keepers', 'anchors', 'show', 'back to the future', 'Back to the Future', 1.1, 0.01, 40),
    ('nostalgia-keepers', 'anchors', 'show', 'the lion king', 'The Lion King', 1.1, 0.01, 50),
    ('nostalgia-keepers', 'sound', 'media_type', 'music', 'Era-defining soundtracks', 0.5, 0.03, 60),
    ('nostalgia-keepers', 'formats', 'media_type', 'movie', 'Movies worth returning to', 0.4, 0.08, 70)
) as seed(slug, signal_group, signal_type, signal_value, display_label, weight, min_strength, sort_order)
join public.people_tribes t on t.slug = seed.slug
on conflict (tribe_id, signal_type, signal_value) do update set
  signal_group = excluded.signal_group,
  display_label = excluded.display_label,
  weight = excluded.weight,
  min_strength = excluded.min_strength,
  sort_order = excluded.sort_order;

insert into public.people_tribe_media
  (tribe_id, title, media_type, editorial_reason, sort_order)
select t.id, seed.title, seed.media_type, seed.editorial_reason, seed.sort_order
from (
  values
    ('cozy-escapists', 'Gilmore Girls', 'tv', 'Rapid-fire warmth and a town that feels lived in.', 10),
    ('cozy-escapists', 'The Thursday Murder Club', 'book', 'A mystery with friendship at its center.', 20),
    ('cozy-escapists', 'Schitt''s Creek', 'tv', 'A chosen family you can return to.', 30),
    ('lore-hunters', 'Dune', 'book', 'Politics, prophecy, ecology, and generations of history.', 10),
    ('lore-hunters', 'The Lord of the Rings', 'movie', 'The benchmark for fully inhabited fantasy worlds.', 20),
    ('lore-hunters', 'The Expanse', 'tv', 'Systems, factions, and consequences at planetary scale.', 30),
    ('beautifully-devastated', 'Fleabag', 'tv', 'A comedy that knows exactly where the bruise is.', 10),
    ('beautifully-devastated', 'Normal People', 'book', 'Intimacy, timing, and everything left unsaid.', 20),
    ('beautifully-devastated', 'Past Lives', 'movie', 'A quiet study of love, identity, and alternate lives.', 30),
    ('chaos-connoisseurs', 'The Traitors', 'tv', 'Social strategy with impeccable theatrical timing.', 10),
    ('chaos-connoisseurs', 'The White Lotus', 'tv', 'Beautiful settings, terrible decisions.', 20),
    ('chaos-connoisseurs', 'Las Culturistas', 'podcast', 'Pop culture processed at conversational speed.', 30),
    ('prestige-sleuths', 'Mindhunter', 'tv', 'Procedural rigor with psychological depth.', 10),
    ('prestige-sleuths', 'Gone Girl', 'book', 'An investigation where perspective is the evidence.', 20),
    ('prestige-sleuths', 'Zodiac', 'movie', 'Atmosphere, obsession, and unresolved detail.', 30),
    ('nostalgia-keepers', 'Back to the Future', 'movie', 'An endlessly revisitable generational touchstone.', 10),
    ('nostalgia-keepers', 'The Lion King', 'movie', 'A formative story carried by an unforgettable soundtrack.', 20),
    ('nostalgia-keepers', 'Stranger Things', 'tv', 'A new story built from the texture of remembered media.', 30)
) as seed(slug, title, media_type, editorial_reason, sort_order)
join public.people_tribes t on t.slug = seed.slug
on conflict (tribe_id, title) do update set
  media_type = excluded.media_type,
  editorial_reason = excluded.editorial_reason,
  sort_order = excluded.sort_order;