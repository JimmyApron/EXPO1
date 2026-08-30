import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { sampleProjectConditions } from '@/constants/sample-project';
import { useAuth } from '@/hooks/use-auth';
import { useRealtimeRefresh } from '@/hooks/use-realtime-refresh';
import { supabase } from '@/lib/supabase';
import type { FinalIdeaAnalysisResult } from '@/types/final-analysis';
import type { BlindIdeaAnalysisCache } from '@/types/idea-evaluation';
import type { MvpPlan } from '@/types/mvp-plan';
import type { PresentationData } from '@/types/presentation';
import type { CompleteProjectConditions, ProjectFlow } from '@/types/project-flow';

const flowselect =
  'id, projectid, userid, durationweeks, teamsize, skilllevel, budget, evaluationcriteria, selectedideaid, coachresult, blindanalysis, evaluationround, mvpplan, presentationdata, createdat, updatedat';

function createLocalFlow(projectid: string, userid: string): ProjectFlow {
  const now = new Date().toISOString();
  return {
    id: '',
    projectid,
    userid,
    durationweeks: sampleProjectConditions.durationWeeks,
    teamsize: sampleProjectConditions.teamSize,
    skilllevel: sampleProjectConditions.skillLevel,
    budget: sampleProjectConditions.budget,
    evaluationcriteria: sampleProjectConditions.evaluationCriteria,
    selectedideaid: null,
    coachresult: null,
    blindanalysis: null,
    evaluationround: 1,
    mvpplan: null,
    presentationdata: null,
    createdat: now,
    updatedat: now,
  };
}

export function projectFlowConditions(flow: ProjectFlow | null): CompleteProjectConditions {
  return {
    durationWeeks: flow?.durationweeks ?? sampleProjectConditions.durationWeeks,
    teamSize: flow?.teamsize ?? sampleProjectConditions.teamSize,
    skillLevel: flow?.skilllevel ?? sampleProjectConditions.skillLevel,
    budget: flow?.budget ?? sampleProjectConditions.budget,
    evaluationCriteria: flow?.evaluationcriteria ?? sampleProjectConditions.evaluationCriteria,
  };
}

