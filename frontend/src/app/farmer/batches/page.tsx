'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth';
import { getBatches, getBatch, addEvent, verifyChain, getBatchQR, Batch, BatchDetail, VerifyResult } from '@/lib/api';
import { CheckCircle, XCircle, Download } from 'lucide-react';

export default function BatchesPage() {
  const { token } = useAuth();
  const router = useRouter();
  const [batches, setBatches] = useState<Batch[]>([]);
  const [selectedBatch, setSelectedBatch] = useState<BatchDetail | null>(null);
  const [verifyResult, setVerifyResult] = useState<VerifyResult | null>(null);
  const [qrCode, setQrCode] = useState('');
  const [loading, setLoading] = useState(true);
  const [addingEvent, setAddingEvent] = useState(false);

  useEffect(() => {
    if (!token) return;
    getBatches(token).then(b => { setBatches(b); setLoading(false); }).catch(() => setLoading(false));
  }, [token]);

  const loadBatch = async (id: number) => {
    if (!token) return;
    const detail = await getBatch(token, id);
    setSelectedBatch(detail);
    setVerifyResult(null);
    setQrCode('');
    try { const qr = await getBatchQR(id); setQrCode(qr.qr_code); } catch {}
  };

  const handleVerify = async () => {
    if (!selectedBatch) return;
    setVerifyResult(await verifyChain(selectedBatch.id));
  };

  const handleAddEvent = async (stage: string) => {
    if (!token || !selectedBatch) return;
    setAddingEvent(true);
    try { await addEvent(token, selectedBatch.id, stage, `${stage} completed`); await loadBatch(selectedBatch.id); }
    catch (e: any) { alert(e.message); }
    setAddingEvent(false);
  };

  const handleDownloadQR = () => {
    if (!qrCode) return;
    const link = document.createElement('a');
    link.href = qrCode; link.download = `${selectedBatch?.batch_code || 'batch'}-qr.png`; link.click();
  };

  const nextStage = (s: string) => s === 'HARVEST' ? 'PROCESSING' : s === 'PROCESSING' ? 'PACKAGING' : null;

  if (loading) return <div className="flex items-center justify-center min-h-screen"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-honey-500"></div></div>;

  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      <header className="bg-white border-b border-gray-100 sticky top-0 z-30">
        <div className="max-w-4xl mx-auto px-4 py-4">
          <button onClick={() => router.push('/farmer/dashboard')} className="text-gray-500 mb-2 block">&larr; Back</button>
          <h1 className="text-2xl font-bold text-gray-900">Batches</h1>
        </div>
      </header>
      <main className="max-w-4xl mx-auto px-4 py-6 space-y-6">
        {selectedBatch ? (
          <div className="space-y-4">
            <button onClick={() => setSelectedBatch(null)} className="text-sm text-gray-500 hover:underline">&larr; Back to batches</button>
            <div className="card">
              <h2 className="text-xl font-bold text-gray-900">{selectedBatch.batch_code}</h2>
              <p className="text-gray-500">{selectedBatch.honey_type} · {selectedBatch.quantity}kg</p>
              <p className="text-sm text-gray-400">Harvested: {new Date(selectedBatch.harvest_date).toLocaleDateString()}</p>
            </div>
            <div className="card">
              <h3 className="font-semibold text-gray-900 mb-4">Traceability Timeline</h3>
              <div className="space-y-4">
                {['GENESIS', 'HARVEST', 'PROCESSING', 'PACKAGING'].map((stage, i) => {
                  const event = selectedBatch.events.find(e => e.stage === stage);
                  return (
                    <div key={stage} className="flex items-start gap-3">
                      <div className="flex flex-col items-center">
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${event ? 'bg-green-500 text-white' : 'bg-gray-200 text-gray-400'}`}>
                          {event ? '✓' : i + 1}
                        </div>
                        {i < 3 && <div className="w-0.5 h-8 bg-gray-200"></div>}
                      </div>
                      <div className="flex-1">
                        <p className="font-medium text-gray-900">{stage === 'GENESIS' ? 'Batch Created' : stage}</p>
                        {event ? (
                          <>
                            <p className="text-sm text-gray-500">{new Date(event.timestamp).toLocaleString()}</p>
                            {event.event_data && <p className="text-xs text-gray-400">{event.event_data}</p>}
                            <p className="text-xs text-gray-300 font-mono mt-1">Hash: {event.current_hash.substring(0, 16)}...</p>
                          </>
                        ) : (
                          <p className="text-sm text-gray-400 italic">Pending</p>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="card space-y-3">
              <h3 className="font-semibold text-gray-900">Actions</h3>
              {nextStage(selectedBatch.status) && (
                <button onClick={() => handleAddEvent(nextStage(selectedBatch.status)!)}
                  className="btn-primary w-full" disabled={addingEvent}>
                  {addingEvent ? 'Adding...' : `Mark as ${nextStage(selectedBatch.status)}`}
                </button>
              )}
              <button onClick={handleVerify} className="btn-secondary w-full">Verify Chain</button>
              {verifyResult && (
                <div className={`p-3 rounded-lg ${verifyResult.valid ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
                  <div className="flex items-center gap-2 font-medium">
                    {verifyResult.valid ? <CheckCircle className="w-5 h-5" /> : <XCircle className="w-5 h-5" />}
                    {verifyResult.valid ? '✓ Chain Valid' : '✗ Chain Compromised'}
                  </div>
                  <p className="text-sm mt-1">{verifyResult.message}</p>
                </div>
              )}
              {qrCode && (
                <div className="text-center">
                  <img src={qrCode} alt="QR Code" className="w-40 h-40 mx-auto" />
                  <button onClick={handleDownloadQR} className="btn-secondary mt-2 inline-flex items-center gap-2">
                    <Download className="w-4 h-4" /> Download QR
                  </button>
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            {batches.map(batch => (
              <div key={batch.id} onClick={() => loadBatch(batch.id)} className="card flex items-center justify-between cursor-pointer hover:shadow-md">
                <div>
                  <p className="font-medium text-gray-900">{batch.batch_code}</p>
                  <p className="text-sm text-gray-500">{batch.honey_type} · {batch.quantity}kg</p>
                </div>
                <span className="badge-blue">{batch.status}</span>
              </div>
            ))}
          </div>
        )}
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