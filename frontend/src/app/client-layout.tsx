'use client';

import { AuthProvider } from '@/lib/auth';
import { useEffect } from 'react';

function KeepAlive() {
  useEffect(() => {
    const ping = () => {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';
      fetch(apiUrl + '/api/health', { cache: 'no-store' }).catch(() => {});
    };
    ping();
    const interval = setInterval(ping, 240000); // every 4 minutes
    return () => clearInterval(interval);
  }, []);
  return null;
}

export default function ClientLayout({ children }: { children: React.ReactNode }) {
  return (
    <AuthProvider>
      <KeepAlive />
      {children}
    </AuthProvider>
  );
}
