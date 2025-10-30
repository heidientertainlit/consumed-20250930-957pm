import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/lib/auth';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { LineChart, Line, BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { TrendingUp, Users, Activity, Target, Zap, Heart } from 'lucide-react';
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

const COLORS = ['#9333ea', '#a855f7', '#c084fc', '#d8b4fe', '#e9d5ff'];

export default function AdminDashboard() {
  const { session } = useAuth();

  const { data: analytics, isLoading } = useQuery<AnalyticsData>({
    queryKey: ['admin-analytics'],
    enabled: !!session,
    queryFn: async () => {
      const response = await fetch(
        `https://mahpgcogwpawvviapqza.supabase.co/functions/v1/get-analytics`,
        {
          headers: {
            'Authorization': `Bearer ${session?.access_token}`,
          },
        }
      );

      if (!response.ok) {
        throw new Error('Failed to fetch analytics');
      }

      return response.json();
    },
    refetchInterval: 60000, // Refresh every minute
  });

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
            <p className="text-gray-300">VC-Ready Metrics for Consumed</p>
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

        {/* Tabs for Different Metrics */}
        <Tabs defaultValue="overview" className="space-y-4">
          <TabsList className="bg-purple-900/50 border border-purple-500/30">
            <TabsTrigger value="overview" data-testid="tab-overview">Overview</TabsTrigger>
            <TabsTrigger value="retention" data-testid="tab-retention">Retention</TabsTrigger>
            <TabsTrigger value="engagement" data-testid="tab-engagement">Engagement</TabsTrigger>
            <TabsTrigger value="activation" data-testid="tab-activation">Activation</TabsTrigger>
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
            <div className="text-5xl font-bold text-white mb-2" data-testid="north-star-metric">
              {summary.engagement_rate?.toFixed(1) || 0}%
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
