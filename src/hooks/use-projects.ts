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
      .select(PROJECT_SELECT)
      .order('createdat', { ascending: false });

    if (roomid) {
      query = query.eq('roomid', roomid);
    } else {
      query = query.eq('userid', user.id).is('roomid', null);
    }

    let { data, error } = await query;
    if (isMissingProjectSettings(error)) {
      let fallback = supabase.from('projects').select(TEMPLATE_PROJECT_SELECT).order('createdat', { ascending: false });
      fallback = roomid ? fallback.eq('roomid', roomid) : fallback.eq('userid', user.id).is('roomid', null);
      const result = await fallback;
      data = result.data?.map(row => ({ ...row, settings: {} })) ?? null;
      error = result.error;
    }
    let rows: Record<string, unknown>[] = data ?? [];
    let loadError = error;
    if (isMissingProjectTemplateColumn(error)) {
      let legacyQuery = supabase.from('projects').select(LEGACY_PROJECT_SELECT)
        .order('createdat', { ascending: false });
      if (roomid) {
        legacyQuery = legacyQuery.eq('roomid', roomid);
      } else {
        legacyQuery = legacyQuery.eq('userid', user.id).is('roomid', null);
      }
      const legacy = await legacyQuery;
      rows = legacy.data ?? [];
      loadError = legacy.error;
    }

    if (loadError) {
      setProjecterror(loadError.message);
      setProjects([]);
    } else {
      setProjects(rows.map(normalizeProjectRow));
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
        .select(PROJECT_SELECT)
        .single();

      if (error) {
        const message = isMissingProjectTemplateColumn(error)
          ? '과제 템플릿 기능을 사용하려면 프로젝트 DB 마이그레이션을 적용해야 합니다.'
          : error.message;
        setProjecterror(message);
        return { error: message };
      }

      const project = normalizeProjectRow(data as Record<string, unknown>);
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

      const { data, error } = await query.select(PROJECT_SELECT).single();

      if (error) {
        const message = isMissingProjectTemplateColumn(error)
          ? '과제 템플릿 기능을 사용하려면 프로젝트 DB 마이그레이션을 적용해야 합니다.'
          : error.message;
        setProjecterror(message);
        return { error: message };
      }

      const project = normalizeProjectRow(data as Record<string, unknown>);
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
