import { useMemo } from 'react';

import type { FinalIdeaAnalysisResult } from '@/types/final-analysis';
import type { Idea } from '@/types/idea';
import type { IdeaResultData, MvpSummary } from '@/types/result';

const defaultMvpSummary: MvpSummary = {
  core: '사용자의 불편 상황을 빠르게 입력받고 해결 아이디어를 추천하는 MVP',
  essentialFeatures: ['문제 상황 입력', '아이디어 후보 표시', '스와이프 평가', '중간 결과 확인', '최종 아이디어 선정'],
  laterFeatures: ['실시간 데이터 연동', 'AI 분석 고도화', '발표 자료 자동 생성'],
  schedule: ['1주차: 화면 구조 설계', '2주차: 평가 기능 구현', '3주차: 결과 카드 구현', '4주차: MVP 요약 연결', '5주차: 테스트 및 오류 수정', '6주차: 발표 준비'],
  requiredApis: ['생성형 AI API', 'Supabase API'],
};

export const sampleResultData: IdeaResultData = {
  currentParticipantCount: 3,
  teamSize: 4,
  currentUserEvaluatedAll: true,
  currentUserRole: 'leader',
  ideas: [
    { id: 'idea-a', title: '아이디어 A', passCount: 2, participantCount: 3, passRate: 67, aiRank: 1, aiStrength: '대기 문제를 직접 해결', aiRisk: '실시간 데이터 연동 필요', difficulty: '보통', mvpSummary: defaultMvpSummary },
    { id: 'idea-b', title: '아이디어 B', passCount: 1, participantCount: 3, passRate: 33, aiRank: 2, aiStrength: '사용자 접근성이 좋음', aiRisk: '차별화 요소가 약할 수 있음', difficulty: '쉬움', mvpSummary: { ...defaultMvpSummary, core: '간단한 입력과 결과 확인을 중심으로 빠르게 구현 가능한 MVP', essentialFeatures: ['아이디어 입력', '후보 목록 표시', '평가 기능', '결과 요약'], laterFeatures: ['디자인 고도화', 'AI 추천 정확도 개선'], schedule: ['1주차: 기본 화면 구현', '2주차: 평가 기능 구현', '3주차: 결과 화면 구현', '4주차: 테스트'], requiredApis: ['Supabase API'] } },
  ],
};

type UseIdeaResultsOptions = {
  ideas: Idea[];
  analysis: FinalIdeaAnalysisResult | null;
  currentUserEvaluatedAll: boolean;
  teamSize: number;
};

export function useIdeaResults({ ideas, analysis, currentUserEvaluatedAll, teamSize }: UseIdeaResultsOptions) {
  const data = useMemo<IdeaResultData>(() => {
    const participants = Math.min(Math.max(1, sampleResultData.currentParticipantCount), Math.max(1, teamSize));
    const recommendedIds = analysis?.overall.recommendedIdeaIds ?? [];
    const analysisById = new Map(analysis?.analyses.map((item) => [item.ideaId, item]) ?? []);
    const resultIdeas = ideas.map((idea, index) => {
      const ai = analysisById.get(idea.id);
      const recommendedIndex = recommendedIds.indexOf(idea.id);
      const rank = recommendedIndex >= 0 ? recommendedIndex + 1 : recommendedIds.length + index + 1;
      const passCount = Math.max(0, participants - index);
      return {
        id: idea.id,
        title: idea.title,
        passCount,
        participantCount: participants,
        passRate: Math.round((passCount / participants) * 100),
        aiRank: rank,
        aiStrength: ai?.strengths[0] ?? sampleResultData.ideas[index % sampleResultData.ideas.length].aiStrength,
        aiRisk: ai?.risks?.[0] ?? ai?.improvements[0] ?? sampleResultData.ideas[index % sampleResultData.ideas.length].aiRisk,
        difficulty: ai?.feasibility ?? sampleResultData.ideas[index % sampleResultData.ideas.length].difficulty,
        mvpSummary: { ...defaultMvpSummary, core: idea.summary || idea.content || defaultMvpSummary.core },
      };
    });
    return { currentParticipantCount: participants, teamSize, currentUserEvaluatedAll, currentUserRole: 'leader', ideas: resultIdeas };
  }, [analysis, currentUserEvaluatedAll, ideas, teamSize]);

  return { data };
}
