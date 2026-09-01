import type { Metadata } from 'next';
import './globals.css';
import ClientLayout from './client-layout';

export const metadata: Metadata = {
  title: 'Honey Chain — From Hive to Jar, Verified at Every Step',
  description: 'Blockchain-based honey traceability and smart beekeeping management system for the Ministry of MSME.',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-gray-50 antialiased">
        <ClientLayout>{children}</ClientLayout>
      </body>
    </html>
  );
}