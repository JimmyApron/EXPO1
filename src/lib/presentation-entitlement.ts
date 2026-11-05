import { supabase } from '@/lib/supabase';
import type { PresentationTheme } from '@/lib/presentation-themes';
import { isPremiumPresentationTheme } from '@/lib/presentation-themes';

/** UI guidance only; database triggers independently enforce the same rule. */
export async function canApplyPresentationTheme(projectId: string, theme: PresentationTheme) {
  if (!isPremiumPresentationTheme(theme)) return true;
  const { data, error } = await supabase.rpc('watt_can_use_premium_presentation', { p_project_id: projectId });
  if (error) throw new Error('구독 권한을 확인하지 못했습니다. 다시 시도해 주세요.');
  return data === true;
}
