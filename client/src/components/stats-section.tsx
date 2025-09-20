import { useQuery } from "@tanstack/react-query";

interface StatsData {
  totalUsers: number;
  totalPools: number;
  totalPointsPayout: number;
  avgWin: number;
}

export default function StatsSection() {
  const { data: stats } = useQuery<StatsData>({
    queryKey: ["/api/stats"],
  });

  if (!stats) return null;

  return (
    <section className="bg-dark-secondary py-16">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-12">
          <h2 className="text-3xl font-bold mb-4">Join the Community</h2>
          <p className="text-gray-400 max-w-2xl mx-auto">
            Thousands of entertainment fans are making predictions and winning real money every day.
          </p>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
          <div className="text-center">
            <div className="text-4xl font-bold text-purple-primary mb-2">
              {stats.totalUsers.toLocaleString()}
            </div>
            <div className="text-gray-400">Active Players</div>
          </div>
          <div className="text-center">
            <div className="text-4xl font-bold text-pink-primary mb-2">
              {stats.totalPools.toLocaleString()}
            </div>
            <div className="text-gray-400">Active Pools</div>
          </div>
          <div className="text-center">
            <div className="text-4xl font-bold text-cyan-accent mb-2">
              {stats.totalPointsPayout?.toLocaleString() || 0}
            </div>
            <div className="text-gray-400">Points in Play</div>
          </div>
          <div className="text-center">
            <div className="text-4xl font-bold text-gold-accent mb-2">
              {stats.avgWin?.toLocaleString() || 0}
            </div>
            <div className="text-gray-400">Avg Win (pts)</div>
          </div>
        </div>
      </div>
    </section>
  );
}
