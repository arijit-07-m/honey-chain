'use client';

import { useEffect, useState, use } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth';
import { getHive, getHiveTelemetry, getAlerts, HiveDetail, SensorReading, Alert } from '@/lib/api';
import dynamic from 'next/dynamic';
import { Thermometer, Droplets, Weight, Ear, AlertTriangle } from 'lucide-react';

const SensorChart = dynamic(() => import('@/components/SensorChart'), { ssr: false });

export default function HiveDetailPage({ params }: { params: Promise<{ hiveId: string }> }) {
  const { hiveId } = use(params);
  const { token } = useAuth();
  const router = useRouter();
  const [hive, setHive] = useState<HiveDetail | null>(null);
  const [telemetry, setTelemetry] = useState<SensorReading[]>([]);
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!token) return;
    const id = parseInt(hiveId);
    Promise.all([
      getHive(token, id), getHiveTelemetry(token, id, 100), getAlerts(token, id),
    ]).then(([h, t, a]) => { setHive(h); setTelemetry(t); setAlerts(a); setLoading(false); })
      .catch(() => setLoading(false));
  }, [token, hiveId]);

  if (loading) return <div className="flex items-center justify-center min-h-screen"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-honey-500"></div></div>;
  if (!hive) return <div className="p-8 text-center text-gray-500">Hive not found</div>;

  const chartData = telemetry.map(r => ({
    time: new Date(r.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    temperature: r.temperature, humidity: r.humidity, weight: r.weight, sound: r.sound_level,
  }));

  const activeAlerts = alerts.filter(a => !a.resolved);

  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      <header className="bg-white border-b border-gray-100 sticky top-0 z-30">
        <div className="max-w-4xl mx-auto px-4 py-4">
          <button onClick={() => router.push('/farmer/hives')} className="text-gray-500 mb-2 block">&larr; Back</button>
          <h1 className="text-2xl font-bold text-gray-900">Hive {hive.hive_code}</h1>
          <p className="text-sm text-gray-500">Last updated: {hive.last_updated ? new Date(hive.last_updated).toLocaleString() : 'N/A'}</p>
        </div>
      </header>
<main className="max-w-4xl mx-auto px-4 py-6 space-y-6">
        {activeAlerts.map(alert => (
          <div key={alert.id} className="card border-l-4 border-orange-400 bg-orange-50">
            <div className="flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 text-orange-500 mt-0.5 flex-shrink-0" />
              <div>
                <p className="font-medium text-gray-900">⚠ Potential Anomaly Detected</p>
                <p className="text-sm text-gray-600">{alert.message}</p>
                <p className="text-xs text-gray-400 mt-1">Recommended action: Inspect the hive and check colony activity.</p>
              </div>
            </div>
          </div>
        ))}

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { icon: <Thermometer className="w-5 h-5 text-red-500" />, label: 'Temperature', value: `${hive.latest_temperature?.toFixed(1) ?? '--'} °C`, color: 'text-red-600' },
            { icon: <Droplets className="w-5 h-5 text-blue-500" />, label: 'Humidity', value: `${hive.latest_humidity?.toFixed(1) ?? '--'} %`, color: 'text-blue-600' },
            { icon: <Weight className="w-5 h-5 text-gray-700" />, label: 'Weight', value: `${hive.latest_weight?.toFixed(1) ?? '--'} kg`, color: 'text-gray-800' },
            { icon: <Ear className="w-5 h-5 text-purple-500" />, label: 'Sound', value: `${hive.latest_sound_level?.toFixed(0) ?? '--'} dB`, color: 'text-purple-600' },
          ].map((s, i) => (
            <div key={i} className="card text-center">
              <div className="flex justify-center mb-2">{s.icon}</div>
              <p className="text-sm text-gray-500">{s.label}</p>
              <p className={`text-xl font-bold ${s.color}`}>{s.value}</p>
            </div>
          ))}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="card">
            <h3 className="text-sm font-medium text-gray-500 mb-4">Temperature</h3>
            <div className="h-48"><SensorChart data={chartData} dataKey="temperature" color="#dc2626" /></div>
          </div>
          <div className="card">
            <h3 className="text-sm font-medium text-gray-500 mb-4">Humidity</h3>
            <div className="h-48"><SensorChart data={chartData} dataKey="humidity" color="#2563eb" /></div>
          </div>
          <div className="card">
            <h3 className="text-sm font-medium text-gray-500 mb-4">Weight</h3>
            <div className="h-48"><SensorChart data={chartData} dataKey="weight" color="#16a34a" /></div>
          </div>
          <div className="card">
            <h3 className="text-sm font-medium text-gray-500 mb-4">Sound Level</h3>
            <div className="h-48"><SensorChart data={chartData} dataKey="sound" color="#9333ea" /></div>
          </div>
        </div>

        <div className="card">
          <h3 className="font-medium text-gray-900 mb-2">Status</h3>
          <p className={`inline-flex items-center gap-1 font-medium ${hive.status === 'HEALTHY' ? 'text-green-600' : 'text-orange-600'}`}>
            <span className={`w-2 h-2 rounded-full ${hive.status === 'HEALTHY' ? 'bg-green-500' : 'bg-orange-500'}`}></span>
            {hive.status === 'HEALTHY' ? 'Healthy' : 'Needs Attention'}
          </p>
          <p className="text-xs text-gray-400 mt-4">* Sensor data shown is for demonstration purposes.</p>
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

