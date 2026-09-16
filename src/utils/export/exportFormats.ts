import type { ExportData } from '../../types/export';

const list = (items: string[]) => items.length ? items.map((item) => `- ${item}`).join('\n') : '- 아직 작성되지 않았습니다.';
const compact = (value: string, limit = 180) => {
  const chars = Array.from(value.replace(/\s+/g, ' ').trim());
  return chars.length > limit ? `${chars.slice(0, limit - 1).join('')}…` : chars.join('');
};

export function formatForKakao({ idea, aiAnalysis }: ExportData) {
  return `[최종 아이디어 공유]\n\n아이디어명: ${compact(idea.title, 80)}\n\n문제:\n${compact(idea.problem)}\n\n해결 방안:\n${compact(idea.solution)}\n\n핵심 기능:\n${list(idea.coreFeatures.slice(0, 4).map((item) => compact(item, 70)))}\n\nAI 분석:\n장점: ${compact(aiAnalysis?.strengths.join(', ') || '분석 전', 120)}\n리스크: ${compact(aiAnalysis?.risks.join(', ') || '분석 전', 120)}\n난이도: ${compact(aiAnalysis?.difficulty || '분석 전', 30)}`;
}

export function exportSections(data: ExportData) {
  return [
    { title: '프로젝트 개요', content: `${data.projectTitle}\n${data.idea.summary}` },
    { title: '아이디어명', content: data.idea.title },
    { title: '문제 정의', content: data.idea.problem },
    { title: '타겟 사용자', content: list(data.idea.targetUsers) },
    { title: '해결 방안', content: data.idea.solution },
    { title: '핵심 기능', content: list(data.idea.coreFeatures) },
    { title: 'AI 분석', content: `장점:\n${list(data.aiAnalysis?.strengths ?? [])}\n리스크:\n${list(data.aiAnalysis?.risks ?? [])}\n구현 난이도: ${data.aiAnalysis?.difficulty || '분석 전'}` },
    { title: 'MVP 요약', content: `필수 기능:\n${list(data.mvpPlan.essentialFeatures)}\n\n추후 기능:\n${list(data.mvpPlan.laterFeatures)}` },
    { title: '개발 일정', content: list(data.mvpPlan.schedule) },
    { title: '필요 API', content: list(data.mvpPlan.requiredApis) },
    { title: '팀원 역할 분담', content: list(data.teamRoles) },
    { title: '발표 순서', content: list(data.presentationOrder) },
    { title: '기대 효과', content: data.expectedEffects || '아직 작성되지 않았습니다.' },
  ];
}

export function formatForNotion(data: ExportData) {
  return '# 최종 아이디어 정리\n\n' + exportSections(data).map((section, index) => `## ${index + 1}. ${section.title}\n\n${section.content}`).join('\n\n');
}

export function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]!);
}

export function reportHtml(data: ExportData) {
  const sections = exportSections(data);
  if (data.presentation?.finalReport) sections.push({ title: '최종 결과 보고서', content: data.presentation.finalReport });
  return `<!DOCTYPE html><html lang="ko"><head><meta charset="utf-8"><title>${escapeHtml(data.projectTitle)}_final_report</title><style>@page{size:A4;margin:18mm}body{font-family:"Malgun Gothic","Apple SD Gothic Neo",sans-serif;color:#172033;font-size:11pt;line-height:1.7}h1{font-size:24pt;color:#2563eb}h2{font-size:15pt;break-after:avoid}p{white-space:pre-wrap;overflow-wrap:anywhere;orphans:3;widows:3}</style></head><body><h1>${escapeHtml(data.projectTitle)} · 최종보고서</h1>${sections.map((section) => `<h2>${escapeHtml(section.title)}</h2><p>${escapeHtml(section.content)}</p>`).join('')}</body></html>`;
}

export function presentationPages(data: ExportData) {
  const slides = data.presentation?.slides.length
    ? data.presentation.slides.map((slide) => ({ title: slide.title, content: slide.bulletPoints.join('\n'), notes: slide.speakerScript }))
    : exportSections(data).map((section) => ({ ...section, notes: '' }));
  return slides.flatMap((slide) => {
    const chars = Array.from(slide.content || '아직 작성되지 않았습니다.');
    const pages = [];
    for (let offset = 0; offset < chars.length; offset += 360) pages.push({ title: slide.title + (offset ? ' (계속)' : ''), content: chars.slice(offset, offset + 360).join(''), notes: offset ? '' : slide.notes });
    return pages;
  });
}
