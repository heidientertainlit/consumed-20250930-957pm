-- This is a read-only role/ACL regression test.  The transaction is
-- intentionally rolled back so no production rows or account fixtures can be
-- changed by running it.
begin;

do $$
declare
  target record;
  function_oid oid;
begin
  for target in
    select *
    from (values
      ('get_dashboard_summary', ''),
      ('get_retention_rates', ''),
      ('get_engaged_users', ''),
      ('get_activation_funnel', ''),
      ('get_engagement_depth', ''),
      ('get_social_graph_metrics', ''),
      ('get_active_users', 'period text'),
      ('get_stickiness_ratio', ''),
      ('get_churn_metrics', 'period_days integer'),
      ('get_session_engagement', 'period_text text'),
      ('get_session_frequency', 'period_days integer'),
      ('get_points_analytics', ''),
      ('get_lists_analytics', ''),
      ('get_cross_platform_engagement', ''),
      ('get_trending_content', ''),
      ('get_dna_clusters', ''),
      ('get_completion_rates', ''),
      ('get_viral_content', ''),
      ('get_creator_influence', ''),
      ('get_partnership_summary', '')
    ) as expected(name, identity_args)
  loop
    select p.oid
      into function_oid
    from pg_catalog.pg_proc as p
    join pg_catalog.pg_namespace as n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname = target.name
      and pg_catalog.pg_get_function_identity_arguments(p.oid) = target.identity_args;

    if function_oid is null then
      raise exception 'expected reporting function %.% is missing', target.name, target.identity_args;
    end if;

    if pg_catalog.has_function_privilege('anon', function_oid, 'EXECUTE')
       or pg_catalog.has_function_privilege('authenticated', function_oid, 'EXECUTE') then
      raise exception 'reporting function %.% remains executable by anon/authenticated',
        target.name, target.identity_args;
    end if;

    if not pg_catalog.has_function_privilege('service_role', function_oid, 'EXECUTE') then
      raise exception 'service_role lost reporting function %.% execute privilege',
        target.name, target.identity_args;
    end if;
  end loop;
end;
$$;

rollback;