'use client';

import React, { useState, useEffect } from 'react';
import { User, Check, Sparkles } from 'lucide-react';
import { useCustomerAuth } from '../CustomerAuthContext';

interface WorkspaceAliasPromptModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function WorkspaceAliasPromptModal({ isOpen, onClose }: WorkspaceAliasPromptModalProps) {
  const { session, updateAlias } = useCustomerAuth();
  const defaultAlias = session?.user.alias || session?.user.username.slice(0, 6) || 'User';
  const [alias, setAlias] = useState(defaultAlias);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (session) {
      setAlias(session.user.alias || session.user.username.slice(0, 6) || 'User');
    }
  }, [session]);

  if (!isOpen) return null;

  const handleSave = async (chosenName?: string) => {
    const finalAlias = (chosenName || alias).trim();
    if (!finalAlias) {
      setError('Alias cannot be empty');
      return;
    }
    if (finalAlias.length > 32) {
      setError('Alias must be 32 characters or less');
      return;
    }
    setBusy(true);
    setError('');
    try {
      await updateAlias(finalAlias);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save alias');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
      <div
        className="w-full max-w-md bg-[#241713] text-[#f7f4ee] rounded-3xl p-6 sm:p-8 border border-white/15 shadow-2xl space-y-6 text-left relative"
        role="dialog"
        aria-modal="true"
        aria-labelledby="alias-modal-title"
      >
        <div className="flex items-center gap-3.5">
          <div className="w-12 h-12 rounded-2xl bg-[#c05634]/20 border border-[#c05634]/30 flex items-center justify-center text-[#ea7c50]">
            <Sparkles className="w-6 h-6" />
          </div>
          <div>
            <h2 id="alias-modal-title" className="text-xl sm:text-2xl font-serif font-bold text-white tracking-tight">
              Welcome to CBPMS!
            </h2>
            <p className="text-xs sm:text-sm text-[#d4c8bd] mt-0.5">
              Choose how your name appears in your workspace.
            </p>
          </div>
        </div>

        {error && (
          <div className="p-3 rounded-xl bg-red-500/15 border border-red-500/30 text-xs text-red-300">
            {error}
          </div>
        )}

        <div className="space-y-2">
          <label className="block text-xs font-medium text-[#d4c8bd]">
            Your Display Alias
          </label>
          <div className="relative">
            <User className="w-4 h-4 text-[#8f7d73] absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              maxLength={32}
              value={alias}
              onChange={(e) => setAlias(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  void handleSave();
                }
              }}
              placeholder="e.g. Alex"
              className="w-full bg-[#18100c] border border-white/20 focus:border-[#ea7c50] text-[#f7f4ee] text-sm pl-10 pr-4 py-3 rounded-xl focus:outline-none transition-colors"
              autoFocus
            />
          </div>
          <p className="text-[11px] text-[#a8998e]">
            Defaults to the first 6 letters of your email: <span className="font-mono text-white/90">{defaultAlias}</span>
          </p>
        </div>

        <div className="flex flex-col sm:flex-row items-center gap-3 pt-2">
          <button
            type="button"
            disabled={busy}
            onClick={() => void handleSave()}
            className="w-full sm:flex-1 py-3 px-5 rounded-xl bg-[#c05634] hover:bg-[#a94829] text-white text-sm font-semibold shadow-lg shadow-[#c05634]/25 transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
          >
            <Check className="w-4 h-4" />
            <span>{busy ? 'Saving…' : 'Save Alias'}</span>
          </button>

          <button
            type="button"
            disabled={busy}
            onClick={() => void handleSave(defaultAlias)}
            className="w-full sm:w-auto py-3 px-4 rounded-xl bg-white/5 hover:bg-white/10 text-[#d4c8bd] hover:text-white text-xs sm:text-sm font-medium border border-white/10 transition-colors cursor-pointer disabled:opacity-50"
          >
            Keep &quot;{defaultAlias}&quot;
          </button>
        </div>
      </div>
    </div>
  );
}
