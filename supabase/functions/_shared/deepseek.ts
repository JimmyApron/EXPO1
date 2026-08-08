export const deepSeekMessagesUrl = 'https://api.deepseek.com/anthropic/v1/messages';
export const anthropicApiVersion = '2023-06-01';

export const allowedDeepSeekModels = ['deepseek-v4-flash', 'deepseek-v4-pro'] as const;
export type DeepSeekModel = (typeof allowedDeepSeekModels)[number];

export const defaultDeepSeekModel: DeepSeekModel = 'deepseek-v4-flash';

export function resolveDeepSeekModel(value: string | undefined): DeepSeekModel | null {
  const model = value?.trim() || defaultDeepSeekModel;
  return allowedDeepSeekModels.find((allowedModel) => allowedModel === model) ?? null;
}

export function withDeepSeekToolInstruction(instruction: string, toolName: string) {
  return `${instruction}\n\n응답은 반드시 ${toolName} 도구를 호출하여 반환하세요. 일반 텍스트로 답하지 마세요.`;
}
