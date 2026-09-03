-- Delete all account-owned database data and the Supabase Auth user in one
-- transaction. Storage objects are removed by the delete-account Edge Function
-- before this RPC is called because Storage object deletion is not transactional
-- with PostgreSQL.
create or replace function public.delete_account_transaction(p_user_id uuid)
returns void
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  deleted_auth_users integer;
begin
  if p_user_id is null then
    raise exception 'A user ID is required';
  end if;

  -- Remove rows whose user references are not protected by foreign keys.
  -- Delete comment reactions before deleting comments they reference.
  delete from public.prediction_comment_likes
  where user_id::text = p_user_id::text
     or comment_id in (
       select id
       from public.prediction_comments
       where user_id::text = p_user_id::text
     );

  delete from public.prediction_comment_votes
  where user_id::text = p_user_id::text
     or comment_id in (
       select id
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

  -- Preserve shared content copied from this user, but remove attribution.
  update public.canonical_media_backfill_plans
  set user_id = null
  where user_id = p_user_id;

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

  -- Production has verified CASCADE/SET NULL foreign keys from auth.users for
  -- all remaining constrained user data, including public.users and profiles.
  delete from auth.users
  where id = p_user_id;

  get diagnostics deleted_auth_users = row_count;
  if deleted_auth_users <> 1 then
    raise exception 'Account was not found';
  end if;
end;
$$;

revoke all on function public.delete_account_transaction(uuid)
from public, anon, authenticated;

grant execute on function public.delete_account_transaction(uuid)
to service_role;