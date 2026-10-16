import { useCallback, useEffect, useMemo, useState } from 'react';
import { useAuth } from '@/hooks/use-auth';
import { useRealtimeRefresh } from '@/hooks/use-realtime-refresh';
import { supabase } from '@/lib/supabase';
import { changeFavoriteWithRollback } from '@/lib/project-favorites';
import { isMissingProjectFeatureTable } from '@/lib/project-schema';

export function useProjectFavorites(projectIds: string[]) {
  const { user } = useAuth();
  const ids = useMemo(() => [...new Set(projectIds)].sort().join(','), [projectIds]);
  const [state, setState] = useState({ key: '', ids: new Set<string>(), error: '', unavailable: false });
  const [busyProjectId, setBusyProjectId] = useState<string | null>(null);
  const key = `${user?.id ?? ''}:${ids}`;

  const load = useCallback(async () => {
    if (!user || !ids) return { ids: new Set<string>(), error: '', unavailable: false };
    const { data, error } = await supabase.from('project_favorites').select('projectid')
      .eq('userid', user.id).in('projectid', ids.split(','));
    const unavailable = isMissingProjectFeatureTable(error, 'project_favorites');
    return { ids: new Set((data ?? []).map((row) => row.projectid as string)),
      error: unavailable ? '' : error?.message ?? '', unavailable };
  }, [ids, user]);

  useEffect(() => {
    let active = true;
    void load().then((result) => { if (active) setState({ key, ...result }); });
    return () => { active = false; };
  }, [key, load]);

  const refresh = useCallback(async () => setState({ key, ...(await load()) }), [key, load]);
  useRealtimeRefresh({ channelName: `project-favorites:${user?.id ?? 'signed-out'}`,
    enabled: Boolean(user && ids), onRefresh: refresh,
    tables: [{ table: 'project_favorites', filter: `userid=eq.${user?.id}` }] });

  const toggleFavorite = useCallback(async (projectId: string) => {
    if (!user || !ids.split(',').includes(projectId) || busyProjectId || state.unavailable) return { error: '즐겨찾기를 변경할 수 없습니다.' };
    setBusyProjectId(projectId);
    const result = await changeFavoriteWithRollback(state.ids, projectId,
      (next) => setState((current) => ({ ...current, ids: next, error: '' })),
      async (shouldAdd) => {
        const { error } = shouldAdd
          ? await supabase.from('project_favorites').insert({ userid: user.id, projectid: projectId })
          : await supabase.from('project_favorites').delete().eq('userid', user.id).eq('projectid', projectId);
        return { error: error?.message };
      });
    if (result.error) setState((current) => ({ ...current, error: result.error }));
    setBusyProjectId(null);
    return result;
  }, [busyProjectId, ids, state.ids, state.unavailable, user]);

  const ready = state.key === key;
  return { favoriteProjectIds: ready ? state.ids : new Set<string>(),
    favoritesStatus: !ready ? 'loading' as const : state.unavailable ? 'unavailable' as const : state.error ? 'error' as const : 'ready' as const,
    favoritesError: ready ? state.error : '', busyProjectId, toggleFavorite };
}
