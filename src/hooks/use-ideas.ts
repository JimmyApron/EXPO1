import { useCallback, useEffect, useState } from 'react';

import { useAuth } from '@/hooks/use-auth';
import { supabase } from '@/lib/supabase';
import {
  IdeaStatuses,
  cleanIdeaCategory,
  normalizeIdeaCategory,
  normalizeIdeaStatus,
  normalizeMindMapSide,
  type Idea,
  type IdeaInput,
  type IdeaMindMapInput,
} from '@/types/idea';

type IdeaMutationResult = {
  idea?: Idea;
  error?: string;
};

const ideaSelect =
  'id, projectid, userid, title, content, status, category, isfavorite, parentnodeid, x, y, side, createdat, updatedat';

function normalizeIdea(row: Partial<Idea>): Idea {
  return {
    id: row.id ?? '',
    projectid: row.projectid ?? '',
    userid: row.userid ?? '',
    title: row.title ?? '',
    content: row.content ?? '',
    status: normalizeIdeaStatus(row.status),
    category: normalizeIdeaCategory(row.category),
    isfavorite: row.isfavorite === true,
    parentnodeid: row.parentnodeid ?? null,
    x: typeof row.x === 'number' ? row.x : null,
    y: typeof row.y === 'number' ? row.y : null,
    side: normalizeMindMapSide(row.side),
    createdat: row.createdat ?? '',
    updatedat: row.updatedat ?? '',
  };
}

function cleanIdeaInput(input: IdeaInput) {
  return {
    title: input.title.trim(),
    content: input.content.trim(),
    status: input.status,
    category: normalizeIdeaCategory(input.category),
  };
}

function cleanMindMapInput(input?: IdeaMindMapInput) {
  if (!input) {
    return {};
  }

  return {
    parentnodeid: input.parentnodeid ?? null,
    x: input.x ?? null,
    y: input.y ?? null,
    side: input.side ?? null,
  };
}

function validateIdeaInput(input: IdeaInput) {
  if (!input.title.trim()) {
    return '아이디어 제목을 입력해 주세요.';
  }

  if (!input.content.trim()) {
    return '아이디어 내용을 입력해 주세요.';
  }

  if (!IdeaStatuses.includes(input.status)) {
    return '올바른 상태를 선택해 주세요.';
  }

  if (!cleanIdeaCategory(input.category)) {
    return '올바른 카테고리를 선택해 주세요.';
  }

  return '';
}

