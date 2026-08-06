import { useCallback, useEffect, useMemo, useState } from 'react';

import { sampleProjectConditions } from '@/constants/sample-project';
import { useAuth } from '@/hooks/use-auth';
import { supabase } from '@/lib/supabase';
import type { FinalIdeaAnalysisResult } from '@/types/final-analysis';
import type { MvpPlan } from '@/types/mvp-plan';
import type { PresentationData } from '@/types/presentation';
import type { CompleteProjectConditions, ProjectFlow } from '@/types/project-flow';

const flowselect =
  'id, projectid, userid, durationweeks, teamsize, skilllevel, budget, evaluationcriteria, selectedideaid, coachresult, mvpplan, presentationdata, createdat, updatedat';

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
  const [isloadingflow, setIsloadingflow] = useState(true);
  const [flowerror, setFlowerror] = useState('');

  const loadFlow = useCallback(async () => {
    if (!user || !projectid) {
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
      setFlow(createLocalFlow(projectid, user.id));
    } else {
      setFlow((data as ProjectFlow | null) ?? createLocalFlow(projectid, user.id));
    }
    setIsloadingflow(false);
  }, [projectid, user]);

  useEffect(() => {
    const timeout = globalThis.setTimeout(() => void loadFlow(), 0);
    return () => globalThis.clearTimeout(timeout);
  }, [loadFlow]);

  const conditions = useMemo(() => projectFlowConditions(flow), [flow]);

  const savePatch = useCallback(
    async (patch: Partial<ProjectFlow>) => {
      if (!user || !projectid) return { error: '로그인이 필요합니다.' };
      const current = flow ?? createLocalFlow(projectid, user.id);
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
      setFlow(saved);
      setFlowerror('');
      return { flow: saved };
    },
    [flow, projectid, user],
  );

  const saveConditions = useCallback(
    (conditions: CompleteProjectConditions) =>
      savePatch({
        durationweeks: conditions.durationWeeks,
        teamsize: conditions.teamSize,
        skilllevel: conditions.skillLevel.trim(),
        budget: conditions.budget,
        evaluationcriteria: conditions.evaluationCriteria.map((item) => item.trim()).filter(Boolean),
        coachresult: null,
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
        .eq('status', 'selected')
        .neq('id', ideaid);
      if (reseterror) return { error: reseterror.message };

      const { error: selecterror } = await supabase
        .from('ideas')
        .update({ status: 'selected', updatedat: new Date().toISOString() })
        .eq('projectid', projectid)
        .eq('id', ideaid);
      if (selecterror) return { error: selecterror.message };

      return savePatch({ selectedideaid: ideaid, mvpplan: null, presentationdata: null });
    },
    [projectid, savePatch],
  );

  const saveCoachResult = useCallback(
    (coachresult: FinalIdeaAnalysisResult) => savePatch({ coachresult }),
    [savePatch],
  );
  const saveMvpPlan = useCallback(
    (mvpplan: MvpPlan) => savePatch({ mvpplan, presentationdata: null }),
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
    saveMvpPlan,
    savePresentationData,
  };
}
