'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth';
import { getBatches, getBatch, addEvent, verifyChain, getBatchQR, Batch, BatchDetail, VerifyResult } from '@/lib/api';
import { CheckCircle, XCircle, Printer, Share2, CheckSquare, Square, Layers, Sparkles, ExternalLink } from 'lucide-react';

export default function BatchesPage() {
  const { token } = useAuth();
  const router = useRouter();
  const [batches, setBatches] = useState<Batch[]>([]);
  const [selectedBatch, setSelectedBatch] = useState<BatchDetail | null>(null);
  const [verifyResult, setVerifyResult] = useState<VerifyResult | null>(null);
  const [qrCode, setQrCode] = useState('');
  const [loading, setLoading] = useState(true);
  const [addingEvent, setAddingEvent] = useState(false);

  // Bulk management state
  const [selectedBatchIds, setSelectedBatchIds] = useState<number[]>([]);
  const [bulkProcessing, setBulkProcessing] = useState(false);

  // Label printing settings
  const [jarSize, setJarSize] = useState<number>(500); // grams
  const [showLabelSheet, setShowLabelSheet] = useState(false);

  useEffect(() => {
    if (!token) return;
    loadBatchList();
  }, [token]);

  const loadBatchList = async () => {
    if (!token) return;
    try {
      const b = await getBatches(token);
      setBatches(b);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  };

  const loadBatch = async (id: number) => {
    if (!token) return;
    const detail = await getBatch(token, id);
    setSelectedBatch(detail);
    setVerifyResult(null);
    setQrCode('');
    setShowLabelSheet(false);
    try {
      const qr = await getBatchQR(id);
      setQrCode(qr.qr_code);
    } catch {}
  };

  const handleVerify = async () => {
    if (!selectedBatch) return;
    setVerifyResult(await verifyChain(selectedBatch.id));
  };

  const handleAddEvent = async (stage: string) => {
    if (!token || !selectedBatch) return;
    setAddingEvent(true);
    try {
      await addEvent(token, selectedBatch.id, stage, `${stage} completed`);
      await loadBatch(selectedBatch.id);
      await loadBatchList();
    } catch (e: any) {
      alert(e.message);
    }
    setAddingEvent(false);
  };

  // Bulk advance all selected batches
  const handleBulkAdvance = async () => {
    if (!token || selectedBatchIds.length === 0) return;
    setBulkProcessing(true);
    try {
      for (const id of selectedBatchIds) {
        const b = batches.find(x => x.id === id);
        if (!b) continue;
        const next = nextStage(b.status);
        if (next) {
          await addEvent(token, id, next, `Bulk ${next} completed`);
        }
      }
      setSelectedBatchIds([]);
      await loadBatchList();
    } catch (e: any) {
      alert(`Bulk update error: ${e.message}`);
    } finally {
      setBulkProcessing(false);
    }
  };

  const toggleSelectBatch = (id: number, e: React.MouseEvent) => {
    e.stopPropagation();
    setSelectedBatchIds(prev => 
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );
  };

  const toggleSelectAll = () => {
    if (selectedBatchIds.length === batches.length) {
      setSelectedBatchIds([]);
    } else {
      setSelectedBatchIds(batches.map(b => b.id));
    }
  };

  const handlePrintLabels = () => {
    window.print();
  };

  const handleShareLink = () => {
    if (!selectedBatch) return;
    const url = `${window.location.origin}/verify/${selectedBatch.batch_code}`;
    const text = `Verified Pure Honey Batch ${selectedBatch.batch_code} (${selectedBatch.honey_type || 'Honey'}, ${selectedBatch.quantity}kg). Verified on Honey Chain: ${url}`;
    if (navigator.share) {
      navigator.share({ title: `Honey Batch ${selectedBatch.batch_code}`, text, url }).catch(() => {});
    } else {
      navigator.clipboard.writeText(text);
      alert('Verification link copied to clipboard! You can paste it into WhatsApp or SMS.');
    }
  };

  const nextStage = (s: string) => s === 'HARVEST' ? 'PROCESSING' : s === 'PROCESSING' ? 'PACKAGING' : null;

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-honey-500"></div>
      </div>
    );
  }

  // Calculate number of jar stickers for sheet
  const stickerCount = selectedBatch ? Math.max(1, Math.min(60, Math.ceil((selectedBatch.quantity * 1000) / jarSize))) : 0;

  return (
    <div className="min-h-screen bg-gray-50 pb-20 print:bg-white print:pb-0">
      {/* Top Header - hidden in print */}
      <header className="bg-white border-b border-gray-100 sticky top-0 z-30 print:hidden">
        <div className="max-w-4xl mx-auto px-4 py-4 flex justify-between items-center">
          <div>
            <button onClick={() => selectedBatch ? setSelectedBatch(null) : router.push('/farmer/dashboard')} className="text-gray-500 mb-1 block text-sm">&larr; Back</button>
            <h1 className="text-2xl font-bold text-gray-900">
              {selectedBatch ? `Batch ${selectedBatch.batch_code}` : 'Honey Batches & Packaging'}
            </h1>
          </div>
          {!selectedBatch && batches.length > 0 && (
            <div className="flex items-center gap-2">
              <button
                onClick={toggleSelectAll}
                className="text-xs text-gray-600 bg-gray-100 hover:bg-gray-200 px-3 py-1.5 rounded-lg flex items-center gap-1"
              >
                {selectedBatchIds.length === batches.length ? <CheckSquare className="w-3.5 h-3.5" /> : <Square className="w-3.5 h-3.5" />}
                {selectedBatchIds.length === batches.length ? 'Deselect All' : 'Select All'}
              </button>
            </div>
          )}
        </div>
      </header>

      {/* Bulk Action Banner */}
      {!selectedBatch && selectedBatchIds.length > 0 && (
        <div className="bg-honey-50 border-b border-honey-200 px-4 py-3 print:hidden sticky top-[73px] z-20">
          <div className="max-w-4xl mx-auto flex items-center justify-between flex-wrap gap-2">
            <span className="text-sm font-medium text-honey-900 flex items-center gap-1.5">
              <Layers className="w-4 h-4 text-honey-600" />
              {selectedBatchIds.length} batch{selectedBatchIds.length > 1 ? 'es' : ''} selected
            </span>
            <div className="flex gap-2">
              <button
                onClick={handleBulkAdvance}
                disabled={bulkProcessing}
                className="btn-primary text-xs py-1.5 px-3 flex items-center gap-1"
              >
                <Sparkles className="w-3.5 h-3.5" />
                {bulkProcessing ? 'Advancing…' : 'Bulk Advance Next Stage'}
              </button>
            </div>
          </div>
        </div>
      )}

      <main className="max-w-4xl mx-auto px-4 py-6 space-y-6 print:p-0 print:m-0">
        {selectedBatch ? (
          <div className="space-y-6">
            {/* Quick Summary Card - hidden in print */}
            <div className="card print:hidden flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-xl font-bold text-gray-900">{selectedBatch.batch_code}</h2>
                  <span className="badge-blue text-xs">{selectedBatch.status}</span>
                </div>
                <p className="text-gray-600 text-sm mt-0.5">{selectedBatch.honey_type} · {selectedBatch.quantity} kg</p>
                <p className="text-xs text-gray-400">Harvest Date: {new Date(selectedBatch.harvest_date).toLocaleDateString()}</p>
              </div>

              <div className="flex flex-wrap gap-2 w-full md:w-auto">
                <button
                  onClick={() => router.push(`/verify/${selectedBatch.batch_code}`)}
                  className="btn-secondary text-xs py-2 px-3 flex-1 md:flex-initial inline-flex items-center justify-center gap-1.5"
                >
                  <ExternalLink className="w-3.5 h-3.5" /> Public Link
                </button>
                <button
                  onClick={handleShareLink}
                  className="btn-secondary text-xs py-2 px-3 flex-1 md:flex-initial inline-flex items-center justify-center gap-1.5"
                >
                  <Share2 className="w-3.5 h-3.5" /> Share
                </button>
              </div>
            </div>

            {/* Smart Sticker Sheet Generator - Highlight Feature */}
            <div className="card border-2 border-honey-200 bg-gradient-to-br from-white to-honey-50/40 print:border-none print:shadow-none print:p-0">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 mb-4 print:hidden">
                <div>
                  <h3 className="font-bold text-gray-900 text-base flex items-center gap-2">
                    <Printer className="w-4 h-4 text-honey-600" />
                    Printable Jar Sticker Sheet
                  </h3>
                  <p className="text-xs text-gray-500 mt-0.5">
                    Generates standardized adhesive labels for glass/PET honey jars with live QR codes.
                  </p>
                </div>

                {/* Jar Size Selector */}
                <div className="flex items-center gap-2">
                  <span className="text-xs text-gray-500 font-medium">Jar Size:</span>
                  <select
                    value={jarSize}
                    onChange={(e) => setJarSize(Number(e.target.value))}
                    className="text-xs border border-gray-300 rounded-lg px-2 py-1.5 bg-white font-medium text-gray-700"
                  >
                    <option value={250}>250g Jars ({Math.ceil((selectedBatch.quantity * 1000) / 250)} labels)</option>
                    <option value={500}>500g Jars ({Math.ceil((selectedBatch.quantity * 1000) / 500)} labels)</option>
                    <option value={1000}>1 kg Jars ({Math.ceil((selectedBatch.quantity * 1000) / 1000)} labels)</option>
                  </select>
                  <button
                    onClick={handlePrintLabels}
                    className="btn-primary text-xs py-1.5 px-3 flex items-center gap-1.5 shadow-sm"
                  >
                    <Printer className="w-3.5 h-3.5" /> Print Sheet
                  </button>
                </div>
              </div>

              {/* Printable Grid of Labels */}
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-3 gap-3 print:grid-cols-3 print:gap-4 print:w-full">
                {Array.from({ length: Math.min(stickerCount, 12) }).map((_, idx) => (
                  <div
                    key={idx}
                    className="border border-dashed border-gray-300 rounded-lg p-3 bg-white flex flex-col justify-between items-center text-center shadow-xs print:border-solid print:border-gray-800 print:rounded-none print:break-inside-avoid"
                  >
                    <div className="w-full border-b border-gray-100 pb-1 mb-1">
                      <div className="flex items-center justify-center gap-1">
                        <span className="text-xs">🍯</span>
                        <span className="text-[11px] font-bold text-gray-800 uppercase tracking-wider">Honey Chain</span>
                      </div>
                      <p className="text-[9px] text-gray-500 font-medium">{selectedBatch.honey_type || 'Pure Honey'}</p>
                    </div>

                    {qrCode ? (
                      <img src={qrCode} alt="QR" className="w-16 h-16 my-1 object-contain" />
                    ) : (
                      <div className="w-16 h-16 bg-gray-100 flex items-center justify-center text-[9px] text-gray-400">Loading QR</div>
                    )}

                    <div className="w-full pt-1 border-t border-gray-100 mt-1">
                      <p className="text-[9px] font-mono font-bold text-gray-900">{selectedBatch.batch_code}</p>
                      <div className="flex justify-between items-center text-[8px] text-gray-500 mt-0.5">
                        <span>Net: {jarSize >= 1000 ? `${jarSize/1000}kg` : `${jarSize}g`}</span>
                        <span className="text-green-600 font-bold">KVIC ✓</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {stickerCount > 12 && (
                <p className="text-[11px] text-gray-400 text-center mt-3 print:hidden">
                  Showing 12 of {stickerCount} labels for preview. Tapping "Print Sheet" prints full batch.
                </p>
              )}
            </div>

            {/* Traceability Timeline - hidden in print */}
            <div className="card print:hidden">
              <h3 className="font-semibold text-gray-900 mb-4">Blockchain Traceability Chain</h3>
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
                        <p className="font-medium text-gray-900">{stage === 'GENESIS' ? 'Batch Minted' : stage}</p>
                        {event ? (
                          <>
                            <p className="text-sm text-gray-500">{new Date(event.timestamp).toLocaleString()}</p>
                            {event.event_data && <p className="text-xs text-gray-400">{event.event_data}</p>}
                            <p className="text-xs text-gray-400 font-mono mt-0.5">SHA-256: {event.current_hash.substring(0, 16)}...</p>
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

            {/* Actions Card - hidden in print */}
            <div className="card space-y-3 print:hidden">
              <h3 className="font-semibold text-gray-900">Stage Progression & Audit</h3>
              {nextStage(selectedBatch.status) && (
                <button
                  onClick={() => handleAddEvent(nextStage(selectedBatch.status)!)}
                  className="btn-primary w-full py-2.5 flex items-center justify-center gap-2"
                  disabled={addingEvent}
                >
                  <Sparkles className="w-4 h-4" />
                  {addingEvent ? 'Appending Block…' : `Advance to ${nextStage(selectedBatch.status)}`}
                </button>
              )}
              <button onClick={handleVerify} className="btn-secondary w-full py-2">
                Run Cryptographic Integrity Check
              </button>
              {verifyResult && (
                <div className={`p-3 rounded-lg ${verifyResult.valid ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
                  <div className="flex items-center gap-2 font-medium">
                    {verifyResult.valid ? <CheckCircle className="w-5 h-5 text-green-600" /> : <XCircle className="w-5 h-5 text-red-600" />}
                    {verifyResult.valid ? '✓ Cryptographic Ledger Valid' : '✗ Hash Discrepancy Detected'}
                  </div>
                  <p className="text-sm mt-1">{verifyResult.message}</p>
                </div>
              )}
            </div>
          </div>
        ) : (
          /* Batch List with Bulk Selection */
          <div className="space-y-3">
            {batches.map(batch => {
              const isSelected = selectedBatchIds.includes(batch.id);
              return (
                <div
                  key={batch.id}
                  onClick={() => loadBatch(batch.id)}
                  className={`card flex items-center justify-between cursor-pointer hover:shadow-md transition-all ${
                    isSelected ? 'ring-2 ring-honey-500 bg-honey-50/20' : ''
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <button
                      type="button"
                      onClick={(e) => toggleSelectBatch(batch.id, e)}
                      className="text-gray-400 hover:text-honey-600 p-1"
                    >
                      {isSelected ? (
                        <CheckSquare className="w-5 h-5 text-honey-600" />
                      ) : (
                        <Square className="w-5 h-5" />
                      )}
                    </button>
                    <div>
                      <p className="font-bold text-gray-900">{batch.batch_code}</p>
                      <p className="text-sm text-gray-500">{batch.honey_type} · {batch.quantity} kg</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${
                      batch.status === 'PACKAGING' ? 'bg-green-100 text-green-800' : 'bg-blue-100 text-blue-800'
                    }`}>
                      {batch.status}
                    </span>
                    <span className="text-gray-400 text-sm">&rarr;</span>
                  </div>
                </div>
              );
            })}
            {batches.length === 0 && (
              <div className="card text-center py-12 text-gray-500">
                <p>No batches found. Harvest honey from a hive to create your first batch!</p>
              </div>
            )}
          </div>
        )}
      </main>

      {/* Bottom Nav - hidden in print */}
      <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-100 z-30 print:hidden">
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