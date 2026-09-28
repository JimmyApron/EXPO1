import { supabase } from '@/lib/supabase';
export const reminderMessages: Record<string, string> = {
  sent: '익명 리마인드를 보냈어요.',
  cooldown: '이미 최근에 리마인드를 보냈어요. 잠시 후 다시 시도해주세요.',
  daily_limit: '오늘 보낼 수 있는 리마인드 횟수를 모두 사용했어요.',
  opted_out: '상대방이 리마인드 수신을 꺼두었어요.',
  complete: '모두 평가를 완료했거나 평가할 아이디어가 없어요.',
  forbidden: '이 과제에 리마인드를 보낼 권한이 없어요.',
};
// Only creates in-app records. Future push delivery belongs behind this server boundary.
export async function sendReminderNotification(projectId: string) {
  const { data, error } = await supabase.rpc('send_anonymous_reminder', { p_projectid: projectId });
  if (error) throw new Error('리마인드를 보내지 못했어요. 네트워크 연결을 확인하고 다시 시도해주세요.');
  return reminderMessages[String(data)] ?? '리마인드를 보내지 못했어요. 다시 시도해주세요.';
}
