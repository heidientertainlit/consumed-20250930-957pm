#!/usr/bin/env bash
# Disposable PostgreSQL ONLY. Does not read project secrets or database URLs.
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
DATA_DIR="$(mktemp -d /tmp/system-lists-pg.XXXXXX)"
SOCKET_DIR="$(mktemp -d /tmp/system-lists-sock.XXXXXX)"
trap 'pg_ctl -D "$DATA_DIR" -m immediate stop >/dev/null 2>&1 || true; rm -rf "$DATA_DIR" "$SOCKET_DIR"' EXIT
initdb -D "$DATA_DIR" --no-locale --encoding=UTF8 >/dev/null
pg_ctl -D "$DATA_DIR" -o "-k '$SOCKET_DIR' -p 55453 -c listen_addresses='' -c fsync=off" start >/dev/null
PSQL=(psql -X -q -v ON_ERROR_STOP=1 -h "$SOCKET_DIR" -p 55453 -U "$(whoami)" -d postgres)
"${PSQL[@]}" <<'SQL'
create role anon nologin;
create role authenticated nologin;
create role service_role nologin bypassrls;
create role supabase_auth_admin login noinherit;
create role authenticator login noinherit;
grant anon, authenticated, service_role to authenticator;
grant usage, create on schema public to authenticated, anon, service_role;
create schema auth;
create table auth.users(id uuid primary key);
insert into auth.users select (repeat(n::text,8)||'-'||repeat(n::text,4)||'-4'||repeat(n::text,3)||'-8'||repeat(n::text,3)||'-'||repeat(n::text,12))::uuid
from generate_series(1,7) n;
insert into auth.users values('99999999-9999-4999-8999-999999999991');
create function auth.uid() returns uuid language sql as $$
 select coalesce(nullif(current_setting('request.jwt.claim.sub',true),''),
   nullif(current_setting('request.jwt.claims',true),'')::jsonb->>'sub')::uuid $$;
create function auth.role() returns text language sql as $$
 select coalesce(nullif(current_setting('request.jwt.claim.role',true),''),
   nullif(current_setting('request.jwt.claims',true),'')::jsonb->>'role') $$;
create table users(id uuid primary key references auth.users on delete cascade);
create table lists(id uuid primary key default gen_random_uuid(),user_id uuid references auth.users on delete cascade,
 title text,is_default boolean default false,is_private boolean default true,
 updated_at timestamptz default now(),share_id text default gen_random_uuid()::text,visibility text default 'public');
create unique index lists_user_title_default_key on lists(user_id,title) where is_default=true;
create unique index lists_user_title_default_unique on lists(user_id,title) where is_default=true;
create table list_items(id uuid primary key default gen_random_uuid(),list_id uuid references lists on delete cascade,
 user_id uuid,external_id text,external_source text,canonical_media_id uuid,notes text,progress integer,created_at timestamptz default now());
create unique index list_items_unique_media on list_items(user_id,list_id,external_id,external_source);
create unique index list_items_user_list_canonical_media_unique on list_items(user_id,list_id,canonical_media_id);
create table list_collaborators(id uuid primary key default gen_random_uuid(),list_id uuid references lists on delete cascade);
create table media_history_log(id uuid primary key default gen_random_uuid(),item_id uuid references list_items on delete cascade,content text);
create table media_tag_links(id uuid primary key default gen_random_uuid(),item_id uuid references list_items on delete cascade);
create table media_progress_events(id uuid primary key default gen_random_uuid(),list_item_id uuid references list_items on delete set null);
create table media_import_rows(id uuid primary key default gen_random_uuid(),list_item_id uuid references list_items on delete set null);
create table finished_tv_scopes(id uuid primary key default gen_random_uuid(),list_item_id uuid references list_items on delete cascade);
create table pools(id uuid primary key default gen_random_uuid(),list_id uuid references lists on delete set null);
create table social_posts(id uuid primary key default gen_random_uuid(),list_id text);
create table activity_logs(id uuid primary key default gen_random_uuid(),list_id uuid references lists on delete cascade);
create table user_media_items(id uuid primary key default gen_random_uuid(),list_id uuid references lists on delete cascade);
create table notifications(id uuid primary key default gen_random_uuid(),list_id text);
create table canonical_media_backfill_plans(id uuid primary key default gen_random_uuid(),list_id uuid);
create function assert_true(ok boolean,label text) returns void language plpgsql as $$
begin if not coalesce(ok,false) then raise exception 'FAIL: %',label; end if; raise notice 'PASS: %',label; end $$;
create function rejects(q text,label text) returns void language plpgsql as $$
declare failed boolean=false;
begin begin execute q; exception when others then failed=true; end; perform assert_true(failed,label); end $$;
create function expect_denied(q text,label text) returns void language plpgsql as $$
declare denied boolean=false;
begin begin execute q; exception when insufficient_privilege then denied=true; end; perform assert_true(denied,label); end $$;
-- Real schema's legacy data is seeded BEFORE protection is installed.
insert into users values('11111111-1111-4111-8111-111111111111'),('22222222-2222-4222-8222-222222222222'),('33333333-3333-4333-8333-333333333333');
insert into lists(id,user_id,title,is_default) values
('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','11111111-1111-4111-8111-111111111111','Queue',true),
('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb','22222222-2222-4222-8222-222222222222','Want To',false),
('cccccccc-cccc-4ccc-8ccc-cccccccccccc','33333333-3333-4333-8333-333333333333','Queue',false);
insert into list_items(id,list_id,user_id,notes,progress) values
('dddddddd-dddd-4ddd-8ddd-dddddddddddd','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','11111111-1111-4111-8111-111111111111','keep original notes',42),
('eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee','bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb','22222222-2222-4222-8222-222222222222','keep review',7);
insert into media_history_log(item_id,content) values('dddddddd-dddd-4ddd-8ddd-dddddddddddd','original history');
insert into media_tag_links(item_id) select id from list_items;
insert into media_progress_events(list_item_id) select id from list_items;
insert into media_import_rows(list_item_id) select id from list_items;
insert into finished_tv_scopes(list_item_id) select id from list_items;
-- Preserve the real signup chain shape with unrelated signup side effects.
create table signup_receipts(user_id uuid);
create function handle_new_user() returns trigger language plpgsql security definer as $$
begin
  insert into public.users values(new.id) on conflict (id) do nothing;
  return new;
