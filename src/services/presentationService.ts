import type { Presentation, PresentationInput, PresentationSummary } from '@/types/presentation';

const sampleSlides = [
  {
    id: 'slide-1',
    type: 'title' as const,
    title: '프로젝트 발표',
    content: '서비스 소개와 핵심 기능을 한눈에 보여줍니다.',
    accent: '#4050D0',
  },
  {
    id: 'slide-2',
    type: 'bullet' as const,
    title: '핵심 포인트',
    content: '• 사용자 경험 개선\n• 빠른 기능 탐색\n• 간단한 발표 구성',
    accent: '#7380EE',
  },
];

const initialPresentation: Presentation = {
  id: 'presentation-1',
  title: '새 발표',
  description: '발표 자료를 구성하는 기본 예시입니다.',
  slides: sampleSlides,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
};

export function getPresentation(): Presentation {
  return initialPresentation;
}

export function createPresentation(input: PresentationInput): Presentation {
  const now = new Date().toISOString();

  return {
    id: `presentation-${Date.now()}`,
    title: input.title,
    description: input.description,
    slides: input.slides,
    createdAt: now,
    updatedAt: now,
  };
}

export function summarizePresentation(presentation: Presentation): PresentationSummary {
  return {
    id: presentation.id,
    title: presentation.title,
    slideCount: presentation.slides.length,
    updatedAt: presentation.updatedAt,
  };
}

export function updatePresentationSlides(
  presentation: Presentation,
  slides: Presentation['slides'],
): Presentation {
  return {
    ...presentation,
    slides,
    updatedAt: new Date().toISOString(),
  };
}
