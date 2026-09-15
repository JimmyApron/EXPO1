import '@/global.css';

import { Platform } from 'react-native';

/**
 * Watt design tokens. Keep semantic names here so screens remain readable and
 * light/dark mode never depends on a one-off color choice.
 */
export const Colors = {
  light: {
    text: '#171B32',
    textSecondary: '#555E78',
    textTertiary: '#7B839B',
    background: '#F7F8FD',
    backgroundElement: '#FFFFFF',
    backgroundSelected: '#E9ECF8',
    surface: '#FFFFFF',
    surfaceElevated: '#FFFFFF',
    primary: '#4050D0',
    primaryHover: '#3442B8',
    primarySoft: '#EEF0FF',
    primaryText: '#FFFFFF',
    border: '#DCE0EF',
    divider: '#E9EBF4',
    success: '#20B86B',
    successSoft: '#E7F8EF',
    warning: '#B56713',
    warningSoft: '#FFF3DF',
    danger: '#C93C4A',
    dangerSoft: '#FFF0F1',
    overlay: 'rgba(17, 24, 39, 0.56)',
  },
  dark: {
    text: '#F4F6FB',
    textSecondary: '#B6BED0',
    textTertiary: '#8993A8',
    background: '#101329',
    backgroundElement: '#191D38',
    backgroundSelected: '#2A3058',
    surface: '#191D38',
    surfaceElevated: '#222746',
    primary: '#7B87F2',
    primaryHover: '#929CF8',
    primarySoft: '#282F64',
    primaryText: '#FFFFFF',
    border: '#363D66',
    divider: '#2B3154',
    success: '#45D58D',
    successSoft: '#173E30',
    warning: '#F5B85B',
    warningSoft: '#49351A',
    danger: '#FF8B94',
    dangerSoft: '#4A232A',
    overlay: 'rgba(3, 6, 12, 0.72)',
  },
} as const;

export type ThemeColor = keyof typeof Colors.light & keyof typeof Colors.dark;

export const Fonts = Platform.select({
  ios: {
    sans: 'system-ui',
    serif: 'ui-serif',
    rounded: 'ui-rounded',
    mono: 'ui-monospace',
  },
  default: {
    sans: 'normal',
    serif: 'serif',
    rounded: 'normal',
    mono: 'monospace',
  },
  web: {
    sans: 'var(--font-display)',
    serif: 'var(--font-serif)',
    rounded: 'var(--font-rounded)',
    mono: 'var(--font-mono)',
  },
});

export const Spacing = {
  half: 2,
  one: 4,
  two: 8,
  three: 16,
  four: 24,
  five: 32,
  six: 48,
  seven: 64,
} as const;

export const Radius = {
  small: 8,
  medium: 12,
  large: 16,
  xlarge: 24,
  pill: 999,
} as const;

export const ControlHeight = {
  input: 48,
  button: 46,
  touch: 44,
} as const;

export const Shadows = {
  card: Platform.select({
    web: { boxShadow: '0 8px 28px rgba(30, 41, 59, 0.07)' },
    default: {
      shadowColor: '#0F172A',
      shadowOffset: { width: 0, height: 6 },
      shadowOpacity: 0.08,
      shadowRadius: 14,
      elevation: 2,
    },
  }),
  floating: Platform.select({
    web: { boxShadow: '0 16px 48px rgba(15, 23, 42, 0.16)' },
    default: {
      shadowColor: '#0F172A',
      shadowOffset: { width: 0, height: 12 },
      shadowOpacity: 0.16,
      shadowRadius: 24,
      elevation: 7,
    },
  }),
} as const;

export const BottomTabInset = Platform.select({ ios: 50, android: 80 }) ?? 0;
export const MaxContentWidth = 1120;
export const ReadableContentWidth = 760;
