'use client';

import { useEffect, useState, use } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth';
import { getHive, getHiveTelemetry, getAlerts, injectTelemetry, HiveDetail, SensorReading, Alert } from '@/lib/api';
import dynamic from 'next/dynamic';
import { Thermometer, Droplets, Weight, Ear, AlertTriangle, Zap, Globe, Radio, Play, Pause } from 'lucide-react';

const SensorChart = dynamic(() => import('@/components/SensorChart'), { ssr: false });

const TIMEZONE_OPTIONS = [
  { label: '🇮🇳 India (IST • UTC+05:30)', value: 'Asia/Kolkata' },
  { label: '🌐 Coordinated Universal Time (UTC)', value: 'UTC' },
  { label: '🇺🇸 USA - Eastern Time (EST / EDT)', value: 'America/New_York' },
  { label: '🇺🇸 USA - Central Time (CST / CDT)', value: 'America/Chicago' },
  { label: '🇺🇸 USA - Mountain Time (MST / MDT)', value: 'America/Denver' },
  { label: '🇺🇸 USA - Pacific Time (PST / PDT)', value: 'America/Los_Angeles' },
  { label: '🇬🇧 United Kingdom (GMT / BST)', value: 'Europe/London' },
  { label: '🇪🇺 Central Europe (CET / CEST)', value: 'Europe/Paris' },
  { label: '🇦🇪 UAE / Gulf (GST • UTC+04:00)', value: 'Asia/Dubai' },
  { label: '🇸🇬 Singapore / Malaysia (SGT • UTC+08:00)', value: 'Asia/Singapore' },
  { label: '🇯🇵 Japan (JST • UTC+09:00)', value: 'Asia/Tokyo' },
  { label: '🇦🇺 Australia - Sydney (AEST / AEDT)', value: 'Australia/Sydney' },
  { label: '🇨🇦 Canada - Toronto (EST / EDT)', value: 'America/Toronto' },
];

