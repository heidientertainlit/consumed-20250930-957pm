create table if not exists public.people_tribes (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  description text not null,
  cover_image_url text,
  accent_color text not null default '#6d4bc3',
  signal_values text[] not null default '{}',
  sort_order integer not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.people_tribe_members (
  tribe_id uuid not null references public.people_tribes(id) on delete cascade,
  user_id uuid not null references public.users(id) on delete cascade,
  affinity_score numeric(6,5) not null default 0 check (affinity_score >= 0 and affinity_score <= 1),
  membership_source text not null default 'dna_signal' check (membership_source in ('dna_signal', 'creator_referral', 'curated')),
  joined_at timestamptz not null default now(),
  primary key (tribe_id, user_id)
);

create table if not exists public.people_tribe_interests (
  id uuid primary key default gen_random_uuid(),
  tribe_id uuid not null references public.people_tribes(id) on delete cascade,
  title text not null,
  media_type text,
  creator text,
  image_url text,
  external_id text,
  external_source text,
  rank integer not null default 0,
  created_at timestamptz not null default now(),
  unique (tribe_id, title)
);

create index if not exists people_tribe_members_user_idx on public.people_tribe_members(user_id);
create index if not exists people_tribe_members_affinity_idx on public.people_tribe_members(tribe_id, affinity_score desc);
create index if not exists people_tribe_interests_rank_idx on public.people_tribe_interests(tribe_id, rank);

create or replace function public.refresh_people_tribe_memberships(target_user_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  delete from public.people_tribe_members
  where user_id = target_user_id
    and membership_source = 'dna_signal';

  insert into public.people_tribe_members (tribe_id, user_id, affinity_score, membership_source)
  select
    t.id,
    s.user_id,
    greatest(0, least(1, max(s.strength))) as affinity_score,
    'dna_signal'
  from public.people_tribes t
  join public.user_dna_signals s
    on s.signal_type = 'genre'
   and lower(trim(s.signal_value)) = any(t.signal_values)
  where s.user_id = target_user_id
    and s.strength >= 0.03
    and t.is_active = true
  group by t.id, s.user_id
  on conflict (tribe_id, user_id) do update set
    affinity_score = excluded.affinity_score,
    membership_source = excluded.membership_source
  where public.people_tribe_members.membership_source = 'dna_signal';
end;
$$;

revoke all on function public.refresh_people_tribe_memberships(uuid) from public;
grant execute on function public.refresh_people_tribe_memberships(uuid) to service_role;

create or replace function public.get_people_tribes_summary(member_limit integer default 4)
returns table (
  id uuid,
  slug text,
  name text,
  description text,
  cover_image_url text,
  accent_color text,
  sort_order integer,
  member_count bigint,
  is_member boolean,
  interests jsonb,
  members jsonb
)
language sql
stable
security definer
set search_path = public
as $$
  select
    t.id,
    t.slug,
    t.name,
    t.description,
    t.cover_image_url,
    t.accent_color,
    t.sort_order,
    (select count(*) from public.people_tribe_members count_members where count_members.tribe_id = t.id) as member_count,
    exists (
      select 1 from public.people_tribe_members own_membership
      where own_membership.tribe_id = t.id
        and own_membership.user_id = auth.uid()
    ) as is_member,
    coalesce((
      select jsonb_agg(to_jsonb(interest_row) order by interest_row.rank)
      from (
        select i.title, i.media_type, i.rank
        from public.people_tribe_interests i
        where i.tribe_id = t.id
        order by i.rank
        limit 4
      ) interest_row
    ), '[]'::jsonb) as interests,
    coalesce((
      select jsonb_agg(to_jsonb(member_row) order by member_row.match_score desc nulls last, member_row.affinity_score desc)
      from (
        select
          u.id,
          u.user_name,
          u.display_name,
          u.first_name,
          u.last_name,
          u.avatar as avatar_url,
          match_data.match_score,
          membership.affinity_score
        from public.people_tribe_members membership
        join public.users u on u.id = membership.user_id
        left join lateral (
          select max(comparison.match_score) as match_score
          from public.dna_comparisons comparison
          where (comparison.user_id_1 = auth.uid() and comparison.user_id_2 = membership.user_id)
             or (comparison.user_id_2 = auth.uid() and comparison.user_id_1 = membership.user_id)
        ) match_data on true
        where membership.tribe_id = t.id
          and membership.user_id is distinct from auth.uid()
        order by match_data.match_score desc nulls last, membership.affinity_score desc
        limit greatest(1, least(coalesce(member_limit, 4), 8))
      ) member_row
    ), '[]'::jsonb) as members
  from public.people_tribes t
  where t.is_active = true
  order by t.sort_order;
$$;

revoke all on function public.get_people_tribes_summary(integer) from public;
grant execute on function public.get_people_tribes_summary(integer) to authenticated;
grant execute on function public.get_people_tribes_summary(integer) to service_role;

alter table public.people_tribes enable row level security;
alter table public.people_tribe_members enable row level security;
alter table public.people_tribe_interests enable row level security;

drop policy if exists "Authenticated users can view active tribes" on public.people_tribes;
create policy "Authenticated users can view active tribes"
  on public.people_tribes for select to authenticated
  using (is_active = true);

drop policy if exists "Authenticated users can view tribe members" on public.people_tribe_members;

drop policy if exists "Authenticated users can view tribe interests" on public.people_tribe_interests;
create policy "Authenticated users can view tribe interests"
  on public.people_tribe_interests for select to authenticated
  using (exists (
    select 1 from public.people_tribes t
    where t.id = tribe_id and t.is_active = true
  ));

insert into public.people_tribes (slug, name, description, accent_color, signal_values, sort_order)
values
  ('true-crime-people', 'True Crime People', 'For people drawn to investigations, courtroom stories, mysteries, and the conversations behind them.', '#6f3142', array['true crime', 'crime'], 10),
  ('reality-tv-obsessed', 'Reality TV Obsessed', 'Big personalities, social experiments, competition shows, and the moments everyone talks about.', '#d85b8c', array['reality', 'reality tv'], 20),
  ('sci-fi-fantasy-fans', 'Sci-Fi & Fantasy Fans', 'Speculative worlds, impossible futures, epic quests, and stories that stretch reality.', '#4e63c8', array['science fiction', 'sci-fi & fantasy', 'fantasy'], 30),
  ('mystery-thriller-people', 'Mystery & Thriller People', 'Twists, secrets, suspense, and stories that make it impossible to stop at one more chapter or episode.', '#315c72', array['mystery', 'thriller', 'thrillers', 'suspense'], 40),
  ('romance-people', 'Romance People', 'Love stories in every form, from sweeping period pieces to sharp modern rom-coms.', '#c45c69', array['romance', 'romantic comedy'], 50),
  ('comedy-people', 'Comedy People', 'Comfort rewatches, sharp stand-up, chaotic ensembles, and anything that reliably makes people laugh.', '#d68a32', array['comedy', 'humor', 'humorous', 'dark humor'], 60),
  ('horror-people', 'Horror People', 'Supernatural dread, slashers, psychological scares, and the stories best experienced with the lights on.', '#4d3b55', array['horror', 'paranormal'], 70),
  ('documentary-people', 'Documentary People', 'Real people, defining moments, hidden systems, and stories that change how the world looks.', '#3b765f', array['documentary', 'history', 'biography', 'society & culture'], 80)
on conflict (slug) do update set
  name = excluded.name,
  description = excluded.description,
  accent_color = excluded.accent_color,
  signal_values = excluded.signal_values,
  sort_order = excluded.sort_order,
  is_active = true,
  updated_at = now();

insert into public.people_tribe_interests (tribe_id, title, media_type, rank)
select t.id, seed.title, seed.media_type, seed.rank
from (
  values
    ('true-crime-people', 'Crime Junkie', 'podcast', 10),
    ('true-crime-people', 'Mindhunter', 'tv', 20),
    ('true-crime-people', 'Gone Girl', 'book', 30),
    ('true-crime-people', 'The Jinx', 'tv', 40),
    ('reality-tv-obsessed', 'Love Is Blind', 'tv', 10),
    ('reality-tv-obsessed', 'Survivor', 'tv', 20),
    ('reality-tv-obsessed', 'The Real Housewives', 'tv', 30),
    ('sci-fi-fantasy-fans', 'Dune', 'book', 10),
    ('sci-fi-fantasy-fans', 'Severance', 'tv', 20),
    ('sci-fi-fantasy-fans', 'The Expanse', 'tv', 30),
    ('mystery-thriller-people', 'Knives Out', 'movie', 10),
    ('mystery-thriller-people', 'Only Murders in the Building', 'tv', 20),
    ('romance-people', 'Bridgerton', 'tv', 10),
    ('romance-people', 'Pride and Prejudice', 'book', 20),
    ('comedy-people', 'Schitt''s Creek', 'tv', 10),
    ('comedy-people', 'The Office', 'tv', 20),
    ('horror-people', 'The Haunting of Hill House', 'tv', 10),
    ('horror-people', 'Scream', 'movie', 20),
    ('documentary-people', 'Free Solo', 'movie', 10),
    ('documentary-people', 'The Last Dance', 'tv', 20)
) as seed(slug, title, media_type, rank)
join public.people_tribes t on t.slug = seed.slug
on conflict (tribe_id, title) do update set
  media_type = excluded.media_type,
  rank = excluded.rank;

insert into public.people_tribe_members (tribe_id, user_id, affinity_score, membership_source)
select
  t.id,
  s.user_id,
  greatest(0, least(1, max(s.strength))) as affinity_score,
  'dna_signal'
from public.people_tribes t
join public.user_dna_signals s
  on s.signal_type = 'genre'
 and lower(trim(s.signal_value)) = any(t.signal_values)
where s.strength >= 0.03
group by t.id, s.user_id
on conflict (tribe_id, user_id) do update set
  affinity_score = excluded.affinity_score,
  membership_source = excluded.membership_source
where public.people_tribe_members.membership_source = 'dna_signal';