'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth';
import { getAdminClusters, ClusterStats } from '@/lib/api';

export default function AdminClusters() {
  const { token } = useAuth();
  const router = useRouter();
  const [clusters, setClusters] = useState<ClusterStats[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!token) return;
    getAdminClusters(token).then(c => { setClusters(c); setLoading(false); }).catch(() => setLoading(false));
  }, [token]);

  if (loading) return <div className="flex items-center justify-center min-h-screen"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-honey-500"></div></div>;

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-100 sticky top-0 z-30">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <button onClick={() => router.push('/admin/dashboard')} className="text-gray-500 mb-2 block">&larr; Back</button>
          <h1 className="text-2xl font-bold text-gray-900">Clusters</h1>
        </div>
      </header>
      <main className="max-w-7xl mx-auto px-4 py-6">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {clusters.map(c => (
            <div key={c.id} className="card">
              <h3 className="text-lg font-semibold text-gray-900">{c.name}</h3>
              <p className="text-sm text-gray-500 mb-4">{c.location}</p>
              <div className="grid grid-cols-3 gap-3 text-center">
                <div><p className="text-xl font-bold text-gray-900">{c.hive_count}</p><p className="text-xs text-gray-500">Hives</p></div>
                <div><p className="text-xl font-bold text-gray-900">{c.beekeeper_count}</p><p className="text-xs text-gray-500">Beekeepers</p></div>
                <div><p className="text-xl font-bold text-honey-600">{c.honey_produced_kg.toFixed(1)}</p><p className="text-xs text-gray-500">Honey (kg)</p></div>
              </div>
            </div>
          ))}
        </div>
      </main>
    </div>
  );
}