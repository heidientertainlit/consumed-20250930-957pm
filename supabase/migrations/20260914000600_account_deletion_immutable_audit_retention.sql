-- Account deletion must not mutate canonical-media backfill plans or audit
-- records.  Those tables are service-role-only, immutable operational history:
-- plans/audit retain RESTRICT references to their run, plan, and canonical
-- media, while a run's requested_by Auth reference is already ON DELETE SET
-- NULL.  A deleted account's UUID may therefore remain in the immutable
-- provenance snapshot as a documented security/audit-retention exception.
--
-- This replaces the impossible attribution UPDATE from the earlier deletion
-- function.  It does not disable or weaken the immutable triggers, and it
-- keeps all other account-targeted cleanup unchanged.
create or replace function public.delete_account_transaction(p_user_id uuid)
returns void
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  target_auth_user uuid;
  deleted_auth_users integer;
begin
  if p_user_id is null then
    raise exception 'A user ID is required';
  end if;

  select id
  into target_auth_user
  from auth.users
  where id = p_user_id
  for update;

  if not found then
    raise exception 'Account was not found';
  end if;

  delete from public.prediction_comment_likes
  where user_id::text = p_user_id::text
     or comment_id in (
       select id
       from public.prediction_comments
       where user_id::text = p_user_id::text
     );

  delete from public.prediction_comment_votes
  where user_id::text = p_user_id::text
     or comment_id::text in (
       select id::text
       from public.prediction_comments
       where user_id::text = p_user_id::text
     );

  delete from public.prediction_comments
  where user_id::text = p_user_id::text;

  delete from public.prediction_likes
  where user_id::text = p_user_id::text;

  delete from public.social_comment_votes
  where user_id::text = p_user_id::text;

  delete from public.post_reactions
  where user_id = p_user_id;

  delete from public.room_follows
  where user_id::text = p_user_id::text;

  delete from public.room_take_votes
  where user_id = p_user_id;

  delete from public.media_engagements
  where user_id = p_user_id;

  delete from public.media_match_scores
  where user_id = p_user_id;

  delete from public.daily_challenge_responses
  where user_id = p_user_id;

  delete from public.challenge_scores
  where user_id::text = p_user_id::text;

  delete from public.trivia_sessions
  where user_id = p_user_id;

  delete from public.user_predictions
  where user_id = p_user_id;

  delete from public.user_prediction_stats
  where user_id = p_user_id;

  delete from public.persona_post_drafts
  where persona_user_id = p_user_id;

  delete from public.scheduled_persona_posts
  where persona_user_id = p_user_id;

  delete from public.awards_ballot_completions
  where user_id::text = p_user_id::text;

  delete from public.beta_feedback
  where user_id = p_user_id;

  delete from public.content_reports
  where reporter_id = p_user_id
     or reported_user_id = p_user_id;

  delete from public.user_blocks
  where blocker_id = p_user_id
     or blocked_id = p_user_id;

  -- user_last_activity is a GROUP BY view, not a writable table. Remove its
  -- session source rows; list_items and social_posts disappear through their
  -- Auth cascades below.
  delete from public.user_sessions
  where user_id = p_user_id;

  update public.admin_room_conversation_runs
  set approved_by = null,
      approved_at = null
  where created_by = p_user_id
     or approved_by = p_user_id
     or published_take_id in (
       select id
       from public.room_takes
       where user_id = p_user_id
     )
     or exists (
       select 1
       from public.admin_room_conversation_drafts
       where run_id = admin_room_conversation_runs.id
         and participant_id = p_user_id
     );

  delete from public.admin_room_conversation_drafts
  where participant_id = p_user_id;

  delete from public.admin_room_conversation_runs
  where created_by = p_user_id
     or published_take_id in (
       select id
       from public.room_takes
       where user_id = p_user_id
     );

  delete from public.admin_room_persona_provision_locks
  where created_by = p_user_id;

  -- canonical_media_backfill_plans and canonical_media_backfill_audit are
  -- immutable, service-role-only provenance records. They intentionally retain
  -- this historical user_id snapshot; do not issue an UPDATE here. The
  -- canonical_media_backfill_runs.requested_by FK sets that reference to NULL
  -- when Auth deletes the account.

  update public.lists
  set origin_user_id = null
  where origin_user_id = p_user_id::text;

  update public.prediction_pools
  set origin_user_id = case
        when origin_user_id = p_user_id::text then null
        else origin_user_id
      end,
      invited_user_id = case
        when invited_user_id = p_user_id::text then null
        else invited_user_id
      end
  where origin_user_id = p_user_id::text
     or invited_user_id = p_user_id::text;

  update public.rank_items
  set custom_add_user_id = null
  where custom_add_user_id = p_user_id::text;

  update public.ranks
  set origin_user_id = null
  where origin_user_id = p_user_id::text;

  update public.social_posts
  set origin_user_id = null
  where origin_user_id = p_user_id::text;

  delete from auth.users
  where id = p_user_id;

  get diagnostics deleted_auth_users = row_count;
  if deleted_auth_users <> 1 then
    raise exception 'Account deletion affected % Auth users', deleted_auth_users;
  end if;
end;
$$;

revoke all on function public.delete_account_transaction(uuid)
from public, anon, authenticated;

grant execute on function public.delete_account_transaction(uuid)
to service_role;