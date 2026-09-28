import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../supabaseClient';

/**
 * Custom React Hook: useUserStats
 * Fetches and subscribes to real-time user referral & reward statistics from Supabase.
 *
 * Stats tracked:
 *  - totalInvites: Total referrals created by this user
 *  - pendingReferrals: Invites awaiting qualifying conversion
 *  - completedReferrals: Successful conversions
 *  - unlockedVouchers: Vouchers / rewards minted for this user
 *
 * @param {string} userId - User UUID or ID
 * @param {string} [token] - JWT token for backend API fallback
 */
export function useUserStats(userId, token) {
  const [stats, setStats] = useState({
    totalInvites: 0,
    pendingReferrals: 0,
    completedReferrals: 0,
    unlockedVouchers: 0,
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [isRealtimeActive, setIsRealtimeActive] = useState(false);

  const fetchStats = useCallback(async () => {
    if (!userId) {
      setLoading(false);
      return;
    }

    try {
      setError(null);

      // Attempt Supabase direct queries
      const [referralsRes, pendingRes, completedRes, rewardsRes] = await Promise.all([
        supabase
          .from('referrals')
          .select('id', { count: 'exact', head: true })
          .eq('referrer_id', userId),
        supabase
          .from('referrals')
          .select('id', { count: 'exact', head: true })
          .eq('referrer_id', userId)
          .eq('status', 'PENDING'),
        supabase
          .from('referrals')
          .select('id', { count: 'exact', head: true })
          .eq('referrer_id', userId)
          .eq('status', 'COMPLETED'),
        supabase
          .from('rewards')
          .select('id', { count: 'exact', head: true })
          .eq('user_id', userId),
      ]);

      // Check if Supabase queries succeeded or if backend API fallback is required
      if (!referralsRes.error && !pendingRes.error && !rewardsRes.error) {
        setStats({
          totalInvites: referralsRes.count || 0,
          pendingReferrals: pendingRes.count || 0,
          completedReferrals: completedRes.count || 0,
          unlockedVouchers: rewardsRes.count || 0,
        });
      } else if (token) {
        // Fallback to Express backend /api/user/stats
        const apiRes = await fetch('/api/user/stats', {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (apiRes.ok) {
          const data = await apiRes.json();
          if (data.stats) setStats(data.stats);
        }
      }
    } catch (err) {
      console.warn('Realtime stats fetch warning:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [userId, token]);

  useEffect(() => {
    fetchStats();

    if (!userId) return;

    // ── Supabase Realtime Subscription ──────────────────────────────────────────
    const channel = supabase
      .channel(`user-stats-channel-${userId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'referrals',
          filter: `referrer_id=eq.${userId}`,
        },
        () => {
          fetchStats();
        }
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'rewards',
          filter: `user_id=eq.${userId}`,
        },
        () => {
          fetchStats();
        }
      )
      .subscribe((status) => {
        setIsRealtimeActive(status === 'SUBSCRIBED');
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId, fetchStats]);

  return {
    stats,
    loading,
    error,
    refetch: fetchStats,
    isRealtimeActive,
  };
}
