import { useCallback, useEffect, useState } from 'react';

import { useAuth } from '@/hooks/use-auth';
import { supabase } from '@/lib/supabase';
import { normalizeIdeaCategory, type IdeaCategory } from '@/types/idea';

export type FavoriteIdeaSummary = {
  id: string;
  projectid: string;
  title: string;
  content: string;
  category: IdeaCategory;
  updatedat: string;
};

function normalizeFavoriteIdea(row: Partial<FavoriteIdeaSummary>): FavoriteIdeaSummary {
  return {
    id: row.id ?? '',
    projectid: row.projectid ?? '',
    title: row.title ?? '',
    content: row.content ?? '',
    category: normalizeIdeaCategory(row.category),
    updatedat: row.updatedat ?? '',
  };
}

export function useFavoriteIdeas() {
  const { user } = useAuth();
  const [favoriteIdeas, setFavoriteIdeas] = useState<FavoriteIdeaSummary[]>([]);
  const [isLoadingFavoriteIdeas, setIsLoadingFavoriteIdeas] = useState(true);
  const [favoriteIdeaError, setFavoriteIdeaError] = useState('');

  const loadFavoriteIdeas = useCallback(async () => {
    if (!user) {
      setFavoriteIdeas([]);
      setIsLoadingFavoriteIdeas(false);
      return;
    }

    setIsLoadingFavoriteIdeas(true);
    setFavoriteIdeaError('');

    const { data, error } = await supabase
      .from('ideas')
      .select('id, projectid, title, content, category, updatedat')
      .eq('userid', user.id)
      .eq('isfavorite', true)
      .order('updatedat', { ascending: false });

    if (error) {
      setFavoriteIdeaError(error.message);
      setFavoriteIdeas([]);
    } else {
      setFavoriteIdeas((data ?? []).map((row) => normalizeFavoriteIdea(row)));
    }

    setIsLoadingFavoriteIdeas(false);
  }, [user]);

  useEffect(() => {
    const timeout = globalThis.setTimeout(() => {
      loadFavoriteIdeas();
    }, 0);

    return () => {
      globalThis.clearTimeout(timeout);
    };
  }, [loadFavoriteIdeas]);

  return {
    favoriteIdeas,
    isLoadingFavoriteIdeas,
    favoriteIdeaError,
    loadFavoriteIdeas,
  };
}
