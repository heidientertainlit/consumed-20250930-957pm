-- Executed only inside the verifier's ROLLBACK transaction on the real schema.
-- Existing users supply role subjects; no user/account records are modified.
do $$
declare admin_id uuid; member_id uuid; item_id uuid; draft public.recommendation_lab_runs;
begin
  select id into strict admin_id from public.users
    where is_admin is true and coalesce(is_persona,false) is false limit 1;
  select id into strict member_id from public.users
    where coalesce(is_admin,false) is false and coalesce(is_persona,false) is false limit 1;
  perform set_config('recommendation_lab.test_admin',admin_id::text,true);
  perform set_config('recommendation_lab.test_member',member_id::text,true);

  if has_table_privilege('anon','public.recommendation_lab_items','SELECT')
      or has_table_privilege('anon','public.recommendation_lab_runs','SELECT')
      or has_function_privilege('anon','public.recommendation_lab_create_draft(text,jsonb)','EXECUTE')
      or has_function_privilege('anon','public.recommendation_lab_foundation_status()','EXECUTE') then
    raise exception 'Guest privileges are too broad';
  end if;
  if has_table_privilege('authenticated','public.recommendation_lab_items','INSERT')
      or has_table_privilege('authenticated','public.recommendation_lab_runs','INSERT')
      or has_table_privilege('authenticated','public.recommendation_lab_runs','UPDATE')
      or has_table_privilege('authenticated','public.recommendation_lab_runs','DELETE')
      or has_table_privilege('authenticated','public.recommendation_lab_runs','TRUNCATE')
      or has_table_privilege('service_role','public.recommendation_lab_runs','INSERT')
      or has_function_privilege('service_role','public.recommendation_lab_create_draft(text,jsonb)','EXECUTE') then
    raise exception 'Unexpected direct write/service access';
  end if;

  insert into public.recommendation_lab_items
    (external_source,external_id,media_type,title,created_by)
    values ('tmdb','foundation-rollback-only','movie','Transactional fixture',admin_id)
    returning id into item_id;
  perform set_config('recommendation_lab.test_item',item_id::text,true);
end;
$$;

do $$
declare draft public.recommendation_lab_runs; payload jsonb;
begin
  perform set_config('request.jwt.claim.sub',current_setting('recommendation_lab.test_admin'),true);
  perform set_config('request.jwt.claims',jsonb_build_object('sub',current_setting('recommendation_lab.test_admin'),'role','authenticated')::text,true);
  execute 'set local role authenticated';
  if not public.recommendation_lab_is_admin() then raise exception 'Real human admin was denied'; end if;
  select * into draft from public.recommendation_lab_create_draft('  Foundation fixture  ','{"test":true}');
  if draft.label <> 'Foundation fixture' or draft.status <> 'draft'
      or draft.created_by <> auth.uid() or draft.source_item_id is not null
      or draft.model_spent_usd <> 0 or draft.model_reserved_usd <> 0
      or draft.results <> '{}'::jsonb or draft.evaluations <> '{}'::jsonb then
    raise exception 'Draft RPC did not enforce empty server-owned defaults';
  end if;
  if (select count(*) from public.recommendation_lab_items) <> 1
      or (select count(*) from public.recommendation_lab_runs) <> 1 then
    raise exception 'Admin RLS read failed';
  end if;
  payload := public.recommendation_lab_foundation_status();
  if payload->>'stage' <> 'storage_foundation' or payload->>'preparation_enabled' <> 'false'
      or payload->>'embedding_generation_enabled' <> 'false'
      or payload->>'ranking_enabled' <> 'false' or payload->>'consumer_connected' <> 'false' then
    raise exception 'A deferred capability is enabled';
  end if;
  begin
    perform public.recommendation_lab_create_draft('','{}');
    raise exception 'Empty label accepted';
  exception when invalid_parameter_value then null; end;
  begin
    perform public.recommendation_lab_create_draft(repeat('x',161),'{}');
    raise exception 'Oversized label accepted';
  exception when invalid_parameter_value then null; end;
  begin
    perform public.recommendation_lab_create_draft('test','[]');
    raise exception 'Non-object configuration accepted';
  exception when invalid_parameter_value then null; end;
  begin
    perform public.recommendation_lab_create_draft('test',jsonb_build_object('value',repeat('x',17000)));
    raise exception 'Oversized configuration accepted';
  exception when invalid_parameter_value then null; end;
  begin
    perform public.recommendation_lab_create_draft(null,'{}');
    raise exception 'Null label accepted';
  exception when invalid_parameter_value then null; end;
  begin
    perform public.recommendation_lab_create_draft('test',null);
    raise exception 'Null configuration accepted';
  exception when invalid_parameter_value then null; end;
  begin
    delete from public.recommendation_lab_runs;
    raise exception 'Admin direct deletion allowed';
  exception when insufficient_privilege then null; end;
  begin
    update public.recommendation_lab_runs set results='{"injected":true}';
    raise exception 'Admin direct update allowed';
  exception when insufficient_privilege then null; end;
  execute 'reset role';