exception when others then
  -- Model live Auth behavior: signup can return successfully without an app row.
  raise warning 'Profile provisioning failed: %',sqlerrm;
  return new;
end $$;
create trigger on_auth_user_created after insert on auth.users for each row execute function handle_new_user();
create function signup_notification_stub() returns trigger language plpgsql security definer as $$
begin insert into public.signup_receipts values(new.id); return new; end $$;
create trigger fixture_signup_notification after insert on users for each row execute function signup_notification_stub();
grant usage on schema auth to supabase_auth_admin, authenticated, anon, service_role;
grant insert on auth.users to supabase_auth_admin;
grant select, insert, trigger on public.users to service_role;
grant select,insert,update,delete on lists to authenticated,service_role;
grant select on list_items to authenticated,anon;
grant execute on function auth.uid(),auth.role() to authenticated,anon;
-- Model the existing role separation with representative policies and freeze
-- exact definitions, grants, flags and unaffected routines before installing SQL.
alter table auth.users enable row level security;
create policy fixture_auth_insert on auth.users for insert to supabase_auth_admin with check (true);
alter table public.users enable row level security;
alter table public.lists enable row level security;
alter table public.list_items enable row level security;
create policy fixture_owner_lists on public.lists for all to authenticated
  using (user_id=auth.uid()) with check (user_id=auth.uid());
create policy fixture_owner_items on public.list_items for select to authenticated
  using (user_id=auth.uid());
create view fixture_security_state as
select jsonb_build_object(
  'schemas', (select jsonb_agg(jsonb_build_array(nspname,nspowner,nspacl) order by nspname)
    from pg_namespace where nspname in ('public','auth')),
  'tables', (select jsonb_agg(jsonb_build_array(oid,relowner,relacl,relrowsecurity,relforcerowsecurity) order by oid)
    from pg_class where oid in ('auth.users'::regclass,'public.users'::regclass,'public.lists'::regclass,'public.list_items'::regclass)),
  'policies', (select jsonb_agg(to_jsonb(p) order by schemaname,tablename,policyname)
    from pg_policies p where schemaname in ('auth','public')),
  'routines', (select jsonb_agg(jsonb_build_array(oid,proowner,proacl,pg_get_functiondef(oid)) order by oid)
    from pg_proc where oid in ('auth.uid()'::regprocedure,'auth.role()'::regprocedure,
      'public.handle_new_user()'::regprocedure,'public.signup_notification_stub()'::regprocedure))
) as security_state;
create table fixture_original_security as select * from fixture_security_state;
alter default privileges in schema public grant execute on functions to anon,authenticated,service_role;
-- Start with both obsolete trigger names/functions so the actual package must reconcile them.
create function create_default_system_lists() returns trigger language plpgsql as $$
begin insert into lists(user_id,title,is_default) values(new.id,'Queue',true); return new; end $$;
create function create_default_lists_for_user() returns trigger language plpgsql as $$
begin insert into lists(user_id,title,is_default) values(new.id,'Queue',true); return new; end $$;
create trigger create_default_lists_trigger after insert on users for each row execute function create_default_system_lists();
create trigger create_lists_trigger after insert on users for each row execute function create_default_lists_for_user();
create function create_default_lists() returns trigger language plpgsql as $$ begin return new; end $$;
create function create_list(p_creator_id uuid,p_title text,p_description text default '',
 p_is_default boolean default false,p_is_pinned boolean default false,p_is_private boolean default false,
 p_primary_type text default 'general',p_visibility text default 'private')