export function useProjectFlow(projectid?: string) {
  const { user } = useAuth();
  const [flow, setFlow] = useState<ProjectFlow | null>(null);
  const flowRef = useRef<ProjectFlow | null>(null);
  const [isloadingflow, setIsloadingflow] = useState(true);
  const [flowerror, setFlowerror] = useState('');

  const loadFlow = useCallback(async () => {
    if (!user || !projectid) {
      flowRef.current = null;
      setFlow(null);
      setIsloadingflow(false);
      return;
    }

    setIsloadingflow(true);
    setFlowerror('');
    const { data, error } = await supabase
      .from('projectflows')
      .select(flowselect)
      .eq('projectid', projectid)
      .maybeSingle();

    if (error) {
      setFlowerror(error.message);
      const localFlow = createLocalFlow(projectid, user.id);
      flowRef.current = localFlow;
      setFlow(localFlow);
    } else {
      const loadedFlow = (data as ProjectFlow | null) ?? createLocalFlow(projectid, user.id);
      flowRef.current = loadedFlow;
      setFlow(loadedFlow);
    }
    setIsloadingflow(false);
  }, [projectid, user]);

  useEffect(() => {
    const timeout = globalThis.setTimeout(() => void loadFlow(), 0);
    return () => globalThis.clearTimeout(timeout);
  }, [loadFlow]);

  useRealtimeRefresh({
    channelName: `project-flow:${projectid ?? 'none'}`,
    enabled: Boolean(user && projectid),
    onRefresh: loadFlow,
    tables: [{ table: 'projectflows', filter: `projectid=eq.${projectid}` }],
  });

  const conditions = useMemo(() => projectFlowConditions(flow), [flow]);

  const savePatch = useCallback(
    async (patch: Partial<ProjectFlow>) => {
      if (!user || !projectid) return { error: '로그인이 필요합니다.' };
      const current = flowRef.current ?? createLocalFlow(projectid, user.id);
      const now = new Date().toISOString();
      const payload = {
        projectid,
        userid: user.id,
        durationweeks: current.durationweeks,
        teamsize: current.teamsize,
        skilllevel: current.skilllevel,
        budget: current.budget,
        evaluationcriteria: current.evaluationcriteria,
        selectedideaid: current.selectedideaid,
        coachresult: current.coachresult,
        blindanalysis: current.blindanalysis,
        evaluationround: current.evaluationround,
        mvpplan: current.mvpplan,
        presentationdata: current.presentationdata,
        ...patch,
        updatedat: now,
      };

      const { data, error } = await supabase
        .from('projectflows')
        .upsert(payload, { onConflict: 'projectid' })
        .select(flowselect)
        .single();

      if (error) {
        setFlowerror(error.message);
        return { error: error.message };
      }
      const saved = data as ProjectFlow;
      flowRef.current = saved;
      setFlow(saved);
      setFlowerror('');
      return { flow: saved };
    },
    [projectid, user],
  );

  const saveConditions = useCallback(
    (conditions: CompleteProjectConditions) =>
      savePatch({
        durationweeks: conditions.durationWeeks,
        teamsize: conditions.teamSize,
        skilllevel: conditions.skillLevel.trim(),
        budget: conditions.budget,
        evaluationcriteria: conditions.evaluationCriteria.map((item) => item.trim()).filter(Boolean),
      }),
    [savePatch],
  );

  const saveSelectedIdea = useCallback(
    async (ideaid: string) => {
      if (!projectid) return { error: '프로젝트 정보가 없습니다.' };

      const { error: reseterror } = await supabase
        .from('ideas')
        .update({ status: 'approved', updatedat: new Date().toISOString() })
        .eq('projectid', projectid)
        .eq('legacystructural', false)
        .eq('status', 'selected')
        .neq('id', ideaid);
      if (reseterror) return { error: reseterror.message };

      const { error: selecterror } = await supabase
        .from('ideas')
        .update({ status: 'selected', updatedat: new Date().toISOString() })
        .eq('projectid', projectid)
        .eq('legacystructural', false)
        .eq('id', ideaid);
      if (selecterror) return { error: selecterror.message };

      // 예전 발표자료에도 변경 전 기준 아이디어를 보강한 뒤 보존한다.
      const current = flowRef.current;
      const presentationdata = current?.presentationdata && !current.presentationdata.ideaId
        ? { ...current.presentationdata, ideaId: current.mvpplan?.ideaId ?? current.selectedideaid ?? undefined }
        : current?.presentationdata;
      return savePatch({ selectedideaid: ideaid, ...(presentationdata ? { presentationdata } : {}) });
    },
    [projectid, savePatch],
  );

  const saveCoachResult = useCallback(
    (coachresult: FinalIdeaAnalysisResult) => savePatch({ coachresult }),
    [savePatch],
  );
  const saveBlindAnalysis = useCallback(
    (blindanalysis: BlindIdeaAnalysisCache) => savePatch({ blindanalysis }),
    [savePatch],
  );
  const restartBlindEvaluation = useCallback(async () => {
    if (!projectid) return { error: '프로젝트 정보가 없습니다.' };

    const { error } = await supabase.rpc('restart_blind_evaluation', { target_project_id: projectid });
    if (error) return { error: error.message };

    await loadFlow();
    return {};
  }, [loadFlow, projectid]);
  const saveMvpPlan = useCallback(
    (mvpplan: MvpPlan) => {
      const current = flowRef.current;
      const presentationdata = current?.presentationdata && !current.presentationdata.ideaId
        ? { ...current.presentationdata, ideaId: current.mvpplan?.ideaId ?? current.selectedideaid ?? undefined }
        : current?.presentationdata;
      return savePatch({ mvpplan, ...(presentationdata ? { presentationdata } : {}) });
    },
    [savePatch],
  );
  const savePresentationData = useCallback(
    (presentationdata: PresentationData) => savePatch({ presentationdata }),
    [savePatch],
  );

  return {
    flow,
    conditions,
    isloadingflow,
    flowerror,
    loadFlow,
    saveConditions,
    saveSelectedIdea,
    saveCoachResult,
    saveBlindAnalysis,
    restartBlindEvaluation,
    saveMvpPlan,
    savePresentationData,
  };
}
