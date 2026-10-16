import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { useAuth } from '@/hooks/use-auth';
import { useRealtimeRefresh } from '@/hooks/use-realtime-refresh';
import { supabase } from '@/lib/supabase';
import type { IdeaLike } from '@/types/like';

type LikeMutationResult = {
  error?: string;
};

type LikeRow = {
  id?: string;
  ideaid?: string;
  userid?: string;
  createdat?: string;
  updatedat?: string;
};

type IdeaIdRow = {
  id?: string;
};

const likeSelect = 'id, ideaid, userid, createdat, updatedat';
const likeRealtimeTables = ['ideas', 'idealikes'] as const;

function normalizeLike(row: LikeRow): IdeaLike {
  return {
    id: row.id ?? '',
    ideaid: row.ideaid ?? '',
    userid: row.userid ?? '',
    createdat: row.createdat ?? '',
    updatedat: row.updatedat ?? '',
  };
}

export function useIdeaLikes(projectId?: string) {
  const { user } = useAuth();
  const [likes, setLikes] = useState<IdeaLike[]>([]);
  const [isLoadingLikes, setIsLoadingLikes] = useState(true);
  const [likeError, setLikeError] = useState('');
  const loadedProjectKey = useRef('');
  const requestId = useRef(0);
  const projectKey = `${user?.id ?? ''}:${projectId ?? ''}`;

  const loadLikes = useCallback(async () => {
    const currentRequestId = ++requestId.current;
    if (!user || !projectId) {
      setLikes([]);
      loadedProjectKey.current = '';
      setIsLoadingLikes(false);
      return;
    }

    if (loadedProjectKey.current !== projectKey) {
      setIsLoadingLikes(true);
      setLikes([]);
    }
    setLikeError('');

    const { data: ideaRows, error: ideaError } = await supabase
      .from('ideas')
      .select('id')
      .eq('legacystructural', false)
      .eq('projectid', projectId);

    if (currentRequestId !== requestId.current) return;

    if (ideaError) {
      setLikeError(ideaError.message);
      loadedProjectKey.current = projectKey;
      setIsLoadingLikes(false);
      return;
    }

    const ideaIds = (ideaRows ?? [])
      .map((row) => (row as IdeaIdRow).id)
      .filter((id): id is string => Boolean(id));

    if (ideaIds.length === 0) {
      setLikes([]);
      loadedProjectKey.current = projectKey;
      setIsLoadingLikes(false);
      return;
    }

    const { data, error } = await supabase
      .from('idealikes')
      .select(likeSelect)
      .in('ideaid', ideaIds)
      .order('createdat', { ascending: false });

    if (currentRequestId !== requestId.current) return;

    if (error) {
      setLikeError(error.message);
    } else {
      setLikes((data ?? []).map((row) => normalizeLike(row as LikeRow)));
    }

    loadedProjectKey.current = projectKey;
    setIsLoadingLikes(false);
  }, [projectId, projectKey, user]);

  useEffect(() => {
    const timeout = globalThis.setTimeout(() => {
      loadLikes();
    }, 0);

    return () => {
      globalThis.clearTimeout(timeout);
    };
  }, [loadLikes]);

  useRealtimeRefresh({
    channelName: `idea-likes:${projectId ?? 'none'}`,
    enabled: Boolean(user && projectId),
    onRefresh: loadLikes,
    tables: likeRealtimeTables,
  });

  const likeCountsByIdeaId = useMemo(() => {
    const grouped = new Map<string, number>();

    likes.forEach((like) => {
      grouped.set(like.ideaid, (grouped.get(like.ideaid) ?? 0) + 1);
    });

    return grouped;
  }, [likes]);

  const likedIdeaIds = useMemo(() => {
    const ids = new Set<string>();

    if (!user) {
      return ids;
    }

    likes.forEach((like) => {
      if (like.userid === user.id) {
        ids.add(like.ideaid);
      }
    });

    return ids;
  }, [likes, user]);

  const toggleLike = useCallback(
    async (ideaId: string, isLiked: boolean): Promise<LikeMutationResult> => {
      if (!user || !projectId) {
        return { error: '로그인이 필요합니다.' };
      }

      setLikeError('');

      if (isLiked) {
        const { error } = await supabase
          .from('idealikes')
          .delete()
          .eq('ideaid', ideaId)
          .eq('userid', user.id);

        if (error) {
          setLikeError(error.message);
          return { error: error.message };
        }

        setLikes((current) =>
          current.filter((like) => !(like.ideaid === ideaId && like.userid === user.id)),
        );
        return {};
      }

      const now = new Date().toISOString();
      const { data, error } = await supabase
        .from('idealikes')
        .insert({
          ideaid: ideaId,
          userid: user.id,
          createdat: now,
          updatedat: now,
        })
        .select(likeSelect)
        .single();

      if (error) {
        setLikeError(error.message);
        return { error: error.message };
      }

      const like = normalizeLike(data as LikeRow);
      setLikes((current) => [like, ...current]);
      return {};
    },
    [projectId, user],
  );

  return {
    likes,
    likeCountsByIdeaId,
    likedIdeaIds,
    isLoadingLikes,
    likeError,
    loadLikes,
    toggleLike,
  };
}
