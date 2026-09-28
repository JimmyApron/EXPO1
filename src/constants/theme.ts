import '@/global.css';

import { Platform } from 'react-native';

/**
 * Watt design tokens.
 * 따뜻한 크림 배경(#FAF7F2), 화이트 카드(#FFFFFF), 옐로우/오렌지 포인트(#F59E0B), 딥 네이비 텍스트(#1E293B)
 */
export const Colors = {
  light: {
    text: '#1E293B',                     // 짙은 네이비 본문
    textSecondary: '#64748B',            // 보조 회색 텍스트
    textTertiary: '#94A3B8',             // 흐린 텍스트/비활성 아이콘
    background: '#FAF7F2',               // 앱 전체 부드러운 크림 배경
    backgroundElement: '#FFFFFF',        // 컴포넌트/카드 기본 흰색
    backgroundSelected: '#FEF3C7',       // 선택된 항목 연노랑 배경
    surface: '#FFFFFF',                  // 메인 서피스 흰색
    surfaceElevated: '#FFFFFF',          // 모달/팝업 서피스 흰색
    primary: '#F59E0B',                  // 메인 옐로우/오렌지
    primaryHover: '#D97706',             // 버튼 호버 딥 오렌지
    primarySoft: '#FEF3C7',              // 연노랑 하이라이트
    primaryText: '#FFFFFF',              // 버튼 위 흰색 텍스트
    border: '#F3E8D6',                   // 부드러운 크림 테두리
    divider: '#EFE6D8',                  // 얇은 구분선
    success: '#10B981',                  // 완료/성공 에메랄드
    successSoft: '#ECFDF5',              // 성공 연초록
    warning: '#D97706',                  // 경고/D-Day 딥 오렌지
    warningSoft: '#FEF3C7',              // 경고 연노랑
    danger: '#EF4444',                   // 위험/삭제 레드
    dangerSoft: '#FEF2F2',               // 위험 연빨강
    overlay: 'rgba(15, 23, 42, 0.45)',   // 모달 뒷배경 오버레이
  },
  dark: {
    // 다크모드에서도 어두운 남색 대신 동일한 밝고 부드러운 톤 유지
    text: '#1E293B',
    textSecondary: '#64748B',
    textTertiary: '#94A3B8',
    background: '#FAF7F2',
    backgroundElement: '#FFFFFF',
    backgroundSelected: '#FEF3C7',
    surface: '#FFFFFF',
    surfaceElevated: '#FFFFFF',
    primary: '#F59E0B',
    primaryHover: '#D97706',
    primarySoft: '#FEF3C7',
    primaryText: '#FFFFFF',
    border: '#F3E8D6',
    divider: '#EFE6D8',
    success: '#10B981',
    successSoft: '#ECFDF5',
    warning: '#D97706',
    warningSoft: '#FEF3C7',
    danger: '#EF4444',
    dangerSoft: '#FEF2F2',
    overlay: 'rgba(15, 23, 42, 0.45)',
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
  input: 44,
  button: 44,
  touch: 40,
} as const;

export const Shadows = {
  card: Platform.select({
    web: { boxShadow: '0 4px 20px rgba(30, 41, 59, 0.05)' },
    default: {
      shadowColor: '#1E293B',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.05,
      shadowRadius: 10,
      elevation: 2,
    },
  }),
  floating: Platform.select({
    web: { boxShadow: '0 12px 36px rgba(15, 23, 42, 0.12)' },
    default: {
      shadowColor: '#1E293B',
      shadowOffset: { width: 0, height: 8 },
      shadowOpacity: 0.12,
      shadowRadius: 20,
      elevation: 6,
    },
  }),
} as const;

export const BottomTabInset = Platform.select({ ios: 50, android: 80 }) ?? 0;
export const MaxContentWidth = 1120;
export const ReadableContentWidth = 760;