returns void language plpgsql as $$
begin insert into lists(user_id,title,is_default) values(p_creator_id,p_title,p_is_default); end $$;
SQL
# A dependency that was not in the audit must stop retirement, not be CASCADE-dropped.
"${PSQL[@]}" -c "create trigger fixture_unreviewed_legacy_dependency after insert on users for each row execute function create_default_lists_for_user()"
if "${PSQL[@]}" -f "$ROOT/supabase/manual/five-system-lists-foundation.sql" > "$DATA_DIR/expected-dependency-failure.log" 2>&1; then
  echo 'FAIL: foundation silently removed an unknown legacy dependency'; exit 1
fi
grep -q 'other objects depend' "$DATA_DIR/expected-dependency-failure.log"
"${PSQL[@]}" <<'SQL'
select assert_true((select count(*)=3 from pg_trigger where tgrelid='public.users'::regclass and not tgisinternal
 and tgname<>'fixture_signup_notification'),'failed retirement rolls back original triggers and unknown dependency intact');
drop trigger fixture_unreviewed_legacy_dependency on users;
SQL
# A conflicting schema must stop the install, not change its existing grants.
"${PSQL[@]}" -c 'create schema list_provisioning_private; grant usage on schema list_provisioning_private to authenticated'
if "${PSQL[@]}" -f "$ROOT/supabase/manual/five-system-lists-foundation.sql" > "$DATA_DIR/expected-schema-failure.log" 2>&1; then
  echo 'FAIL: foundation reused a shared provisioning schema'; exit 1
fi
grep -q 'Unexpected ownership or grants on list_provisioning_private' "$DATA_DIR/expected-schema-failure.log"
"${PSQL[@]}" <<'SQL'
select assert_true(has_schema_privilege('authenticated','list_provisioning_private','USAGE')
 and to_regprocedure('public.protect_standard_system_lists()') is null,
 'schema conflict stops installation and leaves existing access unchanged');
drop schema list_provisioning_private;
SQL
"${PSQL[@]}" -f "$ROOT/supabase/manual/five-system-lists-foundation.sql"
"${PSQL[@]}" -f "$ROOT/supabase/manual/five-system-lists-foundation.sql"
"${PSQL[@]}" <<'SQL'
select assert_true((select count(*)=1 from pg_trigger where tgrelid='public.users'::regclass and not tgisinternal
 and tgname<>'fixture_signup_notification'),'only one signup-list trigger remains');
select assert_true((select security_state from fixture_security_state)=(select security_state from fixture_original_security),
 'existing policies, RLS flags, schema and table grants, and unrelated routines are unchanged');
select assert_true(not exists(
 select 1 from pg_roles r where r.rolname in ('anon','authenticated','service_role','authenticator','supabase_auth_admin')
 and (has_schema_privilege(r.oid,'list_provisioning_private','USAGE,CREATE')
   or has_function_privilege(r.oid,'list_provisioning_private.ensure_system_lists_for_owner(uuid)','EXECUTE')
   or has_function_privilege(r.oid,'list_provisioning_private.create_default_system_lists()','EXECUTE'))
 ),'only the owner can access the private signup and provisioning routines');
select assert_true(has_function_privilege('authenticated','public.ensure_standard_system_lists(uuid)','EXECUTE')
 and has_function_privilege('service_role','public.ensure_standard_system_lists(uuid)','EXECUTE')
 and not has_function_privilege('anon','public.ensure_standard_system_lists(uuid)','EXECUTE')
 and not has_function_privilege('supabase_auth_admin','public.ensure_standard_system_lists(uuid)','EXECUTE'),
 'public restore grants are limited to authenticated and service roles');
select assert_true(to_regprocedure('public.create_default_system_lists()') is null,'old public signup routine retired');
select assert_true(to_regprocedure('public.create_default_lists_for_user()') is null,'duplicate signup function retired');
select assert_true(to_regprocedure('public.create_default_lists()') is null,'unused HTTP helper retired');
select assert_true(not has_function_privilege('anon','public.create_list(uuid,text,text,boolean,boolean,boolean,text,text)','EXECUTE')
 and not has_function_privilege('authenticated','public.create_list(uuid,text,text,boolean,boolean,boolean,text,text)','EXECUTE')
 and not has_function_privilege('service_role','public.create_list(uuid,text,text,boolean,boolean,boolean,text,text)','EXECUTE'),
 'generic list RPC client/service execution revoked');
select rejects($q$select create_list('11111111-1111-4111-8111-111111111111','Queue','',true)$q$,'generic legacy RPC body is explicitly non-writing even for its owner');
set session authorization supabase_auth_admin;
insert into auth.users values('88888888-8888-4888-8888-888888888888');
reset session authorization;
select assert_true(exists(select 1 from public.users where id='88888888-8888-4888-8888-888888888888'),
 'Auth signup without a user JWT creates the app profile');
select assert_true((select array_agg(title order by title) from lists
 where user_id='88888888-8888-4888-8888-888888888888')=
 array['Currently','Did Not Finish','Favorites','Finished','Want To'],'Auth signup creates all five exact titles with no Queue');
select assert_true((select bool_and(is_default is true) from lists
 where user_id='88888888-8888-4888-8888-888888888888'),'all five signup lists are classified as system lists');
select assert_true((select count(*)=1 from signup_receipts),'unrelated signup side effect preserved');
select expect_denied($q$select * from public.ensure_standard_system_lists('11111111-1111-4111-8111-111111111111')$q$,
 'the public RPC has no SQL-admin exception');
