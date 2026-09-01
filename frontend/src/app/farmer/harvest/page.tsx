'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth';
import { getHives, createHarvest, Hive } from '@/lib/api';

export default function HarvestPage() {
  const { token } = useAuth();
  const router = useRouter();
  const [hives, setHives] = useState<Hive[]>([]);
  const [hiveId, setHiveId] = useState('');
  const [honeyType, setHoneyType] = useState('Mustard Honey');
  const [quantity, setQuantity] = useState('');
  const [location, setLocation] = useState('');
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => {
    if (!token) return;
    getHives(token).then(setHives).catch(() => {});
  }, [token]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token || !hiveId) return;
    setError('');
    setLoading(true);
    try {
      const batch = await createHarvest(token, {
        hive_id: parseInt(hiveId),
        honey_type: honeyType,
        harvest_date: new Date().toISOString(),
        quantity: parseFloat(quantity),
        location: location || undefined,
        notes: notes || undefined,
      });
      setSuccess(`Batch ${batch.batch_code} created successfully!`);
      setTimeout(() => router.push('/farmer/batches'), 1500);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      <header className="bg-white border-b border-gray-100 sticky top-0 z-30">
        <div className="max-w-4xl mx-auto px-4 py-4">
          <button onClick={() => router.push('/farmer/dashboard')} className="text-gray-500 mb-2 block">&larr; Back</button>
          <h1 className="text-2xl font-bold text-gray-900">New Harvest</h1>
          <p className="text-sm text-gray-500">Create a verified honey batch</p>
        </div>
      </header>
      <main className="max-w-4xl mx-auto px-4 py-6">
        <form onSubmit={handleSubmit} className="card space-y-4">
          <div>
            <label className="label">Select Hive</label>
            <select className="input-field" value={hiveId} onChange={e => setHiveId(e.target.value)} required>
              <option value="">Choose a hive...</option>
              {hives.map(h => <option key={h.id} value={h.id}>{h.hive_code}</option>)}
            </select>
          </div>
          <div>
            <label className="label">Honey Type</label>
            <select className="input-field" value={honeyType} onChange={e => setHoneyType(e.target.value)}>
              <option>Mustard Honey</option><option>Litchi Honey</option><option>Eucalyptus Honey</option>
              <option>Acacia Honey</option><option>Multiflora Honey</option><option>Sesame Honey</option>
              <option>Sunflower Honey</option><option>Neem Honey</option>
            </select>
          </div>
          <div>
            <label className="label">Quantity (kg)</label>
            <input type="number" step="0.1" min="0.1" className="input-field" value={quantity}
              onChange={e => setQuantity(e.target.value)} placeholder="e.g. 18.5" required />
          </div>
          <div>
            <label className="label">Location (optional)</label>
            <input type="text" className="input-field" value={location}
              onChange={e => setLocation(e.target.value)} placeholder="e.g. Kanpur, UP" />
          </div>
          <div>
            <label className="label">Notes (optional)</label>
            <textarea className="input-field" rows={3} value={notes}
              onChange={e => setNotes(e.target.value)} placeholder="Any additional notes..." />
          </div>
          {error && <p className="text-red-500 text-sm">{error}</p>}
          {success && <p className="text-green-600 font-medium">{success}</p>}
          <button type="submit" className="btn-primary w-full text-lg py-3" disabled={loading}>
            {loading ? 'Creating...' : 'Create Verified Batch'}
          </button>
        </form>
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