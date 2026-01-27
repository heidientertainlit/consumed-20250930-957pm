import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/lib/auth';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { LineChart, Line, BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { TrendingUp, Users, Activity, Target, Zap, Heart, Eye, MousePointer, Shield, AlertTriangle, CheckCircle, XCircle, Ban, Flag } from 'lucide-react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';

interface DashboardSummary {
  total_users: number;
  dau: number;
  wau: number;
  mau: number;
  stickiness_ratio: number;
  engagement_rate: number;
  total_media_tracked: number;
  total_posts: number;
  total_games_played: number;
  avg_actions_per_user: number;
}

interface ChurnData {
  churn_period: string;
  total_users: number;
  active_users: number;
  at_risk_users: number;
  churned_users: number;
  churn_rate: number;
  at_risk_rate: number;
}

interface SessionData {
  time_period: string;
  total_sessions: number;
  total_users: number;
  avg_session_duration_minutes: number;
  median_session_duration_minutes: number;
  total_time_spent_hours: number;
  avg_sessions_per_user: number;
  avg_daily_time_per_user_minutes: number;
}

interface BehaviorData {
  pageTime: Array<{
    page: string;
    avgDuration: number;
    visits: number;
    avgScrollDepth: number;
  }>;
  eventCounts: Array<{
    event: string;
    count: number;
  }>;
  sessionStats: {
    totalSessions: number;
    avgSessionDuration: number;
    sessionsWithHeartbeat: number;
  };
}

interface AnalyticsData {
  summary: DashboardSummary;
  retention: Array<{
    cohort_date: string;
    total_users: number;
    day_1_rate: number;
    day_7_rate: number;
    day_30_rate: number;
  }>;
  engagedUsers: Array<{
    week_start: string;
    total_weekly_users: number;
    engaged_users: number;
    engagement_rate: number;
  }>;
  activationFunnel: Array<{
    step: string;
    users_completed: number;
    completion_rate: number;
  }>;
  engagement: Array<{
    metric: string;
    value: number;
  }>;
  socialGraph: Array<{
    metric: string;
    value: number;
  }>;
  activeUsers: Array<{
    period_date: string;
    active_users: number;
  }>;
}

interface PartnershipData {
  crossPlatform: Array<{
    primary_media_type: string;
    secondary_media_type: string;
    overlap_users: number;
    overlap_percentage: number;
  }>;
  affinityInsights: Array<{
    source_name: string;
    source_type: string;
    source_category: string;
    target_title: string;
    target_creator: string;
    target_type: string;
    affinity_count: number;
    affinity_percentage: number;
    insight_text: string;
  }>;
  trending: Array<{
    media_type: string;
    title: string;
    creator: string;
    adds_count: number;
    posts_count: number;
    total_engagement: number;
  }>;
  dnaClusters: Array<{
    cluster_label: string;
    user_count: number;
    top_genres: string[];
    top_media_types: string[];
    avg_items_tracked: number;
  }>;
  completionRates: Array<{
    media_type: string;
    total_items: number;
    avg_progress: number;
    items_completed: number;
    completion_rate: number;
  }>;
  viral: Array<{
    media_type: string;
    title: string;
    posts_count: number;
    likes_count: number;
    comments_count: number;
    virality_score: number;
  }>;
  creators: Array<{
    creator_name: string;
    creator_role: string;
    followers_count: number;
    media_tracked: number;
    social_posts: number;
    influence_score: number;
  }>;
  partnershipSummary: {
    total_content_tracked: number;
    total_social_posts: number;
    avg_completion_rate: number;
    top_trending_title: string;
    top_trending_engagement: number;
    most_viral_title: string;
    most_viral_score: number;
  };
}

const COLORS = ['#9333ea', '#a855f7', '#c084fc', '#d8b4fe', '#e9d5ff'];

