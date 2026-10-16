import { useCallback, useEffect, useState } from 'react';

import { useAuth } from '@/hooks/use-auth';
import { useRealtimeRefresh } from '@/hooks/use-realtime-refresh';
import { supabase } from '@/lib/supabase';
import type { Project, ProjectInput } from '@/types/project';
import { normalizeProjectSettings } from '@/lib/topic-workspace';
import { normalizeProjectTemplate } from '@/lib/project-stages';
import { isMissingProjectSettings, isMissingProjectTemplateColumn, LEGACY_PROJECT_SELECT, TEMPLATE_PROJECT_SELECT, normalizeProjectRow, PROJECT_SELECT } from '@/lib/project-schema';

type ProjectMutationResult = {
  project?: Project;
  error?: string;
};

function cleanProjectInput(input: ProjectInput) {
  const deadline = input.deadline.trim();

  return {
    title: input.title.trim(),
    description: input.description.trim(),
    deadline: deadline || null,
    template: normalizeProjectTemplate(input.template),
    haspresentation: input.hasPresentation,
    settings: normalizeProjectSettings(input.settings),
  };
}

function validateProjectInput(input: ProjectInput) {
  if (!input.title.trim()) {
    return '과제 제목은 필수입니다.';
  }

  return '';
}

export function useProject(projectid?: string) {
  const { user } = useAuth();
  const [project, setProject] = useState<Project | null>(null);
  const [isloadingproject, setIsloadingproject] = useState(true);
  const [projecterror, setProjecterror] = useState('');

  const loadProject = useCallback(async () => {
    if (!user || !projectid) {
      setProject(null);
      setIsloadingproject(false);
      return;
    }

    setIsloadingproject(true);
    setProjecterror('');

    let { data, error } = await supabase
      .from('projects')
      .select(PROJECT_SELECT)
      .eq('id', projectid)
      .maybeSingle();
    if (isMissingProjectSettings(error)) {
      ({ data, error } = await supabase.from('projects').select(TEMPLATE_PROJECT_SELECT).eq('id', projectid).maybeSingle());
    }
    if (isMissingProjectTemplateColumn(error)) {
      ({ data, error } = await supabase.from('projects')
        .select(LEGACY_PROJECT_SELECT).eq('id', projectid).maybeSingle());
    }

    if (error) {
      setProjecterror(error.message);
      setProject(null);
    } else {
      setProject(data ? normalizeProjectRow(data as Record<string, unknown>) : null);
    }

    setIsloadingproject(false);
  }, [projectid, user]);

  useEffect(() => {
    const timeout = globalThis.setTimeout(() => {
      loadProject();
    }, 0);

    return () => {
      globalThis.clearTimeout(timeout);
    };
  }, [loadProject]);

  useRealtimeRefresh({
    channelName: `project:${projectid ?? 'none'}`,
    enabled: Boolean(user && projectid),
    onRefresh: loadProject,
    tables: [{ table: 'projects', filter: `id=eq.${projectid}` }],
  });

  const updateProject = useCallback(
    async (input: ProjectInput): Promise<ProjectMutationResult> => {
      if (!user || !projectid) {
        return { error: '로그인이 필요합니다.' };
      }

      const validationerror = validateProjectInput(input);
      if (validationerror) {
        return { error: validationerror };
      }

      const { data, error } = await supabase
        .from('projects')
        .update({
          ...cleanProjectInput(input),
          updatedat: new Date().toISOString(),
        })
        .eq('id', projectid)
        .select(PROJECT_SELECT)
        .single();

      if (error) {
        const message = isMissingProjectTemplateColumn(error)
          ? '과제 템플릿 기능을 사용하려면 프로젝트 DB 마이그레이션을 적용해야 합니다.'
          : error.message;
        setProjecterror(message);
        return { error: message };
      }

      const nextProject = normalizeProjectRow(data as Record<string, unknown>);
      setProject(nextProject);
      return { project: nextProject };
    },
    [projectid, user],
  );

  const deleteProject = useCallback(async () => {
    if (!user || !projectid) {
      return { error: '로그인이 필요합니다.' };
    }

    const { error } = await supabase.from('projects').delete().eq('id', projectid);

    if (error) {
      setProjecterror(error.message);
      return { error: error.message };
    }

    setProject(null);
    return {};
  }, [projectid, user]);

  return {
    project,
    isloadingproject,
    projecterror,
    loadProject,
    updateProject,
    deleteProject,
  };
}
