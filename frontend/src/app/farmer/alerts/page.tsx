'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth';
import { getAlerts, resolveAlert, Alert } from '@/lib/api';
import { AlertTriangle, CheckCircle } from 'lucide-react';

export default function AlertsPage() {
  const { token } = useAuth();
  const router = useRouter();
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [loading, setLoading] = useState(true);
  const [resolving, setResolving] = useState<number | null>(null);
  const [showResolved, setShowResolved] = useState(false);

  const fetchAlerts = (resolved: boolean) => {
    if (!token) return;
    const params = resolved ? '?resolved=true' : '?resolved=false';
    import('@/lib/api').then(({ apiFetch }) => {
      apiFetch<Alert[]>(`/api/alerts${params}`, { token })
        .then(a => { setAlerts(a); setLoading(false); })
        .catch(() => setLoading(false));
    });
  };

  useEffect(() => {
    setLoading(true);
    fetchAlerts(showResolved);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, showResolved]);

  const handleResolve = async (alertId: number) => {
    if (!token) return;
    setResolving(alertId);
    try {
      await resolveAlert(token, alertId);
      // Remove from list immediately for snappy UX
      setAlerts(prev => prev.filter(a => a.id !== alertId));
    } catch (e: any) {
      alert(e.message || 'Failed to resolve alert');
    } finally {
      setResolving(null);
    }
  };

  if (loading) return (
    <div className="flex items-center justify-center min-h-screen">
      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-honey-500"></div>
    </div>
  );

  const activeCount = alerts.filter(a => !a.resolved).length;

  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      <header className="bg-white border-b border-gray-100 sticky top-0 z-30">
        <div className="max-w-4xl mx-auto px-4 py-4">
          <button onClick={() => router.push('/farmer/dashboard')} className="text-gray-500 mb-2 block">&larr; Back</button>
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Alerts</h1>
              {!showResolved && activeCount > 0 && (
                <p className="text-sm text-orange-500 font-medium">{activeCount} active alert{activeCount > 1 ? 's' : ''}</p>
              )}
            </div>
            <button
              onClick={() => setShowResolved(v => !v)}
              className="text-xs text-gray-500 hover:text-gray-700 border border-gray-200 rounded-full px-3 py-1"
            >
              {showResolved ? 'Show Active' : 'Show Resolved'}
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-6 space-y-3">
        {alerts.length === 0 && (
          <div className="card text-center py-12">
            <CheckCircle className="w-12 h-12 text-green-500 mx-auto mb-3" />
            <p className="text-gray-500 font-medium">
              {showResolved ? 'No resolved alerts yet.' : 'No active alerts. All hives are healthy! 🐝'}
            </p>
          </div>
        )}

        {alerts.map(alert => (
          <div
            key={alert.id}
            className={`card border-l-4 ${alert.resolved ? 'border-gray-300' : 'border-orange-400'} ${alert.resolved ? '' : 'bg-orange-50'}`}
          >
            <div className="flex items-start gap-3">
              <AlertTriangle
                className={`w-5 h-5 mt-0.5 flex-shrink-0 ${alert.resolved ? 'text-gray-400' : 'text-orange-500'}`}
              />
              <div className="flex-1 min-w-0">
                <p className="font-medium text-gray-900">{alert.message}</p>
                <p className="text-xs text-gray-400 mt-1">{new Date(alert.created_at).toLocaleString()}</p>
                <button
                  onClick={() => router.push(`/farmer/hives/${alert.hive_id}`)}
                  className="text-sm text-honey-600 font-medium mt-1 hover:underline"
                >
                  View Hive →
                </button>
              </div>
              <div className="flex flex-col items-end gap-2 flex-shrink-0">
                <span className={`badge ${alert.resolved ? 'badge-green' : 'badge-orange'}`}>
                  {alert.resolved ? 'Resolved' : 'Active'}
                </span>
                {!alert.resolved && (
                  <button
                    onClick={() => handleResolve(alert.id)}
                    disabled={resolving === alert.id}
                    className="text-xs text-green-600 hover:text-green-800 font-medium border border-green-200 rounded px-2 py-1 hover:bg-green-50 disabled:opacity-50"
                  >
                    {resolving === alert.id ? 'Resolving...' : '✓ Resolve'}
                  </button>
                )}
              </div>
            </div>
          </div>
        ))}
      </main>

      <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-100 z-30">
        <div className="max-w-4xl mx-auto flex justify-around py-3">
          {[
            { icon: '🏠', label: 'Home', path: '/farmer/dashboard' },
            { icon: '🐝', label: 'Hives', path: '/farmer/hives' },
            { icon: '📦', label: 'Harvest', path: '/farmer/harvest' },
            { icon: '📋', label: 'Batches', path: '/farmer/batches' },
            { icon: '🔔', label: 'Alerts', path: '/farmer/alerts' },
          ].map(item => (
            <button
              key={item.label}
              onClick={() => router.push(item.path)}
              className="flex flex-col items-center text-xs text-gray-500 hover:text-honey-600"
            >
              <span className="text-lg">{item.icon}</span>{item.label}
            </button>
          ))}
        </div>
      </nav>
    </div>
  );
}