-- All fixtures, model-spend numbers, claims and feedback are rolled back.
do $test$
declare actor uuid; member uuid; token text; w jsonb; r jsonb; state jsonb; i int;
begin
  select id into strict actor from public.users where is_admin is true and coalesce(is_persona,false) is false limit 1;
  select id into strict member from public.users where coalesce(is_admin,false) is false and coalesce(is_persona,false) is false limit 1;
  if has_function_privilege('anon','public.recommendation_lab_worker(text,uuid,jsonb)','EXECUTE')
    or has_function_privilege('authenticated','public.recommendation_lab_worker(text,uuid,jsonb)','EXECUTE')
    or not has_function_privilege('service_role','public.recommendation_lab_worker(text,uuid,jsonb)','EXECUTE') then
    raise exception 'Worker privileges too broad/narrow';
  end if;
  execute 'set local role service_role';
  begin
    perform public.recommendation_lab_worker('state',member);
    raise exception 'Member accepted' using errcode='XX000';
  exception when insufficient_privilege then null; end;
  begin
    perform public.recommendation_lab_worker('state',gen_random_uuid());
    raise exception 'Forged actor accepted' using errcode='XX000';
  exception when insufficient_privilege then null; end;
  token:=public.recommendation_lab_worker('claim',actor)->>'token';
  begin
    perform public.recommendation_lab_worker('claim',actor);
    raise exception 'Concurrent claim accepted' using errcode='XX000';
  exception when lock_not_available then null; end;
  begin
    perform public.recommendation_lab_worker('release',actor,'{"token":"wrong"}');
    raise exception 'Wrong lease accepted' using errcode='XX000';
  exception when raise_exception then null; end;
  perform public.recommendation_lab_worker('catalog',actor,'{"titles":["Station Eleven"]}');
  perform public.recommendation_lab_worker('context',actor);
  w:=public.recommendation_lab_worker('save_item',actor,jsonb_build_object(
    'external_source','tmdb','external_id','rollback-checkpoint-only','media_type','movie','title','Rollback fixture',
    'source_verified',true,'destination_path','/media/movie/tmdb/rollback-checkpoint-only',
    'source_metadata','{}'::jsonb,'verification','{"source_key":"fixture"}'::jsonb));
  w:=public.recommendation_lab_worker('save_item',actor,w||jsonb_build_object(
    'status','embedded','embedding_model','text-embedding-3-small','embedding_dimensions',256,
    'embedding_input_hash',repeat('b',64),'appeal_embedding',to_jsonb(array_fill(0.5,array[256]))));
  if w->>'status'<>'embedded' then raise exception 'Vector item did not persist'; end if;
  r:=public.recommendation_lab_worker('save_run',actor,jsonb_build_object(
    'sourceKey','fixture','label','Rollback only','source_item_id',w->>'id',
    'results',jsonb_build_object('current',jsonb_build_array(jsonb_build_object('item',w)),'structured','[]'::jsonb,'semantic','[]'::jsonb)));
  perform public.recommendation_lab_worker('evaluate',actor,jsonb_build_object('runId',r->>'id','variant','current',
    'candidateId',w->>'id','verdict','Fine','reasons','["weak connection"]'::jsonb,'note','Rollback-only feedback'));
  perform public.recommendation_lab_worker('evaluate',actor,jsonb_build_object('runId',r->>'id','variant','current',
    'candidateId',w->>'id','verdict','Great','reasons','["surprising/great connection"]'::jsonb,'note','Replaces one attribution key'));
  state:=public.recommendation_lab_worker('state',actor);
  if state->'runs'->0->'evaluations'->('current:'||(w->>'id')||':'||actor::text)->>'verdict'<>'Great' then raise exception 'Feedback did not persist'; end if;
  begin
    perform public.recommendation_lab_worker('evaluate',actor,jsonb_build_object('runId',r->>'id','variant','structured',
      'candidateId',w->>'id','verdict','Bad','reasons','[]'::jsonb,'note',''));
    raise exception 'Foreign candidate feedback accepted' using errcode='XX000';
  exception when raise_exception then null; end;
  begin
    perform public.recommendation_lab_worker('evaluate',actor,jsonb_build_object('runId',r->>'id','variant','current',
      'candidateId',w->>'id','verdict','Fine','reasons','["invented reason"]'::jsonb,'note',''));
    raise exception 'Invalid reason accepted' using errcode='XX000';
  exception when raise_exception then null; end;
  -- Freeze snapshots: attempting to save again must not overwrite results.
  state:=public.recommendation_lab_worker('save_run',actor,jsonb_build_object(
    'sourceKey','fixture','label','Replacement','source_item_id',w->>'id','results','{}'::jsonb));
  if state->'results'<>r->'results' then raise exception 'Comparison snapshot mutated'; end if;
  perform public.recommendation_lab_worker('reserve',actor,'{"token":"test-usage","amount":0.01,"kind":"profile"}');
  perform public.recommendation_lab_worker('settle',actor,'{"token":"test-usage","actual":0.005,"usage":{"total_tokens":25}}');
  begin
    perform public.recommendation_lab_worker('settle',actor,'{"token":"test-usage","actual":0}');
    raise exception 'Duplicate settlement accepted' using errcode='XX000';
  exception when raise_exception then null; end;
  for i in 1..37 loop
    perform public.recommendation_lab_worker('reserve',actor,jsonb_build_object('token','budget-'||i,'amount',0.02,'kind','profile'));
  end loop;
  begin
    perform public.recommendation_lab_worker('reserve',actor,'{"token":"over-cap","amount":0.01,"kind":"profile"}');
    raise exception 'Checkpoint budget cap exceeded' using errcode='XX000';
  exception when program_limit_exceeded then null; end;
  perform public.recommendation_lab_worker('release',actor,jsonb_build_object('token',token,'progress','{"test":true}'::jsonb));
  -- Browser roles cannot bypass HTTP validation by calling the privileged RPC.
  execute 'set local role authenticated';
  begin
    perform public.recommendation_lab_worker('state',actor);
    raise exception 'Browser can call service worker' using errcode='XX000';
  exception when insufficient_privilege then null; end;
  execute 'set local role anon';
  begin
    perform public.recommendation_lab_worker('state',actor);
    raise exception 'Anonymous can call service worker' using errcode='XX000';
  exception when insufficient_privilege then null; end;
  execute 'reset role';
end;
$test$;
