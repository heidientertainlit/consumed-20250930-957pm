-- PRIVATE admin drafts; no jobs or cron are activated by this migration.
begin;
create table public.persona_conversation_gender (
  persona_id uuid primary key references public.users(id) on delete cascade,
  gender text not null check (gender in ('unset','woman','man','nonbinary','other'))
);
create table public.persona_conversation_subjects (
  id uuid primary key default gen_random_uuid(),
  subject jsonb not null,
  topic text,
  provenance jsonb not null default '[]',
  expires_at timestamptz not null default (now() + interval '1 hour')
);
create table public.persona_conversation_runs (
  id uuid primary key default gen_random_uuid(),
  created_by uuid references public.users(id) on delete set null,
  created_at timestamptz not null default now(),
  topic text not null,
  angle text not null default '',
  context text not null default '',
  subject jsonb,
  provenance jsonb not null default '[]',
  participant_ids uuid[] not null,
  opening_author_id uuid not null,
  max_words integer not null default 60 check (max_words between 10 and 120),
  messages jsonb not null,
  revision integer not null default 1,
  approved_revision integer,
  approved_by uuid references public.users(id) on delete set null,
  approved_at timestamptz,
  status text not null default 'draft' check (status in ('draft','approved','scheduled','paused','cancelled','rejected','completed')),
  start_at timestamptz,
  root_post_id uuid references public.social_posts(id) on delete set null,
  last_delivered_at timestamptz,
  next_attempt_at timestamptz,
  attempts integer not null default 0,
  last_error text,
  history jsonb not null default '[]'
);
create index persona_conversation_due on public.persona_conversation_runs(start_at,next_attempt_at) where status='scheduled';
alter table public.social_posts add column persona_conversation_id uuid references public.persona_conversation_runs(id) on delete set null;
-- Scope count maintenance to this NEW workflow; preserve standalone semantics.
-- Recount rather than increment so existing installations' count triggers cannot
-- double-count either automated or human replies.
create function public.sync_persona_conversation_comment_count()
returns trigger language plpgsql security definer set search_path=public as $$
declare p_id uuid;
begin
  p_id=case when tg_op='DELETE' then old.social_post_id else new.social_post_id end;
  perform 1 from social_posts where id=p_id and persona_conversation_id is not null for no key update;
  if found then
    update social_posts set comments_count=(select count(*) from social_post_comments where social_post_id=p_id) where id=p_id;
  end if;
  return null;
end $$;
create constraint trigger zz_persona_conversation_comment_count
after insert or delete on public.social_post_comments deferrable initially deferred
for each row execute function public.sync_persona_conversation_comment_count();
alter table public.persona_conversation_gender enable row level security;
alter table public.persona_conversation_subjects enable row level security;
alter table public.persona_conversation_runs enable row level security;
revoke all on public.persona_conversation_gender,public.persona_conversation_subjects,public.persona_conversation_runs from anon,authenticated;
grant all on public.persona_conversation_gender,public.persona_conversation_subjects,public.persona_conversation_runs to service_role;

create function public.validate_persona_conversation(p_ids uuid[],p_opening uuid,p_messages jsonb)
returns void language plpgsql set search_path=public as $$
declare m jsonb; idx integer=0; prior integer=-1; seen text[]='{}';
begin
  if p_ids is null or p_opening is null or p_messages is null or jsonb_typeof(p_messages)<>'array'
    or cardinality(p_ids) not between 2 and 12 or cardinality(p_ids)<>(select count(distinct id) from unnest(p_ids) id)
    or not p_opening=any(p_ids) or (select count(*) from users where id=any(p_ids) and is_persona)<>cardinality(p_ids)
    then raise exception 'Existing distinct persona roster required'; end if;
  if jsonb_typeof(p_messages)<>'array' or jsonb_array_length(p_messages) not between 3 and 20 then raise exception 'Invalid message count'; end if;
  for m in select value from jsonb_array_elements(p_messages) loop
    if not (m->>'participant_id')::uuid=any(p_ids) or (m->>'client_id') !~ '^[a-z0-9_-]{1,64}$'
      or m->>'client_id'=any(seen) or length(btrim(m->>'body')) not between 1 and 1200
      or (m->>'offset_seconds')::integer not between 0 and 604800
      or m ? 'public_id' or m ? 'delivered_at' then raise exception 'Invalid message'; end if;
    if idx=0 then
      if m->>'parent_client_id' is not null or (m->>'participant_id')::uuid<>p_opening or (m->>'offset_seconds')::integer<>0
        then raise exception 'Invalid opening'; end if;
    elsif not coalesce(m->>'parent_client_id'=any(seen),false) or (m->>'offset_seconds')::integer<prior+60 then
      raise exception 'Invalid parent or chronology';
    end if;
    if m->>'client_id' is null or m->>'body' is null or m->>'participant_id' is null or m->>'offset_seconds' is null then raise exception 'Missing message field'; end if;
    seen=array_append(seen,m->>'client_id'); prior=(m->>'offset_seconds')::integer; idx=idx+1;
  end loop;