select assert_true((select count(*)=5 from list_provisioning_private.ensure_system_lists_for_owner('11111111-1111-4111-8111-111111111111')),'legacy Queue restores all five');
select assert_true((select title='Want To' from lists where id='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'),'legacy list UUID preserved');
select assert_true((select notes='keep original notes' and progress=42 and list_id='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa' from list_items where id='dddddddd-dddd-4ddd-8ddd-dddddddddddd'),'saved item UUID, association, notes, progress preserved');
select assert_true((select count(*)=1 from media_history_log),'history relationship preserved');
select assert_true((select count(*)=5 from list_provisioning_private.ensure_system_lists_for_owner('11111111-1111-4111-8111-111111111111')),'restoration rerun is idempotent');
select rejects($q$select list_provisioning_private.ensure_system_lists_for_owner('22222222-2222-4222-8222-222222222222')$q$,'unreviewed misclassification surfaces error instead of stealing custom list');
select assert_true((select is_default=false from lists where id='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'),'unreviewed custom record untouched');
select assert_true((select count(*)=5 from list_provisioning_private.ensure_system_lists_for_owner('33333333-3333-4333-8333-333333333333')),'custom Queue does not prevent canonical Want To');
select assert_true((select title='Queue' and is_default=false from lists where id='cccccccc-cccc-4ccc-8ccc-cccccccccccc'),'genuine custom Queue untouched');
insert into users values('44444444-4444-4444-8444-444444444444');
select assert_true((select count(*)=5 from lists where user_id='44444444-4444-4444-8444-444444444444' and is_default),'new signup creates exactly five');
select assert_true(not exists(select 1 from lists where title='Queue' and is_default),'signup cannot create Queue');
select rejects($q$insert into lists(user_id,title,is_default) values('44444444-4444-4444-8444-444444444444','Queue',true)$q$,'direct Queue system insertion denied');
select rejects($q$insert into lists(user_id,title,is_default) values('44444444-4444-4444-8444-444444444444','Want To',false)$q$,'new wrong-flag standard rows denied');
select rejects($q$update lists set title='Want To' where id='cccccccc-cccc-4ccc-8ccc-cccccccccccc'$q$,'custom rename cannot create wrong-flag standard row');
do $$
declare t text;
begin
 foreach t in array array['Currently','Want To','Finished','Did Not Finish','Favorites'] loop
  perform rejects(format('delete from lists where user_id=%L and title=%L','44444444-4444-4444-8444-444444444444',t),t||' deletion protected');
  perform rejects(format('update lists set is_default=false where user_id=%L and title=%L','44444444-4444-4444-8444-444444444444',t),t||' demotion protected');
  perform rejects(format('update lists set title=''Queue'' where user_id=%L and title=%L','44444444-4444-4444-8444-444444444444',t),t||' rename protected');
 end loop;
end $$;
set session authorization authenticator;
set role authenticated;
select set_config('request.jwt.claims','{"sub":"11111111-1111-4111-8111-111111111111","role":"authenticated"}',false);
select assert_true((select count(*)=5 from ensure_standard_system_lists('11111111-1111-4111-8111-111111111111')),'owner authorized');
select expect_denied($q$select * from ensure_standard_system_lists('44444444-4444-4444-8444-444444444444')$q$,'foreign restoration denied');
select expect_denied($q$select * from list_provisioning_private.ensure_system_lists_for_owner('11111111-1111-4111-8111-111111111111')$q$,
 'authenticated API cannot invoke the private worker even for itself');
select assert_true((select count(*)=1 from public.list_items)
 and not exists(select 1 from public.list_items where user_id='22222222-2222-4222-8222-222222222222'),
 'representative private saved-item RLS still exposes only the owner’s rows');
select expect_denied($q$select id from auth.users$q$,'private Auth records remain inaccessible');
select set_config('app.system_list_maintenance','on',false);
select rejects($q$delete from lists where title='Want To'$q$,'client cannot grant itself migration bypass');
select set_config('request.jwt.claims','{"role":"authenticated"}',false);
select expect_denied($q$select * from ensure_standard_system_lists('44444444-4444-4444-8444-444444444444')$q$,'missing identity denied');
select set_config('request.jwt.claims','{}',false);
select expect_denied($q$select * from ensure_standard_system_lists('44444444-4444-4444-8444-444444444444')$q$,'authenticated role without verified claims denied');
select set_config('request.jwt.claims','{"role":"service_role"}',false);
select expect_denied($q$select * from ensure_standard_system_lists('44444444-4444-4444-8444-444444444444')$q$,
 'service claim without the service database role does not authorize restoration');
select set_config('request.jwt.claims','{}',false);
select rejects($q$select create_list('11111111-1111-4111-8111-111111111111','Queue','',true)$q$,'authenticated caller cannot execute retired generic creation RPC');
reset role;
set role anon;
select expect_denied($q$select * from ensure_standard_system_lists('11111111-1111-4111-8111-111111111111')$q$,'anonymous public restoration denied');
select assert_true(not exists(select 1 from public.list_items),'anonymous cannot read private saved items');
reset role;
select set_config('app.system_list_maintenance','off',false);
set role service_role;
select expect_denied($q$select * from ensure_standard_system_lists('44444444-4444-4444-8444-444444444444')$q$,
 'service database role without verified claims denied');
