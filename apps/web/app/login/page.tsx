'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useCustomerAuth } from '@/components/customer/CustomerAuthContext';
import AccountSignedOutView from '@/components/customer/AccountSignedOutView';

export default function LoginPage() {
  const { session, loading } = useCustomerAuth();
  const router = useRouter();

  useEffect(() => {
    if (session) {
      router.replace('/account');
    }
  }, [session, router]);

  if (loading) {
    return (
      <main className="desktop-workspace min-h-screen flex items-center justify-center text-xl" role="status">
        Loading…
      </main>
    );
  }

  if (session) {
    return null;
  }

  return <AccountSignedOutView initialMode="login" />;
}