end $$;

create function public.guard_persona_conversation_insert()
returns trigger language plpgsql set search_path=public as $$
begin
  perform validate_persona_conversation(new.participant_ids,new.opening_author_id,new.messages);
  if new.subject is not null and not exists (
    select 1 from media_provider_aliases where external_source=new.subject->>'externalSource'
      and external_id=new.subject->>'externalId' and canonical_media_id=(new.subject->>'canonicalId')::uuid
  ) then raise exception 'Verified canonical/provider subject required'; end if;
  return new;
end $$;
create trigger guard_persona_conversation_insert before insert on public.persona_conversation_runs
for each row execute function public.guard_persona_conversation_insert();

-- One lock governs editing, approval, schedule changes, and release. CAS revision
-- binds moderation/review to the exact content inspected by the Edge Function.
create function public.manage_persona_conversation(p_admin uuid,p_action text,p_run uuid,p_revision integer,p_payload jsonb default '{}')
returns jsonb language plpgsql security definer set search_path=public as $$
declare r persona_conversation_runs; msgs jsonb; start_time timestamptz;
begin
  if not exists(select 1 from users where id=p_admin and is_admin) then raise exception 'Admin required'; end if;
  select * into r from persona_conversation_runs where id=p_run for update;
  if not found or p_revision is null or r.revision<>p_revision then raise exception 'Draft changed; refresh'; end if;
  if p_action in ('edit','regenerate') then
    if r.status not in ('draft','approved','paused') or r.last_delivered_at is not null then raise exception 'Cannot replace an active or delivered thread'; end if;
    msgs=p_payload->'messages';
    perform validate_persona_conversation(r.participant_ids,r.opening_author_id,msgs);
    update persona_conversation_runs set messages=msgs, revision=revision+1,status='draft',
      approved_revision=null,approved_at=null,approved_by=null,start_at=null,last_error=null,attempts=0,next_attempt_at=null where id=p_run;
  elsif p_action='approve' then
    if r.status<>'draft' then raise exception 'Draft required'; end if;
    perform validate_persona_conversation(r.participant_ids,r.opening_author_id,r.messages);
    update persona_conversation_runs set status='approved',approved_revision=revision,approved_at=clock_timestamp(),approved_by=p_admin where id=p_run;
  elsif p_action='schedule' then
    start_time=(p_payload->>'startAt')::timestamptz;
    if r.status not in ('approved','paused') or r.approved_revision is distinct from r.revision or start_time is null or start_time<=clock_timestamp() then raise exception 'Reviewed content and future start required'; end if;
    update persona_conversation_runs set status='scheduled',start_at=start_time,next_attempt_at=null,last_error=null,attempts=0 where id=p_run;
  elsif p_action='pause' then
    if r.status<>'scheduled' then raise exception 'Scheduled thread required'; end if;
    update persona_conversation_runs set status='paused' where id=p_run;
  elsif p_action in ('cancel','reject') then
    if r.status in ('completed','cancelled','rejected') then raise exception 'Thread already closed'; end if;
    update persona_conversation_runs set status=case when p_action='cancel' then 'cancelled' else 'rejected' end where id=p_run;
  else raise exception 'Unknown action'; end if;
  update persona_conversation_runs set revision=revision+case when p_action in ('edit','regenerate') then 0 else 1 end,
    approved_revision=case when p_action in ('approve','schedule','pause') then revision+1 else approved_revision end,
    history=history||jsonb_build_array(jsonb_build_object('action',p_action,'at',clock_timestamp(),'admin',p_admin))
    where id=p_run;
  return (select to_jsonb(t) from persona_conversation_runs t where id=p_run);
end $$;

create function public.deliver_persona_conversation(p_run uuid)
returns jsonb language plpgsql security definer set search_path=public as $$
declare r persona_conversation_runs; m jsonb; parent jsonb; idx integer; now_at timestamptz=clock_timestamp();
  post_id uuid; comment_id bigint; parent_id bigint; previous_offset integer=0; gap integer;