export default function AdminDashboard() {
  const { session } = useAuth();

  const { data: analytics, isLoading, error } = useQuery<AnalyticsData>({
    queryKey: ['admin-analytics'],
    enabled: !!session,
    queryFn: async () => {
      console.log('[ANALYTICS] Fetching with token:', session?.access_token?.substring(0, 20) + '...');
      
      const response = await fetch(
        `https://mahpgcogwpawvviapqza.supabase.co/functions/v1/get-analytics`,
        {
          headers: {
            'Authorization': `Bearer ${session?.access_token}`,
          },
        }
      );

      console.log('[ANALYTICS] Response status:', response.status);
      
      if (!response.ok) {
        const errorData = await response.json();
        console.error('[ANALYTICS] Error:', errorData);
        throw new Error(`Failed to fetch analytics: ${JSON.stringify(errorData)}`);
      }

      const data = await response.json();
      console.log('[ANALYTICS] Data received:', data);
      return data;
    },
    refetchInterval: 60000, // Refresh every minute
  });

  const { data: partnerships, isLoading: partnershipsLoading, error: partnershipsError } = useQuery<PartnershipData>({
    queryKey: ['admin-partnerships'],
    enabled: !!session,
    queryFn: async () => {
      console.log('[PARTNERSHIPS] Fetching partnership insights...');
      const response = await fetch(
        `https://mahpgcogwpawvviapqza.supabase.co/functions/v1/get-analytics?type=partnerships`,
        {
          headers: {
            'Authorization': `Bearer ${session?.access_token}`,
          },
        }
      );

      console.log('[PARTNERSHIPS] Response status:', response.status);

      if (!response.ok) {
        const errorData = await response.json();
        console.error('[PARTNERSHIPS] Error:', errorData);
        throw new Error(`Failed to fetch partnership insights: ${JSON.stringify(errorData)}`);
      }

      const data = await response.json();
      console.log('[PARTNERSHIPS] Data received:', data);
      return data;
    },
    refetchInterval: 60000,
  });

  // Churn metrics query
  const { data: churnData, isLoading: churnLoading } = useQuery<{ churn: ChurnData }>({
    queryKey: ['admin-churn', 30],
    enabled: !!session,
    queryFn: async () => {
      const response = await fetch(
        `https://mahpgcogwpawvviapqza.supabase.co/functions/v1/get-analytics?metric=churn&period=30`,
        {
          headers: {
            'Authorization': `Bearer ${session?.access_token}`,
          },
        }
      );
      if (!response.ok) throw new Error('Failed to fetch churn metrics');
      return await response.json();
    },
    refetchInterval: 60000,
  });

  // Session engagement query
  const { data: sessionData, isLoading: sessionLoading } = useQuery<{ sessions: SessionData }>({
    queryKey: ['admin-sessions', '7 days'],
    enabled: !!session,
    queryFn: async () => {
      const response = await fetch(
        `https://mahpgcogwpawvviapqza.supabase.co/functions/v1/get-analytics?metric=sessions&period=7 days`,
        {
          headers: {
            'Authorization': `Bearer ${session?.access_token}`,
          },
        }
      );
      if (!response.ok) throw new Error('Failed to fetch session metrics');
      return await response.json();
    },
    refetchInterval: 60000,
  });

  // Session frequency query
  const { data: frequencyData } = useQuery<{ sessionFrequency: { avg_sessions_per_user: number; total_sessions: number } }>({
    queryKey: ['admin-frequency', 7],
    enabled: !!session,
    queryFn: async () => {
      const response = await fetch(
        `https://mahpgcogwpawvviapqza.supabase.co/functions/v1/get-analytics?metric=session-frequency&period=7`,
        {
          headers: {
            'Authorization': `Bearer ${session?.access_token}`,
          },
        }
      );
      if (!response.ok) throw new Error('Failed to fetch frequency metrics');
      return await response.json();
    },
    refetchInterval: 60000,
  });

  // Points analytics query
  const { data: pointsData } = useQuery<{ points: { total_points_awarded: number; avg_points_per_user: number } }>({
    queryKey: ['admin-points'],
    enabled: !!session,
    queryFn: async () => {
      const response = await fetch(
        `https://mahpgcogwpawvviapqza.supabase.co/functions/v1/get-analytics?metric=points`,
        {
          headers: {
            'Authorization': `Bearer ${session?.access_token}`,
          },
        }
      );
      if (!response.ok) throw new Error('Failed to fetch points metrics');
      return await response.json();
    },
    refetchInterval: 60000,
  });

  // Lists analytics query
  const { data: listsData } = useQuery<{ lists: { total_custom_lists: number; avg_custom_lists_per_user: number } }>({
    queryKey: ['admin-lists'],
    enabled: !!session,
    queryFn: async () => {
      const response = await fetch(
        `https://mahpgcogwpawvviapqza.supabase.co/functions/v1/get-analytics?metric=lists`,
        {
          headers: {
            'Authorization': `Bearer ${session?.access_token}`,
          },
        }
      );
      if (!response.ok) throw new Error('Failed to fetch lists metrics');
      return await response.json();
    },
    refetchInterval: 60000,
  });

  // Behavior analytics query
  const { data: behaviorData, isLoading: behaviorLoading } = useQuery<{ behavior: BehaviorData }>({
    queryKey: ['admin-behavior'],
    enabled: !!session,
    queryFn: async () => {
      const response = await fetch(
        `https://mahpgcogwpawvviapqza.supabase.co/functions/v1/get-analytics?metric=behavior`,
        {
          headers: {
            'Authorization': `Bearer ${session?.access_token}`,
          },
        }
      );
      if (!response.ok) throw new Error('Failed to fetch behavior metrics');
      return await response.json();
    },
    refetchInterval: 60000,
  });

  // Moderation queue query
  interface ModerationReport {
    id: string;
    reporter_id: string;
    content_type: string;
    content_id: string;
    reason: string;
    description: string | null;
    status: string;
    created_at: string;
    reporter: { id: string; display_name: string; username: string; avatar_url: string | null };
    content: { id: string; content: string; created_at: string } | null;
    content_author: { id: string; display_name: string; username: string } | null;
  }

  const queryClient = useQueryClient();

  const { data: moderationData, isLoading: moderationLoading } = useQuery<{ reports: ModerationReport[]; stats: { pending: number; resolved: number } }>({
    queryKey: ['admin-moderation'],
    enabled: !!session,
    queryFn: async () => {
      const response = await fetch(
        `https://mahpgcogwpawvviapqza.supabase.co/functions/v1/get-moderation-queue?status=pending`,
        {
          headers: {
            'Authorization': `Bearer ${session?.access_token}`,
          },
        }
      );
      if (!response.ok) throw new Error('Failed to fetch moderation queue');
      return await response.json();
    },
    refetchInterval: 30000,
  });

  const moderateMutation = useMutation({
    mutationFn: async ({ action, report_id, content_type, content_id, target_user_id, reason }: {
      action: string;
      report_id: string;
      content_type: string;
      content_id: string;
      target_user_id?: string;
      reason?: string;
    }) => {
      const response = await fetch(
        `https://mahpgcogwpawvviapqza.supabase.co/functions/v1/moderate-content`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${session?.access_token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ action, report_id, content_type, content_id, target_user_id, reason }),
        }
      );
      if (!response.ok) throw new Error('Failed to moderate content');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-moderation'] });
    },
  });

  if (partnershipsError) {
    console.error('[PARTNERSHIPS] Query error:', partnershipsError);
  }

  if (error) {
    console.error('[ANALYTICS] Query error:', error);
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 via-purple-900 to-gray-900 p-6">
        <div className="max-w-7xl mx-auto space-y-6">
          <Skeleton className="h-12 w-64" />
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {[1, 2, 3, 4].map((i) => (
              <Skeleton key={i} className="h-32" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  const summary = analytics?.summary || {} as DashboardSummary;

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-purple-900 to-gray-900 p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-4xl font-bold text-white mb-2" data-testid="admin-title">
              Analytics Dashboard
            </h1>
            <p className="text-gray-300">Real-time engagement and growth metrics</p>
          </div>
          <div className="bg-purple-600/20 backdrop-blur-sm border border-purple-500/30 rounded-lg px-4 py-2">
            <p className="text-sm text-purple-300">Last updated: {new Date().toLocaleTimeString()}</p>
          </div>
        </div>

        {/* Key Metrics Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card className="bg-gradient-to-br from-purple-600 to-purple-700 border-purple-500/30 text-white">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <Users size={18} />
                Total Users
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold" data-testid="metric-total-users">
                {summary.total_users?.toLocaleString() || 0}
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-blue-600 to-blue-700 border-blue-500/30 text-white">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <Activity size={18} />
                DAU / MAU
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold" data-testid="metric-dau-mau">
                {summary.dau?.toLocaleString() || 0} / {summary.mau?.toLocaleString() || 0}
              </div>
              <p className="text-sm text-blue-100 mt-1">
                Stickiness: {summary.stickiness_ratio || 0}%
              </p>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-green-600 to-green-700 border-green-500/30 text-white">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <Zap size={18} />
                Engagement Rate
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold" data-testid="metric-engagement">
                {summary.engagement_rate?.toFixed(1) || 0}%
              </div>
              <p className="text-sm text-green-100 mt-1">
                2+ actions/week
              </p>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-pink-600 to-pink-700 border-pink-500/30 text-white">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <Heart size={18} />
                Avg Actions/User
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold" data-testid="metric-avg-actions">
                {summary.avg_actions_per_user?.toFixed(1) || 0}
              </div>
              <p className="text-sm text-pink-100 mt-1">
                Last 7 days
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Churn & Session Metrics */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Card className="bg-gradient-to-br from-red-600 to-red-700 border-red-500/30 text-white">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <TrendingUp size={18} />
                Churn Rate (30 Days)
              </CardTitle>
            </CardHeader>
            <CardContent>
              {churnLoading ? (
                <Skeleton className="h-10 w-24" />
              ) : (
                <>
                  <div className="text-3xl font-bold" data-testid="metric-churn-rate">
                    {churnData?.churn?.churn_rate?.toFixed(1) || 0}%
                  </div>
                  <p className="text-sm text-red-100 mt-1">
                    {churnData?.churn?.churned_users || 0} churned, {churnData?.churn?.at_risk_users || 0} at risk
                  </p>
                  <div className="mt-2 text-xs text-red-100 space-y-1">
                    <div>Active: {churnData?.churn?.active_users || 0} users</div>
                  </div>
                </>
              )}
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-indigo-600 to-indigo-700 border-indigo-500/30 text-white">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <Target size={18} />
                Avg Time Spent (7 Days)
              </CardTitle>
            </CardHeader>
            <CardContent>
              {sessionLoading ? (
                <Skeleton className="h-10 w-24" />
              ) : (
                <>
                  <div className="text-3xl font-bold" data-testid="metric-time-spent">
                    {sessionData?.sessions?.avg_session_duration_minutes?.toFixed(0) || 0}m
                  </div>
                  <p className="text-sm text-indigo-100 mt-1">
                    Per session • {sessionData?.sessions?.total_sessions || 0} sessions
                  </p>
                  <div className="mt-2 text-xs text-indigo-100 space-y-1">
                    <div>{sessionData?.sessions?.avg_daily_time_per_user_minutes?.toFixed(0) || 0} min/day per user</div>
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </div>

        {/* New Metrics Row */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card className="bg-gradient-to-br from-cyan-600 to-cyan-700 border-cyan-500/30 text-white">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <Activity size={18} />
                Session Frequency (7d)
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold" data-testid="metric-session-frequency">
                {frequencyData?.sessionFrequency?.avg_sessions_per_user?.toFixed(1) || 0}
              </div>
              <p className="text-sm text-cyan-100 mt-1">
                Opens per user • {frequencyData?.sessionFrequency?.total_sessions || 0} total
              </p>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-amber-600 to-amber-700 border-amber-500/30 text-white">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <Target size={18} />
                Points Earned
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold" data-testid="metric-total-points">
                {pointsData?.points?.total_points_awarded?.toLocaleString() || 0}
              </div>
              <p className="text-sm text-amber-100 mt-1">
                Avg: {pointsData?.points?.avg_points_per_user?.toFixed(0) || 0} per user
              </p>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-teal-600 to-teal-700 border-teal-500/30 text-white">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <Heart size={18} />
                Custom Lists
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold" data-testid="metric-custom-lists">
                {listsData?.lists?.total_custom_lists?.toLocaleString() || 0}
              </div>
              <p className="text-sm text-teal-100 mt-1">
                Avg: {listsData?.lists?.avg_custom_lists_per_user?.toFixed(1) || 0} per user
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Tabs for Different Metrics */}
        <Tabs defaultValue="overview" className="space-y-4">
          <TabsList className="bg-purple-900/50 border border-purple-500/30">
            <TabsTrigger value="overview" data-testid="tab-overview">Overview</TabsTrigger>
            <TabsTrigger value="retention" data-testid="tab-retention">Retention</TabsTrigger>
            <TabsTrigger value="engagement" data-testid="tab-engagement">Engagement</TabsTrigger>
            <TabsTrigger value="activation" data-testid="tab-activation">Activation</TabsTrigger>
            <TabsTrigger value="partnerships" data-testid="tab-partnerships">Partnership Insights</TabsTrigger>
            <TabsTrigger value="behavior" data-testid="tab-behavior">Behavior</TabsTrigger>
            <TabsTrigger value="moderation" data-testid="tab-moderation">Moderation</TabsTrigger>
          </TabsList>

          {/* Overview Tab */}
          <TabsContent value="overview" className="space-y-4">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {/* Daily Active Users Chart */}
              <Card className="bg-gray-900/50 backdrop-blur-sm border-purple-500/30">
                <CardHeader>
                  <CardTitle className="text-white">Daily Active Users</CardTitle>
                  <CardDescription className="text-gray-400">Last 30 days</CardDescription>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={300}>
                    <LineChart data={analytics?.activeUsers?.slice(0, 30).reverse() || []}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#4b5563" />
                      <XAxis 
                        dataKey="period_date" 
                        stroke="#9ca3af"
                        tick={{ fill: '#9ca3af' }}
                      />
                      <YAxis stroke="#9ca3af" tick={{ fill: '#9ca3af' }} />
                      <Tooltip 
                        contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #6b7280' }}
                        labelStyle={{ color: '#f3f4f6' }}
                      />
                      <Line 
                        type="monotone" 
                        dataKey="active_users" 
                        stroke="#9333ea" 
                        strokeWidth={2}
                        dot={{ fill: '#9333ea' }}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>

              {/* Engagement Trend */}
              <Card className="bg-gray-900/50 backdrop-blur-sm border-purple-500/30">
                <CardHeader>
                  <CardTitle className="text-white">Weekly Engagement Rate</CardTitle>
                  <CardDescription className="text-gray-400">% users with 2+ actions</CardDescription>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={300}>
                    <LineChart data={analytics?.engagedUsers?.slice(0, 12).reverse() || []}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#4b5563" />
                      <XAxis 
                        dataKey="week_start" 
                        stroke="#9ca3af"
                        tick={{ fill: '#9ca3af' }}
                      />
                      <YAxis stroke="#9ca3af" tick={{ fill: '#9ca3af' }} />
                      <Tooltip 
                        contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #6b7280' }}
                        labelStyle={{ color: '#f3f4f6' }}
                      />
                      <Line 
                        type="monotone" 
                        dataKey="engagement_rate" 
                        stroke="#10b981" 
                        strokeWidth={2}
                        dot={{ fill: '#10b981' }}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>

              {/* Social Graph Metrics */}
              <Card className="bg-gray-900/50 backdrop-blur-sm border-purple-500/30">
                <CardHeader>
                  <CardTitle className="text-white">Social Graph Health</CardTitle>
                  <CardDescription className="text-gray-400">Network metrics</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {analytics?.socialGraph?.map((metric) => (
                      <div key={metric.metric} className="flex justify-between items-center">
                        <span className="text-gray-300">{metric.metric}</span>
                        <span className="text-2xl font-bold text-white">
                          {metric.value.toFixed(1)}
                          {metric.metric.includes('%') ? '%' : ''}
                        </span>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>

              {/* Content Metrics */}
              <Card className="bg-gray-900/50 backdrop-blur-sm border-purple-500/30">
                <CardHeader>
                  <CardTitle className="text-white">Content Activity</CardTitle>
                  <CardDescription className="text-gray-400">Overall platform metrics</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div className="flex justify-between items-center">
                      <span className="text-gray-300">Media Tracked</span>
                      <span className="text-2xl font-bold text-white">
                        {summary.total_media_tracked?.toLocaleString() || 0}
                      </span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-gray-300">Posts Created</span>
                      <span className="text-2xl font-bold text-white">
                        {summary.total_posts?.toLocaleString() || 0}
                      </span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-gray-300">Games Played</span>
                      <span className="text-2xl font-bold text-white">
                        {summary.total_games_played?.toLocaleString() || 0}
                      </span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* Retention Tab */}
          <TabsContent value="retention" className="space-y-4">
            <Card className="bg-gray-900/50 backdrop-blur-sm border-purple-500/30">
              <CardHeader>
                <CardTitle className="text-white">Cohort Retention Rates</CardTitle>
                <CardDescription className="text-gray-400">
                  Day 1, 7, and 30 retention by signup cohort
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={400}>
                  <BarChart data={analytics?.retention?.slice(0, 14).reverse() || []}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#4b5563" />
                    <XAxis 
                      dataKey="cohort_date" 
                      stroke="#9ca3af"
                      tick={{ fill: '#9ca3af' }}
                    />
                    <YAxis stroke="#9ca3af" tick={{ fill: '#9ca3af' }} />
                    <Tooltip 
                      contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #6b7280' }}
                      labelStyle={{ color: '#f3f4f6' }}
                    />
                    <Legend wrapperStyle={{ color: '#f3f4f6' }} />
                    <Bar dataKey="day_1_rate" fill="#9333ea" name="Day 1" />
                    <Bar dataKey="day_7_rate" fill="#a855f7" name="Day 7" />
                    <Bar dataKey="day_30_rate" fill="#c084fc" name="Day 30" />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Engagement Tab */}
          <TabsContent value="engagement" className="space-y-4">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <Card className="bg-gray-900/50 backdrop-blur-sm border-purple-500/30">
                <CardHeader>
                  <CardTitle className="text-white">Engagement Depth</CardTitle>
                  <CardDescription className="text-gray-400">Average user activity</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {analytics?.engagement?.map((metric) => (
                      <div key={metric.metric} className="flex justify-between items-center">
                        <span className="text-gray-300">{metric.metric}</span>
                        <span className="text-2xl font-bold text-white">
                          {metric.value.toFixed(2)}
                        </span>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>

              <Card className="bg-gray-900/50 backdrop-blur-sm border-purple-500/30">
                <CardHeader>
                  <CardTitle className="text-white">Weekly Active vs Engaged</CardTitle>
                  <CardDescription className="text-gray-400">Last 8 weeks</CardDescription>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={analytics?.engagedUsers?.slice(0, 8).reverse() || []}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#4b5563" />
                      <XAxis 
                        dataKey="week_start" 
                        stroke="#9ca3af"
                        tick={{ fill: '#9ca3af' }}
                      />
                      <YAxis stroke="#9ca3af" tick={{ fill: '#9ca3af' }} />
                      <Tooltip 
                        contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #6b7280' }}
                        labelStyle={{ color: '#f3f4f6' }}
                      />
                      <Legend wrapperStyle={{ color: '#f3f4f6' }} />
                      <Bar dataKey="total_weekly_users" fill="#6366f1" name="Active Users" />
                      <Bar dataKey="engaged_users" fill="#10b981" name="Engaged Users (2+ actions)" />
                    </BarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* Activation Tab */}
          <TabsContent value="activation" className="space-y-4">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <Card className="bg-gray-900/50 backdrop-blur-sm border-purple-500/30">
                <CardHeader>
                  <CardTitle className="text-white">Activation Funnel</CardTitle>
                  <CardDescription className="text-gray-400">User onboarding completion</CardDescription>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={analytics?.activationFunnel || []} layout="vertical">
                      <CartesianGrid strokeDasharray="3 3" stroke="#4b5563" />
                      <XAxis type="number" stroke="#9ca3af" tick={{ fill: '#9ca3af' }} />
                      <YAxis 
                        type="category" 
                        dataKey="step" 
                        stroke="#9ca3af"
                        tick={{ fill: '#9ca3af' }}
                        width={180}
                      />
                      <Tooltip 
                        contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #6b7280' }}
                        labelStyle={{ color: '#f3f4f6' }}
                      />
                      <Bar dataKey="users_completed" fill="#9333ea">
                        {analytics?.activationFunnel?.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>

              <Card className="bg-gray-900/50 backdrop-blur-sm border-purple-500/30">
                <CardHeader>
                  <CardTitle className="text-white">Completion Rates</CardTitle>
                  <CardDescription className="text-gray-400">% of users completing each step</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {analytics?.activationFunnel?.map((step) => (
                      <div key={step.step}>
                        <div className="flex justify-between mb-1">
                          <span className="text-gray-300">{step.step}</span>
                          <span className="text-white font-semibold">{step.completion_rate.toFixed(1)}%</span>
                        </div>
                        <div className="w-full bg-gray-700 rounded-full h-2">
                          <div 
                            className="bg-gradient-to-r from-purple-600 to-purple-400 h-2 rounded-full"
                            style={{ width: `${step.completion_rate}%` }}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* Partnership Insights Tab */}
          <TabsContent value="partnerships" className="space-y-4">
            {partnershipsLoading ? (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <Skeleton className="h-96" />
                <Skeleton className="h-96" />
              </div>
            ) : (
              <>
                {/* Summary Stats */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <Card className="bg-gradient-to-br from-orange-600 to-orange-700 border-orange-500/30 text-white">
                    <CardHeader className="pb-3">
                      <CardTitle className="text-sm font-medium">Content Tracked</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="text-3xl font-bold">
                        {partnerships?.partnershipSummary?.total_content_tracked?.toLocaleString() || 0}
                      </div>
                    </CardContent>
                  </Card>

                  <Card className="bg-gradient-to-br from-teal-600 to-teal-700 border-teal-500/30 text-white">
                    <CardHeader className="pb-3">
                      <CardTitle className="text-sm font-medium">Avg Completion Rate</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="text-3xl font-bold">
                        {partnerships?.partnershipSummary?.avg_completion_rate?.toFixed(1) || 0}%
                      </div>
                    </CardContent>
                  </Card>

                  <Card className="bg-gradient-to-br from-rose-600 to-rose-700 border-rose-500/30 text-white">
                    <CardHeader className="pb-3">
                      <CardTitle className="text-sm font-medium">Social Posts</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="text-3xl font-bold">
                        {partnerships?.partnershipSummary?.total_social_posts?.toLocaleString() || 0}
                      </div>
                    </CardContent>
                  </Card>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                  {/* Cross-Platform Engagement */}
                  <Card className="bg-gray-900/50 backdrop-blur-sm border-purple-500/30">
                    <CardHeader>
                      <CardTitle className="text-white">Cross-Platform Engagement</CardTitle>
                      <CardDescription className="text-gray-400">
                        "Users who watch also listen to..."
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-3 max-h-80 overflow-y-auto">
                        {partnerships?.crossPlatform?.slice(0, 10).map((item, idx) => (
                          <div key={idx} className="flex justify-between items-center text-sm">
                            <span className="text-gray-300">
                              {item.primary_media_type} → {item.secondary_media_type}
                            </span>
                            <div className="text-right">
                              <div className="text-white font-semibold">
                                {item.overlap_percentage.toFixed(1)}%
                              </div>
                              <div className="text-xs text-gray-400">
                                {item.overlap_users} users
                              </div>
                            </div>
                          </div>
                        )) || <p className="text-gray-400">No data available</p>}
                      </div>
                    </CardContent>
                  </Card>

                  {/* Trending Content */}
                  <Card className="bg-gray-900/50 backdrop-blur-sm border-purple-500/30">
                    <CardHeader>
                      <CardTitle className="text-white">Trending Content (7 Days)</CardTitle>
                      <CardDescription className="text-gray-400">
                        Most added & discussed
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-3 max-h-80 overflow-y-auto">
                        {partnerships?.trending?.slice(0, 10).map((item, idx) => (
                          <div key={idx} className="border-b border-gray-700 pb-2">
                            <div className="text-white font-medium truncate">{item.title}</div>
                            <div className="flex justify-between text-xs text-gray-400 mt-1">
                              <span>{item.creator || item.media_type}</span>
                              <span className="text-purple-400 font-semibold">
                                {item.total_engagement} actions
                              </span>
                            </div>
                          </div>
                        )) || <p className="text-gray-400">No data available</p>}
                      </div>
                    </CardContent>
                  </Card>

                  {/* Cross-Platform Affinity Insights */}
                  <Card className="bg-gray-900/50 backdrop-blur-sm border-purple-500/30 lg:col-span-2">
                    <CardHeader>
                      <CardTitle className="text-white">Cross-Platform Affinity Insights</CardTitle>
                      <CardDescription className="text-gray-400">
                        Powered by Entertainment DNA, recommendations, creators, and platform usage
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-h-96 overflow-y-auto">
                        {partnerships?.affinityInsights && partnerships.affinityInsights.length > 0 ? partnerships.affinityInsights.slice(0, 20).map((insight, idx) => {
                          const getCategoryIcon = (category: string) => {
                            switch(category) {
                              case 'creator': return '👤';
                              case 'platform': return '📺';
                              case 'dna': return '🧬';
                              case 'recommendation': return '✨';
                              default: return '📊';
                            }
                          };
                          
                          const getCategoryLabel = (category: string) => {
                            switch(category) {
                              case 'creator': return 'Creator';
                              case 'platform': return 'Platform';
                              case 'dna': return 'DNA Profile';
                              case 'recommendation': return 'AI Recommendations';
                              default: return 'Other';
                            }
                          };
                          
                          return (
                            <div 
                              key={idx} 
                              className="bg-gray-800/50 rounded-lg p-3 border border-gray-700 hover:border-purple-500/50 transition-colors"
                            >
                              <div className="text-sm text-gray-300 mb-2">
                                {insight.insight_text}
                              </div>
                              <div className="flex justify-between items-center text-xs">
                                <span className="text-gray-400">
                                  {getCategoryIcon(insight.source_category)} {getCategoryLabel(insight.source_category)}: {insight.source_name}
                                </span>
                                <div className="text-right">
                                  <div className="text-purple-400 font-semibold">
                                    {insight.affinity_percentage}% affinity
                                  </div>
                                  <div className="text-gray-500">
                                    {insight.affinity_count} users
                                  </div>
                                </div>
                              </div>
                            </div>
                          );
                        }) : (
                          <p className="text-gray-400 col-span-2">No affinity data available</p>
                        )}
                      </div>
                    </CardContent>
                  </Card>

                  {/* Completion Rates by Media Type */}
                  <Card className="bg-gray-900/50 backdrop-blur-sm border-purple-500/30">
                    <CardHeader>
                      <CardTitle className="text-white">Completion Rates by Type</CardTitle>
                      <CardDescription className="text-gray-400">
                        What % of content users finish
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <ResponsiveContainer width="100%" height={300}>
                        <BarChart data={partnerships?.completionRates || []}>
                          <CartesianGrid strokeDasharray="3 3" stroke="#4b5563" />
                          <XAxis 
                            dataKey="media_type" 
                            stroke="#9ca3af"
                            tick={{ fill: '#9ca3af' }}
                          />
                          <YAxis stroke="#9ca3af" tick={{ fill: '#9ca3af' }} />
                          <Tooltip 
                            contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #6b7280' }}
                            labelStyle={{ color: '#f3f4f6' }}
                          />
                          <Bar dataKey="completion_rate" fill="#10b981" name="Completion %" />
                        </BarChart>
                      </ResponsiveContainer>
                    </CardContent>
                  </Card>

                  {/* Viral Content */}
                  <Card className="bg-gray-900/50 backdrop-blur-sm border-purple-500/30">
                    <CardHeader>
                      <CardTitle className="text-white">Most Viral Content</CardTitle>
                      <CardDescription className="text-gray-400">
                        Social sharing & engagement
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-3 max-h-80 overflow-y-auto">
                        {partnerships?.viral?.slice(0, 8).map((item, idx) => (
                          <div key={idx} className="border-b border-gray-700 pb-2">
                            <div className="text-white font-medium truncate">{item.title}</div>
                            <div className="flex justify-between text-xs text-gray-400 mt-1">
                              <span>
                                {item.posts_count} posts · {item.likes_count} likes · {item.comments_count} comments
                              </span>
                              <span className="text-pink-400 font-semibold">
                                Score: {item.virality_score}
                              </span>
                            </div>
                          </div>
                        )) || <p className="text-gray-400">No data available</p>}
                      </div>
                    </CardContent>
                  </Card>

                  {/* DNA Clusters */}
                  <Card className="bg-gray-900/50 backdrop-blur-sm border-purple-500/30">
                    <CardHeader>
                      <CardTitle className="text-white">Entertainment DNA Clusters</CardTitle>
                      <CardDescription className="text-gray-400">
                        Personality-based content preferences
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-4">
                        {partnerships?.dnaClusters?.map((cluster, idx) => (
                          <div key={idx} className="border-b border-gray-700 pb-3">
                            <div className="flex justify-between items-center mb-2">
                              <span className="text-white font-semibold">{cluster.cluster_label}</span>
                              <span className="text-purple-400">{cluster.user_count} users</span>
                            </div>
                            <div className="text-xs text-gray-400">
                              Avg tracked: {cluster.avg_items_tracked?.toFixed(1)} items
                            </div>
                            <div className="text-xs text-gray-500 mt-1">
                              {cluster.top_genres?.slice(0, 3).join(', ')}
                            </div>
                          </div>
                        )) || <p className="text-gray-400">No data available</p>}
                      </div>
                    </CardContent>
                  </Card>

                  {/* Creator Influence */}
                  <Card className="bg-gray-900/50 backdrop-blur-sm border-purple-500/30">
                    <CardHeader>
                      <CardTitle className="text-white">Top Influential Creators</CardTitle>
                      <CardDescription className="text-gray-400">
                        Driving the most engagement
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-3 max-h-80 overflow-y-auto">
                        {partnerships?.creators?.slice(0, 10).map((creator, idx) => (
                          <div key={idx} className="flex justify-between items-center text-sm border-b border-gray-700 pb-2">
                            <div>
                              <div className="text-white font-medium">{creator.creator_name}</div>
                              <div className="text-xs text-gray-400">{creator.creator_role}</div>
                            </div>
                            <div className="text-right">
                              <div className="text-purple-400 font-semibold">
                                {creator.influence_score}
                              </div>
                              <div className="text-xs text-gray-400">
                                {creator.followers_count} followers
                              </div>
                            </div>
                          </div>
                        )) || <p className="text-gray-400">No data available</p>}
                      </div>
                    </CardContent>
                  </Card>
                </div>
              </>
            )}
          </TabsContent>

          {/* Behavior Tab */}
          <TabsContent value="behavior" className="space-y-4">
            {behaviorLoading ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {[1, 2, 3, 4].map((i) => (
                  <Skeleton key={i} className="h-64" />
                ))}
              </div>
            ) : (
              <>
                {/* Session Stats Summary */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <Card className="bg-gradient-to-br from-blue-600 to-blue-700 border-blue-500/30 text-white">
                    <CardHeader className="pb-3">
                      <CardTitle className="text-sm font-medium flex items-center gap-2">
                        <Activity size={18} />
                        Sessions (7d)
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="text-3xl font-bold" data-testid="metric-behavior-sessions">
                        {behaviorData?.behavior?.sessionStats?.totalSessions?.toLocaleString() || 0}
                      </div>
                      <p className="text-sm text-blue-100 mt-1">
                        {behaviorData?.behavior?.sessionStats?.sessionsWithHeartbeat || 0} with active heartbeat
                      </p>
                    </CardContent>
                  </Card>

                  <Card className="bg-gradient-to-br from-purple-600 to-purple-700 border-purple-500/30 text-white">
                    <CardHeader className="pb-3">
                      <CardTitle className="text-sm font-medium flex items-center gap-2">
                        <Eye size={18} />
                        Avg Session Duration
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="text-3xl font-bold" data-testid="metric-behavior-duration">
                        {behaviorData?.behavior?.sessionStats?.avgSessionDuration || 0} min
                      </div>
                      <p className="text-sm text-purple-100 mt-1">
                        Average time per session
                      </p>
                    </CardContent>
                  </Card>

                  <Card className="bg-gradient-to-br from-emerald-600 to-emerald-700 border-emerald-500/30 text-white">
                    <CardHeader className="pb-3">
                      <CardTitle className="text-sm font-medium flex items-center gap-2">
                        <MousePointer size={18} />
                        Events Tracked
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="text-3xl font-bold" data-testid="metric-behavior-events">
                        {behaviorData?.behavior?.eventCounts?.reduce((sum, e) => sum + e.count, 0)?.toLocaleString() || 0}
                      </div>
                      <p className="text-sm text-emerald-100 mt-1">
                        Last 7 days
                      </p>
                    </CardContent>
                  </Card>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                  {/* Page Time Distribution */}
                  <Card className="bg-gray-900/50 backdrop-blur-sm border-purple-500/30">
                    <CardHeader>
                      <CardTitle className="text-white">Where Users Spend Time</CardTitle>
                      <CardDescription className="text-gray-400">
                        Average time per page (seconds)
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      {behaviorData?.behavior?.pageTime && behaviorData.behavior.pageTime.length > 0 ? (
                        <ResponsiveContainer width="100%" height={300}>
                          <BarChart 
                            data={behaviorData.behavior.pageTime}
                            layout="vertical"
                            margin={{ left: 80 }}
                          >
                            <CartesianGrid strokeDasharray="3 3" stroke="#4b5563" />
                            <XAxis type="number" stroke="#9ca3af" tick={{ fill: '#9ca3af' }} />
                            <YAxis 
                              type="category" 
                              dataKey="page" 
                              stroke="#9ca3af" 
                              tick={{ fill: '#9ca3af', fontSize: 11 }}
                              width={80}
                            />
                            <Tooltip 
                              contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #6b7280' }}
                              labelStyle={{ color: '#f3f4f6' }}
                              formatter={(value: number, name: string) => {
                                if (name === 'avgDuration') return [`${value}s`, 'Avg Time'];
                                if (name === 'visits') return [value, 'Visits'];
                                return [value, name];
                              }}
                            />
                            <Bar dataKey="avgDuration" fill="#9333ea" name="avgDuration" />
                          </BarChart>
                        </ResponsiveContainer>
                      ) : (
                        <div className="flex items-center justify-center h-64 text-gray-400">
                          <div className="text-center">
                            <Eye className="w-12 h-12 mx-auto mb-2 opacity-50" />
                            <p>No page view data yet</p>
                            <p className="text-sm">Data will appear as users browse the app</p>
                          </div>
                        </div>
                      )}
                    </CardContent>
                  </Card>

                  {/* Page Visit Counts */}
                  <Card className="bg-gray-900/50 backdrop-blur-sm border-purple-500/30">
                    <CardHeader>
                      <CardTitle className="text-white">Most Visited Pages</CardTitle>
                      <CardDescription className="text-gray-400">
                        Number of page visits
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      {behaviorData?.behavior?.pageTime && behaviorData.behavior.pageTime.length > 0 ? (
                        <div className="space-y-3 max-h-72 overflow-y-auto">
                          {behaviorData.behavior.pageTime.map((page, idx) => (
                            <div key={idx} className="flex justify-between items-center text-sm border-b border-gray-700 pb-2">
                              <div className="text-white font-medium truncate max-w-[200px]" title={page.page}>
                                {page.page}
                              </div>
                              <div className="flex gap-4 text-right">
                                <div>
                                  <span className="text-purple-400 font-semibold">{page.visits}</span>
                                  <span className="text-gray-400 text-xs ml-1">visits</span>
                                </div>
                                <div>
                                  <span className="text-blue-400 font-semibold">{page.avgScrollDepth}%</span>
                                  <span className="text-gray-400 text-xs ml-1">scroll</span>
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="flex items-center justify-center h-64 text-gray-400">
                          <div className="text-center">
                            <MousePointer className="w-12 h-12 mx-auto mb-2 opacity-50" />
                            <p>No visit data yet</p>
                          </div>
                        </div>
                      )}
                    </CardContent>
                  </Card>

                  {/* Event Distribution */}
                  <Card className="bg-gray-900/50 backdrop-blur-sm border-purple-500/30 lg:col-span-2">
                    <CardHeader>
                      <CardTitle className="text-white">Feature Usage (Events)</CardTitle>
                      <CardDescription className="text-gray-400">
                        What actions users take most often
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      {behaviorData?.behavior?.eventCounts && behaviorData.behavior.eventCounts.length > 0 ? (
                        <ResponsiveContainer width="100%" height={300}>
                          <BarChart data={behaviorData.behavior.eventCounts.slice(0, 10)}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#4b5563" />
                            <XAxis 
                              dataKey="event" 
                              stroke="#9ca3af" 
                              tick={{ fill: '#9ca3af', fontSize: 10 }}
                              angle={-45}
                              textAnchor="end"
                              height={80}
                            />
                            <YAxis stroke="#9ca3af" tick={{ fill: '#9ca3af' }} />
                            <Tooltip 
                              contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #6b7280' }}
                              labelStyle={{ color: '#f3f4f6' }}
                            />
                            <Bar dataKey="count" fill="#10b981" name="Count" />
                          </BarChart>
                        </ResponsiveContainer>
                      ) : (
                        <div className="flex items-center justify-center h-64 text-gray-400">
                          <div className="text-center">
                            <Activity className="w-12 h-12 mx-auto mb-2 opacity-50" />
                            <p>No event data yet</p>
                            <p className="text-sm">Events will be tracked as users interact with features</p>
                          </div>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                </div>
              </>
            )}
          </TabsContent>
        </Tabs>

        {/* North Star Metric Callout */}
        <Card className="bg-gradient-to-br from-purple-600/20 to-blue-600/20 backdrop-blur-sm border-purple-500/50">
          <CardHeader>
            <CardTitle className="text-white flex items-center gap-2">
              <Target className="text-yellow-400" />
              North Star Metric (OMTM)
            </CardTitle>
            <CardDescription className="text-gray-300">
              Active Engaged Users - % of users taking 2+ actions per week
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-end gap-4 mb-4">
              <div className="text-5xl font-bold text-white" data-testid="north-star-metric">
                {summary.engagement_rate?.toFixed(1) || 0}%
              </div>
              <div className="text-2xl text-gray-300 pb-2">
                ({Math.round((summary.wau || 0) * (summary.engagement_rate || 0) / 100)} / {summary.wau || 0} weekly active users)
              </div>
            </div>
            <p className="text-gray-300">
              This is your core engagement metric - users who Track, Play, Connect, or Predict at least twice per week.
            </p>
            <div className="mt-4 grid grid-cols-3 gap-4 text-center">
              <div>
                <p className="text-gray-400 text-sm">Target</p>
                <p className="text-2xl font-bold text-green-400">25%+</p>
              </div>
              <div>
                <p className="text-gray-400 text-sm">Current</p>
                <p className="text-2xl font-bold text-white">{summary.engagement_rate?.toFixed(1) || 0}%</p>
              </div>
              <div>
                <p className="text-gray-400 text-sm">Benchmark</p>
                <p className="text-2xl font-bold text-yellow-400">20-30%</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
