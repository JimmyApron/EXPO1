import type { PresentationSettings } from '@/types/presentation';

export type PresentationTheme = PresentationSettings['theme'];

export const presentationThemes: { id: PresentationTheme; label: string; premium: boolean }[] = [
  { id: 'minimal-light', label: '미니멀 라이트', premium: false },
  { id: 'soft-color', label: '소프트 컬러', premium: false },
  { id: 'modern-dark', label: '모던 다크', premium: true },
  { id: 'business', label: '비즈니스', premium: true },
];

export const presentationPalette = {
  'minimal-light': { background: '#ffffff', foreground: '#171717', accent: '#1e3a8a', muted: '#5f6672', surface: '#f3f5f8' },
  'modern-dark': { background: '#111827', foreground: '#f8fafc', accent: '#60a5fa', muted: '#cbd5e1', surface: '#1f2937' },
  'soft-color': { background: '#fff9ed', foreground: '#302d29', accent: '#c36b54', muted: '#706962', surface: '#f7eadb' },
  business: { background: '#f6f8fb', foreground: '#17253d', accent: '#176b63', muted: '#556477', surface: '#e7edf3' },
} as const;

export const isPremiumPresentationTheme = (value: PresentationTheme) => value === 'modern-dark' || value === 'business';
