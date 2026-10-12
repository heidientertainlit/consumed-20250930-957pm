-- Run inside the same transaction as the migration, BEFORE its commit.
-- All fixtures, threshold changes, queued HTTP requests and Cron installation
-- MUST be rolled back. Never run this file alone against an installed system.

create function pg_temp.release_fixture(patch jsonb default '{}'::jsonb)
returns jsonb language sql as $$
  select jsonb_build_object('resultCount',1,'results',jsonb_build_array(
    jsonb_build_object('trackId',6759014223,'bundleId','com.entertainlit.consumed',
      'kind','software','version','1.0.9','minimumOsVersion','15.0',
      'currentVersionReleaseDate',clock_timestamp()-interval '2 hours') || patch));
$$;

create function pg_temp.expect_release(payload jsonb,expected_result text,
  expected_version text default '1.0.7')
returns void language plpgsql as $$
declare result text;
begin
  update public.app_version_config set latest_version='1.0.7',minimum_supported_version='1.0.7'
    where platform='ios';
  result=public.apply_ios_app_store_release(payload);
  if result is distinct from expected_result then
    raise exception 'Expected %, got %',expected_result,result;
  end if;
  if not exists(select 1 from public.app_version_config where platform='ios'
    and latest_version=expected_version and minimum_supported_version=expected_version) then
    raise exception 'Unexpected threshold mutation for %',expected_result;
  end if;
end $$;

insert into public.app_version_config(platform,latest_version,minimum_supported_version,app_store_url)
values('android','1.0.7','1.0.7','https://apps.apple.com/us/app/consumed-track-play/id6759014223')
on conflict(platform) do update set latest_version='1.0.7',minimum_supported_version='1.0.7';

select pg_temp.expect_release(pg_temp.release_fixture(),'updated','1.0.9');
select pg_temp.expect_release(pg_temp.release_fixture('{"version":"1.10.0"}'),'updated','1.10.0');
select pg_temp.expect_release(pg_temp.release_fixture('{"version":"1.0.7"}'),'already_current');
select pg_temp.expect_release(pg_temp.release_fixture('{"version":"1.0.6"}'),'older_store_version');
select pg_temp.expect_release(pg_temp.release_fixture('{"version":"garbage"}'),'invalid_version');
select pg_temp.expect_release(pg_temp.release_fixture('{"version":"1.0.10-beta.1"}'),'invalid_version');
select pg_temp.expect_release(pg_temp.release_fixture('{"version":"999999999999.0.0"}'),'invalid_version');
select pg_temp.expect_release(pg_temp.release_fixture('{"trackId":1}'),'wrong_app');
select pg_temp.expect_release(pg_temp.release_fixture('{"bundleId":"other.app"}'),'wrong_app');
select pg_temp.expect_release(pg_temp.release_fixture('{"kind":"movie"}'),'wrong_app');
select pg_temp.expect_release(pg_temp.release_fixture('{"minimumOsVersion":"16.0"}'),'incompatible_ios_requirement');
select pg_temp.expect_release(pg_temp.release_fixture('{"minimumOsVersion":null}'),'invalid_ios_requirement');
select pg_temp.expect_release(pg_temp.release_fixture('{"minimumOsVersion":"invalid"}'),'invalid_ios_requirement');
select pg_temp.expect_release(pg_temp.release_fixture('{"currentVersionReleaseDate":null}'),'invalid_release_date');
select pg_temp.expect_release(pg_temp.release_fixture('{"currentVersionReleaseDate":"invalid"}'),'invalid_release_date');
select pg_temp.expect_release(pg_temp.release_fixture('{"currentVersionReleaseDate":"-infinity"}'),'invalid_release_date');
select pg_temp.expect_release(pg_temp.release_fixture(jsonb_build_object(
  'currentVersionReleaseDate',clock_timestamp()-interval '10 minutes')),'release_propagating');
select pg_temp.expect_release(pg_temp.release_fixture(jsonb_build_object(
  'currentVersionReleaseDate',clock_timestamp()+interval '1 day')),'release_propagating');
select pg_temp.expect_release('{"resultCount":0,"results":[]}'::jsonb,'invalid_lookup');
select pg_temp.expect_release('{"resultCount":1,"results":{}}'::jsonb,'invalid_lookup');
select pg_temp.expect_release('{"resultCount":1,"results":[]}'::jsonb,'invalid_lookup');
select pg_temp.expect_release('null'::jsonb,'invalid_lookup');

