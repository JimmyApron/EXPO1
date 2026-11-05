import { useEffect, useState } from 'react';
import { View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { useTheme } from '@/hooks/use-theme';
import { subscribeWattBalance, wattAction, type WattSnapshot } from '@/hooks/use-watt';

export function WattCostHint({ projectId, units }: { projectId: string; units: number }) {
  const theme = useTheme();
  const [balance,setBalance] = useState<WattSnapshot|null>(null);
  useEffect(() => {
    let active=true;
    const load=()=>{ void wattAction<{personal:WattSnapshot;team:WattSnapshot|null}>({action:'state',projectId})
      .then(result => { if(active) setBalance(result.team ?? result.personal); })
      .catch(() => { if(active) setBalance(null); }); };
    load();
    const listener=()=>load();
    const unsubscribe=subscribeWattBalance(listener);
    return () => { active=false; unsubscribe(); };
  },[projectId]);
  const quota = balance?.textUsage;
  const freeText = units < 4 && quota && quota.todayUsed < quota.dailyLimit
    && (quota.memberLimit === null || (quota.memberUsed ?? 0) < quota.memberLimit)
    && (quota.trialLimit === null || (quota.trialUsed ?? 0) < quota.trialLimit);
  return <View accessibilityLiveRegion="polite"><ThemedText type="caption" style={{color:theme.textSecondary}}>
    {freeText ? `${quota.trialLimit === null ? '구독' : '무료체험'} 혜택으로 0단위 · 오늘 ${quota.todayUsed}/${quota.dailyLimit}회 이용` : `이번 작업 ${units}단위 사용 · 잔여 ${balance?.total ?? '확인 중'}단위`}
  </ThemedText></View>;
}
