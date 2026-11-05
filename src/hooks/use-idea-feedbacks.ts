import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { useAuth } from '@/hooks/use-auth';
import { useRealtimeRefresh } from '@/hooks/use-realtime-refresh';
import { supabase } from '@/lib/supabase';
import type { IdeaFeedback } from '@/types/feedback';

type FeedbackMutationResult = {
  feedback?: IdeaFeedback;
  error?: string;
};

type FeedbackRow = {
  id?: string;
  ideaid?: string;
  userid?: string;
  comment?: string;
  isresolved?: boolean;
  createdat?: string;
  updatedat?: string;
};

type IdeaIdRow = {
  id?: string;
};

const feedbackSelect = 'id, userid, ideaid, comment, isresolved, createdat, updatedat';
const feedbackRealtimeTables = ['ideas', 'feedbacks'] as const;

function normalizeFeedback(row: FeedbackRow): IdeaFeedback {
  return {
    id: row.id ?? '',
    ideaid: row.ideaid ?? '',
    userid: row.userid ?? '',
    content: row.comment ?? '',
    isresolved: row.isresolved === true,
    createdat: row.createdat ?? '',
    updatedat: row.updatedat ?? '',
  };
}

export function useIdeaFeedbacks(projectId?: string) {
  const { user } = useAuth();
  const [feedbacks, setFeedbacks] = useState<IdeaFeedback[]>([]);
  const [isLoadingFeedbacks, setIsLoadingFeedbacks] = useState(true);
  const [feedbackError, setFeedbackError] = useState('');
  const loadedProjectKey = useRef('');
  const requestId = useRef(0);
  const projectKey = `${user?.id ?? ''}:${projectId ?? ''}`;

  const loadFeedbacks = useCallback(async () => {
    const currentRequestId = ++requestId.current;
    if (!user || !projectId) {
      setFeedbacks([]);
      loadedProjectKey.current = '';
      setIsLoadingFeedbacks(false);
      return;
    }

    if (loadedProjectKey.current !== projectKey) {
      setIsLoadingFeedbacks(true);
      setFeedbacks([]);
    }
    setFeedbackError('');

    const { data: ideaRows, error: ideaError } = await supabase
      .from('ideas')
      .select('id')
      .eq('legacystructural', false)
      .eq('projectid', projectId);

    if (currentRequestId !== requestId.current) return;

    if (ideaError) {
      setFeedbackError(ideaError.message);
      loadedProjectKey.current = projectKey;
      setIsLoadingFeedbacks(false);
      return;
    }

    const ideaIds = (ideaRows ?? [])
      .map((row) => (row as IdeaIdRow).id)
      .filter((id): id is string => Boolean(id));

    if (ideaIds.length === 0) {
      setFeedbacks([]);
      loadedProjectKey.current = projectKey;
      setIsLoadingFeedbacks(false);
      return;
    }

    const { data, error } = await supabase
      .from('feedbacks')
      .select(feedbackSelect)
      .in('ideaid', ideaIds)
      .order('createdat', { ascending: false });

    if (currentRequestId !== requestId.current) return;

    if (error) {
      setFeedbackError(error.message);
    } else {
      setFeedbacks((data ?? []).map((row) => normalizeFeedback(row as FeedbackRow)));
    }

    loadedProjectKey.current = projectKey;
    setIsLoadingFeedbacks(false);
  }, [projectId, projectKey, user]);

  useEffect(() => {
    const timeout = globalThis.setTimeout(() => {
      loadFeedbacks();
    }, 0);

    return () => {
      globalThis.clearTimeout(timeout);
    };
  }, [loadFeedbacks]);

  useRealtimeRefresh({
    channelName: `idea-feedbacks:${projectId ?? 'none'}`,
    enabled: Boolean(user && projectId),
    onRefresh: loadFeedbacks,
    tables: feedbackRealtimeTables,
  });

  const feedbacksByIdeaId = useMemo(() => {
    const grouped = new Map<string, IdeaFeedback[]>();

    feedbacks.forEach((feedback) => {
      const current = grouped.get(feedback.ideaid) ?? [];
      current.push(feedback);
      grouped.set(feedback.ideaid, current);
    });

    return grouped;
  }, [feedbacks]);

  const createFeedback = useCallback(
    async (ideaId: string, content: string): Promise<FeedbackMutationResult> => {
      if (!user || !projectId) {
        return { error: '로그인이 필요합니다.' };
      }

      const trimmedContent = content.trim();
      if (!trimmedContent) {
        return { error: '피드백 내용을 입력해 주세요.' };
      }

      const now = new Date().toISOString();
      const { data, error } = await supabase
        .from('feedbacks')
        .insert({
          ideaid: ideaId,
          userid: user.id,
          comment: trimmedContent,
          isresolved: false,
          createdat: now,
          updatedat: now,
        })
        .select(feedbackSelect)
        .single();

      if (error) {
        setFeedbackError(error.message);
        return { error: error.message };
      }

      const feedback = normalizeFeedback(data as FeedbackRow);
      setFeedbacks((current) => [feedback, ...current]);
      return { feedback };
    },
    [projectId, user],
  );

  const toggleFeedbackResolved = useCallback(
    async (feedbackId: string, isresolved: boolean): Promise<FeedbackMutationResult> => {
      if (!user || !projectId) {
        return { error: '로그인이 필요합니다.' };
      }

      const { data, error } = await supabase
        .from('feedbacks')
        .update({
          isresolved,
          updatedat: new Date().toISOString(),
        })
        .eq('id', feedbackId)
        .select(feedbackSelect)
        .single();

      if (error) {
        setFeedbackError(error.message);
        return { error: error.message };
      }

      const feedback = normalizeFeedback(data as FeedbackRow);
      setFeedbacks((current) => current.map((item) => (item.id === feedbackId ? feedback : item)));
      return { feedback };
    },
    [projectId, user],
  );

  return {
    feedbacks,
    feedbacksByIdeaId,
    isLoadingFeedbacks,
    feedbackError,
    loadFeedbacks,
    createFeedback,
    toggleFeedbackResolved,
  };
}
