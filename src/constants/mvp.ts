import { sampleCandidateIdeas, sampleSimpleMvpPlan } from '@/constants/sample-project';
import type { MvpIdea, MvpPlan } from '@/types/mvp-plan';

export const MVP_EDGE_FUNCTION_NAME = 'generate-mvp';

export const selectedIdea: MvpIdea = {
  id: sampleCandidateIdeas[0].id,
  title: sampleCandidateIdeas[0].title,
  description: sampleCandidateIdeas[0].summary,
  targetUsers: sampleCandidateIdeas[0].targetUsers.join(', '),
  problem: sampleCandidateIdeas[0].problem,
  solution: sampleCandidateIdeas[0].solution,
  coreFeatures: sampleCandidateIdeas[0].coreFeatures,
};

export function createSampleMvpPlan(idea: MvpIdea = selectedIdea): MvpPlan {
  return {
    ideaId: idea.id,
    ideaTitle: idea.title,
    summary: `${idea.description}의 핵심 가치를 6주 안에 검증하는 MVP 계획입니다.`,
    mustHaveFeatures: sampleSimpleMvpPlan.essentialFeatures.map((name) => ({
      name,
      description: `${name}을(를) 사용자가 한 흐름에서 완료할 수 있도록 구현합니다.`,
    })),
    laterFeatures: sampleSimpleMvpPlan.laterFeatures.map((name) => ({
      name,
      description: '핵심 가치를 검증한 뒤 사용자 피드백에 따라 확장합니다.',
    })),
    screens: sampleSimpleMvpPlan.screens.map((name) => ({
      name,
      purpose: `${name}에서 필요한 핵심 작업을 제공합니다.`,
      wireframe: ['상단 제목·진행 단계', '핵심 입력 또는 결과 영역', '이전·다음 실행 버튼'],
    })),
    schedule: sampleSimpleMvpPlan.schedule.map((item, index) => {
      const [period, goal = item] = item.split(':');
      return { period, goal: goal.trim(), tasks: [`${index + 1}주차 목표 구현`, '팀 리뷰 및 통합 테스트'] };
    }),
    teamRoles: [
      { role: '기획·통합', responsibilities: ['공통 데이터 규격 관리', '기능 연결 및 발표 흐름 점검'] },
      { role: '아이디어·마인드맵', responsibilities: ['대화 입력과 OCR', '아이디어 추출·저장·시각화'] },
      { role: 'AI 비교·선정·MVP', responsibilities: ['후보 비교와 최종 선정', 'MVP 계획 생성'] },
      { role: '발표·QA', responsibilities: ['발표 자료와 보고서 생성', '통합 테스트와 문서화'] },
    ],
    apis: sampleSimpleMvpPlan.requiredApis.map((name) => ({ name, purpose: `${name} 연동`, method: 'POST' })),
    presentationOrder: ['문제 정의', '대상 사용자', '선정 아이디어', 'MVP 핵심 기능', '화면 구조', '개발 일정과 역할', '기대 효과'],
  };
}

export const sampleMvpPlan = createSampleMvpPlan();
