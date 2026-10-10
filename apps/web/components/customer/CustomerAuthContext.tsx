'use client';

import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { CustomerSession } from '@/lib/types';

interface CustomerAuthValue {
  session: CustomerSession | null;
  loading: boolean;
  error: string;
  refresh: () => Promise<void>;
  signOut: () => Promise<void>;
  updateAlias: (newAlias: string) => Promise<void>;
}
const CustomerAuthContext = createContext<CustomerAuthValue | null>(null);

export function CustomerAuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<CustomerSession | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const generation = useRef(0);
  const refresh = useCallback(async () => {
    const run = ++generation.current;
    setLoading(true);
    try {
      const response = await fetch('/api/auth/session', { cache: 'no-store', credentials: 'same-origin', signal: AbortSignal.timeout(30000) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.detail || 'Unable to restore your session');
      if (run === generation.current) { setSession(data.session); setError(''); }
    } catch (error) {
      if (run === generation.current) {
        setSession(null);
        setError(error instanceof Error ? error.message : 'Unable to restore your session');
      }
    } finally {
      if (run === generation.current) setLoading(false);
    }
  }, []);
  useEffect(() => {
    void refresh();
  }, [refresh]);
  const signOut = async () => {
    const response = await fetch('/api/auth/logout', { method: 'POST', credentials: 'same-origin', signal: AbortSignal.timeout(15000) });
    if (!response.ok) throw new Error('Sign out failed. Please retry.');
    ++generation.current;
    setSession(null); setError(''); setLoading(false);
  };
  const updateAlias = useCallback(async (newAlias: string) => {
    const trimmed = newAlias.trim();
    if (!trimmed) throw new Error('Alias cannot be empty');
    const response = await fetch('/api/backend/customer/alias', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ alias: trimmed }),
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.detail || 'Failed to update alias');
    setSession((prev) => {
      if (!prev) return null;
      return {
        ...prev,
        user: {
          ...prev.user,
          alias: trimmed,
          alias_chosen: true,
        },
      };
    });
  }, []);
  return <CustomerAuthContext.Provider value={{ session, loading, error, refresh, signOut, updateAlias }}>{children}</CustomerAuthContext.Provider>;
}

export function useCustomerAuth() {
  const value = useContext(CustomerAuthContext);
  if (!value) throw new Error('useCustomerAuth must be used inside CustomerAuthProvider');
  return value;
}
