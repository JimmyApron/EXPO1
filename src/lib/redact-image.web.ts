import type { CandidateIdeaImage } from '@/types/candidate-idea';
import { redactionPixels, type RedactionRect } from './image-redaction';

/** Canvas flattens opaque masks into the bytes that will be sent to OCR. */
export async function renderWebImage(uri: string, rectangles: RedactionRect[] = []): Promise<CandidateIdeaImage> {
  const image = await new Promise<HTMLImageElement>((resolve, reject) => {
    const source = new window.Image();
    const timer = globalThis.setTimeout(() => reject(new Error('이미지 읽기 시간이 초과되었습니다.')), 15_000);
    source.onload = () => { globalThis.clearTimeout(timer); resolve(source); };
    source.onerror = () => { globalThis.clearTimeout(timer); reject(new Error('이미지를 읽지 못했습니다.')); };
    source.src = uri;
  });
  if (!image.naturalWidth || !image.naturalHeight) throw new Error('이미지 크기를 확인하지 못했습니다.');
  const scale = Math.min(1, 2000 / Math.max(image.naturalWidth, image.naturalHeight));
  const width = Math.max(1, Math.round(image.naturalWidth * scale));
  const height = Math.max(1, Math.round(image.naturalHeight * scale));
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext('2d');
  if (!context) throw new Error('이 브라우저에서는 이미지 가림을 처리할 수 없습니다.');
  context.fillStyle = '#ffffff';
  context.fillRect(0, 0, width, height);
  context.drawImage(image, 0, 0, width, height);
  context.fillStyle = '#000000';
  rectangles.forEach((rect) => {
    const pixels = redactionPixels(rect, width, height);
    context.fillRect(pixels.x, pixels.y, pixels.width, pixels.height);
  });
  const result = canvas.toDataURL('image/jpeg', 0.9);
  const data = result.split(',')[1];
  canvas.width = canvas.height = 0;
  if (!data || Math.ceil(data.length * 3 / 4) > 8 * 1024 * 1024) throw new Error('처리된 이미지가 너무 큽니다. 더 작은 캡처를 선택해 주세요.');
  return { uri: result, data, mediaType: 'image/jpeg', width, height };
}
