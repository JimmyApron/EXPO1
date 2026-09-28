import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

import {
  allowedDeepSeekModels,
  defaultDeepSeekModel,
  resolveDeepSeekModel,
  withDeepSeekToolInstruction,
} from '../supabase/functions/_shared/deepseek.ts';

const deepSeekOnlyFunctionFiles = [
  'analyze-final-ideas',
  'analyze-idea-draft',
  'generate-mvp',
  'generate-presentation',
].map((name) => new URL(`../supabase/functions/${name}/index.ts`, import.meta.url));
const extractionFunctionFile = new URL('../supabase/functions/extract-candidate-ideas/index.ts', import.meta.url);

test('only the approved DeepSeek V4 models can be resolved', () => {
  assert.deepEqual(allowedDeepSeekModels, ['deepseek-v4-flash', 'deepseek-v4-pro']);
  assert.equal(defaultDeepSeekModel, 'deepseek-v4-flash');
  assert.equal(resolveDeepSeekModel(undefined), 'deepseek-v4-flash');
  assert.equal(resolveDeepSeekModel('deepseek-v4-flash'), 'deepseek-v4-flash');
  assert.equal(resolveDeepSeekModel('deepseek-v4-pro'), 'deepseek-v4-pro');
  assert.equal(resolveDeepSeekModel('deepseek-chat'), null);
  assert.equal(resolveDeepSeekModel('deepseek-reasoner'), null);
  assert.equal(resolveDeepSeekModel('deepseek-v4-flash-free'), null);
});

test('DeepSeek structured output requests are configured for their response flow', async () => {
  const sources = await Promise.all(deepSeekOnlyFunctionFiles.map((file) => readFile(file, 'utf8')));
  const extractionSource = await readFile(extractionFunctionFile, 'utf8');
  const [finalAnalysisSource, draftAnalysisSource, mvpSource, presentationSource] = sources;

  assert.match(
    withDeepSeekToolInstruction('기본 지침', 'record_result'),
    /반드시 record_result 도구를 호출/,
  );
  sources.forEach((source) => {
    assert.match(source, /withDeepSeekToolInstruction\(systemInstruction,/);
  });
  assert.match(finalAnalysisSource, /thinking:\s*\{\s*type:\s*'disabled'\s*\}/);
  assert.match(draftAnalysisSource, /thinking:\s*\{\s*type:\s*'disabled'\s*\}/);
  assert.match(presentationSource, /thinking:\s*\{\s*type:\s*'disabled'\s*\}/);
  assert.match(finalAnalysisSource, /tool_choice:\s*\{\s*type:\s*'tool'/);
  assert.match(draftAnalysisSource, /tool_choice:\s*\{\s*type:\s*'tool'/);
  assert.match(mvpSource, /tool_choice:\s*\{\s*type:\s*'tool'/);
  assert.match(mvpSource, /thinking:\s*\{\s*type:\s*'disabled'\s*\}/);
  assert.doesNotMatch(presentationSource, /tool_choice/);
  assert.match(extractionSource, /withDeepSeekToolInstruction\(systemInstruction, toolName\)/);
  assert.match(extractionSource, /usesClaudeVision \? \{ tool_choice:/);
});

test('AI requests keep model options at provider defaults', async () => {
  const sources = await Promise.all(deepSeekOnlyFunctionFiles.map((file) => readFile(file, 'utf8')));
  const extractionSource = await readFile(extractionFunctionFile, 'utf8');
  const combinedSource = sources.join('\n');

  assert.doesNotMatch(`${combinedSource}\n${extractionSource}`, /reasoning_effort|output_config/);
  assert.doesNotMatch(combinedSource, /api\.anthropic\.com|ANTHROPIC_API_KEY|CLAUDE_API_KEY|ANTHROPIC_MODEL/);
  assert.doesNotMatch(combinedSource, /^\s*(?:minItems|maxItems)\s*:/m);
  [...sources, extractionSource].forEach((source) => {
    assert.match(source, /resolveDeepSeekModel\(Deno\.env\.get\('DEEPSEEK_MODEL'\)\)/);
    assert.match(source, /Deno\.env\.get\('DEEPSEEK_API_KEY'\)/);
  });
});

test('Claude is isolated to image extraction', async () => {
  const sources = await Promise.all(deepSeekOnlyFunctionFiles.map((file) => readFile(file, 'utf8')));
  const extractionSource = await readFile(extractionFunctionFile, 'utf8');

  sources.forEach((source) => {
    assert.doesNotMatch(source, /api\.anthropic\.com|ANTHROPIC_API_KEY|CLAUDE_API_KEY|ANTHROPIC_MODEL/);
  });
  assert.match(extractionSource, /const usesClaudeVision = source\.type === 'image'/);
  assert.match(extractionSource, /Deno\.env\.get\('ANTHROPIC_API_KEY'\)/);
  assert.match(extractionSource, /https:\/\/api\.anthropic\.com\/v1\/messages/);
  assert.match(extractionSource, /usesClaudeVision \? claudeMessagesUrl : deepSeekMessagesUrl/);
});

test('blind AI analysis prioritizes the problem-solution mechanism over writing quality', async () => {
  const draftAnalysisSource = await readFile(
    new URL('../supabase/functions/analyze-idea-draft/index.ts', import.meta.url),
    'utf8',
  );
  const blindHookSource = await readFile(
    new URL('../src/hooks/use-blind-idea-analysis.ts', import.meta.url),
    'utf8',
  );

  assert.match(draftAnalysisSource, /익명 평가 카드의 'AI 장점'과 'AI 리스크'에 바로 표시됩니다/);
  assert.match(draftAnalysisSource, /기능을 다시 설명하지 말고 문제와 해결 방식이 맞물려 생기는 효과/);
  assert.match(draftAnalysisSource, /공백 포함 40자 이내의 음슴체/);
  assert.match(draftAnalysisSource, /대응책, 검증 방법, 부연 설명을 이어 붙이지 마세요/);
  assert.match(draftAnalysisSource, /blindResponseSchema/);
  assert.match(draftAnalysisSource, /isBlindAnalysis \? blindResponseSchema : draftResponseSchema/);
  assert.match(draftAnalysisSource, /strengths\.length === 2/);
  assert.match(draftAnalysisSource, /improvements\.length === 1/);
  assert.match(blindHookSource, /analysisMode: 'problem_solution'/);
  assert.match(blindHookSource, /promptVersion: blindAnalysisPromptVersion/);
  assert.doesNotMatch(blindHookSource, /updatedAt:\s*idea\.updatedat/);
  for (const field of ['problem', 'solution', 'targetUsers', 'coreFeatures']) {
    assert.match(blindHookSource, new RegExp(`${field}: idea\\.`));
  }
});
