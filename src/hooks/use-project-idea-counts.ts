import { useCallback, useEffect, useMemo, useState } from 'react';
import { useAuth } from '@/hooks/use-auth';
import { useRealtimeRefresh } from '@/hooks/use-realtime-refresh';
import { supabase } from '@/lib/supabase';
import { normalizeIdeaStatus } from '@/types/idea';

export type ProjectIdeaCounts = { total: number; selected: number };

export function useProjectIdeaCounts(projectIds: string[]) {
  const { user } = useAuth();
  const ids = useMemo(() => [...new Set(projectIds)].sort().join(','), [projectIds]);
  const key = `${user?.id ?? ''}:${ids}`;
  const [loaded, setLoaded] = useState({ key: '', counts: new Map<string, ProjectIdeaCounts>(), error: '' });

  const load = useCallback(async () => {
    if (!user || !ids) return { counts: new Map<string, ProjectIdeaCounts>(), error: '' };
    const { data, error } = await supabase.from('ideas').select('projectid, status')
      .in('projectid', ids.split(',')).eq('legacystructural', false);
    if (error) return { counts: new Map<string, ProjectIdeaCounts>(), error: error.message };
    const counts = new Map<string, ProjectIdeaCounts>();
    for (const row of data ?? []) {
      const current = counts.get(row.projectid) ?? { total: 0, selected: 0 };
      current.total += 1;
      if (normalizeIdeaStatus(row.status) === 'selected') current.selected += 1;
      counts.set(row.projectid, current);
    }
    return { counts, error: '' };
  }, [ids, user]);

  useEffect(() => {
    let active = true;
    void load().then((result) => { if (active) setLoaded({ key, ...result }); });
    return () => { active = false; };
  }, [key, load]);

  const refresh = useCallback(async () => setLoaded({ key, ...(await load()) }), [key, load]);
  useRealtimeRefresh({ channelName: `project-idea-counts:${user?.id ?? 'signed-out'}:${ids}`,
    enabled: Boolean(user && ids), onRefresh: refresh,
    tables: [{ table: 'ideas' }] });

  const ready = loaded.key === key;
  return { countsByProjectId: ready ? loaded.counts : new Map<string, ProjectIdeaCounts>(),
    ideaCountsStatus: !ready ? 'loading' as const : loaded.error ? 'error' as const : 'ready' as const,
    ideaCountsError: ready ? loaded.error : '' };
}
