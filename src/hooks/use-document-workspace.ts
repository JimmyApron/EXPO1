import AsyncStorage from '@react-native-async-storage/async-storage';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useAuth } from '@/hooks/use-auth';
import { useRealtimeRefresh } from '@/hooks/use-realtime-refresh';
import { emptyWorkspace, normalizeWorkspace } from '@/lib/document-workspace';
import { supabase } from '@/lib/supabase';
import type { DocumentWorkspace } from '@/types/document-workspace';
import type { ProjectTemplate } from '@/types/project';
import type { ProjectStageRecord } from './use-project-stage-progress';

export function useDocumentWorkspace(projectId: string, template: ProjectTemplate, title: string, records: ProjectStageRecord[]) {
  const { user } = useAuth();
  const enabled = template !== 'service_app';
  const [data, setData] = useState<DocumentWorkspace>(() => emptyWorkspace(title));
  const [loading, setLoading] = useState(enabled);
  const [status, setStatus] = useState('불러오는 중');
  const [error, setError] = useState('');
  const current = useRef(data);
  const revision = useRef(0);
  const saved = useRef('');
  const blocked = useRef(false);
  const ready = useRef(false);
  const flight = useRef<Promise<{ error?: string }> | null>(null);
  const key = `workspace-draft:${user?.id}:${projectId}:${template}`;
  const scope = useRef(key);
  const recordsRef = useRef(records);
  const titleRef = useRef(title);
  const draftFlight = useRef<Promise<unknown>>(Promise.resolve());
  useEffect(() => { recordsRef.current = records; titleRef.current = title; }, [records, title]);
  const writeDraft = useCallback((value: string | null) => {
    const operation = () => value === null ? AsyncStorage.removeItem(key) : AsyncStorage.setItem(key, value);
    const pending = draftFlight.current.catch(() => {}).then(operation);
    draftFlight.current = pending;
    return pending;
  }, [key]);

  const load = useCallback(async (discardDraft = false) => {
    if (!enabled || !user) { setLoading(false); return; }
    if (flight.current && !discardDraft) return;
    if (discardDraft && flight.current) await flight.current;
    const requestScope = key;
    const result = await supabase.from('project_workspaces').select('data, revision').eq('projectid', projectId).eq('template', template).maybeSingle();
    if (scope.current !== requestScope) return;
    if (flight.current && !discardDraft) return;
    if (result.error) { setError(`작업 공간을 불러오지 못했습니다. DB 마이그레이션 적용 여부를 확인해 주세요. ${result.error.message}`); setLoading(false); return; }
    const serverRevision = result.data?.revision ?? 0;
    // Our own autosave emits a realtime event. Avoid replacing the live editor
    // state with an identical server snapshot, which can disturb text input scroll.
    if (ready.current && serverRevision === revision.current && saved.current === JSON.stringify(current.current) && !discardDraft) return;
    const server = normalizeWorkspace(result.data?.data, titleRef.current);
    if (!result.data) {
      const legacy = await supabase.from('project_stage_progress').select('stageid, content').eq('projectid', projectId).eq('template', template);
      if (legacy.error) { setError('기존 단계 내용을 불러오지 못했습니다. 다시 시도해 주세요.'); setLoading(false); return; }
      server.legacyNotes = Object.fromEntries((legacy.data ?? recordsRef.current).filter(r => r.content).map(r => [r.stageid, r.content]));
      const oldBody = server.legacyNotes[template === 'report_research' ? 'result' : 'draft'];
      if (oldBody) server.freeBody = oldBody;
    }
    if (ready.current && current.current && saved.current !== JSON.stringify(current.current) && !discardDraft) {
      if (serverRevision !== revision.current) { blocked.current = true; setError('팀원 또는 다른 화면의 저장 내용이 변경되었습니다. 현재 초안은 기기에 보관됩니다. 초안을 내려받은 후 최신 내용을 불러와 주세요.'); }
      return;
    }
    let next = server;
    let local: string | null = null;
    if (!discardDraft) {
      try { local = await AsyncStorage.getItem(key); }
      catch { setError('기기 초안을 읽지 못했습니다. 서버의 저장 내용을 불러왔습니다.'); }
    }
    if (scope.current !== requestScope) return;
    if (ready.current && saved.current !== JSON.stringify(current.current) && !discardDraft) return;
    revision.current = serverRevision;
    saved.current = JSON.stringify(server);
    blocked.current = false;
    if (local) {
      try {
        const draft = JSON.parse(local);
        next = normalizeWorkspace(draft.data, titleRef.current);
        if (JSON.stringify(next) !== JSON.stringify(server) && draft.revision !== serverRevision) { blocked.current = true; setError('기기에 남은 초안과 서버 버전이 다릅니다. 초안을 내려받은 후 최신 내용을 불러와 주세요.'); }
      } catch { /* Invalid cached JSON must not hide the server document. */ }
    }
    if (discardDraft) { try { await writeDraft(null); setError(''); } catch { setError('서버 최신 내용을 불러왔지만 기기 초안을 정리하지 못했습니다.'); } }
    current.current = next; setData(next); ready.current = true; setLoading(false);
    setStatus(saved.current === JSON.stringify(next) ? '저장됨' : '기기 초안 복원됨');
  }, [enabled, key, projectId, template, user, writeDraft]);

  useEffect(() => {
    scope.current = key; ready.current = false; blocked.current = false;
    const timer = setTimeout(() => { setLoading(enabled); setError(''); void load().catch(() => { setError('작업 공간을 불러오지 못했습니다. 다시 시도해 주세요.'); setLoading(false); }); }, 0);
    return () => { clearTimeout(timer); scope.current = ''; };
  }, [enabled, key, load]);

  const update = useCallback((change: (value: DocumentWorkspace) => DocumentWorkspace) => {
    if (!ready.current) return;
    const next = change(current.current); current.current = next; setData(next); setStatus('저장 대기');
    void writeDraft(JSON.stringify({ revision: revision.current, data: next })).catch(() => setError('기기 초안을 보관하지 못했습니다. 저장 버튼으로 서버에 저장해 주세요.'));
  }, [writeDraft]);

  const save = useCallback(async (): Promise<{ error?: string }> => {
    if (!enabled) return {};
    while (flight.current) { const result = await flight.current; if (result.error) return result; }
    if (blocked.current) return { error: '저장 충돌이 있습니다. 초안을 보관한 후 최신 내용을 불러와 주세요.' };
    if (!ready.current) return { error: '작업 공간을 먼저 불러와 주세요.' };
    const payload = current.current, serialized = JSON.stringify(payload);
    if (saved.current === serialized && revision.current > 0) return {};
    setStatus('저장 중'); setError('');
    const requestScope = key;
    const pending = (async () => {
      try {
        const { data: row, error: failure } = await supabase.rpc('save_project_workspace', { p_projectid: projectId, p_template: template, p_revision: revision.current, p_data: payload }).single();
        if (scope.current !== requestScope) return {};
        if (failure) {
          if (failure.code === '40001') blocked.current = true;
          setError(failure.message); setStatus('저장 실패 · 기기 초안 보관'); return { error: failure.message };
        }
        if (!row || typeof row !== 'object' || !('revision' in row) || typeof row.revision !== 'number') {
          const message = '저장 응답을 확인하지 못했습니다. 서버 최신 내용을 확인해 주세요.';
          blocked.current = true; setError(message); setStatus('저장 확인 필요'); return { error: message };
        }
        revision.current = row.revision; saved.current = serialized;
        try {
          if (JSON.stringify(current.current) === serialized) { await writeDraft(null); setStatus('저장됨'); }
          else { await writeDraft(JSON.stringify({ revision: revision.current, data: current.current })); setStatus('저장 대기'); }
        } catch { setError('서버에 저장했습니다. 기기 초안 보관은 사용할 수 없습니다.'); setStatus('서버 저장됨'); }
        return {};
      } catch { const message = '네트워크 오류로 저장하지 못했습니다. 다시 저장해 주세요.'; setError(message); setStatus('저장 실패'); return { error: message }; }
      finally { flight.current = null; }
    })();
    flight.current = pending;
    return pending;
  }, [enabled, key, projectId, template, writeDraft]);

  useEffect(() => {
    if (loading || !enabled || !ready.current || saved.current === JSON.stringify(data)) return;
    const timer = setTimeout(() => void save(), 900);
    return () => clearTimeout(timer);
  }, [data, enabled, loading, save]);
  useRealtimeRefresh({ channelName: `document-workspace:${projectId}:${template}`, enabled: enabled && Boolean(user), onRefresh: load,
    tables: [{ table: 'project_workspaces', filter: `projectid=eq.${projectId}` }] });
  return { data, update, save, loading, status, error, reload: () => load(true) };
}
