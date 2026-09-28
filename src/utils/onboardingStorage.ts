import type { FontSize } from './fontSize';

export type ExperiencePreferences = { fontSize: FontSize; completed: boolean };
export const defaultExperience: ExperiencePreferences = { fontSize: 'default', completed: false };

export function experienceStorageKey(userId: string) {
  return `experience:v1:${userId}`;
}

export function parseExperience(raw: string | null): ExperiencePreferences {
  const value: unknown = raw ? JSON.parse(raw) : {};
  if (!value || typeof value !== 'object') return { ...defaultExperience };
  const stored = value as Record<string, unknown>;
  return {
    fontSize: stored.fontSize === 'small' || stored.fontSize === 'large' ? stored.fontSize : 'default',
    completed: stored.completed === true,
  };
}

export async function readExperience(storage: { getItem: (key: string) => Promise<string | null> }, userId: string) {
  try {
    return { preferences: parseExperience(await storage.getItem(experienceStorageKey(userId))), failed: false };
  } catch {
    return { preferences: { ...defaultExperience }, failed: true };
  }
}