select set_config('request.jwt.claims','{"role":"service_role"}',false);
select assert_true((select count(*)=5 from ensure_standard_system_lists('44444444-4444-4444-8444-444444444444')),'service provisioning uses the same five destinations');
insert into public.users values('99999999-9999-4999-8999-999999999991');
select set_config('app.system_list_maintenance','on',false);
select rejects($q$insert into lists(user_id,title,is_default) values('44444444-4444-4444-8444-444444444444','Queue',true)$q$,'service write cannot recreate Queue or grant itself repair bypass');
select rejects($q$update lists set title='Queue' where user_id='44444444-4444-4444-8444-444444444444' and title='Want To'$q$,'service rename cannot recreate Queue');
reset session authorization;
select assert_true((select count(*)=5 from lists where user_id='99999999-9999-4999-8999-999999999991' and is_default),
 'service profile recovery also provisions all five through the private trigger');
select set_config('request.jwt.claims','',false);
select set_config('app.system_list_maintenance','off',false);
-- Each of the five missing destinations restores against the actual partial indexes.
begin;
do $$
declare wanted text; unchanged text;
begin
 foreach wanted in array array['Currently','Want To','Finished','Did Not Finish','Favorites'] loop
  select md5(string_agg(id::text,',' order by id)) into unchanged from lists
    where user_id='44444444-4444-4444-8444-444444444444' and title<>wanted;
  perform set_config('app.system_list_maintenance','on',true);
  delete from lists where user_id='44444444-4444-4444-8444-444444444444' and title=wanted;
  perform set_config('app.system_list_maintenance','off',true);
  perform list_provisioning_private.ensure_system_lists_for_owner('44444444-4444-4444-8444-444444444444');
  perform assert_true((select count(*)=5 from lists where user_id='44444444-4444-4444-8444-444444444444' and is_default),'missing '||wanted||' restores');
  perform assert_true((select md5(string_agg(id::text,',' order by id))=unchanged from lists
    where user_id='44444444-4444-4444-8444-444444444444' and title<>wanted),'restoring '||wanted||' retains other list IDs');
 end loop;
end $$;
rollback;
-- Exercise the reviewed classification path for ALL five titles.
insert into users values('55555555-5555-4555-8555-555555555555');
select set_config('app.system_list_maintenance','on',false);
update lists set is_default=false where user_id='55555555-5555-4555-8555-555555555555';
select set_config('app.system_list_maintenance','off',false);
do $$
declare t text;
begin
 foreach t in array array['Currently','Want To','Finished','Did Not Finish','Favorites'] loop
  perform assert_true(exists(select 1 from lists where user_id='55555555-5555-4555-8555-555555555555'
    and title=t and is_default=false),'misclassified '||t||' fixture retained');
 end loop;
end $$;
SQL
# Inject an explicitly reviewed synthetic record into the PREPARED migration, not real IDs.
DATA_SQL="$(cat "$ROOT/supabase/manual/five-system-lists-data.sql")"
"${PSQL[@]}" <<'SQL'
begin;
select set_config('app.system_list_maintenance','on',true);
insert into lists(id,user_id,title,is_default) values
 ('abababab-abab-4bab-8bab-abababababab','11111111-1111-4111-8111-111111111111','Want to Read (Books)',true);
commit;
SQL
if "${PSQL[@]}" <<< "$DATA_SQL" > "$DATA_DIR/expected-obsolete-name-failure.log" 2>&1; then
  echo 'FAIL: unreviewed obsolete per-media system list was silently accepted'; exit 1
fi
grep -q 'unsupported historical system destination' "$DATA_DIR/expected-obsolete-name-failure.log"
"${PSQL[@]}" <<'SQL'
select assert_true((select is_default=true and title='Want to Read (Books)' from lists
 where id='abababab-abab-4bab-8bab-abababababab'),'obsolete per-media classification is held intact for review');
begin;
select set_config('app.system_list_maintenance','on',true);
delete from lists where id='abababab-abab-4bab-8bab-abababababab';
commit;
SQL
if "${PSQL[@]}" <<< "$DATA_SQL" > "$DATA_DIR/expected-review-failure.log" 2>&1; then
  echo 'FAIL: unreviewed migration unexpectedly succeeded'; exit 1
fi
grep -q SYSTEM_LIST_REVIEW_REQUIRED "$DATA_DIR/expected-review-failure.log"
# The first account can restore but the second is ambiguous: all earlier writes
# in the same data transaction must roll back, not leave partial reconciliation.
"${PSQL[@]}" <<'SQL'
begin;
select set_config('app.system_list_maintenance','on',true);
delete from lists where user_id='11111111-1111-4111-8111-111111111111' and title='Favorites';
commit;
SQL
if "${PSQL[@]}" <<< "$DATA_SQL" > "$DATA_DIR/expected-review-failure.log" 2>&1; then
  echo 'FAIL: unreviewed migration unexpectedly succeeded'; exit 1
