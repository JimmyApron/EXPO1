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
  const [finalAnalysisSource, ...otherSources] = sources;

  assert.match(
    withDeepSeekToolInstruction('기본 지침', 'record_result'),
    /반드시 record_result 도구를 호출/,
  );
  sources.forEach((source) => {
    assert.match(source, /withDeepSeekToolInstruction\(systemInstruction,/);
  });
  assert.match(finalAnalysisSource, /thinking:\s*\{\s*type:\s*'disabled'\s*\}/);
  assert.match(otherSources.at(-1), /thinking:\s*\{\s*type:\s*'disabled'\s*\}/);
  assert.match(finalAnalysisSource, /tool_choice:\s*\{\s*type:\s*'tool'/);
  otherSources.forEach((source) => assert.doesNotMatch(source, /tool_choice/));
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