end;
$$;

do $$
declare subject text;
begin
  -- A real non-admin, a nonexistent subject with forged admin metadata, and
  -- an authenticated request without a subject must all fail closed.
  foreach subject in array array[current_setting('recommendation_lab.test_member'),gen_random_uuid()::text,'']
  loop
    perform set_config('request.jwt.claim.sub',subject,true);
    perform set_config('request.jwt.claims',jsonb_strip_nulls(jsonb_build_object('sub',nullif(subject,''),'role','authenticated','is_admin',true))::text,true);
    execute 'set local role authenticated';
    if public.recommendation_lab_is_admin() then raise exception 'Unauthorized subject admitted'; end if;
    if exists(select 1 from public.recommendation_lab_items)
        or exists(select 1 from public.recommendation_lab_runs) then
      raise exception 'Non-admin can read private lab data';
    end if;
    begin
      perform public.recommendation_lab_create_draft('forbidden','{}');
      raise exception 'Unauthorized draft created';
    exception when insufficient_privilege then null; end;
    begin
      perform public.recommendation_lab_foundation_status();
      raise exception 'Unauthorized status exposed';
    exception when insufficient_privilege then null; end;
    execute 'reset role';
  end loop;
end;
$$;

do $$
declare item_id uuid := current_setting('recommendation_lab.test_item')::uuid;
begin
  -- Synthetic numeric vectors test storage, not model generation/enrichment.
  begin
    update public.recommendation_lab_items
      set appeal_embedding=array_fill(0.0,array[256])::extensions.vector where id=item_id;
    raise exception 'Vector without model provenance accepted';
  exception when check_violation then null; end;
  update public.recommendation_lab_items set
    appeal_embedding=array_fill(0.0,array[256])::extensions.vector,
    embedding_model='text-embedding-3-small',embedding_dimensions=256,
    embedding_input_hash=repeat('a',64)
    where id=item_id;
  if (select extensions.vector_dims(appeal_embedding) from public.recommendation_lab_items where id=item_id) <> 256 then
    raise exception 'Vector storage failed';
  end if;
  begin
    update public.recommendation_lab_items
      set appeal_embedding=array_fill(0.0,array[255])::extensions.vector where id=item_id;
    raise exception 'Wrong vector dimension accepted';
  exception when data_exception then null; end;
  begin
    update public.recommendation_lab_items set destination_path='https://invalid.example' where id=item_id;
    raise exception 'External destination accepted';
  exception when check_violation then null; end;
  begin
    update public.recommendation_lab_runs set model_spent_usd=-1;
    raise exception 'Negative cost accepted';
  exception when check_violation then null; end;
  if (select count(*) from public.recommendation_lab_runs) <> 1 then
    raise exception 'Denied writes left unexpected drafts';
  end if;
end;
$$;
