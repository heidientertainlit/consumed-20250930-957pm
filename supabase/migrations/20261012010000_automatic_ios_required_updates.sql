-- One-time installation, authorized independently of native releases.
-- Uses the existing pg_cron/pg_net installation; no API keys or Edge Function.
begin;

do $$
begin
  if to_regclass('public.app_version_config') is null
    or to_regclass('cron.job') is null
    or to_regclass('net._http_response') is null
    or to_regprocedure('net.http_get(text,jsonb,jsonb,integer)') is null then
    raise exception 'App version configuration, pg_cron and pg_net must already exist';
  end if;
  if exists(select 1 from cron.job where jobname='consumed-ios-app-store-sync') then
    raise exception 'App Store sync already exists; inspect rather than replace it';
  end if;
  if not exists(select 1 from public.app_version_config where platform='ios'
    and app_store_url='https://apps.apple.com/us/app/consumed-track-play/id6759014223') then
    raise exception 'Expected Consumed iOS configuration is missing';
  end if;
end $$;

create table public.ios_app_store_sync_state (
  platform text primary key check (platform='ios'),
  request_id bigint,
  requested_at timestamptz,
  checked_at timestamptz,
  last_success_at timestamptz,
  last_result text
);
alter table public.ios_app_store_sync_state enable row level security;
revoke all on public.ios_app_store_sync_state from public,anon,authenticated,service_role;
insert into public.ios_app_store_sync_state(platform) values ('ios');

-- Only the privileged scheduler can apply Apple's response. Never accept a
-- version from a browser, an arbitrary URL, TestFlight, or a build number.
create function public.apply_ios_app_store_release(payload jsonb)
returns text language plpgsql set search_path=pg_catalog as $$
declare
  app jsonb;
  store_version text;
  store_parts integer[];
  os_parts integer[];
  latest_parts integer[];
  minimum_parts integer[];
  config public.app_version_config%rowtype;
  release_at timestamptz;
begin
  if payload->>'resultCount' is distinct from '1'
    or jsonb_typeof(payload->'results') is distinct from 'array' then
    return 'invalid_lookup';
  end if;
  if jsonb_array_length(payload->'results')<>1 then
    return 'invalid_lookup';
  end if;
  app=payload->'results'->0;
  if app->>'trackId' is distinct from '6759014223'
    or app->>'bundleId' is distinct from 'com.entertainlit.consumed'
    or app->>'kind' is distinct from 'software' then
    return 'wrong_app';
  end if;
  store_version=app->>'version';
  if store_version is null or store_version !~ '^[0-9]{1,6}\.[0-9]{1,6}\.[0-9]{1,6}$' then
    return 'invalid_version';
  end if;
  store_parts=string_to_array(store_version,'.')::integer[];
  if app->>'minimumOsVersion' is null
    or app->>'minimumOsVersion' !~ '^[0-9]{1,3}(\.[0-9]{1,3}){0,2}$' then
    return 'invalid_ios_requirement';
  end if;
  os_parts=string_to_array(app->>'minimumOsVersion','.')::integer[];
  os_parts=array[os_parts[1],coalesce(os_parts[2],0),coalesce(os_parts[3],0)];
  -- Existing clients share one global minimum. Do not strand iOS 15 devices
  -- by requiring a future release that needs an unsupported OS.
  if os_parts>array[15,0,0] then return 'incompatible_ios_requirement'; end if;
  begin
    release_at=(app->>'currentVersionReleaseDate')::timestamptz;
  exception when others then
    return 'invalid_release_date';
  end;
  if release_at is null or not isfinite(release_at) then return 'invalid_release_date'; end if;
  -- Give the public listing one hour to propagate before making it mandatory.
  if release_at>clock_timestamp()-interval '1 hour' then return 'release_propagating'; end if;

  select * into config from public.app_version_config where platform='ios' for update;
  if not found then return 'missing_config'; end if;
  if config.latest_version !~ '^v?[0-9]{1,6}\.[0-9]{1,6}\.[0-9]{1,6}$'
    or config.minimum_supported_version !~ '^v?[0-9]{1,6}\.[0-9]{1,6}\.[0-9]{1,6}$' then
    return 'invalid_existing_config';
  end if;
  latest_parts=string_to_array(regexp_replace(config.latest_version,'^v',''),'.')::integer[];
  minimum_parts=string_to_array(regexp_replace(config.minimum_supported_version,'^v',''),'.')::integer[];
  -- Apple caches or regional rollbacks must never lower either threshold.
  if store_parts<latest_parts or store_parts<minimum_parts then return 'older_store_version'; end if;
  if store_parts=latest_parts and store_parts=minimum_parts then return 'already_current'; end if;
  update public.app_version_config
    set latest_version=store_version,minimum_supported_version=store_version,updated_at=clock_timestamp()
    where platform='ios';
  return 'updated';
end $$;
revoke all on function public.apply_ios_app_store_release(jsonb)
  from public,anon,authenticated,service_role;
grant execute on function public.apply_ios_app_store_release(jsonb) to postgres;

create function public.sync_ios_app_store_release()
returns text language plpgsql security definer set search_path=pg_catalog as $$
declare
  state public.ios_app_store_sync_state%rowtype;
  response net._http_response%rowtype;
  result text;
  next_request bigint;
begin
  select * into state from public.ios_app_store_sync_state where platform='ios' for update;
  if not found then raise exception 'App Store sync state missing'; end if;
  if state.request_id is not null then
    select * into response from net._http_response where id=state.request_id;
    if not found and state.requested_at>clock_timestamp()-interval '2 minutes' then
      return 'pending';
    end if;
    if response.id is null then
      result='lookup_response_missing';
    elsif response.status_code is distinct from 200
      or response.timed_out is true or response.error_msg is not null then
      result='lookup_failed';
    else
      begin
        result=public.apply_ios_app_store_release(response.content::jsonb);
      exception when others then
        -- Preserve the previous config on malformed responses or query errors.
        result='lookup_processing_failed';
      end;
    end if;
    update public.ios_app_store_sync_state set
      checked_at=clock_timestamp(),last_result=result,
      last_success_at=case when result in ('updated','already_current')
        then clock_timestamp() else last_success_at end
      where platform='ios';
  end if;
  begin
    next_request=net.http_get(
      url:='https://itunes.apple.com/lookup',
      params:=jsonb_build_object('id','6759014223','country','us'),
      headers:=jsonb_build_object('Accept','application/json'),
      timeout_milliseconds:=10000
    );
    update public.ios_app_store_sync_state set
      request_id=next_request,requested_at=clock_timestamp() where platform='ios';
  exception when others then
    update public.ios_app_store_sync_state set
      request_id=null,requested_at=null,last_result='lookup_dispatch_failed' where platform='ios';
    return 'lookup_dispatch_failed';
  end;
  return coalesce(result,'lookup_enqueued');
end $$;
revoke all on function public.sync_ios_app_store_release()
  from public,anon,authenticated,service_role;
grant execute on function public.sync_ios_app_store_release() to postgres;

select cron.schedule('consumed-ios-app-store-sync','*/5 * * * *',
  'select public.sync_ios_app_store_release();');
-- First request is dispatched after this transaction commits.
select public.sync_ios_app_store_release();
commit;
