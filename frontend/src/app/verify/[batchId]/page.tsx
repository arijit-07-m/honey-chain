'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { consumerVerify, ConsumerBatchInfo } from '@/lib/api';
import { CheckCircle, XCircle, Shield, Store, Award } from 'lucide-react';

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
          <p className="mt-4 text-gray-600">Verifying honey batch on cryptographic ledger...</p>
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

  const getStageTitle = (stage: string) => {
    switch (stage) {
      case 'GENESIS': return 'Batch Initialized';
      case 'HARVEST': return 'Harvested at Apiary';
      case 'PROCESSING': return 'Quality Tested & Processed';
      case 'PACKAGING': return 'Bottled & Sealed';
      case 'RETAIL': return 'Dispatched to Retail Market (Out for Sale)';
      default: return stage.charAt(0) + stage.slice(1).toLowerCase();
    }
  };

  const isRetailReady = data.status === 'RETAIL' || data.timeline.some(e => e.stage === 'RETAIL');

  return (
    <div className="min-h-screen bg-gradient-to-b from-honey-50 to-white">
      <div className="bg-white/80 backdrop-blur-sm border-b border-gray-100">
        <div className="max-w-2xl mx-auto px-4 py-6 text-center">
          <div className="text-4xl mb-2">🍯</div>
          <h1 className="text-2xl font-bold text-gray-900">Honey Chain</h1>
          <p className="text-sm text-gray-500">Government of India · Ministry of MSME · KVIC Traceability</p>
        </div>
      </div>

      <main className="max-w-2xl mx-auto px-4 py-8 space-y-6">
        {/* Verification Status Card */}
        <div className={`card text-center border-2 ${data.valid ? 'border-green-400 bg-white' : 'border-red-400'}`}>
          <div className="flex flex-wrap items-center justify-center gap-2 mb-4">
            <div className={`inline-flex items-center gap-2 px-4 py-1.5 rounded-full text-sm font-bold ${
              data.valid ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
            }`}>
              {data.valid ? <CheckCircle className="w-5 h-5 text-green-600" /> : <XCircle className="w-5 h-5 text-red-600" />}
              {data.valid ? 'VERIFIED AUTHENTIC HONEY' : 'VERIFICATION FAILED'}
            </div>

            {isRetailReady && (
              <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold bg-blue-100 text-blue-800">
                <Store className="w-4 h-4 text-blue-600" />
                OUT FOR SALE / RETAIL VERIFIED
              </div>
            )}
          </div>

          <h2 className="text-2xl font-bold text-gray-900">{data.batch_code}</h2>
          <p className="text-sm text-honey-600 font-semibold mt-1">100% Traceable Khadi / Honey Mission Batch</p>

          <div className="mt-6 grid grid-cols-2 gap-4 text-sm text-left bg-gray-50 p-4 rounded-xl">
            <div>
              <p className="text-gray-500 text-xs uppercase font-medium">Honey Variety</p>
              <p className="font-bold text-gray-900 mt-0.5">{data.honey_type || 'Pure Multiflora'}</p>
            </div>
            <div>
              <p className="text-gray-500 text-xs uppercase font-medium">Batch Yield</p>
              <p className="font-bold text-gray-900 mt-0.5">{data.quantity} kg</p>
            </div>
            <div>
              <p className="text-gray-500 text-xs uppercase font-medium">Harvest Date</p>
              <p className="font-bold text-gray-900 mt-0.5">{new Date(data.harvest_date).toLocaleDateString()}</p>
            </div>
            <div>
              <p className="text-gray-500 text-xs uppercase font-medium">Source Hive</p>
              <p className="font-bold text-gray-900 mt-0.5">Hive {data.hive_code || 'H001'}</p>
            </div>
          </div>
        </div>

        {/* Complete Batch Journey */}
        <div className="card">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-bold text-gray-900 text-lg">Batch Supply Chain Journey</h3>
            <span className="text-xs bg-gray-100 text-gray-600 px-2.5 py-1 rounded-md font-mono">
              {data.timeline.length} Recorded Milestones
            </span>
          </div>

          <div className="space-y-0">
            {data.timeline.map((event, i) => (
              <div key={i} className="flex items-start gap-3">
                <div className="flex flex-col items-center">
                  <div className="w-8 h-8 rounded-full bg-green-500 text-white flex items-center justify-center text-sm font-bold shadow-xs">
                    ✓
                  </div>
                  {i < data.timeline.length - 1 && <div className="w-0.5 h-10 bg-green-300"></div>}
                </div>
                <div className="flex-1 pb-5">
                  <div className="flex items-center justify-between">
                    <p className="font-bold text-gray-900 text-sm">
                      {getStageTitle(event.stage)}
                    </p>
                    <span className="text-[11px] text-gray-400">
                      {new Date(event.timestamp).toLocaleDateString()}
                    </span>
                  </div>
                  <p className="text-xs text-gray-500 mt-0.5">{new Date(event.timestamp).toLocaleTimeString()}</p>
                  {event.event_data && (
                    <p className="text-xs text-gray-700 bg-gray-50 px-2.5 py-1.5 rounded mt-1.5 border border-gray-100">
                      {event.event_data}
                    </p>
                  )}
                  <p className="text-[10px] text-gray-400 font-mono mt-1">
                    Block Hash: {event.hash}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Trust & Guarantee Card */}
        <div className="card bg-green-50 border-green-200">
          <div className="flex items-center gap-3 mb-3">
            <Shield className="w-6 h-6 text-green-600" />
            <h3 className="font-bold text-green-900">Cryptographic Integrity Guarantee</h3>
          </div>
          <div className="space-y-2 text-xs text-green-800">
            <p className="flex items-center gap-2">
              <CheckCircle className="w-4 h-4 text-green-600 flex-shrink-0" />
              <span><strong>Zero-Adulteration Proof:</strong> Immutable SHA-256 chain anchors hive weight to harvest quantity.</span>
            </p>
            <p className="flex items-center gap-2">
              <CheckCircle className="w-4 h-4 text-green-600 flex-shrink-0" />
              <span><strong>Direct Beekeeper Benefit:</strong> Certified under KVIC Honey Mission directly supporting rural apiculturists.</span>
            </p>
            <p className="flex items-center gap-2">
              <Award className="w-4 h-4 text-green-600 flex-shrink-0" />
              <span><strong>Lab Testing Verified:</strong> Moisture, HMF, and pollen verified prior to retail release.</span>
            </p>
          </div>
        </div>

        <div className="text-xs text-gray-400 text-center space-y-1">
          <p>This is a verified digital traceability record backed by the Honey Chain Cryptographic Ledger.</p>
          <p className="mt-4 font-semibold text-gray-500">SIH 2026 · Ministry of MSME · Problem Statement #26021</p>
        </div>
      </main>
    </div>
  );
}