fi
grep -q SYSTEM_LIST_REVIEW_REQUIRED "$DATA_DIR/expected-review-failure.log"
"${PSQL[@]}" <<'SQL'
select assert_true(not exists(select 1 from lists where user_id='11111111-1111-4111-8111-111111111111' and title='Favorites'),'midway review failure rolls back earlier successful restoration');
select count(*) from list_provisioning_private.ensure_system_lists_for_owner('11111111-1111-4111-8111-111111111111');
SQL
echo 'PASS: unreviewed migration fails and rolls back rather than guessing'
APPROVAL="insert into approved_system_list_repairs values('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb','22222222-2222-4222-8222-222222222222','Want To'); insert into approved_system_list_repairs select id,user_id,title from lists where user_id='55555555-5555-4555-8555-555555555555';"
DATA_SQL="${DATA_SQL/-- INSERT INTO approved_system_list_repairs VALUES (... reviewed IDs ...);/$APPROVAL}"
COMMITTED_SQL="${DATA_SQL/%rollback;/commit;}"
"${PSQL[@]}" <<< "$DATA_SQL"
"${PSQL[@]}" <<'SQL'
select assert_true((select is_default=false from lists where id='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'),'dry run rolled back classification');
SQL
"${PSQL[@]}" <<< "$COMMITTED_SQL"
"${PSQL[@]}" <<< "$COMMITTED_SQL"
"${PSQL[@]}" <<'SQL'
select assert_true((select is_default=true from lists where id='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'),'reviewed repair preserves original list ID');
select assert_true((select count(*)=2 from list_items),'migration keeps exact item count');
select assert_true((select count(*)=2 from media_progress_events where list_item_id is not null),'progress event associations preserved');
select assert_true((select count(*)=2 from media_import_rows where list_item_id is not null),'import associations preserved');
select assert_true((select count(*)=2 from finished_tv_scopes),'TV scope associations preserved');
select assert_true((select count(*)=5 from lists where user_id='55555555-5555-4555-8555-555555555555' and is_default=true),'all five reviewed classification repairs completed');
-- Guarded inverse rehearsal; roll it back so later fixtures retain the canonical state.
begin;
select set_config('app.system_list_maintenance','on',true);
update lists set is_default=false where id='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb' and title='Want To' and is_default=true;
select assert_true((select is_default=false from lists where id='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'),'inverse restores original classification without replacing row');
select assert_true((select list_id='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb' and notes='keep review' from list_items where id='eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee'),'inverse retains saved content and associations');
rollback;
-- Repeated calls delegate to one implementation, even if an extra invocation occurs.
create trigger fixture_repeat_signup after insert on users for each row execute function list_provisioning_private.create_default_system_lists();
insert into users values('77777777-7777-4777-8777-777777777777');
select assert_true((select count(*)=5 from lists where user_id='77777777-7777-4777-8777-777777777777'),'duplicate trigger execution remains five and never Queue');
drop trigger fixture_repeat_signup on users;
insert into users values('66666666-6666-4666-8666-666666666666');
select set_config('app.system_list_maintenance','on',false);
delete from lists where user_id='66666666-6666-4666-8666-666666666666';
select set_config('app.system_list_maintenance','off',false);
SQL
RESTORE_AS_OWNER="set session authorization authenticator; set role authenticated;
select set_config('request.jwt.claims','{\"sub\":\"66666666-6666-4666-8666-666666666666\",\"role\":\"authenticated\"}',false);
select count(*) from public.ensure_standard_system_lists('66666666-6666-4666-8666-666666666666');"
"${PSQL[@]}" -c "$RESTORE_AS_OWNER" > "$DATA_DIR/race-a.log" &
A=$!
"${PSQL[@]}" -c "$RESTORE_AS_OWNER" > "$DATA_DIR/race-b.log" &
B=$!
wait "$A"; wait "$B"
"${PSQL[@]}" <<'SQL'
select assert_true((select count(*)=5 from lists where user_id='66666666-6666-4666-8666-666666666666'),'concurrent restoration creates exactly five without 42P10');
select set_config('app.system_list_maintenance','on',false);
insert into lists(id,user_id,title,is_default) values('99999999-9999-4999-8999-999999999999','66666666-6666-4666-8666-666666666666','Queue',true);
select set_config('app.system_list_maintenance','off',false);
insert into pools(list_id) values('99999999-9999-4999-8999-999999999999');
insert into social_posts(list_id) values('99999999-9999-4999-8999-999999999999');
SQL
"${PSQL[@]}" <<< "$COMMITTED_SQL"
"${PSQL[@]}" <<'SQL'
select assert_true((select is_default=false and title='Queue' from lists where id='99999999-9999-4999-8999-999999999999'),'empty dual-list source retained as historical row, not deleted');
select assert_true((select list_id='99999999-9999-4999-8999-999999999999' from pools),'dual-list FK association preserved');
select assert_true((select list_id='99999999-9999-4999-8999-999999999999' from social_posts),'dual-list text association preserved');
select set_config('app.system_list_maintenance','on',false);
insert into lists(id,user_id,title,is_default) values('88888888-8888-4888-8888-888888888888','66666666-6666-4666-8666-666666666666','Queue',true);
select set_config('app.system_list_maintenance','off',false);
insert into list_items(list_id,user_id,external_id,external_source,notes)
select id,user_id,'same-work','fixture','keep both distinct notes' from lists where user_id='66666666-6666-4666-8666-666666666666'
  and (id='88888888-8888-4888-8888-888888888888' or (title='Want To' and is_default=true));
