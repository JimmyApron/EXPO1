import { useCallback, useEffect, useState } from 'react';

import { useAuth } from '@/hooks/use-auth';
import { supabase } from '@/lib/supabase';
import type { Project, ProjectInput } from '@/types/project';

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
  };
}

function validateProjectInput(input: ProjectInput) {
  if (!input.title.trim()) {
    return '제목은 필수입니다.';
  }

  return '';
}

export function useProjects() {
  const { user } = useAuth();
  const [projects, setProjects] = useState<Project[]>([]);
  const [isloadingprojects, setIsloadingprojects] = useState(true);
  const [projecterror, setProjecterror] = useState('');

  const loadProjects = useCallback(async () => {
    if (!user) {
      setProjects([]);
      setIsloadingprojects(false);
      return;
    }

    setIsloadingprojects(true);
    setProjecterror('');

    const { data, error } = await supabase
      .from('projects')
      .select('id, userid, title, description, deadline, createdat, updatedat')
      .eq('userid', user.id)
      .order('createdat', { ascending: false });

    if (error) {
      setProjecterror(error.message);
      setProjects([]);
    } else {
      setProjects((data ?? []) as Project[]);
    }

    setIsloadingprojects(false);
  }, [user]);

  useEffect(() => {
    const timeout = globalThis.setTimeout(() => {
      loadProjects();
    }, 0);

    return () => {
      globalThis.clearTimeout(timeout);
    };
  }, [loadProjects]);

  const createProject = useCallback(
    async (input: ProjectInput): Promise<ProjectMutationResult> => {
      if (!user) {
        return { error: '로그인이 필요합니다.' };
      }

      const validationerror = validateProjectInput(input);
      if (validationerror) {
        return { error: validationerror };
      }

      const now = new Date().toISOString();
      const { data, error } = await supabase
        .from('projects')
        .insert({
          userid: user.id,
          ...cleanProjectInput(input),
          createdat: now,
          updatedat: now,
        })
        .select('id, userid, title, description, deadline, createdat, updatedat')
        .single();

      if (error) {
        setProjecterror(error.message);
        return { error: error.message };
      }

      const project = data as Project;
      setProjects((current) => [project, ...current]);
      return { project };
    },
    [user],
  );

  const updateProject = useCallback(
    async (id: string, input: ProjectInput): Promise<ProjectMutationResult> => {
      if (!user) {
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
        .eq('id', id)
        .eq('userid', user.id)
        .select('id, userid, title, description, deadline, createdat, updatedat')
        .single();

      if (error) {
        setProjecterror(error.message);
        return { error: error.message };
      }

      const project = data as Project;
      setProjects((current) => current.map((item) => (item.id === id ? project : item)));
      return { project };
    },
    [user],
  );

  const deleteProject = useCallback(
    async (id: string) => {
      if (!user) {
        return { error: '로그인이 필요합니다.' };
      }

      const { error } = await supabase.from('projects').delete().eq('id', id).eq('userid', user.id);

      if (error) {
        setProjecterror(error.message);
        return { error: error.message };
      }

      setProjects((current) => current.filter((project) => project.id !== id));
      return {};
    },
    [user],
  );

  const getProjectById = useCallback(
    (id: string) => projects.find((project) => project.id === id),
    [projects],
  );

  return {
    projects,
    isloadingprojects,
    projecterror,
    loadProjects,
    createProject,
    updateProject,
    deleteProject,
    getProjectById,
  };
}
