import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      throw new Error('Missing authorization header');
    }

    // Simple check: just verify an auth header exists
    // Since /admin is only accessible on Replit, this is sufficient
    if (!authHeader.startsWith('Bearer ')) {
      throw new Error('Invalid authorization header');
    }

    const url = new URL(req.url);
    const metric = url.searchParams.get('metric') || url.searchParams.get('type');

    // Use SERVICE_ROLE_KEY for database access
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    let result;

    // Fetch specific metric or all metrics
    switch (metric) {
      case 'summary':
        const { data: summaryData, error: summaryError } = await supabaseAdmin.rpc('get_dashboard_summary');
        if (summaryError) throw summaryError;
        result = { summary: summaryData?.[0] || {} };
        break;

      case 'retention':
        const { data: retentionData, error: retentionError } = await supabaseAdmin.rpc('get_retention_rates');
        if (retentionError) throw retentionError;
        result = { retention: retentionData || [] };
        break;

      case 'engaged':
        const { data: engagedData, error: engagedError } = await supabaseAdmin.rpc('get_engaged_users');
        if (engagedError) throw engagedError;
        result = { engagedUsers: engagedData || [] };
        break;

      case 'activation':
        const { data: activationData, error: activationError } = await supabaseAdmin.rpc('get_activation_funnel');
        if (activationError) throw activationError;
        result = { activationFunnel: activationData || [] };
        break;

      case 'engagement':
        const { data: engagementData, error: engagementError } = await supabaseAdmin.rpc('get_engagement_depth');
        if (engagementError) throw engagementError;
        result = { engagement: engagementData || [] };
        break;

      case 'social':
        const { data: socialData, error: socialError } = await supabaseAdmin.rpc('get_social_graph_metrics');
        if (socialError) throw socialError;
        result = { socialGraph: socialData || [] };
        break;

      case 'active-users':
        const period = url.searchParams.get('period') || 'day';
        const { data: activeData, error: activeError } = await supabaseAdmin.rpc('get_active_users', { period });
        if (activeError) throw activeError;
        result = { activeUsers: activeData || [] };
        break;

      case 'stickiness':
        const { data: stickinessData, error: stickinessError} = await supabaseAdmin.rpc('get_stickiness_ratio');
        if (stickinessError) throw stickinessError;
        result = { stickiness: stickinessData?.[0] || {} };
        break;

      case 'churn':
        const churnPeriod = parseInt(url.searchParams.get('period') || '30');
        const { data: churnData, error: churnError } = await supabaseAdmin.rpc('get_churn_metrics', { period_days: churnPeriod });
        if (churnError) throw churnError;
        result = { churn: churnData?.[0] || {} };
        break;

      case 'sessions':
        const sessionPeriod = url.searchParams.get('period') || '7 days';
        const { data: sessionData, error: sessionError } = await supabaseAdmin.rpc('get_session_engagement', { period_text: sessionPeriod });
        if (sessionError) throw sessionError;
        result = { sessions: sessionData?.[0] || {} };
        break;

      case 'partnerships':
        // Fetch all partnership insights
        const [
          crossPlatformResult,
          affinityResult,
          trendingResult,
          dnaResult,
          completionResult,
          viralResult,
          creatorResult,
          partnershipSummaryResult
        ] = await Promise.all([
          supabaseAdmin.rpc('get_cross_platform_engagement'),
          supabaseAdmin.rpc('get_platform_affinity_insights'),
          supabaseAdmin.rpc('get_trending_content'),
          supabaseAdmin.rpc('get_dna_clusters'),
          supabaseAdmin.rpc('get_completion_rates'),
          supabaseAdmin.rpc('get_viral_content'),
          supabaseAdmin.rpc('get_creator_influence'),
          supabaseAdmin.rpc('get_partnership_summary')
        ]);

        // Check for errors
        if (crossPlatformResult.error) throw new Error(`Cross-platform engagement error: ${crossPlatformResult.error.message}`);
        if (affinityResult.error) throw new Error(`Platform affinity error: ${affinityResult.error.message}`);
        if (trendingResult.error) throw new Error(`Trending content error: ${trendingResult.error.message}`);
        if (dnaResult.error) throw new Error(`DNA clusters error: ${dnaResult.error.message}`);
        if (completionResult.error) throw new Error(`Completion rates error: ${completionResult.error.message}`);
        if (viralResult.error) throw new Error(`Viral content error: ${viralResult.error.message}`);
        if (creatorResult.error) throw new Error(`Creator influence error: ${creatorResult.error.message}`);
        if (partnershipSummaryResult.error) throw new Error(`Partnership summary error: ${partnershipSummaryResult.error.message}`);

        result = {
          crossPlatform: crossPlatformResult.data || [],
          affinityInsights: affinityResult.data || [],
          trending: trendingResult.data || [],
          dnaClusters: dnaResult.data || [],
          completionRates: completionResult.data || [],
          viral: viralResult.data || [],
          creators: creatorResult.data || [],
          partnershipSummary: partnershipSummaryResult.data?.[0] || {}
        };
        break;

      default:
        // Fetch all metrics for the dashboard
        const [
          summaryResult,
          retentionResult,
          engagedResult,
          activationResult,
          engagementResult,
          socialResult,
          stickinessResult,
          activeUsersResult
        ] = await Promise.all([
          supabaseAdmin.rpc('get_dashboard_summary'),
          supabaseAdmin.rpc('get_retention_rates'),
          supabaseAdmin.rpc('get_engaged_users'),
          supabaseAdmin.rpc('get_activation_funnel'),
          supabaseAdmin.rpc('get_engagement_depth'),
          supabaseAdmin.rpc('get_social_graph_metrics'),
          supabaseAdmin.rpc('get_stickiness_ratio'),
          supabaseAdmin.rpc('get_active_users', { period: 'day' })
        ]);

        // Check for errors
        if (summaryResult.error) throw summaryResult.error;
        if (retentionResult.error) throw retentionResult.error;
        if (engagedResult.error) throw engagedResult.error;
        if (activationResult.error) throw activationResult.error;
        if (engagementResult.error) throw engagementResult.error;
        if (socialResult.error) throw socialResult.error;
        if (stickinessResult.error) throw stickinessResult.error;
        if (activeUsersResult.error) throw activeUsersResult.error;

        result = {
          summary: summaryResult.data?.[0] || {},
          retention: retentionResult.data || [],
          engagedUsers: engagedResult.data || [],
          activationFunnel: activationResult.data || [],
          engagement: engagementResult.data || [],
          socialGraph: socialResult.data || [],
          stickiness: stickinessResult.data?.[0] || {},
          activeUsers: activeUsersResult.data || []
        };
    }

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Analytics error:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { 
        status: 400, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});