SQL
if "${PSQL[@]}" <<< "$COMMITTED_SQL" > "$DATA_DIR/expected-merge-failure.log" 2>&1; then
  echo 'FAIL: nonempty dual-list migration unexpectedly succeeded'; exit 1
fi
grep -q SYSTEM_LIST_MERGE_REVIEW_REQUIRED "$DATA_DIR/expected-merge-failure.log"
"${PSQL[@]}" <<'SQL'
select assert_true((select is_default=true from lists where id='88888888-8888-4888-8888-888888888888'),'nonempty duplicate-list case rolls back intact');
select assert_true((select count(*)=2 from list_items where external_id='same-work'),'duplicate-work rows and conflicting notes never silently deleted or duplicated');
insert into list_items(list_id,user_id,notes)
select id,user_id,'account deletion fixture' from lists where user_id='77777777-7777-4777-8777-777777777777' and title='Want To';
insert into media_history_log(item_id,content) select id,'account deletion fixture' from list_items where notes='account deletion fixture';
delete from auth.users where id='77777777-7777-4777-8777-777777777777';
select assert_true(not exists(select 1 from lists where user_id='77777777-7777-4777-8777-777777777777'),'permanent protection does not block actual Auth account cascade');
select assert_true(not exists(select 1 from media_history_log where content='account deletion fixture'),'account deletion still cleans dependent history');
select assert_true((select count(*)=4 from list_items),'account deletion leaves other users saved items intact');
SQL
# Even a SQL client configured to continue after errors must not replay the old bootstrap.
"${PSQL[@]}" -v ON_ERROR_STOP=0 -f "$ROOT/supabase_lists_schema.sql" > "$DATA_DIR/obsolete-bootstrap.log" 2>&1
grep -q OBSOLETE_LIST_SCHEMA "$DATA_DIR/obsolete-bootstrap.log"
"${PSQL[@]}" <<'SQL'
select assert_true((select count(*)=4 from list_items),'blocked historical bootstrap cannot change saved content');
select assert_true((select count(*)=1 from pg_trigger where tgrelid='public.users'::regclass and not tgisinternal
 and tgname<>'fixture_signup_notification'),'blocked historical bootstrap cannot reinstall signup writers');
SQL

# Rehearse the actual write pause, manifest and inverse across sessions.
"${PSQL[@]}" <<'SQL'
begin;
select set_config('app.system_list_maintenance','on',true);
-- Synthetic equivalents of a legacy Queue, a reviewed historical Want To, and an entirely missing row.
update public.lists set is_default=false where title='Queue' and is_default=true;
update public.lists set title='Queue' where user_id='11111111-1111-4111-8111-111111111111' and title='Want To' and is_default;
update public.lists set is_default=false where id='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
delete from public.lists where user_id='44444444-4444-4444-8444-444444444444' and title='Want To' and is_default;
commit;
SQL
{
  printf "begin;\nset local lock_timeout='5s';\nlock table public.users, public.lists, public.list_items in share row exclusive mode;\n"
  sed '/^begin;$/d; /^commit;$/d' "$ROOT/supabase/manual/five-system-lists-foundation.sql" \
    "$ROOT/supabase/manual/five-system-lists-pause-writes.sql"
  printf 'commit;\n'
} | "${PSQL[@]}"
"${PSQL[@]}" <<'SQL'
create function expect_paused(q text,label text) returns void language plpgsql as $$
declare paused boolean=false;
begin begin execute q; exception when lock_not_available then paused=true; end; perform assert_true(paused,label); end $$;
grant insert on public.list_items to service_role,authenticated;
create policy fixture_owner_item_insert on public.list_items for insert to authenticated with check (user_id=auth.uid());
set session authorization authenticator;
set role authenticated;
set request.jwt.claims='{"sub":"11111111-1111-4111-8111-111111111111","role":"authenticated"}';
select expect_paused($q$insert into public.list_items(user_id) values('11111111-1111-4111-8111-111111111111')$q$,
 'write pause blocks a direct older client insert');
set role service_role;
set request.jwt.claims='{"role":"service_role"}';
set app.system_list_maintenance='on';
select expect_paused($q$update public.lists set updated_at=now()$q$,'write pause blocks service writes even with a client-set flag');
select expect_paused($q$select * from public.ensure_standard_system_lists('44444444-4444-4444-8444-444444444444')$q$,
 'write pause blocks a trusted service RPC that would create a missing list');
