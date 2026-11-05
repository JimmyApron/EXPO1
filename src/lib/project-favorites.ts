import type { Project } from '../types/project.ts';

export function sortProjectsWithFavorites<T extends Pick<Project, 'id' | 'deadline' | 'updatedat' | 'createdat'>>(
  projects: T[], favorites: ReadonlySet<string>, order: 'deadline' | 'updated' | 'created', favoriteOnly = false,
): T[] {
  const compare = order === 'deadline'
    ? (a: T, b: T) => (a.deadline ?? '9999').localeCompare(b.deadline ?? '9999')
    : order === 'updated'
      ? (a: T, b: T) => b.updatedat.localeCompare(a.updatedat)
      : (a: T, b: T) => b.createdat.localeCompare(a.createdat);
  return projects.filter((project) => !favoriteOnly || favorites.has(project.id))
    .sort((a, b) => Number(favorites.has(b.id)) - Number(favorites.has(a.id)) || compare(a, b));
}

export async function changeFavoriteWithRollback(
  before: ReadonlySet<string>, projectId: string,
  show: (ids: Set<string>) => void,
  persist: (shouldAdd: boolean) => Promise<{ error?: string }>,
) {
  const next = new Set(before);
  const shouldAdd = !next.has(projectId);
  if (shouldAdd) next.add(projectId); else next.delete(projectId);
  show(next);
  try {
    const result = await persist(shouldAdd);
    if (result.error) {
      show(new Set(before));
      return { error: result.error };
    }
    return {};
  } catch (error) {
    show(new Set(before));
    return { error: error instanceof Error ? error.message : '즐겨찾기 저장에 실패했습니다.' };
  }
}
