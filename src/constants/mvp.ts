import type { MvpIdea, MvpPlan } from '@/types/mvp-plan';

export const MVP_EDGE_FUNCTION_NAME = 'generate-mvp';
export const selectedIdeaId = 'idea-001';

export const candidateIdeas: MvpIdea[] = [
  {
    id: 'idea-001',
    title: '팀 프로젝트 실행 도우미',
    description: '선정된 아이디어를 실행 가능한 MVP 계획과 팀 업무로 빠르게 바꾸는 협업 서비스',
    targetUsers: '해커톤 및 대학생 팀 프로젝트 참가자',
  },
  {
    id: 'idea-002',
    title: '캠퍼스 스터디 매칭',
    description: '목표와 시간표를 바탕으로 스터디원을 연결하는 서비스',
    targetUsers: '대학생',
  },
];

function findSelectedIdea(): MvpIdea {
  const idea = candidateIdeas.find((candidate) => candidate.id === selectedIdeaId);
  if (!idea) throw new Error(`선정 아이디어(${selectedIdeaId})를 찾을 수 없습니다.`);
  return idea;
}

export const selectedIdea = findSelectedIdea();

export const sampleMvpPlan: MvpPlan = {
  ideaId: selectedIdea.id,
  ideaTitle: selectedIdea.title,
  summary: '아이디어 선정부터 역할 배정, 일정 확인까지 한 흐름으로 연결하는 팀 프로젝트용 MVP입니다.',
  mustHaveFeatures: [
    { name: '최종 아이디어 요약', description: '선정 아이디어의 문제, 대상 사용자, 핵심 가치를 한눈에 보여줍니다.' },
    { name: 'AI MVP 계획 생성', description: '기능, 화면, 일정, 역할, API, 발표 순서를 구조화해 생성합니다.' },
    { name: '팀 역할 및 일정 보드', description: '담당자별 할 일과 주차별 목표를 확인합니다.' },
  ],
  laterFeatures: [
    { name: '실시간 공동 편집', description: '여러 팀원이 동시에 계획을 수정합니다.' },
    { name: 'GitHub·캘린더 연동', description: '개발 진행률과 마감 일정을 자동으로 동기화합니다.' },
    { name: '계획 버전 비교', description: 'AI 재생성 전후 계획을 비교하고 복원합니다.' },
  ],
  screens: [
    { name: 'MVP 대시보드', purpose: '전체 계획과 현재 진행 상태 확인', wireframe: ['선정 아이디어 헤더', '핵심 기능 카드', '일정 타임라인', '팀 역할 요약'] },
    { name: '기능 상세', purpose: '필수/추후 기능의 범위와 완료 조건 확인', wireframe: ['필터 탭', '기능 목록', '기능 상세 패널'] },
    { name: '발표 준비', purpose: '발표 흐름과 담당자 확인', wireframe: ['발표 순서', '슬라이드별 핵심 메시지', '리허설 체크리스트'] },
  ],
  schedule: [
    { period: '1주차', goal: '기획 및 설계', tasks: ['사용자 시나리오 확정', '와이어프레임 제작', '데이터 모델 및 API 계약 정의'] },
    { period: '2주차', goal: '핵심 기능 구현', tasks: ['화면 및 내비게이션 구현', 'Supabase 연동', 'MVP 생성 Edge Function 연결'] },
    { period: '3주차', goal: '통합 및 발표 준비', tasks: ['통합 테스트', '사용성 개선', '데모 데이터와 발표 자료 준비'] },
  ],
  teamRoles: [
    { role: '기획/PM', responsibilities: ['요구사항과 범위 관리', '일정 조율', '발표 스토리 구성'] },
    { role: '프론트엔드', responsibilities: ['Expo 화면 구현', 'Supabase 호출 및 상태 처리', '사용성 테스트'] },
    { role: '백엔드/AI', responsibilities: ['DB 및 Edge Function 구현', 'Claude 프롬프트와 응답 검증', '보안 설정'] },
    { role: '디자인/QA', responsibilities: ['와이어프레임과 UI 규칙', '테스트 시나리오', '데모 품질 점검'] },
  ],
  apis: [
    { name: 'Supabase Auth', purpose: '사용자 로그인과 세션 관리', method: 'SDK' },
    { name: 'generate-mvp Edge Function', purpose: '선정 아이디어로 MVP 계획 생성', method: 'POST' },
    { name: 'MVP Plan 저장 API', purpose: '생성된 계획 저장 및 조회', method: 'GET / POST' },
  ],
  presentationOrder: ['문제와 대상 사용자', '선정 아이디어와 핵심 가치', 'MVP 필수 기능', '주요 화면 데모', '기술 구조와 API', '개발 일정과 역할 분담', '기대 효과 및 향후 기능'],
};