reset session authorization;
set app.system_list_maintenance='off';
set session authorization supabase_auth_admin;
insert into auth.users values('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1');
reset session authorization;
select assert_true(exists(select 1 from users where id='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1')
 and (select count(*)=5 from lists where user_id='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1' and is_default),
 'a genuine Auth signup still gets its app profile and all five lists during the pause');
SQL
MANIFEST_MARK='-- INSERT INTO approved_system_list_operations VALUES (... reviewed dry-run operation fingerprint ...);'
REVIEW_SQL="$(cat "$ROOT/supabase/manual/five-system-lists-data.sql")"
REVIEW_APPROVAL="insert into approved_system_list_repairs values('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb','22222222-2222-4222-8222-222222222222','Want To');"
REVIEW_SQL="${REVIEW_SQL/-- INSERT INTO approved_system_list_repairs VALUES (... reviewed IDs ...);/$REVIEW_APPROVAL}"
"${PSQL[@]}" -At <<< "$REVIEW_SQL" > "$DATA_DIR/final-dry-run.txt"
MANIFEST="$(grep -E '^[0-9a-f]{32}$' "$DATA_DIR/final-dry-run.txt")"
[[ "$MANIFEST" =~ ^[0-9a-f]{32}$ ]]
WRONG_MANIFEST="insert into approved_system_list_operations values('00000000000000000000000000000000');"
INVALID_REVIEW="${REVIEW_SQL/$MANIFEST_MARK/$WRONG_MANIFEST}"
if "${PSQL[@]}" <<< "${INVALID_REVIEW/%rollback;/commit;}" > "$DATA_DIR/final-drift.txt" 2>&1; then
  echo 'FAIL: a changed manifest committed'; exit 1
fi
grep -q SYSTEM_LIST_MANIFEST_CHANGED "$DATA_DIR/final-drift.txt"
RIGHT_MANIFEST="insert into approved_system_list_operations values('$MANIFEST');"
APPROVED_REVIEW="${REVIEW_SQL/$MANIFEST_MARK/$RIGHT_MANIFEST}"
"${PSQL[@]}" -At <<< "${APPROVED_REVIEW/%rollback;/commit;}" > "$DATA_DIR/final-commit.txt"
RECEIPT="$(grep '^\[' "$DATA_DIR/final-commit.txt")"
INVERSE_MARK='-- INSERT INTO system_list_rollback_input VALUES (... exact committed receipt JSON ...);'
INVERSE="$(cat "$ROOT/supabase/manual/five-system-lists-rollback.sql")"
[[ -n "$RECEIPT" ]]
INPUT="insert into system_list_rollback_input values(\$fixture_receipt\$$RECEIPT\$fixture_receipt\$::jsonb);"
INVERSE="${INVERSE/$INVERSE_MARK/$INPUT}"
"${PSQL[@]}" <<'SQL'
select assert_true((select is_default from lists where id='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb')
 and exists(select 1 from lists where user_id='44444444-4444-4444-8444-444444444444' and title='Want To'),
 'approved manifest commits the exact local operations');
insert into social_posts(list_id)
 select id::text from lists where user_id='44444444-4444-4444-8444-444444444444' and title='Want To';
SQL
if "${PSQL[@]}" <<< "${INVERSE/%rollback;/commit;}" > "$DATA_DIR/final-reference.txt" 2>&1; then
  echo 'FAIL: rollback removed a newly referenced list'; exit 1
fi
grep -q SYSTEM_LIST_ROLLBACK_REFERENCES "$DATA_DIR/final-reference.txt"
"${PSQL[@]}" <<'SQL'
delete from social_posts where list_id in (
 select id::text from lists where user_id='44444444-4444-4444-8444-444444444444' and title='Want To');
SQL
"${PSQL[@]}" <<< "$INVERSE"
"${PSQL[@]}" <<< "${INVERSE/%rollback;/commit;}"
"${PSQL[@]}" <<'SQL'
select assert_true(exists(select 1 from lists where id='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa' and title='Queue' and is_default)
 and (select is_default=false from lists where id='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb')
 and not exists(select 1 from lists where user_id='44444444-4444-4444-8444-444444444444' and title='Want To'),
 'committed receipt restores prior titles/flags and removes only the empty new list');
select assert_true((select count(*)=4 from list_items)
 and (select count(*)=5 from lists where user_id='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1' and is_default),
 'inverse preserves saved items and new accounts outside the receipt');
SQL
# Re-apply the approved logical operations before removing the pause.
"${PSQL[@]}" <<< "${APPROVED_REVIEW/%rollback;/commit;}"
"${PSQL[@]}" -f "$ROOT/supabase/manual/five-system-lists-resume-writes.sql"
"${PSQL[@]}" <<'SQL'
set session authorization authenticator;
set role authenticated;
set request.jwt.claims='{"sub":"11111111-1111-4111-8111-111111111111","role":"authenticated"}';
insert into public.list_items(user_id) values('11111111-1111-4111-8111-111111111111');
select assert_true((select count(*)=2 from public.list_items),'older client writes work again after the pause is removed');
SQL
echo 'PASS: isolated five-list database regression and migration dry run; no project database accessed'
