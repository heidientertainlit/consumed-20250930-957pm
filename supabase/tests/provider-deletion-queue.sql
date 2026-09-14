-- Queue/control invariants only.  This test never calls a provider and always
-- rolls back.  Run against an isolated database after migration
-- 20260914000700_provider_deletion_queue.sql.
begin;

set local role service_role;

do $$
declare
  user_a constant uuid := '00000000-0000-4000-8000-00000000a901';
  posthog_job constant uuid := '00000000-0000-4000-8000-00000000a911';
  cio_job constant uuid := '00000000-0000-4000-8000-00000000a912';
  onesignal_job constant uuid := '00000000-0000-4000-8000-00000000a913';
  person_a constant text := '00000000-0000-4000-8000-00000000a921';
  rolling_users constant uuid[] := array[
    '00000000-0000-4000-8000-00000000b901'::uuid,
    '00000000-0000-4000-8000-00000000b902'::uuid,
    '00000000-0000-4000-8000-00000000b903'::uuid,
    '00000000-0000-4000-8000-00000000b904'::uuid,
    '00000000-0000-4000-8000-00000000b905'::uuid
  ];
  rolling_jobs constant uuid[] := array[
    '00000000-0000-4000-8000-00000000c901'::uuid,
    '00000000-0000-4000-8000-00000000c902'::uuid,
    '00000000-0000-4000-8000-00000000c903'::uuid,
    '00000000-0000-4000-8000-00000000c904'::uuid,
    '00000000-0000-4000-8000-00000000c905'::uuid
  ];
  boundary_job_ids constant uuid[] := array[
    '00000000-0000-4000-8000-00000000d901'::uuid,
    '00000000-0000-4000-8000-00000000d902'::uuid,
    '00000000-0000-4000-8000-00000000d903'::uuid,
    '00000000-0000-4000-8000-00000000d904'::uuid,
    '00000000-0000-4000-8000-00000000d905'::uuid
  ];
  boundary_lease_ids constant uuid[] := array[
    '00000000-0000-4000-8000-00000000e901'::uuid,
    '00000000-0000-4000-8000-00000000e902'::uuid,
    '00000000-0000-4000-8000-00000000e903'::uuid,
    '00000000-0000-4000-8000-00000000e904'::uuid,
    '00000000-0000-4000-8000-00000000e905'::uuid
  ];
  posthog_lease uuid;
  cio_lease uuid;
  onesignal_lease uuid;
  stale_lease uuid;
  reserved_now boolean;
  reserve_reason text;
  recorded boolean;
  claimed_count integer;
  duplicate_rejected boolean := false;
  mapping_rejected boolean := false;
  attempt_mutation_rejected boolean := false;
  result_reserved boolean;
  boundary_passed boolean := false;
  i integer;
