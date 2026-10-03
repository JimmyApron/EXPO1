import { forwardRef } from 'react';
import { StyleSheet, TextInput, type TextInputProps } from 'react-native';
import { useExperience } from '@/context/ExperienceContext';
import { scaledTypography } from '@/utils/fontSize';

export const ScaledTextInput = forwardRef<TextInput, TextInputProps>(function ScaledTextInput({ style, ...props }, ref) {
  const { fontSize } = useExperience();
  const base = StyleSheet.flatten(style);
  return <TextInput ref={ref} {...props} style={[style, scaledTypography(base?.fontSize ?? 16, base?.lineHeight, fontSize)]} />;
});
