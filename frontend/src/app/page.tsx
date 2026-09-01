'use client';

import { useAuth } from '@/lib/auth';
import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function HomePage() {
  const { login } = useAuth();
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const { role } = await login(email, password);
      router.push(role === 'ADMIN' ? '/admin/dashboard' : '/farmer/dashboard');
    } catch (err: any) {
      setError(err.message || 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-honey-50 to-white">
      {/* Header */}
      <div className="bg-white/80 backdrop-blur-sm border-b border-gray-100">
        <div className="max-w-4xl mx-auto px-4 py-4 flex items-center gap-2">
          <span className="text-2xl">🍯</span>
          <span className="font-bold text-xl text-gray-900">Honey Chain</span>
        </div>
      </div>

      <main className="max-w-4xl mx-auto px-4 py-8">
        <div className="grid md:grid-cols-2 gap-8 items-start">
          {/* Left: Hero */}
          <div className="py-8">
            <h1 className="text-4xl font-bold text-gray-900 leading-tight mb-4">
              From Hive to Jar.<br />
              <span className="text-honey-500">Verified at Every Step.</span>
            </h1>
            <p className="text-lg text-gray-600 mb-6">
              Smart beekeeping. Transparent traceability. Trusted honey.
            </p>
            <div className="space-y-3 text-sm text-gray-500">
              <p className="flex items-center gap-2">🐝 Real-time hive monitoring</p>
              <p className="flex items-center gap-2">🤖 AI-powered anomaly detection</p>
              <p className="flex items-center gap-2">🔗 Blockchain-based traceability</p>
              <p className="flex items-center gap-2">📱 QR code consumer verification</p>
            </div>
            <div className="mt-6">
              <p className="text-sm font-medium text-gray-700 mb-2">Verify a Honey Batch</p>
              <div className="flex gap-2">
                <input type="text" id="batchInput"
                  className="input-field flex-1"
                  placeholder="e.g. HC-2026-00001"
                  onKeyDown={(e) => { if (e.key === 'Enter') { const val = e.currentTarget.value.trim(); if (val) router.push('/verify/' + val); } }} />
                <button id="verifyBtn"
                  onClick={() => { const input = document.getElementById('batchInput') as HTMLInputElement; const val = input?.value.trim(); if (val) router.push('/verify/' + val); }}
                  className="btn-primary whitespace-nowrap">
                  Verify
                </button>
              </div>
            </div>
            <div className="mt-6 p-4 bg-gray-50 rounded-lg text-sm text-gray-600">
              <p className="font-medium mb-1">Demo Credentials:</p>
              <p>Admin: admin@honeychain.in / admin123</p>
              <p>Farmer: farmer01@honeychain.in / farmer123</p>
            </div>
          </div>

          {/* Right: Login Form */}
          <div className="bg-white rounded-2xl shadow-xl p-8 border border-gray-100">
            <h2 className="text-2xl font-bold text-gray-900 mb-2">Sign In</h2>
            <p className="text-gray-500 mb-6">Sign in to your account</p>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="label">Email</label>
                <input type="email" className="input-field" value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="farmer01@honeychain.in" required />
              </div>
              <div>
                <label className="label">Password</label>
                <input type="password" className="input-field" value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter password" required />
              </div>
              {error && <p className="text-red-500 text-sm">{error}</p>}
              <button type="submit" className="btn-primary w-full text-lg py-3" disabled={loading}>
                {loading ? 'Signing in...' : 'Sign In'}
              </button>
            </form>
          </div>
        </div>
      </main>

      <footer className="border-t border-gray-100 mt-12 py-8 text-center text-sm text-gray-400">
        <p>SIH 2026 — Ministry of MSME — Problem Statement #26021</p>
        <p className="mt-1">Prototype system. Data shown is for demonstration purposes.</p>
      </footer>
    </div>
  );
}
