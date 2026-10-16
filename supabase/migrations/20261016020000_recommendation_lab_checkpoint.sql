-- Checkpoint worker. Only the two lab tables are writable. No production DDL.
create function public.recommendation_lab_worker(p_action text,p_actor uuid,p_payload jsonb default '{}'::jsonb)
returns jsonb language plpgsql security definer set search_path=pg_catalog
as $$
declare
  ledger public.recommendation_lab_runs;
  item public.recommendation_lab_items;
  run public.recommendation_lab_runs;
  token text;
  reserved numeric;
  actual numeric;
  totals numeric;
  result jsonb;
  k text;
begin
  if not exists(select 1 from public.users where id=p_actor and is_admin is true and coalesce(is_persona,false) is false) then
    raise exception 'Human admin required' using errcode='42501';
  end if;
  if jsonb_typeof(p_payload) <> 'object' or octet_length(p_payload::text)>3000000 then
    raise exception 'Invalid payload' using errcode='22023';
  end if;
  -- One checkpoint-wide lock serializes budget, leases, item limits and feedback.
  perform pg_advisory_xact_lock(hashtextextended('recommendation-lab-small-lab-1',0));
  select * into ledger from public.recommendation_lab_runs
    where experiment_key='small-lab-1' and label='Checkpoint ledger' order by created_at limit 1 for update;
  if ledger.id is null and p_action <> 'state' then
    insert into public.recommendation_lab_runs(experiment_key,label,created_by,configuration)
      values('small-lab-1','Checkpoint ledger',p_actor,'{"cap_usd":0.75,"max_items":48,"ranking_version":"frozen-1","llm_reranking":false}')
      returning * into ledger;
  end if;
  if p_action in ('state','dataset') then
    return jsonb_build_object(
      'items',coalesce((select jsonb_agg(
        case when p_action='state' then to_jsonb(i)-array['appeal_embedding','tone_style_embedding','subject_theme_embedding'] else to_jsonb(i) end
        order by i.created_at,i.id)
        from public.recommendation_lab_items i where i.verification->>'checkpoint'='small-lab-1'),'[]'),
      'runs',coalesce((select jsonb_agg(to_jsonb(r) order by created_at desc,id)
        from public.recommendation_lab_runs r where experiment_key='small-lab-1' and label<>'Checkpoint ledger'),'[]'),
      'ledger',jsonb_build_object('id',ledger.id,'status',coalesce(ledger.status,'draft'),
        'spent',coalesce(ledger.model_spent_usd,0),'reserved',coalesce(ledger.model_reserved_usd,0),
        'cap',0.75,'max_items',48,'prepared',(select count(*) from public.recommendation_lab_items where verification->>'checkpoint'='small-lab-1'),
        'progress',coalesce(ledger.progress,'{}'))
    );
  elsif p_action='catalog' then
    -- Exact-title seed lookup only; no search/resolution/enrichment function calls.
    if jsonb_array_length(coalesce(p_payload->'titles','[]'))>40 then raise exception 'Too many titles'; end if;
    return coalesce((select jsonb_agg(to_jsonb(x)) from (
      select f.external_source,f.external_id,f.media_type,f.source_metadata,
        f.canonical_media_id as existing_canonical_id,
        c.story_key,c.open_library_work_id,c.isbn_identifier
      from public.media_fingerprints f left join public.canonical_media c on c.id=f.canonical_media_id
      where f.status='ready' and f.fingerprint->>'source_verified'='true'
        and lower(f.source_metadata->>'title') in (select lower(value) from jsonb_array_elements_text(p_payload->'titles'))
        and f.external_source in ('tmdb','googlebooks','openlibrary','open_library','itunes','spotify','youtube','rawg')
      order by f.external_source,f.external_id limit 120
    ) x),'[]');
  elsif p_action='context' then
    return jsonb_build_object(
      'dna',(select jsonb_build_object('profile_text',left(profile_text,10000),'favorite_media_types',favorite_media_types,'favorite_genres',favorite_genres)
        from public.dna_profiles where user_id=p_actor limit 1),
      'recent',coalesce((select jsonb_agg(to_jsonb(x)) from (select title,creator,media_type from public.list_items where user_id=p_actor order by created_at desc limit 10)x),'[]'));
  elsif p_action='claim' then
    if coalesce((ledger.progress->>'lease_until')::timestamptz,'epoch')>now() then
      raise exception 'Another lab step is running' using errcode='55P03';
    end if;
    token:=gen_random_uuid()::text;
    update public.recommendation_lab_runs set status='preparing',
      progress=progress||jsonb_build_object('lease_token',token,'lease_until',now()+interval '4 minutes'),
      updated_at=now() where id=ledger.id;
    return jsonb_build_object('token',token);
  elsif p_action='release' then
    if ledger.progress->>'lease_token' is distinct from p_payload->>'token' or p_payload->>'token' is null then raise exception 'Lease mismatch'; end if;
    update public.recommendation_lab_runs set progress=(progress-array['lease_token','lease_until'])||coalesce(p_payload->'progress','{}'),
      status=case when p_payload->>'complete'='true' then 'complete' else 'paused' end,
      updated_at=now() where id=ledger.id;
    return '{}'::jsonb;
  elsif p_action='reserve' then
    token:=p_payload->>'token'; reserved:=(p_payload->>'amount')::numeric;
    if token is null or char_length(token)>100 or reserved<=0 or reserved>0.02 then raise exception 'Invalid reservation'; end if;
    if ledger.diagnostics->'calls' ? token then raise exception 'Duplicate reservation'; end if;
    if ledger.model_spent_usd+ledger.model_reserved_usd+reserved>0.75 then
      raise exception 'Checkpoint model-spend cap reached' using errcode='54000';
    end if;
    update public.recommendation_lab_runs set
      diagnostics=jsonb_set(diagnostics,'{calls}',coalesce(diagnostics->'calls','{}')||jsonb_build_object(token,jsonb_build_object('reserved',reserved,'kind',p_payload->>'kind','state','reserved')),true),
      model_reserved_usd=model_reserved_usd+reserved,updated_at=now() where id=ledger.id;
    return '{}'::jsonb;
  elsif p_action='settle' then
    token:=p_payload->>'token'; actual:=(p_payload->>'actual')::numeric;
    if ledger.diagnostics->'calls'->token->>'state' is distinct from 'reserved' then raise exception 'Unknown/already settled reservation'; end if;
    reserved:=(ledger.diagnostics->'calls'->token->>'reserved')::numeric;
    if actual<0 or actual>reserved then raise exception 'Actual usage exceeds reservation'; end if;
    update public.recommendation_lab_runs set model_reserved_usd=model_reserved_usd-reserved,
      model_spent_usd=model_spent_usd+actual,
      diagnostics=jsonb_set(diagnostics,array['calls',token],
        (diagnostics->'calls'->token)||jsonb_build_object('actual',actual,'usage',coalesce(p_payload->'usage','{}'),'state','settled'),true),
      updated_at=now() where id=ledger.id;
    return '{}'::jsonb;
  elsif p_action='save_item' then
    if not coalesce((p_payload->>'source_verified')::boolean,false)
      or p_payload->>'external_source' not in ('tmdb','googlebooks','openlibrary','open_library','itunes','spotify')
      or p_payload->>'destination_path' is null then raise exception 'Verified supported provider required'; end if;
    select * into item from public.recommendation_lab_items
      where external_source=p_payload->>'external_source' and external_id=p_payload->>'external_id' and profile_version=1;
    if item.id is null and (select count(*) from public.recommendation_lab_items where verification->>'checkpoint'='small-lab-1')>=48 then
      raise exception 'Bounded item limit reached' using errcode='54000';
    end if;
    insert into public.recommendation_lab_items(external_source,external_id,media_type,title,existing_canonical_id,
      source_verified,destination_path,source_metadata,verification,profile,profile_evidence,
      embedding_model,embedding_dimensions,embedding_input_hash,appeal_embedding,tone_style_embedding,subject_theme_embedding,status,created_by)
    values(p_payload->>'external_source',p_payload->>'external_id',p_payload->>'media_type',p_payload->>'title',
      nullif(p_payload->>'existing_canonical_id','')::uuid,true,p_payload->>'destination_path',p_payload->'source_metadata',
      coalesce(p_payload->'verification','{}')||'{"checkpoint":"small-lab-1"}',coalesce(p_payload->'profile','{}'),coalesce(p_payload->'profile_evidence','{}'),
      p_payload->>'embedding_model',(p_payload->>'embedding_dimensions')::integer,p_payload->>'embedding_input_hash',
      (p_payload->>'appeal_embedding')::extensions.vector,(p_payload->>'tone_style_embedding')::extensions.vector,
      (p_payload->>'subject_theme_embedding')::extensions.vector,coalesce(p_payload->>'status','verified'),p_actor)
    on conflict(external_source,external_id,profile_version) do update set
      profile=excluded.profile,profile_evidence=excluded.profile_evidence,
      appeal_embedding=excluded.appeal_embedding,tone_style_embedding=excluded.tone_style_embedding,
      subject_theme_embedding=excluded.subject_theme_embedding,embedding_model=excluded.embedding_model,
      embedding_dimensions=excluded.embedding_dimensions,embedding_input_hash=excluded.embedding_input_hash,
      verification=excluded.verification,source_metadata=excluded.source_metadata,status=excluded.status,updated_at=now()
    returning * into item;
    return to_jsonb(item);
  elsif p_action='save_run' then
    if p_payload->>'sourceKey' is null or jsonb_typeof(p_payload->'results')<>'object' then raise exception 'Invalid comparison'; end if;
    select * into run from public.recommendation_lab_runs where experiment_key='small-lab-1'
      and configuration->>'sourceKey'=p_payload->>'sourceKey' and created_by=p_actor limit 1;
    if run.id is not null then return to_jsonb(run); end if;
    insert into public.recommendation_lab_runs(experiment_key,label,source_item_id,status,configuration,results,diagnostics,created_by)
      values('small-lab-1',p_payload->>'label',(p_payload->>'source_item_id')::uuid,'complete',
        jsonb_build_object('sourceKey',p_payload->>'sourceKey','ranking_version','frozen-1','llm_reranking',false),
        p_payload->'results',coalesce(p_payload->'diagnostics','{}'),p_actor)
      returning * into run;
    return to_jsonb(run);
  elsif p_action='evaluate' then
    select * into strict run from public.recommendation_lab_runs
      where id=(p_payload->>'runId')::uuid and experiment_key='small-lab-1' and label<>'Checkpoint ledger' for update;
    if p_payload->>'variant' not in ('current','structured','semantic')
      or p_payload->>'verdict' not in ('Great','Fine','Bad')
      or char_length(coalesce(p_payload->>'note',''))>500
      or jsonb_typeof(p_payload->'reasons')<>'array'
      or jsonb_array_length(p_payload->'reasons')>6 then raise exception 'Invalid evaluation'; end if;
    if exists(select 1 from jsonb_array_elements_text(p_payload->'reasons') r
      where r not in ('same subject, wrong experience','weak connection','good but obvious','surprising/great connection','identity/data problem','already know this')) then
      raise exception 'Invalid diagnostic reason';
    end if;
    if not exists(select 1 from jsonb_array_elements(run.results->(p_payload->>'variant')) c
      where c->'item'->>'id'=p_payload->>'candidateId') then raise exception 'Candidate not in frozen run'; end if;
    k:=(p_payload->>'variant')||':'||(p_payload->>'candidateId')||':'||p_actor::text;
    update public.recommendation_lab_runs set evaluations=jsonb_set(evaluations,array[k],
      jsonb_build_object('verdict',p_payload->>'verdict','reasons',p_payload->'reasons','note',coalesce(p_payload->>'note',''),
        'reviewer_id',p_actor,'updated_at',now()),true),updated_at=now() where id=run.id;
    return jsonb_build_object('saved',true,'key',k);
  end if;
  raise exception 'Unsupported lab action' using errcode='22023';
end;
$$;
revoke all on function public.recommendation_lab_worker(text,uuid,jsonb) from public,anon,authenticated,service_role;
grant execute on function public.recommendation_lab_worker(text,uuid,jsonb) to service_role;
