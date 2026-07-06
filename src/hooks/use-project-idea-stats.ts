import { useCallback, useEffect, useMemo, useState } from 'react';

import { useAuth } from '@/hooks/use-auth';
import { supabase } from '@/lib/supabase';
import { normalizeIdeaStatus, type IdeaStatus } from '@/types/idea';

type IdeaStatRow = {
  projectid?: string;
  status?: IdeaStatus;
  isfavorite?: boolean;
};

export type ProjectIdeaStats = {
  total: number;
  selected: number;
  approved: number;
  favorites: number;
};

const emptyStats: ProjectIdeaStats = {
  total: 0,
  selected: 0,
  approved: 0,
  favorites: 0,
};

function createEmptyStats(): ProjectIdeaStats {
  return { ...emptyStats };
}

export function useProjectIdeaStats() {
  const { user } = useAuth();
  const [statsByProjectId, setStatsByProjectId] = useState<Map<string, ProjectIdeaStats>>(new Map());
  const [isLoadingStats, setIsLoadingStats] = useState(true);
  const [statsError, setStatsError] = useState('');

  const loadStats = useCallback(async () => {
    if (!user) {
      setStatsByProjectId(new Map());
      setIsLoadingStats(false);
      return;
    }

    setIsLoadingStats(true);
    setStatsError('');

    const { data, error } = await supabase
      .from('ideas')
      .select('projectid, status, isfavorite')
      .eq('userid', user.id);

    if (error) {
      setStatsError(error.message);
      setStatsByProjectId(new Map());
      setIsLoadingStats(false);
      return;
    }

    const nextStats = new Map<string, ProjectIdeaStats>();

    (data ?? []).forEach((row) => {
      const idea = row as IdeaStatRow;

      if (!idea.projectid) {
        return;
      }

      const current = nextStats.get(idea.projectid) ?? createEmptyStats();
      const status = normalizeIdeaStatus(idea.status);

      current.total += 1;
      if (status === 'selected') {
        current.selected += 1;
      }
      if (status === 'approved') {
        current.approved += 1;
      }
      if (idea.isfavorite) {
        current.favorites += 1;
      }

      nextStats.set(idea.projectid, current);
    });

    setStatsByProjectId(nextStats);
    setIsLoadingStats(false);
  }, [user]);

  useEffect(() => {
    const timeout = globalThis.setTimeout(() => {
      loadStats();
    }, 0);

    return () => {
      globalThis.clearTimeout(timeout);
    };
  }, [loadStats]);

  const totals = useMemo(() => {
    let totalIdeas = 0;
    let selectedIdeas = 0;
    let favoriteIdeas = 0;

    statsByProjectId.forEach((stats) => {
      totalIdeas += stats.total;
      selectedIdeas += stats.selected;
      favoriteIdeas += stats.favorites;
    });

    return { totalIdeas, selectedIdeas, favoriteIdeas };
  }, [statsByProjectId]);

  const getStatsForProject = useCallback(
    (projectId: string) => statsByProjectId.get(projectId) ?? emptyStats,
    [statsByProjectId],
  );

  return {
    statsByProjectId,
    totals,
    isLoadingStats,
    statsError,
    loadStats,
    getStatsForProject,
  };
}
