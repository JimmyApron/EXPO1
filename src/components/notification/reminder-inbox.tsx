import { useCallback, useEffect, useState } from 'react';
import { AppState, Pressable, Switch, View } from 'react-native';
import { ThemedText } from '@/components/themed-text';
import { useAuth } from '@/hooks/use-auth';
import { supabase } from '@/lib/supabase';

type Reminder = { id: string; createdat: string; isread: boolean };
export function ReminderInbox() {
  const { user } = useAuth();
  const [items, setItems] = useState<Reminder[]>([]);
  const [enabled, setEnabled] = useState(true);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const load = useCallback(async () => {
    if (!user) return;
    try {
      const [notifications, preferences] = await Promise.all([
        supabase.from('reminder_notifications').select('id, createdat, isread').eq('recipientid', user.id).order('createdat', { ascending: false }).limit(50),
        supabase.from('reminder_preferences').select('enabled').eq('userid', user.id).maybeSingle(),
      ]);
      if (notifications.error || preferences.error) throw new Error();
      setItems(notifications.data ?? []); setEnabled(preferences.data?.enabled ?? true); setError('');
    } catch { setError('리마인드 알림을 불러오지 못했어요. 연결을 확인하고 다시 시도해주세요.'); }
    finally { setLoading(false); }
  }, [user]);
  useEffect(() => {
    const initial = setTimeout(() => void load(), 0);
    const timer = setInterval(() => { if (AppState.currentState === 'active') void load(); }, 30000);
    return () => { clearTimeout(initial); clearInterval(timer); };
  }, [load]);
  const mutate = async (id?: string) => {
    if (!user || busy) return;
    setBusy(true);
    try {
      const result = id
        ? await supabase.from('reminder_notifications').update({ isread: true }).eq('id', id).eq('recipientid', user.id)
        : await supabase.from('reminder_preferences').upsert({ userid: user.id, enabled: !enabled });
      if (result.error) throw new Error();
      await load();
    } catch { setError('변경하지 못했어요. 연결을 확인하고 다시 시도해주세요.'); }
    finally { setBusy(false); }
  };
  return <View style={{ gap: 12 }}><ThemedText type="sectionTitle">익명 리마인드</ThemedText>
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}><ThemedText style={{ flex: 1 }}>리마인드 수신</ThemedText><Switch accessibilityLabel="익명 리마인드 수신" disabled={loading || busy || !!error} value={enabled} onValueChange={() => void mutate()} /></View>
    {loading ? <ThemedText>알림을 불러오는 중…</ThemedText> : null}
    {error ? <View><ThemedText accessibilityLiveRegion="polite">{error}</ThemedText><Pressable accessibilityRole="button" accessibilityLabel="리마인드 알림 다시 불러오기" onPress={() => void load()} style={{ padding: 12 }}><ThemedText>다시 시도</ThemedText></Pressable></View> : null}
    {!loading && !error && items.length === 0 ? <ThemedText>받은 리마인드가 없어요.</ThemedText> : null}
    {items.map((item) => <View key={item.id} style={{ padding: 12, borderWidth: 1, borderColor: '#cbd5e1', borderRadius: 12, gap: 8 }}><ThemedText>아직 참여하지 않은 과제의 평가를 완료해주세요.</ThemedText><ThemedText type="caption">{new Date(item.createdat).toLocaleString('ko-KR')}</ThemedText>{item.isread ? <ThemedText>읽음</ThemedText> : <Pressable accessibilityRole="button" accessibilityLabel="익명 리마인드 읽음 처리" accessibilityState={{ disabled: busy, busy }} disabled={busy} onPress={() => void mutate(item.id)} style={{ padding: 12 }}><ThemedText>읽음 처리</ThemedText></Pressable>}</View>)}
  </View>;
}
