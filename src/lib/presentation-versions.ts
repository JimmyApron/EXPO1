import type { PresentationData, PresentationVersionEntry } from '@/types/presentation';

export function presentationSnapshot(data: PresentationData): NonNullable<PresentationVersionEntry['snapshot']> {
  return {
    presentationTitle: data.presentationTitle,
    slides: data.slides,
    expectedQna: data.expectedQna,
    businessPlanDraft: data.businessPlanDraft,
    finalReport: data.finalReport,
  };
}

export function changedPresentationSections(before: PresentationData, after: PresentationData) {
  const changes: string[] = [];
  if (before.presentationTitle !== after.presentationTitle) changes.push('발표 제목');
  const oldSlides = new Map(before.slides.map((slide) => [slide.slideNumber, slide]));
  for (const slide of after.slides) {
    const old = oldSlides.get(slide.slideNumber);
    if (!old || JSON.stringify(old) !== JSON.stringify(slide)) changes.push(`${slide.slideNumber}번 슬라이드: ${slide.title}`);
    oldSlides.delete(slide.slideNumber);
  }
  for (const slide of oldSlides.values()) changes.push(`${slide.slideNumber}번 슬라이드 삭제`);
  if (JSON.stringify(before.expectedQna) !== JSON.stringify(after.expectedQna)) changes.push('예상 질문');
  if (before.businessPlanDraft !== after.businessPlanDraft) changes.push('사업계획서');
  if (before.finalReport !== after.finalReport) changes.push('최종 보고서');
  return changes;
}

export function createArchivedVersion(data: PresentationData, instruction: string): PresentationVersionEntry {
  return {
    id: data.currentVersionId ?? `legacy-${Date.now()}`,
    createdAt: data.createdAt ?? new Date().toISOString(),
    instruction,
    summary: `${data.slides.length}개 슬라이드와 문서 보관`,
    changedSlides: [],
    snapshot: presentationSnapshot(data),
  };
}

export function applyPresentationCandidate(current: PresentationData, candidate: PresentationData, instruction: string): PresentationData {
  const archived = createArchivedVersion(current, instruction);
  return {
    ...presentationSnapshot(candidate),
    ideaId: current.ideaId ?? candidate.ideaId,
    createdAt: new Date().toISOString(),
    currentVersionId: `version-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    previousVersionId: archived.id,
    versionHistory: [archived, ...(current.versionHistory ?? [])],
  };
}
