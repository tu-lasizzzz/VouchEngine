import React from 'react';
import { 
  Users, 
  Clock, 
  Gift, 
  CheckCircle2, 
  RefreshCw, 
  Radio, 
  TrendingUp, 
  Zap 
} from 'lucide-react';
import { useUserStats } from '../hooks/useUserStats';

/**
 * UserStatsCard
 *
 * Task 3 Integration:
 * Displays real-time user statistics fetched & subscribed from Supabase.
 * - Total Invites
 * - Pending Referrals
 * - Unlocked Vouchers
 */
export function UserStatsCard({ userId = 'demo-user-id', token = '' }) {
  const { stats, loading, error, refetch, isRealtimeActive } = useUserStats(userId, token);

  return (
    <div className="w-full space-y-4">
      <div className="flex items-center justify-between px-1">
        <div className="flex items-center space-x-2">
          <TrendingUp className="w-5 h-5 text-indigo-400" />
          <h2 className="text-lg font-bold text-white">Real-Time Referral Analytics</h2>
        </div>

        <div className="flex items-center space-x-3">
          {/* Live Supabase Pulse Indicator */}
          <div className="flex items-center space-x-1.5 px-3 py-1 bg-emerald-950/60 border border-emerald-500/40 rounded-full text-[11px] font-semibold text-emerald-400 shadow-sm">
            <Radio className="w-3 h-3 text-emerald-400 animate-pulse" />
            <span>{isRealtimeActive ? 'Supabase Realtime Sync' : 'Live Polling'}</span>
          </div>

          <button
            onClick={refetch}
            disabled={loading}
            className="p-1.5 bg-gray-800 hover:bg-gray-700 text-gray-400 hover:text-white rounded-lg border border-gray-700 transition-colors"
            title="Refetch Stats"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Stats Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Card 1: Total Invites */}
        <div className="relative overflow-hidden bg-gradient-to-br from-gray-800/90 to-gray-900/90 border border-gray-700/80 rounded-2xl p-5 shadow-lg group hover:border-indigo-500/50 transition-all">
          <div className="absolute top-0 right-0 w-24 h-24 bg-indigo-500/10 rounded-full blur-2xl group-hover:bg-indigo-500/20 transition-all" />
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Total Invites</span>
            <div className="p-2.5 bg-indigo-600/20 text-indigo-400 rounded-xl border border-indigo-500/30">
              <Users className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-4 flex items-baseline justify-between">
            <span className="text-3xl font-extrabold text-white font-mono">
              {loading ? '...' : stats.totalInvites}
            </span>
            <span className="text-xs text-indigo-400 font-medium flex items-center">
              <Zap className="w-3 h-3 mr-1" /> Invites Sent
            </span>
          </div>
        </div>

        {/* Card 2: Pending Referrals */}
        <div className="relative overflow-hidden bg-gradient-to-br from-gray-800/90 to-gray-900/90 border border-gray-700/80 rounded-2xl p-5 shadow-lg group hover:border-amber-500/50 transition-all">
          <div className="absolute top-0 right-0 w-24 h-24 bg-amber-500/10 rounded-full blur-2xl group-hover:bg-amber-500/20 transition-all" />
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Pending Referrals</span>
            <div className="p-2.5 bg-amber-600/20 text-amber-400 rounded-xl border border-amber-500/30">
              <Clock className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-4 flex items-baseline justify-between">
            <span className="text-3xl font-extrabold text-white font-mono">
              {loading ? '...' : stats.pendingReferrals}
            </span>
            <span className="text-xs text-amber-400 font-medium">Awaiting Action</span>
          </div>
        </div>

        {/* Card 3: Unlocked Vouchers */}
        <div className="relative overflow-hidden bg-gradient-to-br from-gray-800/90 to-gray-900/90 border border-gray-700/80 rounded-2xl p-5 shadow-lg group hover:border-emerald-500/50 transition-all">
          <div className="absolute top-0 right-0 w-24 h-24 bg-emerald-500/10 rounded-full blur-2xl group-hover:bg-emerald-500/20 transition-all" />
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Unlocked Vouchers</span>
            <div className="p-2.5 bg-emerald-600/20 text-emerald-400 rounded-xl border border-emerald-500/30">
              <Gift className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-4 flex items-baseline justify-between">
            <span className="text-3xl font-extrabold text-white font-mono">
              {loading ? '...' : stats.unlockedVouchers}
            </span>
            <span className="text-xs text-emerald-400 font-medium flex items-center">
              <CheckCircle2 className="w-3 h-3 mr-1" /> Rewards Active
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
