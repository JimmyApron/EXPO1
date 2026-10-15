import { useCallback, useEffect, useMemo, useState } from 'react';

import { useAuth } from '@/hooks/use-auth';
import { useRealtimeRefresh } from '@/hooks/use-realtime-refresh';
import { supabase } from '@/lib/supabase';
import type { ProjectFlow } from '@/types/project-flow';

export type ProjectFlowSummary = Pick<
  ProjectFlow,
  'projectid' | 'selectedideaid' | 'mvpplan' | 'presentationdata'
>;

export function useProjectFlowSummaries(projectIds: string[]) {
  const { user } = useAuth();
  const idsKey = useMemo(() => [...new Set(projectIds)].sort().join(','), [projectIds]);
  const [loaded, setLoaded] = useState<{ key: string; flows: Map<string, ProjectFlowSummary>; error: boolean }>({ key: '', flows: new Map(), error: false });
  const queryKey = `${user?.id ?? ''}:${idsKey}`;

  const loadFlows = useCallback(async () => {
    if (!user?.id || !idsKey) return { flows: new Map<string, ProjectFlowSummary>(), error: false };

    const { data, error } = await supabase
      .from('projectflows')
      .select('projectid, selectedideaid, mvpplan, presentationdata')
      .in('projectid', idsKey.split(','));

    if (error) return { flows: new Map<string, ProjectFlowSummary>(), error: true };

    return {
      flows: new Map((data as ProjectFlowSummary[] ?? []).map((flow) => [flow.projectid, flow])),
      error: false,
    };
  }, [idsKey, user?.id]);

  useEffect(() => {
    let active = true;
    void loadFlows().then((result) => {
      if (active) setLoaded({ key: queryKey, ...result });
    });
    return () => { active = false; };
  }, [loadFlows, queryKey]);

  const refreshFlows = useCallback(async () => {
    const result = await loadFlows();
    setLoaded({ key: queryKey, ...result });
  }, [loadFlows, queryKey]);

  useRealtimeRefresh({
    channelName: `project-flow-summaries:${user?.id ?? 'signed-out'}`,
    enabled: Boolean(user && idsKey),
    onRefresh: refreshFlows,
    tables: [{ table: 'projectflows', filter: `userid=eq.${user?.id}` }],
  });

  const isReady = loaded.key === queryKey;
  return {
    flowsByProjectId: isReady ? loaded.flows : new Map<string, ProjectFlowSummary>(),
    flowStatus: !isReady ? 'loading' : loaded.error ? 'error' : 'ready',
  } as const;
}