do $$
begin
  update public.app_version_config set latest_version='1.10.0',minimum_supported_version='1.9.0'
    where platform='ios';
  if public.apply_ios_app_store_release(pg_temp.release_fixture('{"version":"1.9.0"}'))
      <> 'older_store_version' then raise exception 'Numerical downgrade accepted'; end if;
  update public.app_version_config set latest_version='1.0.9',minimum_supported_version='1.0.7'
    where platform='ios';
  if public.apply_ios_app_store_release(pg_temp.release_fixture()) <> 'updated' then
    raise exception 'Current public version did not become mandatory'; end if;
  if not exists(select 1 from public.app_version_config where platform='ios'
    and latest_version='1.0.9' and minimum_supported_version='1.0.9') then
    raise exception 'Required threshold did not catch up'; end if;
  if not exists(select 1 from public.app_version_config where platform='android'
    and latest_version='1.0.7' and minimum_supported_version='1.0.7') then
    raise exception 'Android control was mutated'; end if;
  if has_function_privilege('anon','public.apply_ios_app_store_release(jsonb)','EXECUTE')
    or has_function_privilege('authenticated','public.apply_ios_app_store_release(jsonb)','EXECUTE')
    or has_function_privilege('service_role','public.sync_ios_app_store_release()','EXECUTE')
    or has_table_privilege('anon','public.ios_app_store_sync_state','SELECT')
    or has_table_privilege('authenticated','public.ios_app_store_sync_state','UPDATE') then
    raise exception 'Sync privileges are not private'; end if;
  if not exists(select 1 from cron.job where jobname='consumed-ios-app-store-sync'
    and active and schedule='*/5 * * * *') then
    raise exception 'Dedicated scheduler missing'; end if;
end $$;

-- Exercise the REAL worker's HTTP interpretation, not just the helper.
insert into net._http_response(id,status_code,content,timed_out,created)
values(-6759014223,200,pg_temp.release_fixture()::text,false,clock_timestamp());

do $$
declare result text;
begin
  update public.app_version_config set latest_version='1.0.7',minimum_supported_version='1.0.7'
    where platform='ios';
  update public.ios_app_store_sync_state set request_id=-6759014223,requested_at=clock_timestamp();
  result=public.sync_ios_app_store_release();
  if result<>'updated' then raise exception 'Worker valid response failed: %',result; end if;
  if not exists(select 1 from public.ios_app_store_sync_state
    where last_result='updated' and last_success_at is not null and request_id>0) then
    raise exception 'Worker did not record success and enqueue next lookup'; end if;
  result=public.sync_ios_app_store_release();
  if result<>'pending' then raise exception 'In-flight request was duplicated: %',result; end if;

  update net._http_response set status_code=503 where id=-6759014223;
  update public.ios_app_store_sync_state set request_id=-6759014223,requested_at=clock_timestamp();
  if public.sync_ios_app_store_release()<>'lookup_failed' then
    raise exception 'HTTP failure not recognized'; end if;

  update net._http_response set status_code=200,content='not JSON' where id=-6759014223;
  update public.ios_app_store_sync_state set request_id=-6759014223,requested_at=clock_timestamp();
  if public.sync_ios_app_store_release()<>'lookup_processing_failed' then
    raise exception 'Malformed body not recognized'; end if;

  update net._http_response set content=pg_temp.release_fixture()::text,timed_out=true
    where id=-6759014223;
  update public.ios_app_store_sync_state set request_id=-6759014223,requested_at=clock_timestamp();
  if public.sync_ios_app_store_release()<>'lookup_failed' then
    raise exception 'Timeout not recognized'; end if;

  update public.ios_app_store_sync_state set
    request_id=-6759014224,requested_at=clock_timestamp()-interval '10 minutes';
  if public.sync_ios_app_store_release()<>'lookup_response_missing' then
    raise exception 'Expired response not recognized'; end if;
  if not exists(select 1 from public.app_version_config where platform='ios'
    and latest_version='1.0.9' and minimum_supported_version='1.0.9') then
    raise exception 'Failures changed the enforced version'; end if;
end $$;
