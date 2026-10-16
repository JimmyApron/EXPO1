import { useCallback, useEffect, useState } from 'react';

import { supabase } from '@/lib/supabase';
import { useRealtimeRefresh } from '@/hooks/use-realtime-refresh';

const balanceListeners = new Set<() => void>();
export function notifyWattBalanceChanged() { balanceListeners.forEach(listener => listener()); }
export function subscribeWattBalance(listener: () => void) {
  balanceListeners.add(listener);
  return () => { balanceListeners.delete(listener); };
}

export type WattSnapshot = {
  total: number;
  server_now?: string;
  grants: { source: string; remaining: number; total: number; expires_at: string | null }[];
  entitlements: { id: string; product_id: string; state: string; started_at: string; ends_at: string; room_id: string | null; room_name?: string | null; trial: boolean; auto_renew?: boolean; next_renewal_at?: string | null; next_grant_at?: string | null }[];
};
export type WattState = { personal: WattSnapshot; team?: WattSnapshot|null; trialUsed?: boolean };

export async function wattAction<T>(body: Record<string, unknown>) {
  const { data, error } = await supabase.functions.invoke('watt-billing', { body });
  if (error) throw error;
  if (data?.error) throw new Error(typeof data.message === 'string' ? data.message : data.error);
  return data.data as T;
}

export function useWattBalance() {
  const [balance, setBalance] = useState<WattSnapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [trialUsed,setTrialUsed] = useState(false);
  const [userId,setUserId] = useState<string|null>(null);
  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const result = await wattAction<WattState>({ action: 'state' });
      setBalance(result.personal);
      setTrialUsed(Boolean(result.trialUsed));
      setError('');
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'AI 이용량을 불러오지 못했습니다.');
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => {
    let active = true;
    void supabase.auth.getUser().then(({data}) => { if(active) setUserId(data.user?.id ?? null); });
    const {data:{subscription}} = supabase.auth.onAuthStateChange((_event,session) => setUserId(session?.user.id ?? null));
    return () => { active = false; subscription.unsubscribe(); };
  }, []);
  useEffect(() => {
    const timeout=globalThis.setTimeout(()=>{
      if(userId) { void refresh(); return; }
      setBalance(null);
      setTrialUsed(false);
      setError('');
    },0);
    return()=>globalThis.clearTimeout(timeout);
  }, [refresh,userId]);
  useRealtimeRefresh({
    channelName: 'watt-personal-state',
    enabled: Boolean(userId),
    onRefresh: refresh,
    tables: userId ? [
      {table:'watt_entitlements',filter:`user_id=eq.${userId}`},
      {table:'watt_grants',filter:`owner_id=eq.${userId}`},
      {table:'watt_purchases',filter:`user_id=eq.${userId}`},
      {table:'watt_trials',filter:`user_id=eq.${userId}`},
      {table:'watt_usage',filter:`user_id=eq.${userId}`},
    ] : [],
  });
  useEffect(() => {
    const timeout = globalThis.setTimeout(() => { void refresh(); }, 0);
    const unsubscribe = subscribeWattBalance(refresh);
    return () => { globalThis.clearTimeout(timeout); unsubscribe(); };
  }, [refresh]);
  return { balance, loading, error, refresh, trialUsed };
}
