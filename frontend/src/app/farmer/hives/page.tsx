'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth';
import { getHives, Hive } from '@/lib/api';

export default function FarmerHives() {
  const { token } = useAuth();
  const router = useRouter();
  const [hives, setHives] = useState<Hive[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!token) return;
    getHives(token).then(h => { setHives(h); setLoading(false); }).catch(() => setLoading(false));
  }, [token]);

  if (loading) return <div className="flex items-center justify-center min-h-screen"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-honey-500"></div></div>;

  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      <header className="bg-white border-b border-gray-100 sticky top-0 z-30">
        <div className="max-w-4xl mx-auto px-4 py-4">
          <button onClick={() => router.push('/farmer/dashboard')} className="text-gray-500 mb-2 block">&larr; Back</button>
          <h1 className="text-2xl font-bold text-gray-900">Your Hives</h1>
          <p className="text-sm text-gray-500">{hives.length} hives registered</p>
        </div>
      </header>
      <main className="max-w-4xl mx-auto px-4 py-6 space-y-3">
        {hives.map(hive => (
          <div key={hive.id} onClick={() => router.push(`/farmer/hives/${hive.id}`)}
            className="card flex items-center justify-between cursor-pointer hover:shadow-md transition-shadow">
            <div className="flex items-center gap-3">
              <span className="w-12 h-12 rounded-full bg-honey-100 flex items-center justify-center text-2xl">🐝</span>
              <div>
                <p className="font-medium text-gray-900 text-lg">{hive.hive_code}</p>
                <p className="text-sm text-gray-500">
                  Status: {hive.status === 'HEALTHY' ? 'Healthy' : hive.status === 'ATTENTION' ? 'Needs Attention' : 'Critical'}
                </p>
              </div>
            </div>
            <span className={`w-3 h-3 rounded-full ${hive.status === 'HEALTHY' ? 'bg-green-500' : hive.status === 'ATTENTION' ? 'bg-orange-500' : 'bg-red-500'}`}></span>
          </div>
        ))}
      </main>
      <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-100 z-30">
        <div className="max-w-4xl mx-auto flex justify-around py-3">
          {[{ icon: '🏠', label: 'Home', path: '/farmer/dashboard' }, { icon: '🐝', label: 'Hives', path: '/farmer/hives' }, { icon: '📦', label: 'Harvest', path: '/farmer/harvest' }, { icon: '📋', label: 'Batches', path: '/farmer/batches' }, { icon: '🔔', label: 'Alerts', path: '/farmer/alerts' }].map(item => (
            <button key={item.label} onClick={() => router.push(item.path)} className="flex flex-col items-center text-xs text-gray-500 hover:text-honey-600">
              <span className="text-lg">{item.icon}</span>{item.label}
            </button>
          ))}
        </div>
      </nav>
    </div>
  );
}