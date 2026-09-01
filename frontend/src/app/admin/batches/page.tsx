'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth';
import { getAdminBatches, verifyChain, getBatchQR, VerifyResult } from '@/lib/api';
import { CheckCircle, XCircle, QrCode } from 'lucide-react';

export default function AdminBatches() {
  const { token } = useAuth();
  const router = useRouter();
  const [batches, setBatches] = useState<any[]>([]);
  const [verifyResult, setVerifyResult] = useState<VerifyResult | null>(null);
  const [qrCode, setQrCode] = useState('');
  const [loading, setLoading] = useState(true);
  const [selectedBatchId, setSelectedBatchId] = useState<number | null>(null);

  useEffect(() => {
    if (!token) return;
    getAdminBatches(token).then(b => { setBatches(b); setLoading(false); }).catch(() => setLoading(false));
  }, [token]);

  const handleVerify = async (batchId: number) => {
    setSelectedBatchId(batchId);
    const result = await verifyChain(batchId);
    setVerifyResult(result);
    setQrCode('');
    try { const qr = await getBatchQR(batchId); setQrCode(qr.qr_code); } catch {}
  };

  if (loading) return <div className="flex items-center justify-center min-h-screen"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-honey-500"></div></div>;

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-100 sticky top-0 z-30">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <button onClick={() => router.push('/admin/dashboard')} className="text-gray-500 mb-2 block">&larr; Back</button>
          <h1 className="text-2xl font-bold text-gray-900">Batch Audit</h1>
          <p className="text-sm text-gray-500">Traceability audit with hash-chain verification</p>
        </div>
      </header>
      <main className="max-w-7xl mx-auto px-4 py-6 space-y-6">
        <div className="card overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-gray-500">
                <th className="text-left py-2">Batch ID</th>
                <th className="text-left py-2">Type</th>
                <th className="text-right py-2">Qty</th>
                <th className="text-left py-2">Status</th>
                <th className="text-left py-2">Last Hash</th>
                <th className="text-center py-2">Verify</th>
              </tr>
            </thead>
            <tbody>
              {batches.map(b => (
                <tr key={b.id} className="border-b last:border-0 hover:bg-gray-50">
                  <td className="py-3 font-medium">{b.batch_code}</td>
                  <td className="py-3 text-gray-500">{b.honey_type}</td>
                  <td className="py-3 text-right">{b.quantity}kg</td>
                  <td className="py-3"><span className="badge-blue">{b.status}</span></td>
                  <td className="py-3 text-gray-400 font-mono text-xs">{b.last_hash}</td>
                  <td className="py-3 text-center">
                    <button onClick={() => handleVerify(b.id)} className="text-honey-600 hover:underline text-xs font-medium">
                      Verify Chain
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {verifyResult && (
          <div className="card space-y-4">
            <h3 className="font-semibold text-gray-900">Verification Result</h3>
            <div className={`p-4 rounded-lg ${verifyResult.valid ? 'bg-green-50' : 'bg-red-50'}`}>
              <div className="flex items-center gap-2">
                {verifyResult.valid ? <CheckCircle className="w-6 h-6 text-green-600" /> : <XCircle className="w-6 h-6 text-red-600" />}
                <div>
                  <p className={`font-bold ${verifyResult.valid ? 'text-green-700' : 'text-red-700'}`}>
                    {verifyResult.valid ? '✓ Blockchain Integrity Verified' : '✗ Chain Integrity Compromised'}
                  </p>
                  <p className="text-sm text-gray-600">{verifyResult.batch_id} — {verifyResult.message}</p>
                </div>
              </div>
            </div>
            {qrCode && (
              <div className="text-center">
                <p className="text-sm text-gray-500 mb-2">QR Code for this batch:</p>
                <img src={qrCode} alt="QR" className="w-32 h-32 mx-auto" />
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
}