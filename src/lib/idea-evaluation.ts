import type { Idea } from '@/types/idea';
import type { FinalIdeaAnalysisResult, FinalAnalysisLevel } from '@/types/final-analysis';
import type {
  BlindIdeaAiAnalysis,
  IdeaAnalysis,
  IdeaEvaluation,
  IdeaResultForComparison,
} from '@/types/idea-evaluation';
import type { IdeaResult, IdeaResultData } from '@/types/result';

function anonymousLabel(index: number) {
  return `익명 아이디어 ${index + 1}`;
}

function shortText(value: string, fallback: string) {
  const cleaned = value.trim();
  return cleaned || fallback;
}

const maxBlindAnalysisLength = 40;

/** Keeps AI card copy compact even if a provider ignores the requested style. */
export function formatBlindAnalysisText(value: string, fallback: string) {
  const firstSentence = shortText(value, fallback)
    .replace(/^[•*\-]\s*/, '')
    .replace(/\s+/g, ' ')
    .split(/[.!?。！？\r\n]/, 1)[0]
    .trim()
    .replace(/할 수 있습니다$/u, '할 수 있음')
    .replace(/될 수 있습니다$/u, '될 수 있음')
    .replace(/필요합니다$/u, '필요함')
    .replace(/어렵습니다$/u, '어려움')
    .replace(/높습니다$/u, '높음')
    .replace(/낮습니다$/u, '낮음')
    .replace(/있습니다$/u, '있음')
    .replace(/없습니다$/u, '없음')
    .replace(/됩니다$/u, '됨')
    .replace(/합니다$/u, '함')
    .replace(/입니다$/u, '임');

  if (firstSentence.length <= maxBlindAnalysisLength) return firstSentence;

  const clipped = firstSentence.slice(0, maxBlindAnalysisLength + 1);
  const lastSpace = clipped.lastIndexOf(' ');
  return clipped.slice(0, lastSpace >= 24 ? lastSpace : maxBlindAnalysisLength).trim();
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
        formatBlindAnalysisText(ai?.advantages[0] ?? '', '문제 해결 효과를 확인하기 쉬움'),
        formatBlindAnalysisText(ai?.advantages[1] ?? '', '사용자에게 줄 가치가 분명함'),
      ],
      risk: formatBlindAnalysisText(ai?.risk ?? '', '실제 사용자 수요 검증이 필요함'),
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

function analysisLevelScore(level: FinalAnalysisLevel | undefined) {
  if (level === '높음') return 2;
  if (level === '보통') return 1;
  return 0;
}

export type IdeaResultSortMode = 'ai' | 'team';

export function sortIdeaResults(ideas: IdeaResult[], mode: IdeaResultSortMode) {
  return [...ideas].sort((left, right) => {
    const aiRankDifference =
      (left.aiRank ?? Number.MAX_SAFE_INTEGER) - (right.aiRank ?? Number.MAX_SAFE_INTEGER);

    if (mode === 'team') {
      return right.passRate - left.passRate
        || right.passCount - left.passCount
        || aiRankDifference
        || left.label.localeCompare(right.label, 'ko');
    }

    return aiRankDifference
      || right.passRate - left.passRate
      || right.passCount - left.passCount
      || left.label.localeCompare(right.label, 'ko');
  });
}

function getVisibleRecommendationReason(
  results: IdeaResultForComparison[],
  recommendation?: FinalIdeaAnalysisResult | null,
) {
  let reason = recommendation?.overall.recommendationReason.trim() ?? '';
  if (!reason || !recommendation) return reason;

  const labelsById = new Map(results.map((result) => [
    result.ideaId,
    result.anonymousLabel.replace(/^익명 /, ''),
  ]));
  const titledAnalyses = [...recommendation.analyses]
    .filter((analysis) => analysis.title.trim())
    .sort((left, right) => right.title.length - left.title.length);

  titledAnalyses.forEach((analysis) => {
    const label = labelsById.get(analysis.ideaId);
    if (label) reason = reason.split(analysis.title.trim()).join(label);
  });

  return reason;
}

/** Joins locked team votes with the same anonymous AI analysis shown while swiping. */
export function createIdeaResultData(
  results: IdeaResultForComparison[],
  recommendation?: FinalIdeaAnalysisResult | null,
  ideas: Pick<Idea, 'id' | 'title' | 'summary' | 'content'>[] = [],
): IdeaResultData {
  const resultIds = new Set(results.map((result) => result.ideaId));
  const recommendedIds = (recommendation?.overall.recommendedIdeaIds ?? [])
    .filter((ideaId, index, values) => resultIds.has(ideaId) && values.indexOf(ideaId) === index);
  const analysisById = new Map(
    recommendation?.analyses.map((analysis) => [analysis.ideaId, analysis]) ?? [],
  );
  const ideaById = new Map(ideas.map((idea) => [idea.id, idea]));
  const remainingIds = results
    .map((result) => result.ideaId)
    .filter((ideaId) => !recommendedIds.includes(ideaId))
    .sort((leftId, rightId) => {
      const left = analysisById.get(leftId);
      const right = analysisById.get(rightId);
      const scoreDifference =
        analysisLevelScore(right?.projectFit) + analysisLevelScore(right?.feasibility)
        - analysisLevelScore(left?.projectFit) - analysisLevelScore(left?.feasibility);
      return scoreDifference || results.findIndex((result) => result.ideaId === leftId)
        - results.findIndex((result) => result.ideaId === rightId);
    });
  const rankById = recommendation
    ? new Map([...recommendedIds, ...remainingIds].map((ideaId, index) => [ideaId, index + 1]))
    : new Map<string, number>();

  return {
    currentParticipantCount: results[0]?.currentParticipantCount ?? 0,
    aiRecommendationReason: getVisibleRecommendationReason(results, recommendation),
    ideas: results.map((result, index) => {
      const sourceIdea = ideaById.get(result.ideaId);
      return {
        id: result.ideaId,
        number: index + 1,
        label: sourceIdea?.title.trim() || result.anonymousLabel.replace(/^익명 /, ''),
        summary: sourceIdea?.summary.trim() || sourceIdea?.content.trim() || '',
        passCount: result.pickCount,
        participantCount: result.participantCount,
        passRate: result.passRate,
        aiRank: rankById.get(result.ideaId) ?? null,
        aiAdvantages: result.aiAdvantages,
        aiRisk: result.aiRisk,
        difficulty: result.difficulty,
      };
    }),
  };
}
