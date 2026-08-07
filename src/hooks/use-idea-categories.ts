import { useCallback, useEffect, useMemo, useState } from 'react';

import { useAuth } from '@/hooks/use-auth';
import { useRealtimeRefresh } from '@/hooks/use-realtime-refresh';
import { supabase } from '@/lib/supabase';
import {
  DefaultIdeaCategory,
  IdeaCategories,
  cleanIdeaCategory,
  normalizeIdeaCategory,
  type IdeaCategory,
} from '@/types/idea';

type IdeaCategoryRow = {
  id: string;
  userid: string;
  projectid: string;
  name: string;
  createdat: string;
  updatedat: string;
};

type CategoryMutationResult = {
  category?: IdeaCategory;
  error?: string;
};

const categorySelect = 'id, userid, projectid, name, createdat, updatedat';

function mergeCategories(...categoryGroups: IdeaCategory[][]) {
  const seen = new Set<string>();
  const merged: IdeaCategory[] = [];

  categoryGroups.flat().forEach((category) => {
    const cleanCategory = normalizeIdeaCategory(category);
    const key = cleanCategory.toLocaleLowerCase();

    if (!seen.has(key)) {
      seen.add(key);
      merged.push(cleanCategory);
    }
  });

  return merged;
}

export function useIdeaCategories(projectid?: string, usedCategories: IdeaCategory[] = []) {
  const { user } = useAuth();
  const [customCategories, setCustomCategories] = useState<IdeaCategory[]>([]);
  const [isloadingcategories, setIsloadingcategories] = useState(true);
  const [categoryerror, setCategoryerror] = useState('');

  const categories = useMemo(
    () => mergeCategories([...IdeaCategories], customCategories, usedCategories),
    [customCategories, usedCategories],
  );

  const loadCategories = useCallback(async () => {
    if (!user || !projectid) {
      setCustomCategories([]);
      setIsloadingcategories(false);
      return;
    }

    setIsloadingcategories(true);
    setCategoryerror('');

    const { data, error } = await supabase
      .from('ideacategories')
      .select(categorySelect)
      .eq('projectid', projectid)
      .order('createdat', { ascending: true });

    if (error) {
      setCategoryerror(error.message);
      setCustomCategories([]);
    } else {
      setCustomCategories((data ?? []).map((row) => normalizeIdeaCategory((row as IdeaCategoryRow).name)));
    }

    setIsloadingcategories(false);
  }, [projectid, user]);

  useEffect(() => {
    const timeout = globalThis.setTimeout(() => {
      loadCategories();
    }, 0);

    return () => {
      globalThis.clearTimeout(timeout);
    };
  }, [loadCategories]);

  useRealtimeRefresh({
    channelName: `idea-categories:${projectid ?? 'none'}`,
    enabled: Boolean(user && projectid),
    onRefresh: loadCategories,
    tables: [{ table: 'ideacategories', filter: `projectid=eq.${projectid}` }],
  });

  const createCategory = useCallback(
    async (name: string): Promise<CategoryMutationResult> => {
      if (!user || !projectid) {
        return { error: '로그인이 필요합니다.' };
      }

      const category = cleanIdeaCategory(name);
      if (!category) {
        return { error: '카테고리 이름을 입력해 주세요.' };
      }

      const duplicate = categories.find((current) => current.toLocaleLowerCase() === category.toLocaleLowerCase());
      if (duplicate) {
        return { category: duplicate };
      }

      const now = new Date().toISOString();
      const { data, error } = await supabase
        .from('ideacategories')
        .insert({
          userid: user.id,
          projectid,
          name: category,
          createdat: now,
          updatedat: now,
        })
        .select(categorySelect)
        .single();

      if (error) {
        setCategoryerror(error.message);
        return { error: error.message };
      }

      const nextCategory = normalizeIdeaCategory((data as IdeaCategoryRow).name);
      setCustomCategories((current) => mergeCategories(current, [nextCategory]));
      return { category: nextCategory };
    },
    [categories, projectid, user],
  );

  const renameCategory = useCallback(
    async (oldName: string, nextName: string): Promise<CategoryMutationResult> => {
      if (!user || !projectid) {
        return { error: '로그인이 필요합니다.' };
      }

      const fromCategory = cleanIdeaCategory(oldName);
      const toCategory = cleanIdeaCategory(nextName);
      if (!fromCategory || !toCategory) {
        return { error: '카테고리 이름을 입력해 주세요.' };
      }

      if (fromCategory.toLocaleLowerCase() === toCategory.toLocaleLowerCase()) {
        return { category: fromCategory };
      }

      const duplicate = categories.find((category) => category.toLocaleLowerCase() === toCategory.toLocaleLowerCase());
      const now = new Date().toISOString();

      const { error: ideaError } = await supabase
        .from('ideas')
        .update({ category: duplicate ?? toCategory, updatedat: now })
        .eq('projectid', projectid)
        .eq('legacystructural', false)
        .eq('category', fromCategory);

      if (ideaError) {
        setCategoryerror(ideaError.message);
        return { error: ideaError.message };
      }

      if (duplicate) {
        const { error } = await supabase
          .from('ideacategories')
          .delete()
          .eq('projectid', projectid)
          .eq('name', fromCategory);

        if (error) {
          setCategoryerror(error.message);
          return { error: error.message };
        }

        setCustomCategories((current) =>
          mergeCategories(current.filter((category) => category !== fromCategory), [duplicate]),
        );
        return { category: duplicate };
      }

      const { error } = await supabase
        .from('ideacategories')
        .update({ name: toCategory, updatedat: now })
        .eq('projectid', projectid)
        .eq('name', fromCategory);

      if (error) {
        setCategoryerror(error.message);
        return { error: error.message };
      }

      setCustomCategories((current) =>
        mergeCategories(
          current.map((category) => (category === fromCategory ? toCategory : category)),
        ),
      );
      return { category: toCategory };
    },
    [categories, projectid, user],
  );

  const deleteCategory = useCallback(
    async (name: string): Promise<CategoryMutationResult> => {
      if (!user || !projectid) {
        return { error: '로그인이 필요합니다.' };
      }

      const category = cleanIdeaCategory(name);
      if (!category) {
        return { error: '카테고리 이름을 입력해 주세요.' };
      }

      const now = new Date().toISOString();
      const { error: ideaError } = await supabase
        .from('ideas')
        .update({ category: DefaultIdeaCategory, updatedat: now })
        .eq('projectid', projectid)
        .eq('legacystructural', false)
        .eq('category', category);

      if (ideaError) {
        setCategoryerror(ideaError.message);
        return { error: ideaError.message };
      }

      const { error } = await supabase
        .from('ideacategories')
        .delete()
        .eq('projectid', projectid)
        .eq('name', category);

      if (error) {
        setCategoryerror(error.message);
        return { error: error.message };
      }

      setCustomCategories((current) => current.filter((item) => item !== category));
      return { category: DefaultIdeaCategory };
    },
    [projectid, user],
  );

  return {
    categories,
    customCategories,
    isloadingcategories,
    categoryerror,
    loadCategories,
    createCategory,
    renameCategory,
    deleteCategory,
  };
}
