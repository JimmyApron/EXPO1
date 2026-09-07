import { Pressable, StyleSheet, TextInput, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ExtractionPrivacyNotice } from './extraction-privacy-notice';
import { ImageRedactionEditor } from './image-redaction-editor';
import { ControlHeight, Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import type { CandidateIdeaImage } from '@/types/candidate-idea';

export type ExtractionSourceMode = 'text' | 'image';

type ExtractionSourceInputProps = {
  mode: ExtractionSourceMode;
  text: string;
  images: CandidateIdeaImage[];
  imageSelectionId: number;
  isBusy: boolean;
  permissionError: string;
  onChangeMode: (mode: ExtractionSourceMode) => void;
  onChangeText: (value: string) => void;
  onPickImages: () => void;
  onClearImages: () => void;
  onPrepareImage: (uri: string, prepared?: CandidateIdeaImage) => void;
};

export function ExtractionSourceInput({
  mode,
  text,
  images,
  imageSelectionId,
  isBusy,
  permissionError,
  onChangeMode,
  onChangeText,
  onPickImages,
  onClearImages,
  onPrepareImage,
}: ExtractionSourceInputProps) {
  const theme = useTheme();

  return (
    <View style={styles.container}>
      <ExtractionPrivacyNotice />
      <View style={styles.modeRow} accessibilityRole="tablist">
        {(['text', 'image'] as const).map((sourceMode) => {
          const selected = mode === sourceMode;
          const label = sourceMode === 'text' ? '텍스트 입력' : '이미지 입력';
          return (
            <Pressable
              key={sourceMode}
              accessibilityRole="tab"
              accessibilityLabel={label}
              accessibilityState={{ selected, disabled: isBusy }}
              disabled={isBusy}
              onPress={() => onChangeMode(sourceMode)}
              style={({ pressed }) => [
                styles.modeButton,
                { borderColor: theme.border, backgroundColor: theme.background },
                selected && { borderColor: theme.primary, backgroundColor: theme.primarySoft },
                (pressed || isBusy) && styles.pressed,
              ]}>
              <ThemedText type="smallBold" style={selected ? { color: theme.primary } : undefined}>
                {selected ? `✓ ${label}` : label}
              </ThemedText>
            </Pressable>
          );
        })}
      </View>

      {mode === 'text' ? (
        <View style={styles.field}>
          <ThemedText type="smallBold">회의록 또는 채팅 내용</ThemedText>
          <TextInput
            accessibilityLabel="회의록 또는 채팅 내용"
            value={text}
            editable={!isBusy}
            onChangeText={onChangeText}
            multiline
            maxLength={30_000}
            placeholder="회의에서 나온 문제, 아이디어, 사용자 요구를 붙여 넣어 주세요."
            placeholderTextColor={theme.textSecondary}
            style={[
              styles.textArea,
              { color: theme.text, borderColor: theme.backgroundSelected, backgroundColor: theme.background },
            ]}
          />
          <ThemedText type="small" themeColor="textSecondary" style={styles.counter}>
            {text.length.toLocaleString()} / 30,000자
          </ThemedText>
        </View>
      ) : (
        <View style={styles.field}>
          <View style={styles.imageActions}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="카카오톡 캡처 이미지 선택"
              disabled={isBusy}
              onPress={onPickImages}
              style={({ pressed }) => [
                styles.primaryButton,
                { backgroundColor: theme.primary },
                (pressed || isBusy) && styles.pressed,
              ]}>
              <ThemedText type="smallBold" style={styles.primaryButtonText}>
                {images.length > 0 ? '이미지 다시 선택' : '캡처 이미지 선택'}
              </ThemedText>
            </Pressable>
            {images.length > 0 ? (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="선택한 이미지 모두 제거"
                disabled={isBusy}
                onPress={onClearImages}
                style={({ pressed }) => [
                  styles.secondaryButton,
                  { borderColor: theme.border },
                  (pressed || isBusy) && styles.pressed,
                ]}>
                <ThemedText type="smallBold">모두 제거</ThemedText>
              </Pressable>
            ) : null}
          </View>

          <ThemedText type="small" themeColor="textSecondary">
            PNG, JPEG, WebP · 최대 3장 · 원본 1장당 16MB 이하
          </ThemedText>

          {permissionError ? (
            <ThemedText accessibilityRole="alert" type="small" style={styles.errorText}>
              {permissionError}
            </ThemedText>
          ) : null}

          {images.length > 0 ? (
            <View style={styles.previewGrid}>
              {images.map((image, index) => (
                <ImageRedactionEditor
                  key={`${imageSelectionId}:${index}`}
                  image={image} index={index} disabled={isBusy} onPrepare={onPrepareImage}
                />
              ))}
            </View>
          ) : null}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: Spacing.three },
  modeRow: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two },
  modeButton: {
    minHeight: ControlHeight.touch,
    minWidth: 132,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderRadius: Radius.medium,
    paddingHorizontal: Spacing.three,
  },
  field: { gap: Spacing.two },
  textArea: {
    minHeight: 180,
    borderWidth: 1,
    borderRadius: Radius.medium,
    padding: Spacing.three,
    fontSize: 16,
    lineHeight: 23,
    textAlignVertical: 'top',
  },
  counter: { alignSelf: 'flex-end' },
  privacyNotice: { gap: Spacing.one, borderWidth: 1, borderRadius: Radius.medium, padding: Spacing.three },
  imageActions: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two },
  primaryButton: {
    minHeight: ControlHeight.touch,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: Radius.medium,
    paddingHorizontal: Spacing.three,
  },
  primaryButtonText: { color: '#ffffff' },
  secondaryButton: {
    minHeight: ControlHeight.touch,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderRadius: Radius.medium,
    paddingHorizontal: Spacing.three,
  },
  previewGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two },
  previewCard: { width: 166, gap: Spacing.one, borderWidth: 1, borderRadius: Radius.medium, padding: Spacing.two },
  previewImage: { width: '100%', height: 190, borderRadius: Radius.small },
  errorText: { color: '#b91c1c' },
  pressed: { opacity: 0.6 },
});
