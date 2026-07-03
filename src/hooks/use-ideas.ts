import { useCallback, useEffect, useState } from 'react';

import { useAuth } from '@/hooks/use-auth';
import { supabase } from '@/lib/supabase';
import { IdeaStatuses, type Idea, type IdeaInput } from '@/types/idea';

type IdeaMutationResult = {
  idea?: Idea;
  error?: string;
};

function cleanIdeaInput(input: IdeaInput) {
  return {
    title: input.title.trim(),
    content: input.content.trim(),
    status: input.status,
  };
}

function validateIdeaInput(input: IdeaInput) {
  if (!input.title.trim()) {
    return '아이디어 제목을 입력해주세요.';
  }

  if (!input.content.trim()) {
    return '아이디어 내용을 입력해주세요.';
  }

  if (!IdeaStatuses.includes(input.status)) {
    return '올바른 상태를 선택해주세요.';
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
      .select('id, projectid, userid, title, content, status, createdat, updatedat')
      .eq('userid', user.id)
      .eq('projectid', projectId)
      .order('createdat', { ascending: false });

    if (error) {
      setIdeaError(error.message);
      setIdeas([]);
    } else {
      setIdeas((data ?? []) as Idea[]);
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
    async (input: IdeaInput): Promise<IdeaMutationResult> => {
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
          createdat: now,
          updatedat: now,
        })
        .select('id, projectid, userid, title, content, status, createdat, updatedat')
        .single();

      if (error) {
        setIdeaError(error.message);
        return { error: error.message };
      }

      const idea = data as Idea;
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
        .select('id, projectid, userid, title, content, status, createdat, updatedat')
        .single();

      if (error) {
        setIdeaError(error.message);
        return { error: error.message };
      }

      const idea = data as Idea;
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
    deleteIdea,
  };
}
