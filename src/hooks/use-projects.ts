import { useCallback, useEffect, useState } from 'react';

import { useAuth } from '@/hooks/use-auth';
import { useRealtimeRefresh } from '@/hooks/use-realtime-refresh';
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
    return '과제 제목은 필수입니다.';
  }

  return '';
}

const projectSelect = 'id, userid, roomid, title, description, deadline, createdat, updatedat';

export function useProjects(roomid?: string) {
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

    let query = supabase
      .from('projects')
      .select(projectSelect)
      .order('createdat', { ascending: false });

    if (roomid) {
      query = query.eq('roomid', roomid);
    } else {
      query = query.eq('userid', user.id).is('roomid', null);
    }

    const { data, error } = await query;

    if (error) {
      setProjecterror(error.message);
      setProjects([]);
    } else {
      setProjects((data ?? []) as Project[]);
    }

    setIsloadingprojects(false);
  }, [roomid, user]);

  useEffect(() => {
    const timeout = globalThis.setTimeout(() => {
      loadProjects();
    }, 0);

    return () => {
      globalThis.clearTimeout(timeout);
    };
  }, [loadProjects]);

  useRealtimeRefresh({
    channelName: `projects:${roomid ?? user?.id ?? 'signed-out'}`,
    enabled: Boolean(user),
    onRefresh: loadProjects,
    tables: [{
      table: 'projects',
      filter: roomid
        ? `roomid=eq.${roomid}`
        : `userid=eq.${user?.id},roomid=is.null`,
    }],
  });

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
          roomid: roomid ?? null,
          ...cleanProjectInput(input),
          createdat: now,
          updatedat: now,
        })
        .select(projectSelect)
        .single();

      if (error) {
        setProjecterror(error.message);
        return { error: error.message };
      }

      const project = data as Project;
      setProjects((current) => [project, ...current]);
      return { project };
    },
    [roomid, user],
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

      let query = supabase
        .from('projects')
        .update({
          ...cleanProjectInput(input),
          updatedat: new Date().toISOString(),
        })
        .eq('id', id);

      if (roomid) {
        query = query.eq('roomid', roomid);
      } else {
        query = query.eq('userid', user.id).is('roomid', null);
      }

      const { data, error } = await query.select(projectSelect).single();

      if (error) {
        setProjecterror(error.message);
        return { error: error.message };
      }

      const project = data as Project;
      setProjects((current) => current.map((item) => (item.id === id ? project : item)));
      return { project };
    },
    [roomid, user],
  );

  const deleteProject = useCallback(
    async (id: string) => {
      if (!user) {
        return { error: '로그인이 필요합니다.' };
      }

      let query = supabase.from('projects').delete().eq('id', id);

      if (roomid) {
        query = query.eq('roomid', roomid);
      } else {
        query = query.eq('userid', user.id).is('roomid', null);
      }

      const { error } = await query;

      if (error) {
        setProjecterror(error.message);
        return { error: error.message };
      }

      setProjects((current) => current.filter((project) => project.id !== id));
      return {};
    },
    [roomid, user],
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
