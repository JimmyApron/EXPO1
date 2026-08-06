import type { CandidateIdea, ProjectConditions } from '@/types/candidate-idea';
import type { SampleMvpPlan } from '@/types/presentation';

export const sampleProjectConditions: Required<ProjectConditions> = {
  durationWeeks: 6,
  teamSize: 4,
  skillLevel: '초급~중급',
  budget: 100000,
  evaluationCriteria: ['창의성', '구현 가능성', '사용자 편의성', '완성도'],
};

export const sampleCandidateIdeas: CandidateIdea[] = [
  {
    id: 'idea-001',
    title: 'AI 회의 아이디어 정리 서비스',
    summary: '회의와 채팅에서 아이디어를 추출하고 실행 계획까지 만들어주는 서비스',
    problem: '회의가 끝난 후 아이디어가 정리되지 않고 다음 행동으로 이어지지 않는다.',
    targetUsers: ['대학생 프로젝트팀', '공모전 준비팀', '초기 창업팀'],
    solution: 'AI가 대화 내용을 분석해 아이디어, 키워드, 마인드맵, MVP 계획을 자동 생성한다.',
    keywords: ['AI', '회의 정리', '아이디어', '마인드맵', '프로젝트 관리'],
    coreFeatures: [
      '회의·채팅 텍스트 입력',
      '아이디어 자동 추출',
      '마인드맵 생성',
      '조건 기반 아이디어 추천',
      'MVP 계획 생성',
      '발표 자료 생성',
    ],
  },
  {
    id: 'idea-002',
    title: 'AI 팀원 역할 추천 서비스',
    summary: '팀원의 경험과 기술을 분석해 프로젝트 역할을 추천하는 서비스',
    problem: '프로젝트 초기에 역할을 공정하고 효율적으로 나누기 어렵다.',
    targetUsers: ['대학생 팀', '동아리', '해커톤 참가자'],
    solution: '팀원의 기술, 경험, 선호 업무를 바탕으로 역할과 작업 일정을 추천한다.',
    keywords: ['팀 빌딩', '역할 분담', 'AI 추천', '일정 관리'],
    coreFeatures: ['팀원 정보 입력', '역할 자동 추천', '업무 분배', '주차별 일정 생성'],
  },
  {
    id: 'idea-003',
    title: '공모전 맞춤 아이디어 추천 서비스',
    summary: '공모전 조건에 맞는 아이디어를 추천하고 평가해주는 서비스',
    problem: '공모전 주제와 평가 기준에 적합한 아이디어를 선정하기 어렵다.',
    targetUsers: ['공모전 참가자', '대학생', '예비 창업자'],
    solution: '공모전 주제, 기간, 인원, 평가 기준을 분석해 적합한 아이디어를 추천한다.',
    keywords: ['공모전', '아이디어 추천', '적합도 평가', 'AI 코치'],
    coreFeatures: ['공모전 조건 입력', '추천 키워드 생성', '아이디어 조합', '아이디어 적합도 비교'],
  },
];

export const sampleSelectedIdeaId = 'idea-001';

export const sampleSimpleMvpPlan: SampleMvpPlan = {
  essentialFeatures: ['텍스트 입력', '아이디어 자동 추출', '아이디어 저장', '조건 기반 추천', 'MVP 계획 생성'],
  laterFeatures: ['카카오톡 캡처 OCR', '마인드맵 고도화', '익명 스와이프 평가', '문서 다운로드'],
  screens: ['홈 화면', '대화 입력 화면', '아이디어 목록 화면', '아이디어 비교 화면', 'MVP 결과 화면', '발표 자료 화면'],
  schedule: [
    '1주차: 화면 구조 및 공통 데이터 설계',
    '2주차: 아이디어 추출 기능',
    '3주차: 조건 기반 추천 기능',
    '4주차: MVP 및 발표 자료 생성',
    '5주차: 기능 연결 및 테스트',
    '6주차: 오류 수정 및 발표 준비',
  ],
  requiredApis: ['생성형 AI API', '이미지 텍스트 추출 API'],
};
