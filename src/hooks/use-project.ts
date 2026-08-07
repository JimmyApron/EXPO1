import { useCallback, useEffect, useState } from 'react';

import { useAuth } from '@/hooks/use-auth';
import { useRealtimeRefresh } from '@/hooks/use-realtime-refresh';
import { supabase } from '@/lib/supabase';
import type { Project, ProjectInput } from '@/types/project';

type ProjectMutationResult = {
  project?: Project;
  error?: string;
};

const projectSelect = 'id, userid, roomid, title, description, deadline, createdat, updatedat';

function cleanProjectInput(input: ProjectInput) {
  const deadline = input.deadline.trim();

  return {
    title: input.title.trim(),
    description: input.description.trim(),
    deadline: deadline || null,
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

    const { data, error } = await supabase
      .from('projects')
      .select(projectSelect)
      .eq('id', projectid)
      .maybeSingle();

    if (error) {
      setProjecterror(error.message);
      setProject(null);
    } else {
      setProject((data as Project | null) ?? null);
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
        .select(projectSelect)
        .single();

      if (error) {
        setProjecterror(error.message);
        return { error: error.message };
      }

      const nextProject = data as Project;
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
