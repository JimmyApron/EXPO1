export type EvaluationProgressRow = {
  userid: string;
  ideaid: string;
};

export function completedEvaluatorIds(rows: EvaluationProgressRow[], requiredIdeaIds: string[]) {
  if (requiredIdeaIds.length === 0) return new Set<string>();
  const required = new Set(requiredIdeaIds);
  const evaluatedByUser = new Map<string, Set<string>>();
  rows.forEach((row) => {
    if (!required.has(row.ideaid)) return;
    const evaluated = evaluatedByUser.get(row.userid) ?? new Set<string>();
    evaluated.add(row.ideaid);
    evaluatedByUser.set(row.userid, evaluated);
  });
  return new Set(
    [...evaluatedByUser.entries()]
      .filter(([, evaluated]) => evaluated.size === required.size)
      .map(([userId]) => userId),
  );
}
