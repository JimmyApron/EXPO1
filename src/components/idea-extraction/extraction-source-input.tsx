import { Image, Pressable, StyleSheet, TextInput, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import type { CandidateIdeaImage } from '@/types/candidate-idea';

export type ExtractionSourceMode = 'text' | 'image';

type ExtractionSourceInputProps = {
  mode: ExtractionSourceMode;
  text: string;
  images: CandidateIdeaImage[];
  isBusy: boolean;
  permissionError: string;
  onChangeMode: (mode: ExtractionSourceMode) => void;
  onChangeText: (value: string) => void;
  onPickImages: () => void;
  onClearImages: () => void;
};

export function ExtractionSourceInput({
  mode,
  text,
  images,
  isBusy,
  permissionError,
  onChangeMode,
  onChangeText,
  onPickImages,
  onClearImages,
}: ExtractionSourceInputProps) {
  const theme = useTheme();

  return (
    <View style={styles.container}>
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
                selected && styles.modeButtonSelected,
                (pressed || isBusy) && styles.pressed,
              ]}>
              <ThemedText type="smallBold" style={selected ? styles.modeTextSelected : undefined}>
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
          <ThemedView type="backgroundElement" style={styles.privacyNotice}>
            <ThemedText type="smallBold">개인정보를 먼저 확인해 주세요</ThemedText>
            <ThemedText type="small" themeColor="textSecondary">
              카카오톡 캡처에 이름, 전화번호 등 불필요한 개인정보가 있다면 가린 뒤 선택해 주세요.
            </ThemedText>
          </ThemedView>

          <View style={styles.imageActions}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="카카오톡 캡처 이미지 선택"
              disabled={isBusy}
              onPress={onPickImages}
              style={({ pressed }) => [styles.primaryButton, (pressed || isBusy) && styles.pressed]}>
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
                style={({ pressed }) => [styles.secondaryButton, (pressed || isBusy) && styles.pressed]}>
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
                <View key={`${image.uri}:${index}`} style={styles.previewCard}>
                  <Image
                    accessibilityLabel={`선택한 캡처 ${index + 1}`}
                    source={{ uri: image.uri }}
                    resizeMode="contain"
                    style={styles.previewImage}
                  />
                  <ThemedText type="small" themeColor="textSecondary">
                    {image.width} × {image.height}
                  </ThemedText>
                </View>
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
    minHeight: 44,
    minWidth: 132,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderRadius: Spacing.two,
    paddingHorizontal: Spacing.three,
  },
  modeButtonSelected: { borderColor: '#2563eb', backgroundColor: '#eff6ff' },
  modeTextSelected: { color: '#1d4ed8' },
  field: { gap: Spacing.two },
  textArea: {
    minHeight: 180,
    borderWidth: 1,
    borderRadius: Spacing.two,
    padding: Spacing.three,
    fontSize: 16,
    lineHeight: 23,
    textAlignVertical: 'top',
  },
  counter: { alignSelf: 'flex-end' },
  privacyNotice: { gap: Spacing.one, borderRadius: Spacing.two, padding: Spacing.three },
  imageActions: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two },
  primaryButton: {
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: Spacing.two,
    backgroundColor: '#2563eb',
    paddingHorizontal: Spacing.three,
  },
  primaryButtonText: { color: '#ffffff' },
  secondaryButton: {
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderRadius: Spacing.two,
    paddingHorizontal: Spacing.three,
  },
  previewGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two },
  previewCard: { width: 150, gap: Spacing.one },
  previewImage: { width: 150, height: 190, borderRadius: Spacing.two, backgroundColor: '#f8fafc' },
  errorText: { color: '#b91c1c' },
  pressed: { opacity: 0.6 },
});