begin
  insert into public.deleted_account_tombstones (user_id)
  values (user_a);

  insert into public.provider_deletion_jobs (
    job_id, deleted_user_id, provider, provider_identifier_kind,
    provider_identifier, state, mapping_state
  )
  values
    (posthog_job, user_a, 'posthog', 'posthog_person_uuid',
      null, 'mapping_pending', 'mapping_pending'),
    (cio_job, user_a, 'customer_io', 'customer_id',
      user_a::text, 'queued', 'not_required'),
    (onesignal_job, user_a, 'onesignal', 'external_id',
      user_a::text, 'queued', 'not_required');

  if (select count(*) from public.provider_deletion_jobs where deleted_user_id = user_a) <> 3 then
    raise exception 'expected one job per provider';
  end if;

  begin
    insert into public.provider_deletion_jobs (
      deleted_user_id, provider, provider_identifier_kind,
      provider_identifier, state, mapping_state
    )
    values (user_a, 'onesignal', 'external_id', user_a::text, 'queued', 'not_required');
  exception when unique_violation then
    duplicate_rejected := true;
  end;
  if not duplicate_rejected then
    raise exception 'duplicate provider job was accepted';
  end if;

  -- No unverified PostHog identifier may be introduced by an update.
  begin
    update public.provider_deletion_jobs
    set provider_identifier = person_a
    where job_id = posthog_job;
  exception when others then
    mapping_rejected := true;
  end;
  if not mapping_rejected then
    raise exception 'unverified PostHog mapping was accepted';
  end if;

  -- Exercise durable failure/completion states without making any provider
  -- request. Retryable 429 can be reclaimed; permanent 401 cannot.
  select count(*) into claimed_count
  from public.provider_deletion_claim_job(cio_job);
  if claimed_count <> 1 then
    raise exception 'expected one claimed Customer.io job';
  end if;
  select lease_token into cio_lease
  from public.provider_deletion_jobs where job_id = cio_job;
  stale_lease := cio_lease;
  select public.provider_deletion_record_job(
    cio_job, cio_lease, 'retryable_failure', 'not_required', 429, 'rate_limited',
    now() - interval '1 second', false
  ) into recorded;
  if not recorded then
    raise exception 'retryable failure was not recorded';
  end if;
  select count(*) into claimed_count
  from public.provider_deletion_claim_job(cio_job);
  if claimed_count <> 1 then
    raise exception 'retryable Customer.io job was not reclaimable';
  end if;
  select lease_token into cio_lease
  from public.provider_deletion_jobs where job_id = cio_job;
  if cio_lease = stale_lease then
    raise exception 'reclaim did not rotate lease token';
  end if;
  select public.provider_deletion_record_job(
    cio_job, cio_lease, 'permanent_failure', 'not_required', 401, 'provider_rejected',
    null, false
  ) into recorded;
  if not recorded then
    raise exception 'permanent failure was not recorded';
  end if;

  select count(*) into claimed_count
  from public.provider_deletion_claim_job(onesignal_job);
  if claimed_count <> 1 then
    raise exception 'expected one claimed OneSignal job';
  end if;
  select lease_token into onesignal_lease
  from public.provider_deletion_jobs where job_id = onesignal_job;
  select public.provider_deletion_record_job(
    onesignal_job, onesignal_lease, 'accepted_pending', 'not_required', 202,
    'provider_retention_unverified', now() - interval '1 second', true
  ) into recorded;
  if not recorded then
    raise exception 'accepted-pending state was not recorded';
  end if;
  select count(*) into claimed_count
  from public.provider_deletion_claim_job(onesignal_job);
  if claimed_count <> 1 then
    raise exception 'accepted-pending OneSignal job was not reclaimable';
  end if;
  select lease_token into onesignal_lease
  from public.provider_deletion_jobs where job_id = onesignal_job;
  select public.provider_deletion_record_job(
    onesignal_job, onesignal_lease, 'accepted_pending', 'not_required', 404,
    'readback_not_yet_conclusive', now() - interval '1 second', true, true
  ) into recorded;
  if not recorded then
    raise exception 'first absence readback was not recorded';
  end if;
  select count(*) into claimed_count
  from public.provider_deletion_claim_job(onesignal_job);
  if claimed_count <> 1 then
    raise exception 'first absence readback was not reclaimable';
  end if;
  select lease_token into onesignal_lease
  from public.provider_deletion_jobs where job_id = onesignal_job;
  select public.provider_deletion_record_job(
    onesignal_job, onesignal_lease, 'accepted_pending', 'not_required', 404,
    'readback_not_yet_conclusive', now() - interval '1 second', true, true
  ) into recorded;
  if not recorded then
    raise exception 'second absence readback was not recorded';
  end if;
  select count(*) into claimed_count
  from public.provider_deletion_claim_job(onesignal_job);
  if claimed_count <> 1 then
    raise exception 'second absence readback was not reclaimable';
  end if;
  select lease_token into onesignal_lease
  from public.provider_deletion_jobs where job_id = onesignal_job;
  select public.provider_deletion_record_job(
    onesignal_job, onesignal_lease, 'observed_absent', 'not_required', 404,
    'observed_absent', null, true, true
  ) into recorded;
  if not recorded then
    raise exception 'third absence readback did not become observed-absent';
  end if;

  select count(*) into claimed_count
  from public.provider_deletion_claim_job(posthog_job);
  if claimed_count <> 1 then
    raise exception 'expected one claimed PostHog job';
  end if;
  select lease_token into posthog_lease
  from public.provider_deletion_jobs where job_id = posthog_job;

  if public.provider_deletion_set_posthog_mapping(
    posthog_job, stale_lease, person_a
  ) then
    raise exception 'stale mapping lease was accepted';
  end if;
  if not public.provider_deletion_set_posthog_mapping(
    posthog_job, posthog_lease, person_a
  ) then
    raise exception 'exact PostHog mapping was not recorded';
  end if;

  begin
    perform public.provider_deletion_set_posthog_mapping(
      posthog_job, posthog_lease, '00000000-0000-4000-8000-00000000a922'
    );
    raise exception 'verified PostHog mapping was replaced';
  exception when others then
    null;
  end;

  -- Duplicate delivery cannot claim an already leased job.
  if exists (select 1 from public.provider_deletion_claim_job(posthog_job)) then
    raise exception 'duplicate delivery acquired an active lease';
  end if;

  -- Simulate worker A running past its lease while worker B reclaims the same
  -- job. Worker A's old token must not be able to write a result.
  update public.provider_deletion_jobs
  set lease_until = now() - interval '1 second'
  where job_id = posthog_job;
  select count(*) into claimed_count
  from public.provider_deletion_claim_job(posthog_job);
  if claimed_count <> 1 then
    raise exception 'expired lease was not reclaimable by worker B';
  end if;
  stale_lease := posthog_lease;
  select lease_token into posthog_lease
  from public.provider_deletion_jobs where job_id = posthog_job;
  if posthog_lease = stale_lease then
    raise exception 'reclaimed PostHog lease token did not rotate';
  end if;
  if public.provider_deletion_record_job(
    posthog_job, stale_lease, 'retryable_failure', 'verified', 503,
    'provider_5xx', now(), false
  ) then
    raise exception 'stale worker result crossed lease CAS';
  end if;

  update public.provider_control_ledger
  set provider_enabled = true, kill_switch = false, circuit_open = false
  where control_key = 'provider:posthog';
  update public.provider_control_ledger
  set provider_enabled = true, kill_switch = false, circuit_open = false
  where control_key = 'provider:customer_io';

  update public.provider_control_ledger
  set kill_switch = true
  where control_key = 'global';

  if public.provider_deletion_before_dispatch(posthog_job, posthog_lease, false) then
    raise exception 'kill switch did not block pre-dispatch guard';
  end if;
  select reserved, reason
  into reserved_now, reserve_reason
  from public.provider_deletion_reserve_attempt(posthog_job, posthog_lease, false);
  if reserved_now or reserve_reason <> 'kill_switch' then
    raise exception 'kill switch did not block destructive reservation';
  end if;

  update public.provider_control_ledger
  set kill_switch = false
  where control_key = 'global';

  if public.provider_deletion_real_mode_approved() then
    raise exception 'real cleanup approval was enabled by default';
  end if;
  select reserved, reason
  into reserved_now, reserve_reason
  from public.provider_deletion_reserve_attempt(posthog_job, posthog_lease, true);
  if reserved_now or reserve_reason <> 'real_cleanup_not_approved' then
    raise exception 'database real-approval gate did not block real mode';
  end if;

  -- Boundary fixture: five requests arrived 59 minutes ago, just before an
  -- hour edge. A sixth current user must still be denied by the rolling
  -- timestamp window. The nested exception rolls this setup back.
  begin
    for i in 1..5 loop
      insert into public.deleted_account_tombstones (user_id)
      values (rolling_users[i]);
      insert into public.provider_deletion_jobs (
        job_id, deleted_user_id, provider, provider_identifier_kind,
        provider_identifier, state, mapping_state, lease_token, lease_until
      )
      values (
        boundary_job_ids[i], rolling_users[i], 'posthog', 'posthog_person_uuid',
        rolling_users[i]::text, 'in_flight', 'verified', boundary_lease_ids[i],
        now() + interval '2 minutes'
      );
      insert into public.provider_deletion_attempts (
        job_id, lease_token, deleted_user_id, provider,
        reserved_at
      )
      values (
        boundary_job_ids[i], boundary_lease_ids[i], rolling_users[i],
        'posthog', now() - interval '59 minutes'
      );
    end loop;
    select reserved, reason
    into reserved_now, reserve_reason
    from public.provider_deletion_reserve_attempt(posthog_job, posthog_lease, false);
    if reserved_now or reserve_reason <> 'global_account_limit' then
      raise exception 'rolling 59-minute boundary undercounted the sixth user';
    end if;
    boundary_passed := true;
    raise exception 'rollback rolling boundary fixture';
  exception when others then
    if sqlerrm <> 'rollback rolling boundary fixture' then
      raise;
    end if;
  end;
  if not boundary_passed then
    raise exception 'rolling boundary fixture did not execute';
  end if;

  -- Rolling limits: A plus four distinct users are admitted, while the
  -- sixth distinct user is denied.
  update public.provider_control_ledger
  set circuit_open = false
  where control_key in ('global', 'provider:customer_io');
  select reserved into result_reserved
  from public.provider_deletion_reserve_attempt(posthog_job, posthog_lease, false);
  if not result_reserved then
    raise exception 'initial rolling reservation for A failed';
  end if;
  if (select count(*) from public.provider_deletion_attempts
      where job_id = posthog_job) <> 1 then
    raise exception 'reservation did not append exactly one attempt';
  end if;
  select reserved, reason
  into reserved_now, reserve_reason
  from public.provider_deletion_reserve_attempt(posthog_job, posthog_lease, false);
  if not reserved_now or reserve_reason <> 'already_reserved' then
    raise exception 'same lease was counted more than once';
  end if;
  begin
    update public.provider_deletion_attempts
    set reserved_at = now()
    where job_id = posthog_job;
  exception when others then
    attempt_mutation_rejected := true;
  end;
  if not attempt_mutation_rejected then
    raise exception 'append-only attempt ledger accepted an update';
  end if;

  for i in 1..5 loop
    insert into public.deleted_account_tombstones (user_id)
    values (rolling_users[i]);
    insert into public.provider_deletion_jobs (
      job_id, deleted_user_id, provider, provider_identifier_kind,
      provider_identifier, state, mapping_state
    )
    values (
      rolling_jobs[i], rolling_users[i], 'customer_io', 'customer_id',
      rolling_users[i]::text, 'queued', 'not_required'
    );
    select count(*) into claimed_count
    from public.provider_deletion_claim_job(rolling_jobs[i]);
    if claimed_count <> 1 then
      raise exception 'rolling user % was not claimed', i;
    end if;
    select lease_token into cio_lease
    from public.provider_deletion_jobs where job_id = rolling_jobs[i];
    select reserved into result_reserved
    from public.provider_deletion_reserve_attempt(
      rolling_jobs[i], cio_lease, false
    );
    if i < 5 and not result_reserved then
      raise exception 'rolling user % was unexpectedly blocked', i;
    end if;
    if i = 5 and (
      result_reserved
      or not exists (
        select 1
        from public.provider_control_ledger
        where control_key = 'global' and circuit_open
      )
    ) then
      raise exception 'sixth distinct rolling user was not denied';
    end if;
  end loop;

  -- Reset only the manual circuit. All five successful reservations remain in
  -- the append-only ledger and continue counting toward the request limit.
  update public.provider_control_ledger
  set circuit_open = false
  where control_key = 'global';
  for i in 1..10 loop
    update public.provider_deletion_jobs
    set lease_until = now() - interval '1 second'
    where job_id = posthog_job;
    select count(*) into claimed_count
    from public.provider_deletion_claim_job(posthog_job);
    if claimed_count <> 1 then
      raise exception 'retry lease % was not claimed', i;
    end if;
    select lease_token into posthog_lease
    from public.provider_deletion_jobs where job_id = posthog_job;
    select reserved into result_reserved
    from public.provider_deletion_reserve_attempt(
      posthog_job, posthog_lease, false
    );
    if not result_reserved then
      raise exception 'retry reservation % unexpectedly blocked', i;
    end if;
  end loop;

  update public.provider_deletion_jobs
  set lease_until = now() - interval '1 second'
  where job_id = posthog_job;
  select count(*) into claimed_count
  from public.provider_deletion_claim_job(posthog_job);
  if claimed_count <> 1 then
    raise exception 'sixteenth request lease was not claimed';
  end if;
  select lease_token into posthog_lease
  from public.provider_deletion_jobs where job_id = posthog_job;
  select reserved into result_reserved
  from public.provider_deletion_reserve_attempt(posthog_job, posthog_lease, false);
  if result_reserved then
    raise exception 'sixteenth rolling request was not denied';
  end if;
end;
$$;

select 'PASS: queue targets, immutable mapping, duplicate claims, kill switch, and shared request circuit are fail-closed' as result;

rollback;