export default function HiveDetailPage({ params }: { params: Promise<{ hiveId: string }> }) {
  const { hiveId } = use(params);
  const { token } = useAuth();
  const router = useRouter();
  const [hive, setHive] = useState<HiveDetail | null>(null);
  const [telemetry, setTelemetry] = useState<SensorReading[]>([]);
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [loading, setLoading] = useState(true);
  const [injecting, setInjecting] = useState(false);
  const [injectMsg, setInjectMsg] = useState('');
  const [selectedTimezone, setSelectedTimezone] = useState<string>('Asia/Kolkata');
  const [isSimulating, setIsSimulating] = useState(false); // In-browser virtual sensor stream

  // Load saved timezone or default to India (IST)
  useEffect(() => {
    const savedTz = localStorage.getItem('honeychain_tz');
    if (savedTz) {
      setSelectedTimezone(savedTz);
    }
  }, []);

  const handleTimezoneChange = (tz: string) => {
    setSelectedTimezone(tz);
    localStorage.setItem('honeychain_tz', tz);
  };

  // Browser-based Virtual Sensor Stream: Generates live telemetry even when ESP32 or terminal sim is offline
  useEffect(() => {
    if (!isSimulating || !token) return;
    const id = parseInt(hiveId);

    const streamInterval = setInterval(async () => {
      const temp = Number((32.2 + (Math.random() * 1.6 - 0.8)).toFixed(1));
      const hum = Number((64.5 + (Math.random() * 3.4 - 1.7)).toFixed(1));
      const wt = Number((24.9 + (Math.random() * 0.6 - 0.3)).toFixed(1));
      const snd = Number((56.0 + (Math.random() * 5.0 - 2.5)).toFixed(0));

      try {
        await injectTelemetry(token, id, {
          temperature: temp,
          humidity: hum,
          weight: wt,
          sound_level: snd,
        });
      } catch {}
    }, 4000);

    return () => clearInterval(streamInterval);
  }, [isSimulating, token, hiveId]);

  useEffect(() => {
    if (!token) return;
    const id = parseInt(hiveId);

    const load = () => {
      Promise.all([
        getHive(token, id),
        getHiveTelemetry(token, id, 100),
        getAlerts(token, id),
      ]).then(([h, t, a]) => {
        setHive(h); setTelemetry(t); setAlerts(a); setLoading(false);
      }).catch(() => setLoading(false));
    };

    load();
    // Live refresh every 5 seconds so new sensor readings appear in real-time
    const interval = setInterval(load, 5000);
    return () => clearInterval(interval);
  }, [token, hiveId]);

  const handleInjectAnomaly = async () => {
    if (!token) return;
    setInjecting(true);
    setInjectMsg('');
    try {
      await injectTelemetry(token, parseInt(hiveId), {
        temperature: 39.8,
        humidity: 91.2,
        weight: 14.1,
        sound_level: 85.3,
      });
      setInjectMsg('⚡ Anomaly injected! AI is analyzing… check back in 5s.');
    } catch (e: any) {
      setInjectMsg(`Error: ${e.message}`);
    } finally {
      setInjecting(false);
    }
  };

  if (loading) return (
    <div className="flex items-center justify-center min-h-screen">
      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-honey-500"></div>
    </div>
  );
  if (!hive) return <div className="p-8 text-center text-gray-500">Hive not found</div>;

  // Format UTC timestamps according to user-selected country / time zone
  const formatWithTz = (ts: string | null, includeSeconds = true) => {
    if (!ts) return 'N/A';
    const utcStr = ts.endsWith('Z') || ts.includes('+') ? ts : `${ts}Z`;
    try {
      return new Date(utcStr).toLocaleTimeString([], {
        timeZone: selectedTimezone,
        hour: '2-digit',
        minute: '2-digit',
        second: includeSeconds ? '2-digit' : undefined,
      });
    } catch {
      return new Date(utcStr).toLocaleTimeString();
    }
  };

  const chartData = telemetry.map(r => ({
    time: formatWithTz(r.timestamp, false),
    temperature: r.temperature,
    humidity: r.humidity,
    weight: r.weight,
    sound: r.sound_level,
  }));

  const activeAlerts = alerts.filter(a => !a.resolved);

  // Timezone display label (e.g. "IST" or "Asia/Kolkata")
  const currentTzLabel = TIMEZONE_OPTIONS.find(t => t.value === selectedTimezone)?.label.split('(')[1]?.replace(')', '') || selectedTimezone;

  // Connection Heartbeat: dynamically detects whether physical hardware, simulator, or browser stream is active
  const getDeviceHealth = () => {
    if (isSimulating) {
      return {
        label: 'VIRTUAL STREAM',
        badge: 'bg-emerald-100 text-emerald-800 border-emerald-300',
        dot: 'bg-emerald-500 animate-pulse',
        desc: 'Browser-driven virtual sensors publishing every 4s',
        isLive: true,
      };
    }
    if (!hive?.last_updated) {
      return {
        label: 'NO DATA',
        badge: 'bg-gray-100 text-gray-600 border-gray-300',
        dot: 'bg-gray-400',
        desc: 'No sensor data recorded yet for this node',
        isLive: false,
      };
    }
    const utcStr = hive.last_updated.endsWith('Z') || hive.last_updated.includes('+') ? hive.last_updated : `${hive.last_updated}Z`;
    const secondsAgo = Math.max(0, Math.round((Date.now() - new Date(utcStr).getTime()) / 1000));

    if (secondsAgo <= 65) {
      return {
        label: 'LIVE SENSORS',
        badge: 'bg-green-100 text-green-700 border-green-300',
        dot: 'bg-green-500 animate-pulse',
        desc: `Active heartbeat received ${secondsAgo}s ago via MQTT / API`,
        isLive: true,
      };
    } else if (secondsAgo <= 900) {
      const mins = Math.max(1, Math.round(secondsAgo / 60));
      return {
        label: `STANDBY • SLEEP (${mins}m ago)`,
        badge: 'bg-amber-100 text-amber-800 border-amber-300',
        dot: 'bg-amber-500',
        desc: 'ESP32 in low-power conservation cycle; awaiting next interval',
        isLive: false,
      };
    } else {
      return {
        label: 'NODE OFFLINE',
        badge: 'bg-gray-100 text-gray-700 border-gray-300',
        dot: 'bg-gray-400',
        desc: 'Hardware inactive. Turn on Virtual Stream or check battery.',
        isLive: false,
      };
    }
  };

  const health = getDeviceHealth();

  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      <header className="bg-white border-b border-gray-100 sticky top-0 z-30">
        <div className="max-w-4xl mx-auto px-4 py-4">
          <button onClick={() => router.push('/farmer/hives')} className="text-gray-500 mb-2 block">&larr; Back</button>
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Hive {hive.hive_code}</h1>
              <div className="flex items-center gap-2 mt-1 flex-wrap">
                <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-bold border ${health.badge}`} title={health.desc}>
                  <span className={`w-2 h-2 rounded-full ${health.dot}`}></span>
                  {health.label}
                </span>
                <p className="text-sm text-gray-500">
                  Last updated: <span className="font-semibold text-gray-800">{formatWithTz(hive.last_updated)}</span> <span className="text-xs font-medium text-amber-700 bg-amber-100 px-1.5 py-0.5 rounded ml-1">{currentTzLabel}</span>
                </p>
              </div>
            </div>

            {/* Action Buttons: Virtual Stream Toggle & Anomaly Injector */}
            <div className="flex items-center gap-2 self-start sm:self-center flex-wrap">
              {/* Virtual IoT Sensor Stream Switch */}
              <button
                type="button"
                onClick={() => setIsSimulating(!isSimulating)}
                className={`flex items-center gap-1.5 text-xs font-bold px-3 py-2 rounded-lg transition-all border ${
                  isSimulating
                    ? 'bg-emerald-600 text-white border-emerald-700 shadow-sm animate-pulse'
                    : 'bg-white hover:bg-emerald-50 text-emerald-800 border-emerald-300'
                }`}
                title="Simulate live ESP32 telemetry streaming directly in your browser without hardware"
              >
                <Radio className="w-3.5 h-3.5" />
                {isSimulating ? 'Virtual Stream: ON' : 'Virtual Stream: OFF'}
              </button>

              {/* Anomaly Injection — demo tool for judges */}
              <button
                onClick={handleInjectAnomaly}
                disabled={injecting}
                className="flex items-center gap-1.5 bg-red-500 hover:bg-red-600 disabled:opacity-50 text-white text-xs font-bold px-3 py-2 rounded-lg transition-colors shadow-xs"
                title="Inject anomalous sensor values to trigger AI detection"
              >
                <Zap className="w-3.5 h-3.5" />
                {injecting ? 'Injecting…' : 'Inject Anomaly'}
              </button>
            </div>
          </div>
          {injectMsg && (
            <p className="text-xs mt-2 text-orange-600 font-medium">{injectMsg}</p>
          )}
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

        {/* Offline / Standby Resilience Banner */}
        {!health.isLive && !isSimulating && (
          <div className="card bg-blue-50/70 border border-blue-200 p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-blue-100 flex items-center justify-center text-blue-700 flex-shrink-0">
                <Radio className="w-4 h-4" />
              </div>
              <div>
                <h4 className="text-sm font-bold text-gray-900">Offline Resilience Active</h4>
                <p className="text-xs text-gray-600 mt-0.5">
                  Physical ESP32 node is in conservation sleep or offline. Historical readings and blockchain records remain 100% accessible.
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setIsSimulating(true)}
              className="btn-primary text-xs py-1.5 px-3 whitespace-nowrap self-end sm:self-center shadow-xs flex items-center gap-1"
            >
              <Radio className="w-3.5 h-3.5" /> Start Virtual Stream ⚡
            </button>
          </div>
        )}

        {/* Sensor value cards */}
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

        {/* Sensor charts */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="card">
            <h3 className="text-sm font-medium text-gray-500 mb-4">Temperature (°C)</h3>
            <div className="h-48"><SensorChart data={chartData} dataKey="temperature" color="#dc2626" /></div>
          </div>
          <div className="card">
            <h3 className="text-sm font-medium text-gray-500 mb-4">Humidity (%)</h3>
            <div className="h-48"><SensorChart data={chartData} dataKey="humidity" color="#2563eb" /></div>
          </div>
          <div className="card">
            <h3 className="text-sm font-medium text-gray-500 mb-4">Weight (kg)</h3>
            <div className="h-48"><SensorChart data={chartData} dataKey="weight" color="#16a34a" /></div>
          </div>
          <div className="card">
            <h3 className="text-sm font-medium text-gray-500 mb-4">Sound Level (dB)</h3>
            <div className="h-48"><SensorChart data={chartData} dataKey="sound" color="#9333ea" /></div>
          </div>
        </div>

        {/* Status card */}
        <div className="card">
          <h3 className="font-medium text-gray-900 mb-2">Hive Status</h3>
          <p className={`inline-flex items-center gap-1 font-medium ${hive.status === 'HEALTHY' ? 'text-green-600' : hive.status === 'CRITICAL' ? 'text-red-600' : 'text-orange-600'}`}>
            <span className={`w-2 h-2 rounded-full ${hive.status === 'HEALTHY' ? 'bg-green-500' : hive.status === 'CRITICAL' ? 'bg-red-500' : 'bg-orange-500'}`}></span>
            {hive.status === 'HEALTHY' ? 'Healthy' : hive.status === 'CRITICAL' ? 'Critical' : 'Needs Attention'}
          </p>
          {hive.anomaly_status && hive.anomaly_status !== 'NORMAL' && (
            <p className="text-sm text-orange-600 mt-2">AI Detection: <span className="font-medium">{hive.anomaly_status}</span></p>
          )}
          <p className="text-xs text-gray-400 mt-4">* Live data refreshes every 5 seconds.</p>
        </div>

        {/* Country & Time Zone Selection Card */}
        <div className="card bg-gradient-to-r from-amber-50/60 to-orange-50/60 border border-amber-200/80">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-amber-100 flex items-center justify-center text-amber-700 flex-shrink-0">
                <Globe className="w-4 h-4" />
              </div>
              <div>
                <h4 className="text-sm font-bold text-gray-900">Country & Time Zone Setting</h4>
                <p className="text-xs text-gray-500">Telemetry timestamps will automatically adapt to your regional time</p>
              </div>
            </div>
            <div className="sm:w-72">
              <select
                value={selectedTimezone}
                onChange={(e) => handleTimezoneChange(e.target.value)}
                className="w-full text-xs font-semibold bg-white border border-amber-300 rounded-lg px-3 py-2 text-gray-800 focus:outline-none focus:ring-2 focus:ring-amber-500 shadow-sm cursor-pointer"
              >
                {TIMEZONE_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Quick preset buttons */}
          <div className="flex flex-wrap items-center gap-1.5 mt-3 pt-3 border-t border-amber-100">
            <span className="text-[11px] font-medium text-gray-500 mr-1">Quick Select:</span>
            {[
              { label: '🇮🇳 India (IST)', tz: 'Asia/Kolkata' },
              { label: '🌐 UTC', tz: 'UTC' },
              { label: '🇺🇸 US Eastern', tz: 'America/New_York' },
              { label: '🇬🇧 UK (GMT)', tz: 'Europe/London' },
              { label: '🇦🇪 UAE (GST)', tz: 'Asia/Dubai' },
              { label: '🇸🇬 Singapore', tz: 'Asia/Singapore' },
            ].map((p) => (
              <button
                key={p.tz}
                onClick={() => handleTimezoneChange(p.tz)}
                className={`text-[11px] px-2 py-0.5 rounded-full font-medium transition-colors ${
                  selectedTimezone === p.tz
                    ? 'bg-amber-600 text-white font-bold shadow-xs'
                    : 'bg-white text-gray-700 border border-gray-200 hover:bg-amber-50'
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>
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
