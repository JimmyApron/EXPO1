import { useCallback, useEffect, useMemo, useState } from 'react';
import { useAuth } from '@/hooks/use-auth';
import { useRealtimeRefresh } from '@/hooks/use-realtime-refresh';
import { supabase } from '@/lib/supabase';
import type { ProjectStageId } from '@/lib/project-stages';
import type { ProjectTemplate } from '@/types/project';
import { isMissingProjectFeatureTable } from '@/lib/project-schema';

export type ProjectStageRecord = {
  projectid: string;
  template: ProjectTemplate;
  stageid: ProjectStageId;
  content: string;
  iscompleted: boolean;
  updatedat: string;
};

export function useProjectStageProgress(projectIds: string[]) {
  const { user } = useAuth();
  const key = useMemo(() => [...new Set(projectIds)].sort().join(','), [projectIds]);
  const [loaded, setLoaded] = useState({ key: '', rows: new Map<string, ProjectStageRecord[]>(), error: '', unavailable: false });
  const queryKey = `${user?.id ?? ''}:${key}`;

  const load = useCallback(async () => {
    if (!user || !key) return { rows: new Map<string, ProjectStageRecord[]>(), error: '', unavailable: false };
    const { data, error } = await supabase.from('project_stage_progress')
      .select('projectid, template, stageid, content, iscompleted, updatedat').in('projectid', key.split(','));
    if (error) {
      const unavailable = isMissingProjectFeatureTable(error, 'project_stage_progress');
      return { rows: new Map<string, ProjectStageRecord[]>(), error: unavailable ? '' : error.message, unavailable };
    }
    const rows = new Map<string, ProjectStageRecord[]>();
    for (const record of (data ?? []) as ProjectStageRecord[]) {
      rows.set(record.projectid, [...(rows.get(record.projectid) ?? []), record]);
    }
    return { rows, error: '', unavailable: false };
  }, [key, user]);

  useEffect(() => {
    let active = true;
    void load().then((result) => { if (active) setLoaded({ key: queryKey, ...result }); });
    return () => { active = false; };
  }, [load, queryKey]);

  const refresh = useCallback(async () => {
    setLoaded({ key: queryKey, ...(await load()) });
  }, [load, queryKey]);

  useRealtimeRefresh({ channelName: `project-stages:${user?.id ?? 'signed-out'}:${key}`,
    enabled: Boolean(user && key), onRefresh: refresh,
    tables: [{ table: 'project_stage_progress' }] });

  const saveStage = useCallback(async (projectId: string, template: ProjectTemplate, stageId: ProjectStageId, content: string, isCompleted: boolean) => {
    if (!user || !projectIds.includes(projectId)) return { error: '과제를 찾을 수 없습니다.' };
    const { data, error } = await supabase.from('project_stage_progress').upsert({
      projectid: projectId, template, stageid: stageId, content: content.trim(), iscompleted: isCompleted,
      updatedat: new Date().toISOString(),
    }, { onConflict: 'projectid,template,stageid' }).select('projectid, template, stageid, content, iscompleted, updatedat').single();
    if (error) return { error: error.message };
    const record = data as ProjectStageRecord;
    setLoaded((current) => {
      const rows = new Map(current.rows);
      rows.set(projectId, [...(rows.get(projectId) ?? []).filter((item) => item.stageid !== stageId || item.template !== template), record]);
      return { ...current, rows };
    });
    return {};
  }, [projectIds, user]);

  const ready = loaded.key === queryKey;
  return { progressByProjectId: ready ? loaded.rows : new Map<string, ProjectStageRecord[]>(),
    stageProgressStatus: !ready ? 'loading' as const : loaded.unavailable ? 'unavailable' as const : loaded.error ? 'error' as const : 'ready' as const,
    stageProgressError: ready ? loaded.error : '', saveStage, refreshStages: refresh };
}
