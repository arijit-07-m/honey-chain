'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth';
import { getHives, getBatches, getAlerts, Hive, Batch, Alert } from '@/lib/api';
import { AlertTriangle, Archive, Plus } from 'lucide-react';

export default function FarmerDashboard() {
  const { token, user, logout, isAuthenticated } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!isAuthenticated) router.push('/');
  }, [isAuthenticated, router]);
  const [hives, setHives] = useState<Hive[]>([]);
  const [batches, setBatches] = useState<Batch[]>([]);
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!token) return;
    Promise.all([
      getHives(token).catch(() => []),
      getBatches(token).catch(() => []),
      getAlerts(token).catch(() => []),
    ]).then(([h, b, a]) => {
      setHives(h); setBatches(b); setAlerts(a); setLoading(false);
    });
  }, [token]);

  const healthy = hives.filter(h => h.status === 'HEALTHY').length;
  const attention = hives.filter(h => h.status !== 'HEALTHY').length;
  const todayProd = batches
    .filter(b => new Date(b.harvest_date).toDateString() === new Date().toDateString())
    .reduce((s, b) => s + b.quantity, 0);

  if (loading) return <div className="flex items-center justify-center min-h-screen"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-honey-500"></div></div>;

  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      <header className="bg-white border-b border-gray-100 sticky top-0 z-30">
        <div className="max-w-4xl mx-auto px-4 py-4 flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Good Morning</h1>
            <p className="text-gray-500 text-sm">{user?.name}</p>
          </div>
          <div className="flex items-center gap-3">
            <button onClick={() => router.push('/farmer/alerts')} className="relative">
              <AlertTriangle className="w-6 h-6 text-gray-500" />
              {alerts.filter(a => !a.resolved).length > 0 && (
                <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full w-4 h-4 flex items-center justify-center">
                  {alerts.filter(a => !a.resolved).length}
                </span>
              )}
            </button>
            <button onClick={logout} className="text-sm text-gray-500 hover:text-gray-700">Logout</button>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-6 space-y-6">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="card text-center"><p className="text-3xl font-bold text-gray-900">{hives.length}</p><p className="text-sm text-gray-500">Total Hives</p></div>
          <div className="card text-center"><p className="text-3xl font-bold text-green-600">{healthy}</p><p className="text-sm text-gray-500">Healthy</p></div>
          <div className="card text-center"><p className="text-3xl font-bold text-orange-500">{attention}</p><p className="text-sm text-gray-500">Needs Attention</p></div>
          <div className="card text-center"><p className="text-3xl font-bold text-honey-500">{todayProd.toFixed(1)}</p><p className="text-sm text-gray-500">Today kg</p></div>
        </div>

        {alerts.filter(a => !a.resolved).length > 0 && (
          <div className="space-y-3">
            <h2 className="text-lg font-semibold text-gray-900">Active Alerts</h2>
            {alerts.filter(a => !a.resolved).slice(0, 3).map(alert => (
              <div key={alert.id} className="card border-l-4 border-orange-400 bg-orange-50">
                <div className="flex items-start gap-3">
                  <AlertTriangle className="w-5 h-5 text-orange-500 mt-0.5 flex-shrink-0" />
                  <div>
                    <p className="font-medium text-gray-900">⚠ Potential Hive Anomaly</p>
                    <p className="text-sm text-gray-600">{alert.message}</p>
                    <button onClick={() => router.push('/farmer/hives/' + alert.hive_id)} className="text-sm text-honey-600 font-medium mt-2 hover:underline">View Hive →</button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        <div>
          <div className="flex justify-between items-center mb-3">
            <h2 className="text-lg font-semibold text-gray-900">Your Apiary</h2>
            <button onClick={() => router.push('/farmer/hives')} className="text-sm text-honey-600 font-medium hover:underline">View All →</button>
          </div>
          <div className="space-y-2">
            {hives.slice(0, 5).map(hive => (
              <div key={hive.id} onClick={() => router.push('/farmer/hives/' + hive.id)} className="card flex items-center justify-between cursor-pointer hover:shadow-md transition-shadow">
                <div className="flex items-center gap-3">
                  <span className="w-10 h-10 rounded-full bg-honey-100 flex items-center justify-center text-lg">🐝</span>
                  <div>
                    <p className="font-medium text-gray-900">{hive.hive_code}</p>
                    <p className="text-xs text-gray-500">{hive.status === 'HEALTHY' ? 'Healthy' : 'Needs Attention'}</p>
                  </div>
                </div>
                <span className={'w-3 h-3 rounded-full ' + (hive.status === 'HEALTHY' ? 'bg-green-500' : 'bg-orange-500')}></span>
              </div>
            ))}
          </div>
        </div>

        <div>
          <div className="flex justify-between items-center mb-3">
            <h2 className="text-lg font-semibold text-gray-900">Recent Harvests</h2>
            <button onClick={() => router.push('/farmer/harvest')} className="text-sm text-honey-600 font-medium hover:underline">New Harvest ←</button>
          </div>
          <div className="space-y-2">
            {batches.slice(0, 3).map(batch => (
              <div key={batch.id} onClick={() => router.push('/farmer/batches')} className="card flex items-center justify-between cursor-pointer">
                <div>
                  <p className="font-medium text-gray-900">{batch.batch_code}</p>
                  <p className="text-sm text-gray-500">{batch.honey_type} · {batch.quantity}kg</p>
                </div>
                <span className="badge-blue">{batch.status}</span>
              </div>
            ))}
            {batches.length === 0 && (
              <div className="card text-center py-8 text-gray-500">
                <Archive className="w-8 h-8 mx-auto mb-2 opacity-50" />
                <p>No harvests yet. Create your first batch!</p>
                <button onClick={() => router.push('/farmer/harvest')} className="btn-primary mt-4 inline-flex items-center gap-2"><Plus className="w-4 h-4" /> Create Harvest</button>
              </div>
            )}
          </div>
        </div>
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

