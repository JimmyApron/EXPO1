import { sampleCandidateIdeas, sampleSimpleMvpPlan } from './sample-project';
import type { ExportData } from '../types/export';

/** Use with <ExportPanel data={sampleExportData} /> for a standalone preview. */
export const sampleExportData: ExportData = {
  projectTitle: 'Watt',
  idea: sampleCandidateIdeas[0],
  mvpPlan: sampleSimpleMvpPlan,
  aiAnalysis: { strengths: ['회의 결과를 실행 계획으로 연결'], risks: ['AI 분석 결과 검토 필요'], difficulty: '보통' },
  teamRoles: ['기획: 요구사항 정리', '개발: 핵심 기능 구현', '디자인: 화면 구성'],
  presentationOrder: ['문제 제기', '타겟 사용자', '해결 방안', '핵심 기능', 'AI 분석', 'MVP 개발 계획'],
  expectedEffects: '회의 내용을 정리하는 시간을 줄이고 팀의 실행 계획 수립을 돕습니다.',
};
