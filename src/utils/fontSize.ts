export type FontSize = 'small' | 'default' | 'large';
export function scaledTypography(size: number, lineHeight: number | undefined, setting: FontSize) {
  const scale = { small: 0.9, default: 1, large: 1.2 }[setting];
  const fontSize = Math.max(14, Math.round(size * scale));
  return { fontSize, lineHeight: Math.max(fontSize * 1.4, (lineHeight ?? size * 1.5) * scale) };
}
