'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth';
import { getAdminDashboard, getAdminClusters } from '@/lib/api';
import type { AdminDashboard as AdminDashboardType, ClusterStats } from '@/lib/api';
import dynamic from 'next/dynamic';
import { AlertTriangle, Building2, Package, Users } from 'lucide-react';

const ClusterChart = dynamic(() => import('@/components/ClusterChart'), { ssr: false });

export default function AdminDashboard() {
  const { token, logout, isAuthenticated } = useAuth();
  const router = useRouter();
  useEffect(() => {
    if (!isAuthenticated) router.push('/');
  }, [isAuthenticated, router]);
  const [dash, setDash] = useState<AdminDashboardType | null>(null);
  const [clusters, setClusters] = useState<ClusterStats[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!token) return;
    Promise.all([getAdminDashboard(token), getAdminClusters(token)])
      .then(([d, c]) => { setDash(d); setClusters(c); setLoading(false); })
      .catch(() => setLoading(false));
  }, [token]);

  if (loading) return <div className="flex items-center justify-center min-h-screen"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-honey-500"></div></div>;

  const COLORS = ['#22c55e', '#eab308', '#ef4444', '#3b82f6', '#8b5cf6'];

  return (
    <div className="min-h-screen bg-gray-50 pb-10">
      <header className="bg-white border-b border-gray-100 sticky top-0 z-30">
        <div className="max-w-7xl mx-auto px-4 py-4 flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Admin Dashboard</h1>
            <p className="text-sm text-gray-500">KVIC Administration</p>
          </div>
          <div className="flex items-center gap-4">
            <button onClick={() => router.push('/admin/clusters')} className="text-sm text-gray-500 hover:text-gray-700">Clusters</button>
            <button onClick={() => router.push('/admin/batches')} className="text-sm text-gray-500 hover:text-gray-700">Audit</button>
            <button onClick={logout} className="text-sm text-gray-500 hover:text-gray-700">Logout</button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-6 space-y-6">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="card text-center"><Building2 className="w-6 h-6 text-honey-500 mx-auto mb-2" /><p className="text-3xl font-bold text-gray-900">{dash?.total_clusters || 0}</p><p className="text-sm text-gray-500">Total Clusters</p></div>
          <div className="card text-center"><Users className="w-6 h-6 text-blue-500 mx-auto mb-2" /><p className="text-3xl font-bold text-gray-900">{dash?.total_beekeepers || 0}</p><p className="text-sm text-gray-500">Beekeepers</p></div>
          <div className="card text-center"><span className="text-2xl block mb-2">🐝</span><p className="text-3xl font-bold text-gray-900">{dash?.active_hives || 0}</p><p className="text-sm text-gray-500">Active Hives</p></div>
          <div className="card text-center"><Package className="w-6 h-6 text-honey-500 mx-auto mb-2" /><p className="text-3xl font-bold text-gray-900">{dash?.honey_produced_kg.toFixed(0) || 0}</p><p className="text-sm text-gray-500">Honey (kg)</p></div>
        </div>

        {/* Cluster Performance */}
        <div className="card">
          <h3 className="font-semibold text-gray-900 mb-4">Cluster Performance</h3>
          <div className="h-64">
            <ClusterChart data={clusters} />
          </div>
        </div>

        {/* Cluster List */}
        <div className="card">
          <h3 className="font-semibold text-gray-900 mb-4">Cluster Overview</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-gray-500">
                  <th className="text-left py-2">Cluster</th>
                  <th className="text-left py-2">Location</th>
                  <th className="text-right py-2">Hives</th>
                  <th className="text-right py-2">Beekeepers</th>
                  <th className="text-right py-2">Honey (kg)</th>
                </tr>
              </thead>
              <tbody>
                {clusters.map(c => (
                  <tr key={c.id} className="border-b last:border-0">
                    <td className="py-3 font-medium">{c.name}</td>
                    <td className="py-3 text-gray-500">{c.location}</td>
                    <td className="py-3 text-right">{c.hive_count}</td>
                    <td className="py-3 text-right">{c.beekeeper_count}</td>
                    <td className="py-3 text-right font-medium">{c.honey_produced_kg.toFixed(1)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Recent Alerts */}
        {dash && dash.recent_alerts.length > 0 && (
          <div className="card">
            <h3 className="font-semibold text-gray-900 mb-4">Recent Alerts</h3>
            <div className="space-y-2">
              {dash.recent_alerts.slice(0, 5).map(a => (
                <div key={a.id} className="flex items-start gap-2 text-sm">
                  <AlertTriangle className="w-4 h-4 text-orange-500 mt-0.5 flex-shrink-0" />
                  <p className="text-gray-600">{a.message}</p>
                </div>
              ))}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}


