'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { consumerVerify, ConsumerBatchInfo } from '@/lib/api';
import { CheckCircle, XCircle, Shield } from 'lucide-react';

export default function ConsumerVerifyPage() {
  const params = useParams();
  const batchCode = params.batchId as string;
  const [data, setData] = useState<ConsumerBatchInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!batchCode) return;
    consumerVerify(batchCode)
      .then(d => { setData(d); setLoading(false); })
      .catch(e => { setError(e.message); setLoading(false); });
  }, [batchCode]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-honey-50 to-white flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-honey-500 mx-auto"></div>
          <p className="mt-4 text-gray-600">Verifying honey batch...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-honey-50 to-white flex items-center justify-center p-4">
        <div className="card max-w-md w-full text-center">
          <XCircle className="w-16 h-16 text-red-400 mx-auto mb-4" />
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Batch Not Found</h1>
          <p className="text-gray-500">The batch code "{batchCode}" could not be verified.</p>
        </div>
      </div>
    );
  }

  if (!data) return null;

  return (
    <div className="min-h-screen bg-gradient-to-b from-honey-50 to-white">
      <div className="bg-white/80 backdrop-blur-sm border-b border-gray-100">
        <div className="max-w-2xl mx-auto px-4 py-6 text-center">
          <div className="text-4xl mb-2">🍯</div>
          <h1 className="text-2xl font-bold text-gray-900">Honey Chain</h1>
          <p className="text-sm text-gray-500">Verified Honey Traceability</p>
        </div>
      </div>

      <main className="max-w-2xl mx-auto px-4 py-8 space-y-6">
        <div className={`card text-center border-2 ${data.valid ? 'border-green-400' : 'border-red-400'}`}>
          <div className={`inline-flex items-center gap-2 px-4 py-2 rounded-full text-sm font-bold mb-4 ${data.valid ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
            {data.valid ? <CheckCircle className="w-5 h-5" /> : <XCircle className="w-5 h-5" />}
            {data.valid ? 'VERIFIED HONEY' : 'VERIFICATION FAILED'}
          </div>
          <h2 className="text-xl font-bold text-gray-900">{data.batch_code}</h2>
          <div className="mt-4 grid grid-cols-2 gap-4 text-sm">
            <div><p className="text-gray-500">Honey Type</p><p className="font-semibold text-gray-900">{data.honey_type || 'N/A'}</p></div>
            <div><p className="text-gray-500">Quantity</p><p className="font-semibold text-gray-900">{data.quantity} kg</p></div>
            <div><p className="text-gray-500">Harvested</p><p className="font-semibold text-gray-900">{new Date(data.harvest_date).toLocaleDateString()}</p></div>
            <div><p className="text-gray-500">Hive</p><p className="font-semibold text-gray-900">{data.hive_code || 'N/A'}</p></div>
          </div>
        </div>
<div className="card">
          <h3 className="font-semibold text-gray-900 mb-4">Batch Journey</h3>
          <div className="space-y-0">
            {data.timeline.map((event, i) => (
              <div key={i} className="flex items-start gap-3">
                <div className="flex flex-col items-center">
                  <div className="w-8 h-8 rounded-full bg-green-500 text-white flex items-center justify-center text-sm font-bold">✓</div>
                  {i < data.timeline.length - 1 && <div className="w-0.5 h-8 bg-green-200"></div>}
                </div>
                <div className="flex-1 pb-6">
                  <p className="font-medium text-gray-900">
                    {event.stage === 'GENESIS' ? 'Batch Created' : event.stage.charAt(0) + event.stage.slice(1).toLowerCase()}
                  </p>
                  <p className="text-sm text-gray-500">{new Date(event.timestamp).toLocaleString()}</p>
                  {event.event_data && <p className="text-xs text-gray-400 mt-1">{event.event_data}</p>}
                  <p className="text-xs text-gray-300 font-mono mt-1">Hash: {event.hash}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="card bg-green-50 border-green-100">
          <div className="flex items-center gap-3 mb-3">
            <Shield className="w-6 h-6 text-green-600" />
            <h3 className="font-semibold text-green-800">Traceability & Integrity</h3>
          </div>
          <div className="space-y-2 text-sm text-green-700">
            <p className="flex items-center gap-2"><CheckCircle className="w-4 h-4" /> Verified digital record</p>
            <p className="flex items-center gap-2"><CheckCircle className="w-4 h-4" /> Hash-chain integrity verified</p>
            <p className="flex items-center gap-2"><CheckCircle className="w-4 h-4" /> Complete batch journey from hive to jar</p>
          </div>
        </div>

        <div className="text-xs text-gray-400 text-center space-y-1">
          <p>This is a verified digital traceability record. The information shown is based on data recorded by the beekeeper and supply chain actors.</p>
          <p>Honey Chain does not independently verify product quality claims such as "pure" or "organic".</p>
          <p className="mt-4">SIH 2026 · Ministry of MSME · Problem Statement #26021</p>
        </div>
      </main>
    </div>
  );
}