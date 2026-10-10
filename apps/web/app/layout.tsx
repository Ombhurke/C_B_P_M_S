import type { Metadata } from 'next';
import './globals.css';
import { CustomerAuthProvider } from '../components/customer/CustomerAuthContext';

export const metadata: Metadata = {
  title: 'CBPMS - Desktop Cloud Printing Platform',
  description: 'Zero-Install, Privacy-First, Ephemeral Counter & Desktop Cloud Printing Platform',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark">
      <body className="min-h-screen bg-[#14100e] flex flex-col font-sans text-[#f5efe6] antialiased selection:bg-[#ea7c50] selection:text-white overflow-x-hidden">
        {/* Soft Ambient Desktop Glows */}
        <div className="fixed inset-0 pointer-events-none z-0 overflow-hidden">
          <div className="absolute -top-40 -right-40 w-[42rem] h-[42rem] bg-[#ea7c50]/10 rounded-full blur-[160px]" />
          <div className="absolute top-1/3 -left-40 w-[38rem] h-[38rem] bg-[#f3a261]/8 rounded-full blur-[140px]" />
          <div className="absolute -bottom-40 right-1/4 w-[45rem] h-[45rem] bg-[#d97752]/8 rounded-full blur-[180px]" />
        </div>
        <div className="relative z-10 flex-1 flex flex-col w-full">
          <CustomerAuthProvider>{children}</CustomerAuthProvider>
        </div>
      </body>
    </html>
  );
}
