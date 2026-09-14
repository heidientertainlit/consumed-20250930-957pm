-- Reporting results contain aggregate product and member activity data.  These
-- functions are called only by the authenticated admin reporting functions,
-- which use a service-role database client after checking users.is_admin.
--
-- Keep the exact overload signatures here: an unqualified function name would
-- not revoke every overload in PostgreSQL and could leave an alternate public
-- entry point executable.
revoke execute on function public.get_dashboard_summary()
  from public, anon, authenticated;
revoke execute on function public.get_retention_rates()
  from public, anon, authenticated;
revoke execute on function public.get_engaged_users()
  from public, anon, authenticated;
revoke execute on function public.get_activation_funnel()
  from public, anon, authenticated;
revoke execute on function public.get_engagement_depth()
  from public, anon, authenticated;
revoke execute on function public.get_social_graph_metrics()
  from public, anon, authenticated;
revoke execute on function public.get_active_users(text)
  from public, anon, authenticated;
revoke execute on function public.get_stickiness_ratio()
  from public, anon, authenticated;
revoke execute on function public.get_churn_metrics(integer)
  from public, anon, authenticated;
revoke execute on function public.get_session_engagement(text)
  from public, anon, authenticated;
revoke execute on function public.get_session_frequency(integer)
  from public, anon, authenticated;
revoke execute on function public.get_points_analytics()
  from public, anon, authenticated;
revoke execute on function public.get_lists_analytics()
  from public, anon, authenticated;
revoke execute on function public.get_cross_platform_engagement()
  from public, anon, authenticated;
revoke execute on function public.get_trending_content()
  from public, anon, authenticated;
revoke execute on function public.get_dna_clusters()
  from public, anon, authenticated;
revoke execute on function public.get_completion_rates()
  from public, anon, authenticated;
revoke execute on function public.get_viral_content()
  from public, anon, authenticated;
revoke execute on function public.get_creator_influence()
  from public, anon, authenticated;
revoke execute on function public.get_partnership_summary()
  from public, anon, authenticated;

-- The edge functions use the service-role client for these aggregate reads.
grant execute on function public.get_dashboard_summary() to service_role;
grant execute on function public.get_retention_rates() to service_role;
grant execute on function public.get_engaged_users() to service_role;
grant execute on function public.get_activation_funnel() to service_role;
grant execute on function public.get_engagement_depth() to service_role;
grant execute on function public.get_social_graph_metrics() to service_role;
grant execute on function public.get_active_users(text) to service_role;
grant execute on function public.get_stickiness_ratio() to service_role;
grant execute on function public.get_churn_metrics(integer) to service_role;
grant execute on function public.get_session_engagement(text) to service_role;
grant execute on function public.get_session_frequency(integer) to service_role;
grant execute on function public.get_points_analytics() to service_role;
grant execute on function public.get_lists_analytics() to service_role;
grant execute on function public.get_cross_platform_engagement() to service_role;
grant execute on function public.get_trending_content() to service_role;
grant execute on function public.get_dna_clusters() to service_role;
grant execute on function public.get_completion_rates() to service_role;
grant execute on function public.get_viral_content() to service_role;
grant execute on function public.get_creator_influence() to service_role;
grant execute on function public.get_partnership_summary() to service_role;

notify pgrst, 'reload schema';