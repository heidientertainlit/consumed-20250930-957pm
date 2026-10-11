-- MANUAL RELEASE OPERATION ONLY. Never run from startup/build/deploy hooks.
-- Requires separate production approval. Creates a dedicated INACTIVE timer.
-- Does not install extensions, create Vault secrets, generate content, or
-- modify any existing generator/scheduler. Activate only after worker release.
begin;

do $$
begin
  if to_regclass('public.persona_conversation_runs') is null
    or to_regclass('cron.job') is null
    or to_regclass('vault.decrypted_secrets') is null
    or to_regprocedure('cron.schedule(text,text,text)') is null
    or to_regprocedure('cron.alter_job(bigint,text,text,text,text,boolean)') is null
    or to_regprocedure('net.http_post(text,jsonb,jsonb,jsonb,integer)') is null then
    raise exception 'Conversation schema, Cron, pg_net and Vault must already be configured';
  end if;
  if exists(select 1 from cron.job where jobname='persona-social-conversations') then
    raise exception 'Conversation timer already exists; inspect it instead of replacing it';
  end if;
end $$;

create function public.dispatch_due_persona_conversations()
returns jsonb language plpgsql security definer set search_path=pg_catalog as $$
declare app_url text; worker_credential text; request_id bigint;
begin
  -- This timer only dispatches existing, explicitly approved schedules.
  -- The transactional delivery RPC rechecks approval/state under a row lock.
  if not exists(
    select 1 from public.persona_conversation_runs
    where status='scheduled' and approved_revision=revision
      and start_at<=clock_timestamp()
      and (next_attempt_at is null or next_attempt_at<=clock_timestamp())
  ) then
    return '{"status":"idle"}'::jsonb;
  end if;

  select decrypted_secret into app_url from vault.decrypted_secrets
    where name='consumed_supabase_url';
  select decrypted_secret into worker_credential from vault.decrypted_secrets
    where name='consumed_service_role';
  if app_url is null or worker_credential is null or length(btrim(worker_credential))=0 then
    raise exception 'Scheduled conversation delivery credentials are not configured';
  end if;
  -- Never send the credential to a workspace URL, another project, or an
  -- arbitrary host. Vault must hold this app project's service-role credential.
  app_url=rtrim(btrim(app_url),'/');
  if app_url<>'https://mahpgcogwpawvviapqza.supabase.co' then
    raise exception 'Scheduled conversation delivery target is not the approved app project';
  end if;

  request_id=net.http_post(
    url:=app_url||'/functions/v1/deliver-persona-conversations',
    body:='{}'::jsonb,
    headers:=jsonb_build_object('Content-Type','application/json',
      'Authorization','Bearer '||worker_credential),
    timeout_milliseconds:=10000
  );
  -- A queued request is NOT proof of delivery; run state/history is authoritative.
  return jsonb_build_object('status','enqueued','request_id',request_id);
end $$;
revoke all on function public.dispatch_due_persona_conversations()
  from public,anon,authenticated,service_role;
grant execute on function public.dispatch_due_persona_conversations() to postgres;

do $$
declare timer_id bigint;
begin
  timer_id=cron.schedule('persona-social-conversations','* * * * *',
    'select public.dispatch_due_persona_conversations();');
  -- Both statements commit together. Other sessions never see an active job.
  perform cron.alter_job(timer_id,active:=false);
end $$;
commit;
