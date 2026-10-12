'use client';

import React, { useState } from 'react';
import { CounterDeskContextType } from './types';
import { request } from '@/lib/api';
import { Users, UserPlus, Shield, Store, CheckCircle2, AlertCircle, Save } from 'lucide-react';

export default function CounterDeskTeam({ ctx }: { ctx: CounterDeskContextType }) {
  const { shop, team, refreshData, token } = ctx;

  // Profile Edit State
  const [name, setName] = useState(shop.name);
  const [email, setEmail] = useState(shop.email || '');
  const [phone, setPhone] = useState(shop.phone || '');
  const [address, setAddress] = useState(shop.address || '');
  const [upiId, setUpiId] = useState(shop.upi_id || '');
  const [profileSaving, setProfileSaving] = useState(false);
  const [profileSuccess, setProfileSuccess] = useState(false);

  // Invite Staff State
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [inviteUsername, setInviteUsername] = useState('');
  const [invitePassword, setInvitePassword] = useState('');
  const [inviteRole, setInviteRole] = useState<'operator' | 'admin'>('operator');
  const [inviteLoading, setInviteLoading] = useState(false);

  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setProfileSaving(true);
    setErrorMsg(null);
    setProfileSuccess(false);

    try {
      await request(`/shops/${shop.id}/profile`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          email: email || undefined,
          phone: phone || undefined,
          address: address || undefined,
          upi_id: upiId || undefined
        })
      }, token);

      setProfileSuccess(true);
      await refreshData();
      setTimeout(() => setProfileSuccess(false), 4000);
    } catch (err: any) {
      setErrorMsg(err.message);
    } finally {
      setProfileSaving(false);
    }
  };

  const handleInviteStaff = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inviteUsername || !invitePassword) return;
    setInviteLoading(true);
    setErrorMsg(null);

    try {
      await request(`/shops/${shop.id}/team`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: inviteUsername,
          password: invitePassword,
          role: inviteRole
        })
      }, token);

      setShowInviteModal(false);
      setInviteUsername('');
      setInvitePassword('');
      await refreshData();
    } catch (err: any) {
      setErrorMsg(err.message);
    } finally {
      setInviteLoading(false);
    }
  };

  return (
    <div className="space-y-8 animate-fadeIn max-w-5xl">
      {/* Top Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-[#e2dad0]">
        <div>
          <h1 className="font-serif text-3xl text-[#251c17] tracking-tight">Staff & Shop Settings</h1>
          <p className="text-sm text-[#70645a] mt-1">
            Manage counter staff permissions, operator access, and store profile information.
          </p>
        </div>
        <button
          onClick={() => setShowInviteModal(true)}
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#ea7c50] hover:bg-[#d75d31] text-white font-semibold text-xs shadow-sm cursor-pointer transition-colors"
        >
          <UserPlus className="w-4 h-4" />
          <span>Add Staff Member</span>
        </button>
      </div>

      {errorMsg && (
        <div className="p-4 bg-red-50 text-red-700 text-xs rounded-xl border border-red-200">
          {errorMsg}
        </div>
      )}

      {profileSuccess && (
        <div className="flex items-center gap-2 p-4 rounded-xl bg-[#eef3eb] border border-[#d8e3d3] text-xs font-semibold text-[#3b5232]">
          <CheckCircle2 className="w-4 h-4" />
          <span>Shop profile updated successfully.</span>
        </div>
      )}

      {/* Team Roster Table */}
      <div className="bg-white rounded-2xl border border-[#e2dad0] p-6 shadow-sm space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-[#f0eae1]">
          <div>
            <h2 className="font-serif text-lg text-[#251c17]">Active Staff Roster ({team.length})</h2>
            <p className="text-xs text-[#70645a] mt-0.5">Staff with authorized access to Counter Desk and Print Station.</p>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-[#f0eae1] text-[#91857a] font-medium text-[11px]">
                <th className="pb-2.5 font-medium">Username / Email</th>
                <th className="pb-2.5 font-medium">Role</th>
                <th className="pb-2.5 font-medium">Status</th>
                <th className="pb-2.5 text-right font-medium">Last Active</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#f7f3ed]">
              {team.map(member => (
                <tr key={member.username} className="hover:bg-[#fcfaf7]">
                  <td className="py-3 font-semibold text-[#251c17] flex items-center gap-2">
                    <Users className="w-4 h-4 text-[#70645a]" />
                    <span>{member.username}</span>
                  </td>
                  <td className="py-3">
                    <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-semibold ${
                      member.role === 'admin' ? 'bg-[#ede9fe] text-[#6d28d9]' : 'bg-[#eef3eb] text-[#2f5a25]'
                    }`}>
                      <Shield className="w-3 h-3" />
                      {member.role.toUpperCase()}
                    </span>
                  </td>
                  <td className="py-3">
                    <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-[#f0fdf4] text-[#15803d]">
                      <span className="w-1.5 h-1.5 rounded-full bg-[#34a853]" />
                      Active
                    </span>
                  </td>
                  <td className="py-3 text-right font-mono text-[11px] text-[#91857a]">
                    {member.last_active ? new Date(member.last_active).toLocaleDateString() : 'Active session'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Shop Profile Form */}
      <form onSubmit={handleUpdateProfile} className="bg-white rounded-2xl border border-[#e2dad0] p-6 shadow-sm space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-[#f0eae1]">
          <div>
            <h2 className="font-serif text-lg text-[#251c17]">Store Profile & Contact</h2>
            <p className="text-xs text-[#70645a] mt-0.5">Details shown on customer receipts and counter signage.</p>
          </div>
          <button
            type="submit"
            disabled={profileSaving}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-[#3b5232] hover:bg-[#2d4026] text-white font-semibold text-xs shadow-sm cursor-pointer transition-colors"
          >
            <Save className="w-3.5 h-3.5" />
            <span>{profileSaving ? 'Saving...' : 'Update Store Info'}</span>
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
          <div>
            <label className="block font-semibold text-[#251c17] mb-1">Store / Shop Name</label>
            <input
              type="text"
              value={name}
              onChange={e => setName(e.target.value)}
              required
              className="w-full p-2.5 rounded-xl border border-[#e2dad0]"
            />
          </div>
          <div>
            <label className="block font-semibold text-[#251c17] mb-1">Primary Email</label>
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              className="w-full p-2.5 rounded-xl border border-[#e2dad0]"
            />
          </div>
          <div>
            <label className="block font-semibold text-[#251c17] mb-1">Phone Number</label>
            <input
              type="text"
              value={phone}
              onChange={e => setPhone(e.target.value)}
              className="w-full p-2.5 rounded-xl border border-[#e2dad0]"
            />
          </div>
          <div>
            <label className="block font-semibold text-[#251c17] mb-1">UPI ID for Direct Payments</label>
            <input
              type="text"
              placeholder="e.g. quickprints@okaxis"
              value={upiId}
              onChange={e => setUpiId(e.target.value)}
              className="w-full p-2.5 rounded-xl border border-[#e2dad0]"
            />
          </div>
          <div className="md:col-span-2">
            <label className="block font-semibold text-[#251c17] mb-1">Store Address / Location</label>
            <input
              type="text"
              value={address}
              onChange={e => setAddress(e.target.value)}
              className="w-full p-2.5 rounded-xl border border-[#e2dad0]"
            />
          </div>
        </div>
      </form>

      {/* Invite Modal */}
      {showInviteModal && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4">
          <form onSubmit={handleInviteStaff} className="bg-white rounded-2xl border border-[#e2dad0] p-6 max-w-md w-full shadow-xl space-y-4">
            <h3 className="font-serif text-xl font-bold text-[#251c17]">Add Staff Member</h3>
            <div className="space-y-3 text-xs">
              <div>
                <label className="block font-semibold text-[#251c17] mb-1">Username / Email</label>
                <input
                  type="text"
                  placeholder="e.g. staff1@quickprints.com"
                  value={inviteUsername}
                  onChange={e => setInviteUsername(e.target.value)}
                  required
                  className="w-full p-2.5 rounded-xl border border-[#e2dad0]"
                />
              </div>
              <div>
                <label className="block font-semibold text-[#251c17] mb-1">Password</label>
                <input
                  type="password"
                  placeholder="Temporary login password"
                  value={invitePassword}
                  onChange={e => setInvitePassword(e.target.value)}
                  required
                  className="w-full p-2.5 rounded-xl border border-[#e2dad0]"
                />
              </div>
              <div>
                <label className="block font-semibold text-[#251c17] mb-1">Assigned Role</label>
                <select
                  value={inviteRole}
                  onChange={e => setInviteRole(e.target.value as any)}
                  className="w-full p-2.5 rounded-xl border border-[#e2dad0] bg-white"
                >
                  <option value="operator">Operator (Queue, Release & Print)</option>
                  <option value="admin">Admin (Full Store Management & Rates)</option>
                </select>
              </div>
            </div>
            <div className="flex justify-end gap-3 pt-3">
              <button
                type="button"
                onClick={() => setShowInviteModal(false)}
                className="px-4 py-2 rounded-xl border border-[#e2dad0] text-xs font-semibold text-[#70645a] cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={inviteLoading}
                className="px-4 py-2 rounded-xl bg-[#ea7c50] text-white text-xs font-semibold hover:bg-[#d75d31] cursor-pointer"
              >
                {inviteLoading ? 'Adding...' : 'Create Staff Login'}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
