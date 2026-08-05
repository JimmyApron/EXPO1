import * as ImageManipulator from 'expo-image-manipulator';
import * as ImagePicker from 'expo-image-picker';
import { useCallback, useState } from 'react';
import { Platform } from 'react-native';

import { useAuth } from '@/hooks/use-auth';
import { normalizeExtractCandidateIdeasResponse, maxCandidateTextLength } from '@/lib/candidate-idea';
import { supabase } from '@/lib/supabase';
import type {
  CandidateIdeaImage,
  ExtractCandidateIdeasRequest,
  ExtractCandidateIdeasResponse,
  ProjectConditions,
} from '@/types/candidate-idea';

const maxImages = 3;
const maxImageBytes = 8 * 1024 * 1024;
const maxImageEdge = 2_000;

function getEstimatedBase64Bytes(data: string) {
  return Math.ceil((data.length * 3) / 4);
}

async function optimizeImage(asset: ImagePicker.ImagePickerAsset): Promise<CandidateIdeaImage> {
  const mimeType = asset.mimeType?.toLocaleLowerCase();
  if (mimeType && !['image/jpeg', 'image/png', 'image/webp'].includes(mimeType)) {
    throw new Error('PNG, JPEG, WebP 이미지만 선택할 수 있습니다.');
  }
  if (asset.fileSize && asset.fileSize > maxImageBytes * 2) {
    throw new Error('원본 이미지가 너무 큽니다. 16MB 이하의 캡처를 선택해 주세요.');
  }

  // On web, ImagePicker can legitimately return zero dimensions. Passing that
  // asset through ImageManipulator makes its Canvas path call createImageData
  // with a zero width, so use the picker-provided JPEG data directly instead.
  if (Platform.OS === 'web') {
    const data = asset.base64 ?? '';
    if (!data) {
      throw new Error('브라우저에서 이미지 데이터를 읽지 못했습니다. 다른 이미지를 선택해 주세요.');
    }
    if (getEstimatedBase64Bytes(data) > maxImageBytes) {
      throw new Error('이미지 용량이 8MB를 초과합니다. 더 작은 캡처를 선택해 주세요.');
    }

    return {
      uri: asset.uri,
      width: Number.isFinite(asset.width) ? asset.width : 0,
      height: Number.isFinite(asset.height) ? asset.height : 0,
      mediaType: 'image/jpeg',
      data,
    };
  }

  const context = ImageManipulator.ImageManipulator.manipulate(asset.uri);
  if (asset.width > maxImageEdge || asset.height > maxImageEdge) {
    if (asset.width >= asset.height) {
      context.resize({ width: maxImageEdge, height: null });
    } else {
      context.resize({ width: null, height: maxImageEdge });
    }
  }

  const rendered = await context.renderAsync();
  const result = await rendered.saveAsync({
    base64: true,
    compress: 0.9,
    format: ImageManipulator.SaveFormat.JPEG,
  });
  const data = result.base64 ?? '';

  if (!data || getEstimatedBase64Bytes(data) > maxImageBytes) {
    throw new Error('이미지를 안전한 요청 크기로 줄이지 못했습니다. 더 작은 캡처를 선택해 주세요.');
  }

  return {
    uri: result.uri,
    width: result.width,
    height: result.height,
    mediaType: 'image/jpeg',
    data,
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

async function getInvokeErrorMessage(error: unknown) {
  const context = isRecord(error) ? error.context : undefined;

  if (context && typeof context === 'object' && 'json' in context && typeof context.json === 'function') {
    try {
      const body = await context.json();
      if (isRecord(body) && typeof body.message === 'string' && body.message.trim()) {
        return body.message;
      }
    } catch {
      // Fall through to the transport error message below.
    }
  }

  const message = isRecord(error) && typeof error.message === 'string' ? error.message : '';
  if (/jwt|unauthorized|401/i.test(message)) {
    return '로그인이 만료되었습니다. 다시 로그인한 뒤 시도해 주세요.';
  }
  return message || '아이디어 추출 서버에 연결하지 못했습니다. 다시 시도해 주세요.';
}

export function useCandidateIdeaExtraction(projectId: string) {
  const { session, user } = useAuth();
  const accessToken = session?.access_token ?? '';
  const userId = user?.id ?? '';
  const [images, setImages] = useState<CandidateIdeaImage[]>([]);
  const [isPickingImages, setIsPickingImages] = useState(false);
  const [isExtracting, setIsExtracting] = useState(false);
  const [permissionError, setPermissionError] = useState('');
  const [extractionError, setExtractionError] = useState('');

  const pickImages = useCallback(async () => {
    if (isPickingImages || isExtracting) {
      return;
    }

    setIsPickingImages(true);
    setPermissionError('');
    setExtractionError('');

    try {
      if (Platform.OS !== 'web') {
        const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (!permission.granted) {
          setPermissionError(
            permission.canAskAgain
              ? '카카오톡 캡처를 선택하려면 사진 접근 권한이 필요합니다.'
              : '설정에서 사진 접근 권한을 허용한 뒤 다시 시도해 주세요.',
          );
          return;
        }
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsMultipleSelection: true,
        selectionLimit: maxImages,
        orderedSelection: true,
        quality: 1,
        base64: Platform.OS === 'web',
      });

      if (result.canceled) {
        return;
      }
      if (result.assets.length > maxImages) {
        setExtractionError(`이미지는 최대 ${maxImages}장까지 선택할 수 있습니다.`);
        return;
      }

      const optimized = await Promise.all(result.assets.map(optimizeImage));
      setImages(optimized);
    } catch (error) {
      setExtractionError(error instanceof Error ? error.message : '이미지를 처리하지 못했습니다.');
    } finally {
      setIsPickingImages(false);
    }
  }, [isExtracting, isPickingImages]);

  const clearImages = useCallback(() => setImages([]), []);

  const extract = useCallback(
    async (
      source: { type: 'text'; text: string } | { type: 'image' },
      projectConditions?: ProjectConditions,
    ): Promise<ExtractCandidateIdeasResponse | null> => {
      if (isExtracting) {
        return null;
      }
      if (!userId || !accessToken) {
        setExtractionError('로그인이 필요합니다.');
        return null;
      }

      const requestSource: ExtractCandidateIdeasRequest['source'] =
        source.type === 'text'
          ? { type: 'text', text: source.text.trim().slice(0, maxCandidateTextLength) }
          : {
              type: 'image',
              images: images.map(({ mediaType, data }) => ({ mediaType, data })),
            };

      if (requestSource.type === 'text' && !requestSource.text) {
        setExtractionError('회의록 또는 채팅 내용을 입력해 주세요.');
        return null;
      }
      if (requestSource.type === 'image' && requestSource.images.length === 0) {
        setExtractionError('카카오톡 캡처 이미지를 선택해 주세요.');
        return null;
      }

      setIsExtracting(true);
      setExtractionError('');

      try {
        const body: ExtractCandidateIdeasRequest = { projectId, source: requestSource, projectConditions };
        const { data, error } = await supabase.functions.invoke('extract-candidate-ideas', {
          body,
          headers: { Authorization: `Bearer ${accessToken}` },
        });

        if (error) {
          setExtractionError(await getInvokeErrorMessage(error));
          return null;
        }

        const normalized = normalizeExtractCandidateIdeasResponse(data);
        if (!normalized) {
          setExtractionError('AI 응답 형식이 올바르지 않습니다. 다시 시도해 주세요.');
          return null;
        }

        if (requestSource.type === 'image') {
          setImages([]);
        }
        return normalized;
      } catch {
        setExtractionError('네트워크 오류가 발생했습니다. 연결을 확인하고 다시 시도해 주세요.');
        return null;
      } finally {
        setIsExtracting(false);
      }
    },
    [accessToken, images, isExtracting, projectId, userId],
  );

  return {
    images,
    isPickingImages,
    isExtracting,
    permissionError,
    extractionError,
    pickImages,
    clearImages,
    clearExtractionError: () => setExtractionError(''),
    extract,
  };
}
