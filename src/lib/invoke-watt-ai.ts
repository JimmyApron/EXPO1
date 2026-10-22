import { Alert, Platform } from 'react-native';
import { supabase } from '@/lib/supabase';

const pendingRequests = new Map<string, string>();

function requestId() {
  if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID();
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, char => {
    const n = Math.floor(Math.random() * 16);
    return (char === 'x' ? n : (n & 3) | 8).toString(16);
  });
}

function confirmUnits(units: number): Promise<boolean> {
  const message = `오늘의 무료 AI 호출 한도를 사용했습니다. 이 작업에 AI ${units}단위를 차감할까요?`;
  if (Platform.OS === 'web') return Promise.resolve(globalThis.confirm(message));
  return new Promise(resolve => Alert.alert('AI 단위 사용 확인', message, [
    { text: '취소', style: 'cancel', onPress: () => resolve(false) },
    { text: `${units}단위 사용`, onPress: () => resolve(true) },
  ], { cancelable: false }));
}

/** Consent is scoped to this request ID and identical request body. */
export async function invokeWattAi<T = any>(name: string, options: { body: NonNullable<Parameters<typeof supabase.functions.invoke>[1]>['body']; headers?: Record<string, string> }) {
  const key = JSON.stringify([name, options.body, options.headers?.Authorization]);
  const id = pendingRequests.get(key) ?? requestId();
  pendingRequests.set(key, id);
  const invoke = (consent?: number) => supabase.functions.invoke<T>(name, {
    body: options.body, headers: { ...options.headers, 'x-watt-request-id': id, ...(consent ? { 'x-watt-consent': String(consent) } : {}) },
  });
  const first = await invoke();
  if (!first.error) { pendingRequests.delete(key); return first; }
  let response: { error?: string; units?: number } | null = null;
  try { response = await (first.error.context as Response)?.clone().json(); } catch { /* Preserve the original error. */ }
  if (response?.error !== 'consent_required' || !Number.isInteger(response.units) || !response.units || response.units < 1) {
    if ((first.error.context as Response)?.status === 502 || response?.error === 'request_already_finished') pendingRequests.delete(key);
    return first;
  }
  if (!await confirmUnits(response.units)) { pendingRequests.delete(key); return first; }
  const accepted = await invoke(response.units);
  if (!accepted.error || (accepted.error.context as Response)?.status === 502) pendingRequests.delete(key);
  return accepted;
}
