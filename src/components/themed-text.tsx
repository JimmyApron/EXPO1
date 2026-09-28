import { Platform, StyleSheet, Text, type TextProps } from 'react-native';

import { Fonts, ThemeColor } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

export type ThemedTextProps = TextProps & {
  type?:
    | 'default'
    | 'title'
    | 'screenTitle'
    | 'sectionTitle'
    | 'cardTitle'
    | 'body'
    | 'caption'
    | 'captionStrong'
    | 'button'
    | 'small'
    | 'smallBold'
    | 'subtitle'
    | 'link'
    | 'linkPrimary'
    | 'code';
  themeColor?: ThemeColor;
};

export function ThemedText({ style, type = 'default', themeColor, ...rest }: ThemedTextProps) {
  const theme = useTheme();

  return (
    <Text
      style={[
        { color: theme[themeColor ?? 'text'] },
        type === 'default' && styles.default,
        type === 'title' && styles.title,
        type === 'screenTitle' && styles.screenTitle,
        type === 'sectionTitle' && styles.sectionTitle,
        type === 'cardTitle' && styles.cardTitle,
        type === 'body' && styles.body,
        type === 'caption' && styles.caption,
        type === 'captionStrong' && styles.captionStrong,
        type === 'button' && styles.button,
        type === 'small' && styles.small,
        type === 'smallBold' && styles.smallBold,
        type === 'subtitle' && styles.subtitle,
        type === 'link' && styles.link,
        type === 'linkPrimary' && [styles.linkPrimary, { color: theme.primary }],
        type === 'code' && styles.code,
        style,
      ]}
      {...rest}
    />
  );
}

const styles = StyleSheet.create({
  small: {
    fontSize: 13,
    lineHeight: 19,
    fontWeight: 400,
  },
  smallBold: {
    fontSize: 14,
    lineHeight: 20,
    fontWeight: 700,
  },
  default: {
    fontSize: 16,
    lineHeight: 24,
    fontWeight: 400,
  },
  screenTitle: { fontSize: 30, lineHeight: 38, fontWeight: '700', letterSpacing: -0.6 },
  sectionTitle: { fontSize: 21, lineHeight: 28, fontWeight: '700', letterSpacing: -0.25 },
  cardTitle: { fontSize: 17, lineHeight: 24, fontWeight: '700' },
  body: { fontSize: 15, lineHeight: 23, fontWeight: '400' },
  caption: { fontSize: 13, lineHeight: 18, fontWeight: '400' },
  captionStrong: { fontSize: 13, lineHeight: 18, fontWeight: '700' },
  button: { fontSize: 14, lineHeight: 20, fontWeight: '700' },
  title: {
    fontSize: 40,
    fontWeight: 700,
    lineHeight: 48,
    letterSpacing: -1.2,
  },
  subtitle: {
    fontSize: 28,
    lineHeight: 36,
    fontWeight: 700,
    letterSpacing: -0.5,
  },
  link: {
    lineHeight: 30,
    fontSize: 14,
  },
  linkPrimary: {
    lineHeight: 30,
    fontSize: 14,
    fontWeight: 700,
  },
  code: {
    fontFamily: Fonts.mono,
    fontWeight: Platform.select({ android: 700 }) ?? 500,
    fontSize: 12,
  },
});
