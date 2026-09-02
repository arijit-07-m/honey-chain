'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth';
import { getBatches, getBatch, addEvent, verifyChain, getBatchQR, Batch, BatchDetail, VerifyResult } from '@/lib/api';
import { CheckCircle, XCircle, Printer, Share2, CheckSquare, Square, Layers, Sparkles, ExternalLink, ChevronDown, ChevronUp, Store, Lock } from 'lucide-react';

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
  const [showRetailBatches, setShowRetailBatches] = useState(false); // Collapsible retail market section

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

  const nextStage = (s: string) => {
    if (s === 'HARVEST') return 'PROCESSING';
    if (s === 'PROCESSING') return 'PACKAGING';
    if (s === 'PACKAGING') return 'RETAIL';
    return null;
  };

  const getStageTitle = (stage: string) => {
    switch (stage) {
      case 'GENESIS': return 'Batch Initialized';
      case 'HARVEST': return 'Harvested at Apiary';
      case 'PROCESSING': return 'Quality Tested & Processed';
      case 'PACKAGING': return 'Bottled & Sealed';
      case 'RETAIL': return 'Out for Sale (Retail Market)';
      default: return stage;
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-honey-500"></div>
      </div>
    );
  }

  // Calculate number of full jar stickers for sheet based on batch quantity
  const totalGrams = selectedBatch ? Math.round(selectedBatch.quantity * 1000) : 0;
  const fullJars = totalGrams > 0 ? Math.floor(totalGrams / jarSize) : 0;
  const remainderGrams = totalGrams > 0 ? totalGrams % jarSize : 0;
  const stickerCount = Math.max(1, fullJars);

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

            {/* Smart Sticker Sheet Generator — ONLY available before going Out for Sale */}
            {selectedBatch.status === 'RETAIL' ? (
              <div className="card border border-emerald-200 bg-emerald-50/50 p-4 rounded-xl print:hidden">
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-lg bg-emerald-100 flex items-center justify-center text-emerald-700 flex-shrink-0">
                      <Lock className="w-5 h-5" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="text-sm font-bold text-gray-900">Jar Labels Locked & Archived</h3>
                        <span className="text-[10px] font-bold uppercase tracking-wide bg-emerald-200 text-emerald-800 px-2 py-0.5 rounded-full">
                          Out for Sale
                        </span>
                      </div>
                      <p className="text-xs text-gray-600 mt-0.5">
                        This batch has already been dispatched to retail markets. Jar label generation is locked to preserve cryptographic packaging integrity.
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={() => router.push(`/verify/${selectedBatch.batch_code}`)}
                    className="btn-secondary text-xs py-1.5 px-3 flex items-center gap-1.5 text-emerald-800 border-emerald-300 hover:bg-emerald-100/60 whitespace-nowrap self-end sm:self-center"
                  >
                    <ExternalLink className="w-3.5 h-3.5" /> View Consumer QR
                  </button>
                </div>
              </div>
            ) : (
              <div className="card border border-honey-200 bg-white print:border-none print:shadow-none print:p-0 transition-all">
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 print:hidden">
                  <button
                    type="button"
                    onClick={() => setShowLabelSheet(prev => !prev)}
                    className="flex items-center gap-2.5 text-left flex-1 hover:opacity-80 transition-opacity cursor-pointer group"
                  >
                    <div className="w-8 h-8 rounded-lg bg-honey-100 flex items-center justify-center text-honey-600 flex-shrink-0 group-hover:bg-honey-200">
                      <Printer className="w-4 h-4" />
                    </div>
                    <div>
                      <h3 className="font-bold text-gray-900 text-base flex items-center gap-2">
                        Printable Jar Sticker Sheet
                        <span className="text-xs font-normal text-honey-700 bg-honey-50 border border-honey-200 px-2 py-0.5 rounded-full">
                          {stickerCount} {stickerCount === 1 ? 'label' : 'labels'} ({jarSize >= 1000 ? `${jarSize / 1000}kg` : `${jarSize}g`})
                        </span>
                      </h3>
                      <p className="text-xs text-gray-500 mt-0.5">
                        {showLabelSheet ? 'Tap to collapse preview' : 'Tap to expand & preview labels for glass/PET jars'}
                      </p>
                    </div>
                    <div className="ml-auto text-gray-400 group-hover:text-gray-600 pr-2">
                      {showLabelSheet ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
                    </div>
                  </button>

                  {/* Controls (Jar Size & Print Button) */}
                  <div className="flex items-center gap-2 self-end sm:self-center">
                    <span className="text-xs text-gray-500 font-medium">Jar:</span>
                    <select
                      value={jarSize}
                      onChange={(e) => setJarSize(Number(e.target.value))}
                      className="text-xs border border-gray-300 rounded-lg px-2 py-1.5 bg-white font-medium text-gray-700"
                    >
                      <option value={250}>
                        250g ({Math.floor(totalGrams / 250)} jars)
                      </option>
                      <option value={500}>
                        500g ({Math.floor(totalGrams / 500)} jars)
                      </option>
                      <option value={1000}>
                        1 kg ({Math.floor(totalGrams / 1000)} jars{remainderGrams > 0 && jarSize === 1000 ? ` • +${remainderGrams}g` : ''})
                      </option>
                    </select>
                    <button
                      onClick={() => {
                        if (!showLabelSheet) setShowLabelSheet(true);
                        setTimeout(handlePrintLabels, 150);
                      }}
                      className="btn-primary text-xs py-1.5 px-3 flex items-center gap-1.5 shadow-xs whitespace-nowrap"
                    >
                      <Printer className="w-3.5 h-3.5" /> Print Sheet
                    </button>
                  </div>
                </div>

                {/* Printable Grid of Labels - Collapsible on screen, always visible when printing */}
                <div className={`${showLabelSheet ? 'block mt-4 pt-4 border-t border-gray-100' : 'hidden'} print:block print:mt-0 print:pt-0`}>
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-3 gap-3 print:grid-cols-3 print:gap-4 print:w-full">
                    {Array.from({ length: stickerCount }).map((_, idx) => (
                      <div
                        key={idx}
                        className="border border-dashed border-gray-300 rounded-lg p-3 bg-white flex flex-col justify-between items-center text-center shadow-xs print:border-solid print:border-gray-800 print:rounded-none print:break-inside-avoid"
                      >
                        {/* Honey Type & Net Weight */}
                        <div className="w-full border-b border-gray-100 pb-1 mb-1 text-center">
                          <p className="text-xs font-bold text-gray-900 uppercase tracking-wide">
                            {selectedBatch.honey_type || 'Natural Honey'}
                          </p>
                          <p className="text-[10px] font-semibold text-gray-700">
                            Net Wt: {jarSize >= 1000 ? `${jarSize / 1000} kg` : `${jarSize} g`}
                          </p>
                        </div>

                        {/* QR Code */}
                        {qrCode ? (
                          <img src={qrCode} alt="Verification QR" className="w-20 h-20 my-1 object-contain" />
                        ) : (
                          <div className="w-20 h-20 bg-gray-100 flex items-center justify-center text-[10px] text-gray-400">Loading QR</div>
                        )}

                        {/* Batch Code & Direct Website Address */}
                        <div className="w-full pt-1 border-t border-gray-100 mt-1 text-center">
                          <p className="text-[10px] font-mono font-bold text-gray-900">
                            Batch: {selectedBatch.batch_code}
                          </p>
                          <p className="text-[8px] font-mono text-gray-500 break-all leading-tight mt-0.5">
                            Verify: {typeof window !== 'undefined' ? window.location.host : 'honey-chain-ten.vercel.app'}/verify/{selectedBatch.batch_code}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* 2-Column Section: Traceability Timeline on Left, Stage Progression & Audit on Right */}
            <div className="grid grid-cols-1 md:grid-cols-12 gap-6 print:hidden items-start">
              {/* Left Column: Traceability Timeline */}
              <div className="md:col-span-7 card">
                <h3 className="font-semibold text-gray-900 mb-4">Blockchain Traceability Chain</h3>
                <div className="space-y-4">
                  {['GENESIS', 'HARVEST', 'PROCESSING', 'PACKAGING', 'RETAIL'].map((stage, i) => {
                    let event = selectedBatch.events.find(e => e.stage === stage);
                    // If stage is GENESIS and not explicitly stored as a separate event, treat batch creation as genesis
                    const isGenesisVirtual = stage === 'GENESIS' && !event && selectedBatch.events.length > 0;
                    const isCompleted = !!event || isGenesisVirtual;

                    return (
                      <div key={stage} className="flex items-start gap-3">
                        <div className="flex flex-col items-center">
                          <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${isCompleted ? 'bg-green-500 text-white' : 'bg-gray-200 text-gray-400'}`}>
                            {isCompleted ? '✓' : i + 1}
                          </div>
                          {i < 4 && <div className="w-0.5 h-8 bg-gray-200"></div>}
                        </div>
                        <div className="flex-1">
                          <p className="font-medium text-gray-900">{getStageTitle(stage)}</p>
                          {event ? (
                            <>
                              <p className="text-sm text-gray-500">{new Date(event.timestamp).toLocaleString()}</p>
                              {event.event_data && <p className="text-xs text-gray-400">{event.event_data}</p>}
                              <p className="text-xs text-gray-400 font-mono mt-0.5">SHA-256: {event.current_hash.substring(0, 16)}...</p>
                            </>
                          ) : isGenesisVirtual ? (
                            <>
                              <p className="text-sm text-gray-500">{new Date(selectedBatch.created_at).toLocaleString()}</p>
                              <p className="text-xs text-gray-400">Batch digital identity registered</p>
                              <p className="text-xs text-gray-400 font-mono mt-0.5">Root Hash: GENESIS</p>
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

              {/* Right Column: Stage Progression & Audit Actions */}
              <div className="md:col-span-5 card space-y-4 sticky top-24">
                <div>
                  <h3 className="font-semibold text-gray-900">Stage Progression & Audit</h3>
                  <p className="text-xs text-gray-500 mt-0.5">Mint subsequent blocks or run cryptographic integrity verification.</p>
                </div>

                {nextStage(selectedBatch.status) && (
                  <button
                    onClick={() => handleAddEvent(nextStage(selectedBatch.status)!)}
                    className="btn-primary w-full py-2.5 flex items-center justify-center gap-2 shadow-xs"
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
          </div>
        ) : (
          /* Batch List with Organized Pipeline and Shrinkable Retail Section */
          <div className="space-y-6">
            {/* 1. Active Production Pipeline */}
            <div className="space-y-3">
              <div className="flex items-center justify-between px-1">
                <h2 className="text-sm font-bold text-gray-700 uppercase tracking-wide">
                  Active Production Pipeline ({batches.filter(b => b.status !== 'RETAIL').length})
                </h2>
                <span className="text-xs text-gray-400">Harvest • Processing • Packaging</span>
              </div>

              {batches.filter(b => b.status !== 'RETAIL').map(batch => {
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
                        batch.status === 'PACKAGING' ? 'bg-amber-100 text-amber-800' : 'bg-blue-100 text-blue-800'
                      }`}>
                        {batch.status}
                      </span>
                      <span className="text-gray-400 text-sm">&rarr;</span>
                    </div>
                  </div>
                );
              })}

              {batches.filter(b => b.status !== 'RETAIL').length === 0 && batches.length > 0 && (
                <div className="card text-center py-6 text-gray-500 bg-gray-50/60">
                  <p className="text-sm">All current batches have advanced to Retail Market!</p>
                </div>
              )}
            </div>

            {/* 2. Shrinkable Section: Out for Sale / Retail Market */}
            {batches.filter(b => b.status === 'RETAIL').length > 0 && (
              <div className="card border border-emerald-200 bg-emerald-50/40 p-4 rounded-xl shadow-xs transition-all">
                <button
                  type="button"
                  onClick={() => setShowRetailBatches(!showRetailBatches)}
                  className="w-full flex items-center justify-between text-left focus:outline-none cursor-pointer"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-lg bg-emerald-100 flex items-center justify-center text-emerald-700 flex-shrink-0">
                      <Store className="w-5 h-5" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="text-sm font-bold text-gray-900">Out for Sale (Retail Market)</h3>
                        <span className="text-xs px-2 py-0.5 rounded-full font-bold bg-emerald-200 text-emerald-800">
                          {batches.filter(b => b.status === 'RETAIL').length}
                        </span>
                      </div>
                      <p className="text-xs text-gray-500 mt-0.5">
                        Batches currently on retail shelves with live consumer QR verification
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-semibold text-emerald-700 hidden sm:inline">
                      {showRetailBatches ? 'Tap to shrink' : 'Tap to expand'}
                    </span>
                    <div className="p-1 rounded-md bg-white border border-emerald-200 text-emerald-700">
                      {showRetailBatches ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                    </div>
                  </div>
                </button>

                {/* Collapsible Retail Batches Content */}
                {showRetailBatches && (
                  <div className="mt-4 pt-3 border-t border-emerald-100 space-y-2.5">
                    {batches.filter(b => b.status === 'RETAIL').map(batch => {
                      const isSelected = selectedBatchIds.includes(batch.id);
                      return (
                        <div
                          key={batch.id}
                          onClick={() => loadBatch(batch.id)}
                          className={`bg-white border border-emerald-200 rounded-lg p-3 flex items-center justify-between cursor-pointer hover:shadow-sm transition-all ${
                            isSelected ? 'ring-2 ring-emerald-500 bg-emerald-50/30' : ''
                          }`}
                        >
                          <div className="flex items-center gap-3">
                            <button
                              type="button"
                              onClick={(e) => toggleSelectBatch(batch.id, e)}
                              className="text-gray-400 hover:text-emerald-600 p-1"
                            >
                              {isSelected ? (
                                <CheckSquare className="w-5 h-5 text-emerald-600" />
                              ) : (
                                <Square className="w-5 h-5" />
                              )}
                            </button>
                            <div>
                              <div className="flex items-center gap-2">
                                <p className="font-bold text-gray-900 text-sm">{batch.batch_code}</p>
                                <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 flex items-center gap-1">
                                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                                  On Sale
                                </span>
                              </div>
                              <p className="text-xs text-gray-500 mt-0.5">{batch.honey_type} · {batch.quantity} kg</p>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="text-xs text-emerald-600 font-medium hidden sm:inline">View Blockchain Record &rarr;</span>
                            <span className="text-gray-400 text-sm sm:hidden">&rarr;</span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

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