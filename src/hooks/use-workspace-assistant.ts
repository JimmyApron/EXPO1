import { useRef, useState } from 'react';
import { supabase } from '@/lib/supabase';

export type WorkspaceAiTask = 'topics' | 'resource' | 'compare' | 'outline' | 'polish' | 'expand' | 'shorten' | 'continue' | 'tone' | 'dialogue' | 'feedback' | 'presentation';
export type WorkspaceAiResult = { text: string; suggestions: { title: string; text: string; original: string; reason: string; kind: string }[]; outline: { title: string; guidance: string }[]; slides: { title: string; content: string; script: string }[]; qna: string };

/** Removes only complete bold markers from plain-text AI responses. */
function cleanAiResponseText(value: string) {
  return value.replace(/(^|[^*])\*\*([^*\n]+?)\*\*(?!\*)/g, '$1$2');
}

function cleanAiResult(data: WorkspaceAiResult): WorkspaceAiResult {
  return {
    text: cleanAiResponseText(data.text),
    suggestions: data.suggestions.map(item => ({ ...item, title: cleanAiResponseText(item.title), text: cleanAiResponseText(item.text), reason: cleanAiResponseText(item.reason) })),
    outline: data.outline.map(item => ({ title: cleanAiResponseText(item.title), guidance: cleanAiResponseText(item.guidance) })),
    slides: data.slides.map(item => ({ title: cleanAiResponseText(item.title), content: cleanAiResponseText(item.content), script: cleanAiResponseText(item.script) })),
    qna: cleanAiResponseText(data.qna),
  };
}

export function useWorkspaceAssistant(projectId: string) {
  const [busy, setBusy] = useState(false), [error, setError] = useState('');
  const running = useRef(false);
  async function request(task: WorkspaceAiTask, context: unknown): Promise<WorkspaceAiResult | null> {
    if (running.current) return null;
    running.current = true; setBusy(true); setError('');
    try {
      const { data, error: failure } = await supabase.functions.invoke('workspace-assistant', { body: { projectId, task, context } });
      if (failure) {
        let message = 'AI 요청에 실패했습니다. Edge Function 배포와 로그인 상태를 확인한 후 다시 시도해 주세요.';
        try { const result = await failure.context?.json(); if (typeof result?.message === 'string') message = result.message; } catch { /* Network errors have no response body. */ }
        setError(message); return null;
      }
      if (!data || typeof data.text !== 'string' || !Array.isArray(data.suggestions) || !Array.isArray(data.outline) || !Array.isArray(data.slides) || typeof data.qna !== 'string') { setError('AI 응답 형식을 확인할 수 없습니다.'); return null; }
      return cleanAiResult(data as WorkspaceAiResult);
    } catch { setError('네트워크 연결을 확인한 후 AI 요청을 다시 시도해 주세요.'); return null; }
    finally { running.current = false; setBusy(false); }
  }
  return { request, busy, error };
}
