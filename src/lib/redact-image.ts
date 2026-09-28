import type { CandidateIdeaImage } from '@/types/candidate-idea';

// Metro resolves redact-image.web.ts for browser builds.
export async function renderWebImage(_uri: string): Promise<CandidateIdeaImage> {
  throw new Error('웹 전용 이미지 처리입니다.');
}