export function useIdeas(projectId?: string) {
  const { user } = useAuth();
  const [ideas, setIdeas] = useState<Idea[]>([]);
  const [isLoadingIdeas, setIsLoadingIdeas] = useState(true);
  const [ideaError, setIdeaError] = useState('');

  const loadIdeas = useCallback(async () => {
    if (!user || !projectId) {
      setIdeas([]);
      setIsLoadingIdeas(false);
      return;
    }

    setIsLoadingIdeas(true);
    setIdeaError('');

    const { data, error } = await supabase
      .from('ideas')
      .select(ideaSelect)
      .eq('projectid', projectId)
      .order('createdat', { ascending: false });

    if (error) {
      setIdeaError(error.message);
      setIdeas([]);
    } else {
      setIdeas((data ?? []).map((row) => normalizeIdea(row as Partial<Idea>)));
    }

    setIsLoadingIdeas(false);
  }, [projectId, user]);

  useEffect(() => {
    const timeout = globalThis.setTimeout(() => {
      loadIdeas();
    }, 0);

    return () => {
      globalThis.clearTimeout(timeout);
    };
  }, [loadIdeas]);

  const createIdea = useCallback(
    async (input: IdeaInput, mindMapInput?: IdeaMindMapInput): Promise<IdeaMutationResult> => {
      if (!user || !projectId) {
        return { error: '로그인이 필요합니다.' };
      }

      const validationError = validateIdeaInput(input);
      if (validationError) {
        return { error: validationError };
      }

      const now = new Date().toISOString();
      const { data, error } = await supabase
        .from('ideas')
        .insert({
          projectid: projectId,
          userid: user.id,
          ...cleanIdeaInput(input),
          ...cleanMindMapInput(mindMapInput),
          isfavorite: false,
          createdat: now,
          updatedat: now,
        })
        .select(ideaSelect)
        .single();

      if (error) {
        setIdeaError(error.message);
        return { error: error.message };
      }

      const idea = normalizeIdea(data as Partial<Idea>);
      setIdeas((current) => [idea, ...current]);
      return { idea };
    },
    [projectId, user],
  );

  const updateIdea = useCallback(
    async (id: string, input: IdeaInput): Promise<IdeaMutationResult> => {
      if (!user || !projectId) {
        return { error: '로그인이 필요합니다.' };
      }

      const validationError = validateIdeaInput(input);
      if (validationError) {
        return { error: validationError };
      }

      const { data, error } = await supabase
        .from('ideas')
        .update({
          ...cleanIdeaInput(input),
          updatedat: new Date().toISOString(),
        })
        .eq('id', id)
        .eq('userid', user.id)
        .eq('projectid', projectId)
        .select(ideaSelect)
        .single();

      if (error) {
        setIdeaError(error.message);
        return { error: error.message };
      }

      const idea = normalizeIdea(data as Partial<Idea>);
      setIdeas((current) => current.map((item) => (item.id === id ? idea : item)));
      return { idea };
    },
    [projectId, user],
  );

  const toggleIdeaFavorite = useCallback(
    async (id: string, isFavorite: boolean): Promise<IdeaMutationResult> => {
      if (!user || !projectId) {
        return { error: '로그인이 필요합니다.' };
      }

      const { data, error } = await supabase
        .from('ideas')
        .update({
          isfavorite: isFavorite,
          updatedat: new Date().toISOString(),
        })
        .eq('id', id)
        .eq('userid', user.id)
        .eq('projectid', projectId)
        .select(ideaSelect)
        .single();

      if (error) {
        setIdeaError(error.message);
        return { error: error.message };
      }

      const idea = normalizeIdea(data as Partial<Idea>);
      setIdeas((current) => current.map((item) => (item.id === id ? idea : item)));
      return { idea };
    },
    [projectId, user],
  );

  const updateIdeaMindMap = useCallback(
    async (id: string, input: IdeaMindMapInput): Promise<IdeaMutationResult> => {
      if (!user || !projectId) {
        return { error: '로그인이 필요합니다.' };
      }

      const { data, error } = await supabase
        .from('ideas')
        .update({
          ...cleanMindMapInput(input),
          updatedat: new Date().toISOString(),
        })
        .eq('id', id)
        .eq('userid', user.id)
        .eq('projectid', projectId)
        .select(ideaSelect)
        .single();

      if (error) {
        setIdeaError(error.message);
        return { error: error.message };
      }

      const idea = normalizeIdea(data as Partial<Idea>);
      setIdeas((current) => current.map((item) => (item.id === id ? idea : item)));
      return { idea };
    },
    [projectId, user],
  );

  const deleteIdea = useCallback(
    async (id: string) => {
      if (!user || !projectId) {
        return { error: '로그인이 필요합니다.' };
      }

      const { error } = await supabase
        .from('ideas')
        .delete()
        .eq('id', id)
        .eq('userid', user.id)
        .eq('projectid', projectId);

      if (error) {
        setIdeaError(error.message);
        return { error: error.message };
      }

      setIdeas((current) => current.filter((idea) => idea.id !== id));
      return {};
    },
    [projectId, user],
  );

  return {
    ideas,
    isLoadingIdeas,
    ideaError,
    loadIdeas,
    createIdea,
    updateIdea,
    toggleIdeaFavorite,
    updateIdeaMindMap,
    deleteIdea,
  };
}
