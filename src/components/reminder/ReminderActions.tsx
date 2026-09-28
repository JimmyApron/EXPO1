import * as Clipboard from 'expo-clipboard';
import { useRef, useState } from 'react';
import { Pressable, View } from 'react-native';
import { ThemedText } from '@/components/themed-text';
import { useNotificationToasts } from '@/components/notification/notification-toast-provider';
import { createKakaoReminderMessage, KAKAO_COPY_SUCCESS } from '@/utils/share/kakaoReminderMessage';
import { sendReminderNotification } from '@/utils/reminder/reminderSender';

export function ReminderActions({ projectId, title, deadline, completedCount, totalCount }: {
  projectId: string; title: string; deadline?: string | null; completedCount: number; totalCount: number;
}) {
  const [busy, setBusy] = useState('');
  const lock = useRef(false);
  const [message, setMessage] = useState('');
  const { showNotificationToast } = useNotificationToasts();
  const handleAction = async (action: 'copy' | 'send') => {
    if (lock.current) return;
    lock.current = true; setBusy(action); setMessage('');
    try {
      if (action === 'copy') {
        const ok = await Clipboard.setStringAsync(createKakaoReminderMessage({ assignmentTitle: title, completedCount, totalCount, dueDate: deadline }));
        if (!ok) throw new Error('복사하지 못했어요. 클립보드 권한을 확인하고 다시 시도해주세요.');
        showNotificationToast({ id: `copy:${projectId}`, projectid: projectId, title: '복사 완료', message: KAKAO_COPY_SUCCESS, kind: 'evaluation', isread: true, createdat: new Date().toISOString() });
      } else setMessage(await sendReminderNotification(projectId));
    } catch (error) { setMessage(error instanceof Error ? error.message : '실패했어요. 다시 시도해주세요.'); }
    finally { lock.current = false; setBusy(''); }
  };
  if (totalCount <= 0 || completedCount >= totalCount) return null;
  return <View style={{ gap: 8, width: '100%', minWidth: 0 }}><View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
    {(['send', 'copy'] as const).map((action) => <Pressable key={action} accessibilityRole="button" accessibilityLabel={action === 'send' ? '미완료자 콕 찌르기, 익명 리마인드' : '카카오톡 독려 메시지 복사'} accessibilityState={{ disabled: !!busy, busy: busy === action }} disabled={!!busy} onPress={() => void handleAction(action)} style={{ padding: 12, borderWidth: 1, borderColor: '#d97706', borderRadius: 8 }}><ThemedText type="button">{busy === action ? '처리 중…' : action === 'send' ? '미완료자 콕 찌르기' : '카카오톡 독려 메시지 복사'}</ThemedText></Pressable>)}
  </View>{message ? <ThemedText accessibilityLiveRegion="polite">{message}</ThemedText> : null}</View>;
}
