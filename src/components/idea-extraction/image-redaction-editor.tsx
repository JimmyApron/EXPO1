import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Image, Platform, Pressable, StyleSheet, View } from 'react-native';
import Svg, { Image as SvgImage, Rect } from 'react-native-svg';

import { ThemedText } from '@/components/themed-text';
import { ControlHeight, Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { redactionPixels, redactionRectangle, suggestedRedactions, type RedactionPoint, type RedactionRect } from '@/lib/image-redaction';
import { renderWebImage } from '@/lib/redact-image';
import type { CandidateIdeaImage } from '@/types/candidate-idea';

export function ImageRedactionEditor({ image, index, disabled, onPrepare }: {
  image: CandidateIdeaImage;
  index: number;
  disabled: boolean;
  onPrepare: (uri: string, prepared?: CandidateIdeaImage) => void;
}) {
  const theme = useTheme();
  const svg = useRef<Svg>(null);
  const operation = useRef(false);
  const [rectangles, setRectangles] = useState<RedactionRect[]>(suggestedRedactions);
  const [anchor, setAnchor] = useState<RedactionPoint | null>(null);
  const [width, setWidth] = useState(280);
  const [loaded, setLoaded] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [prepared, setPrepared] = useState<CandidateIdeaImage | null>(null);
  const [confirmed, setConfirmed] = useState(false);
  const [error, setError] = useState('');
  const height = width * image.height / image.width;
  const busy = disabled || processing;
  const imageSource = `data:${image.mediaType};base64,${image.data}`;

  useEffect(() => {
    if (loaded) return;
    const timer = globalThis.setTimeout(() => setError('미리보기를 읽지 못했습니다. 캡처 이미지를 다시 선택해 주세요.'), 15_000);
    return () => globalThis.clearTimeout(timer);
  }, [loaded]);

  const changeRectangles = (next: RedactionRect[]) => {
    setRectangles(next);
    setAnchor(null);
    setPrepared(null);
    setConfirmed(false);
    setError('');
    onPrepare(image.uri);
  };

  const prepare = async () => {
    if (operation.current || busy || !loaded || !rectangles.length || anchor) return;
    operation.current = true;
    setProcessing(true);
    setError('');
    try {
      let result: CandidateIdeaImage;
      if (Platform.OS === 'web') {
        result = await renderWebImage(imageSource, rectangles);
      } else {
        const base64 = await new Promise<string>((resolve, reject) => {
          const timer = globalThis.setTimeout(() => reject(new Error('가림 이미지 생성 시간이 초과되었습니다.')), 15_000);
          if (!svg.current) { globalThis.clearTimeout(timer); reject(new Error('이미지 미리보기를 다시 열어 주세요.')); return; }
          svg.current.toDataURL((data) => { globalThis.clearTimeout(timer); resolve(data.replace(/\s/g, '')); }, { width: image.width, height: image.height });
        });
        if (!base64 || Math.ceil(base64.length * 3 / 4) > 8 * 1024 * 1024) {
          throw new Error('가림 이미지가 너무 큽니다. 더 작은 캡처를 선택해 주세요.');
        }
        result = {
          uri: `data:image/png;base64,${base64}`,
          width: image.width,
          height: image.height,
          data: base64,
          mediaType: 'image/png',
        };
      }
      // The user must review this raster, not just the editing overlay, before upload.
      setPrepared(result);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : '가림 이미지 생성에 실패했습니다.');
    } finally { operation.current = false; setProcessing(false); }
  };

  const button = (label: string, action: () => void, inactive = busy) => (
    <Pressable accessibilityRole="button" disabled={inactive} onPress={action}
      style={[styles.button, { borderColor: theme.border }, inactive && styles.disabled]}>
      <ThemedText type="smallBold">{label}</ThemedText>
    </Pressable>
  );

  return (
    <View style={[styles.card, { borderColor: theme.border }]}>
      <ThemedText type="smallBold">캡처 {index + 1} · {confirmed ? (rectangles.length ? '가림본 전송 준비됨' : '가림 없는 이미지 전송 준비됨') : '전송 전 검토 필요'}</ThemedText>
      <ThemedText type="small" themeColor="textSecondary">기본 가림은 상단과 왼쪽 프로필 영역의 위치 제안입니다. 이름·사진을 인식하지 않으며 채팅 배치에 따라 누락되거나 대화가 가려질 수 있어요.</ThemedText>
      <ThemedText type="small">이름이나 사진을 가리려면 영역의 두 모서리를 차례로 눌러 주세요. {anchor ? '반대쪽 모서리를 눌러 완성하세요.' : '검은 영역은 아래 버튼으로 삭제할 수 있어요.'}</ThemedText>
      <View onLayout={(event) => setWidth(Math.max(1, event.nativeEvent.layout.width))} style={styles.preview}>
        {prepared ? (
          <Image source={{ uri: prepared.uri }} accessibilityLabel={`캡처 ${index + 1} 실제 전송 이미지`} style={{ width, height }} resizeMode="contain" />
        ) : (
          <Pressable accessibilityLabel="가림 영역의 첫 모서리와 반대 모서리 선택" disabled={busy}
            onPress={(event) => {
              const point = { x: event.nativeEvent.locationX / width, y: event.nativeEvent.locationY / height };
              if (!anchor) { setAnchor(point); onPrepare(image.uri); setConfirmed(false); return; }
              const rect = redactionRectangle(anchor, point);
              if (rect) changeRectangles([...rectangles, rect]);
              else { setAnchor(null); setError('두 모서리를 조금 더 떨어뜨려 선택해 주세요.'); }
            }}>
            <View pointerEvents="none">
              <Svg ref={svg} width={width} height={height} viewBox={`0 0 ${image.width} ${image.height}`}>
                <SvgImage href={imageSource} width={image.width} height={image.height} onLoad={() => setLoaded(true)} />
                {rectangles.map((rect, rectIndex) => <Rect key={rectIndex} {...redactionPixels(rect, image.width, image.height)} fill="#000000" />)}
              </Svg>
              {anchor ? <View style={[styles.anchor, { left: anchor.x * width - 4, top: anchor.y * height - 4 }]} /> : null}
            </View>
          </Pressable>
        )}
      </View>
      {!prepared ? <View style={styles.row}>
        {rectangles.map((_, rectIndex) => <View key={rectIndex}>{button(`영역 ${rectIndex + 1} 삭제`, () => changeRectangles(rectangles.filter((__, i) => i !== rectIndex)))}</View>)}
        {button('기본 가림 다시 적용', () => changeRectangles([...suggestedRedactions]))}
        {button('모든 가림 삭제', () => changeRectangles([]))}
        {anchor ? button('영역 선택 취소', () => setAnchor(null)) : null}
      </View> : null}
      {processing ? <ActivityIndicator color={theme.primary} /> : null}
      {error ? <ThemedText accessibilityRole="alert" type="small" style={{ color: theme.danger }}>{error}</ThemedText> : null}
      {prepared ? (
        <>
          <ThemedText type="small">위 이미지는 실제 전송본입니다. 이름·사진·대화 속 개인정보를 확인해 주세요.</ThemedText>
          {button(confirmed ? '전송본 확인 완료' : '이 가림본으로 전송 준비', () => { onPrepare(image.uri, prepared); setConfirmed(true); }, busy || confirmed)}
          {button('가림 다시 편집', () => changeRectangles([...rectangles]))}
        </>
      ) : rectangles.length ? (
        <Pressable accessibilityRole="button" disabled={busy || !loaded || Boolean(anchor)} onPress={() => void prepare()}
          style={[styles.button, { borderColor: theme.border }, (busy || !loaded || Boolean(anchor)) && styles.disabled]}>
          <ThemedText type="smallBold">가림 적용 · 실제 전송본 미리보기</ThemedText>
        </Pressable>
      ) : (
        <>
          <ThemedText type="small" style={{ color: theme.warning }}>가림이 없습니다. 선택한 이미지의 이름과 프로필 사진이 그대로 AI에 전달됩니다.</ThemedText>
          {button(confirmed ? '가림 없는 이미지 확인 완료' : '가림 없이 원본 내용 전송 준비', () => { onPrepare(image.uri, image); setConfirmed(true); }, busy || confirmed || !loaded || Boolean(anchor))}
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { width: '100%', gap: Spacing.two, borderWidth: 1, borderRadius: Radius.medium, padding: Spacing.two },
  preview: { width: '100%' }, row: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two },
  button: { alignSelf: 'flex-start', minHeight: ControlHeight.touch, justifyContent: 'center', borderWidth: 1, borderRadius: Radius.medium, paddingHorizontal: Spacing.two },
  anchor: { position: 'absolute', width: 8, height: 8, borderRadius: 4, backgroundColor: '#ef4444' },
  disabled: { opacity: 0.5 },
});
