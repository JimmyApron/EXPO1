import type { Idea } from '@/types/idea';
import type {
  BlindIdeaAiAnalysis,
  IdeaAnalysis,
  IdeaEvaluation,
  IdeaResultForComparison,
} from '@/types/idea-evaluation';

function anonymousLabel(index: number) {
  return `익명 아이디어 ${String.fromCharCode(65 + index)}`;
}

function shortText(value: string, fallback: string) {
  const cleaned = value.trim();
  return cleaned || fallback;
}

/**
 * Converts project ideas into the deliberately limited data contract used by
 * the blind-evaluation UI. No author, title, likes, recommendations, or team
 * voting data is included here.
 */
export function createBlindIdeaAnalyses(
  ideas: Idea[],
  aiAnalyses: BlindIdeaAiAnalysis[] = [],
): IdeaAnalysis[] {
  return ideas.map((idea, index) => {
    const ai = aiAnalyses.find((analysis) => analysis.ideaId === idea.id);

    return {
      id: idea.id,
      anonymousLabel: anonymousLabel(index),
      problem: shortText(idea.problem, '해결하려는 문제를 구체화하는 단계입니다.'),
      solution: shortText(idea.solution, shortText(idea.summary, '핵심 해결 방식을 검토 중입니다.')),
      advantages: [
        ai?.advantages[0] ?? '문제를 빠르게 해결할 수 있는 방향입니다.',
        ai?.advantages[1] ?? '사용자가 이해하고 활용하기 쉬운 방식입니다.',
      ],
      risk: ai?.risk ?? '실제 사용자 검증과 운영 방식 확인이 필요합니다.',
      difficulty: ai?.difficulty ?? '보통',
    };
  });
}

export function calculateIdeaResults(
  analyses: IdeaAnalysis[],
  evaluations: IdeaEvaluation[],
  currentParticipantCount: number,
): IdeaResultForComparison[] {
  return analyses.map((analysis) => {
    const votes = evaluations.filter((evaluation) => evaluation.ideaId === analysis.id);
    const participantCount = new Set(votes.map((evaluation) => evaluation.userId)).size;
    const pickCount = votes.filter((evaluation) => evaluation.choice === 'pick').length;

    return {
      currentParticipantCount,
      ideaId: analysis.id,
      anonymousLabel: analysis.anonymousLabel,
      pickCount,
      participantCount,
      passRate: participantCount === 0 ? 0 : Math.round((pickCount / participantCount) * 100),
      aiAdvantages: analysis.advantages,
      aiRisk: analysis.risk,
      difficulty: analysis.difficulty,
    };
  });
}