begin
  select * into r from persona_conversation_runs where id=p_run for update skip locked;
  if not found then return '{"status":"locked"}'; end if;
  if r.status<>'scheduled' or r.approved_revision is distinct from r.revision or r.start_at>now_at
    or r.next_attempt_at>now_at then return '{"status":"not_due"}'; end if;
  select value,ordinality::integer-1 into m,idx from jsonb_array_elements(r.messages) with ordinality
    where value->>'delivered_at' is null order by ordinality limit 1;
  if m is null then return '{"status":"empty"}'; end if;
  if r.start_at+make_interval(secs=>(m->>'offset_seconds')::integer)>now_at then return '{"status":"not_due"}'; end if;
  if idx>0 then
    previous_offset=(r.messages->(idx-1)->>'offset_seconds')::integer;
    gap=greatest(60,(m->>'offset_seconds')::integer-previous_offset);
    if r.last_delivered_at is null or r.last_delivered_at+make_interval(secs=>gap)>now_at then return '{"status":"paced"}'; end if;
  end if;
  begin
    if not exists(select 1 from users where id=(m->>'participant_id')::uuid and is_persona) then raise exception 'Author is no longer a verified persona'; end if;
    if idx=0 then
      if r.subject is not null and (nullif(r.subject->>'externalId','') is null or nullif(r.subject->>'externalSource','') is null) then raise exception 'Verified subject identity required'; end if;
      if r.subject is not null and not exists (
        select 1 from media_provider_aliases where external_source=r.subject->>'externalSource'
          and external_id=r.subject->>'externalId' and canonical_media_id=(r.subject->>'canonicalId')::uuid
      ) then raise exception 'Selected canonical/provider identity changed; release stopped'; end if;
      insert into social_posts(user_id,post_type,content,rating,media_title,media_type,media_creator,
        media_external_id,media_external_source,canonical_media_id,visibility,likes_count,comments_count,created_at,persona_conversation_id)
      values((m->>'participant_id')::uuid,'review',m->>'body',null,r.subject->>'title',r.subject->>'type',r.subject->>'creator',
        r.subject->>'externalId',r.subject->>'externalSource',(r.subject->>'canonicalId')::uuid,'public',0,0,now_at,r.id)
      returning id into post_id;
      m=m||jsonb_build_object('public_id',post_id::text,'delivered_at',now_at);
      update persona_conversation_runs set root_post_id=post_id where id=p_run;
    else
      select value into parent from jsonb_array_elements(r.messages) where value->>'client_id'=m->>'parent_client_id';
      if parent->>'delivered_at' is null or r.root_post_id is null then raise exception 'Parent is not delivered'; end if;
      -- Root FK is checked before comments; deleted roots never resurrect.
      perform 1 from social_posts where id=r.root_post_id for no key update;
      if not found then raise exception 'Public root deleted'; end if;
      parent_id=case when parent->>'client_id'=r.messages->0->>'client_id' then null else (parent->>'public_id')::bigint end;
      if parent_id is not null and not exists(select 1 from social_post_comments where id=parent_id and social_post_id=r.root_post_id) then raise exception 'Public parent deleted'; end if;
      now_at=clock_timestamp();
      insert into social_post_comments(social_post_id,user_id,content,parent_comment_id,created_at)
        values(r.root_post_id,(m->>'participant_id')::uuid,m->>'body',parent_id,now_at) returning id into comment_id;
      m=m||jsonb_build_object('public_id',comment_id::text,'delivered_at',now_at);
      -- Recount under the root lock, compatible with existing count triggers.
      update social_posts set comments_count=(select count(*) from social_post_comments where social_post_id=r.root_post_id) where id=r.root_post_id;
    end if;
    update persona_conversation_runs set messages=jsonb_set(messages,array[idx::text],m-'error'),
      last_delivered_at=now_at,last_error=null,attempts=0,
      next_attempt_at=case when idx=jsonb_array_length(messages)-1 then null else greatest(
        r.start_at+make_interval(secs=>(messages->(idx+1)->>'offset_seconds')::integer),
        now_at+make_interval(secs=>greatest(60,(messages->(idx+1)->>'offset_seconds')::integer-(m->>'offset_seconds')::integer))
      ) end,
      status=case when idx=jsonb_array_length(messages)-1 then 'completed' else status end,
      history=history||jsonb_build_array(jsonb_build_object('action','delivered','message',m->>'client_id','at',now_at))
      where id=p_run;
    return jsonb_build_object('status','delivered','message',m->>'client_id');
  exception when others then
    -- Subtransaction rolls back ALL public writes before persisting the failure.
    update persona_conversation_runs set attempts=attempts+1,last_error=left(SQLERRM,500),
      messages=jsonb_set(messages,array[idx::text],m||jsonb_build_object('error',left(SQLERRM,500))),
      next_attempt_at=now_at+interval '5 minutes',status=case when attempts>=4 then 'paused' else status end,
      history=history||jsonb_build_array(jsonb_build_object('action','failed','message',m->>'client_id','at',now_at,'error',left(SQLERRM,500)))
      where id=p_run;
    return '{"status":"failed"}';
  end;
end $$;
revoke all on function public.validate_persona_conversation(uuid[],uuid,jsonb) from public,anon,authenticated;
revoke all on function public.manage_persona_conversation(uuid,text,uuid,integer,jsonb) from public,anon,authenticated;
revoke all on function public.deliver_persona_conversation(uuid) from public,anon,authenticated;
grant execute on function public.validate_persona_conversation(uuid[],uuid,jsonb) to service_role;
grant execute on function public.manage_persona_conversation(uuid,text,uuid,integer,jsonb) to service_role;
grant execute on function public.deliver_persona_conversation(uuid) to service_role;
commit;
