import AsyncStorage from '@react-native-async-storage/async-storage';
import { FunctionsHttpError } from '@supabase/supabase-js';
import { Alert } from 'react-native';
import { supabase } from '@/lib/supabase';
import { notifyWattBalanceChanged } from '@/hooks/use-watt';

export type WattDailyConsent = 'unset' | 'allow' | 'off' | 'blocked';

const pendingRequests = new Map<string, string>();
const dailyDecisions = new Map<string, WattDailyConsent>();
const dailyReads = new Map<string, Promise<WattDailyConsent>>();
const dailyPrompts = new Map<string, Promise<WattDailyConsent>>();
const dailyListeners = new Set<() => void>();
const consentStoragePrefix = 'watt.ai-daily-consent.v2:';
type ConsentPresenter = (units: number) => Promise<boolean>;
let consentPresenter: ConsentPresenter | null = null;

export function wattKoreaDay() {
  return new Date(Date.now() + 9 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

function decisionKey(userId: string) {
  return `${userId}:${wattKoreaDay()}`;
}

export function registerWattConsentPresenter(presenter: ConsentPresenter) {
  consentPresenter = presenter;
  return () => { if (consentPresenter === presenter) consentPresenter = null; };
}

export function subscribeWattDailyConsent(listener: () => void) {
  dailyListeners.add(listener);
  return () => { dailyListeners.delete(listener); };
}

export async function getWattDailyConsent(userId: string): Promise<WattDailyConsent> {
  if (!userId) return 'unset';
  const day = wattKoreaDay();
  const key = `${userId}:${day}`;
  const cached = dailyDecisions.get(key);
  if (cached) return cached;
  const pending = dailyReads.get(key);
  if (pending) return pending;
  const read = (async () => {
    const stored = await AsyncStorage.getItem(`${consentStoragePrefix}${userId}`).catch(() => null);
    if (day !== wattKoreaDay()) return getWattDailyConsent(userId);
    const value = stored?.startsWith(`${day}:`) ? stored.slice(11) : '';
    const decision: WattDailyConsent = value === 'allow' || value === 'off' || value === 'blocked' ? value : 'unset';
    if (!dailyDecisions.has(key)) dailyDecisions.set(key, decision);
    return dailyDecisions.get(key)!;
  })();
  dailyReads.set(key, read);
  try { return await read; }
  finally { dailyReads.delete(key); }
}

async function saveDailyConsent(userId: string, decision: WattDailyConsent) {
  const day = wattKoreaDay();
  await AsyncStorage.setItem(`${consentStoragePrefix}${userId}`, `${day}:${decision}`);
  dailyDecisions.set(`${userId}:${day}`, decision);
  dailyListeners.forEach(listener => listener());
}

export async function setWattDailyAutoCharge(userId: string, enabled: boolean) {
  const current = await getWattDailyConsent(userId);
  if (current === 'blocked' && !enabled) return current;
  const next = enabled ? 'allow' : 'off';
  await saveDailyConsent(userId, next);
  return next;
}

function requestId() {
  if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID();
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, char => {
    const n = Math.floor(Math.random() * 16);
    return (char === 'x' ? n : (n & 3) | 8).toString(16);
  });
}

function confirmUnits(units: number): Promise<boolean> {
  if (consentPresenter) return consentPresenter(units);
  return new Promise(resolve => Alert.alert('오늘 무료 AI 사용량을 다 썼어요',
    `이번 작업을 계속하면 AI ${units}단위가 차감돼요.\n\n사용하면 오늘 자정까지 다시 묻지 않고, 텍스트 AI 작업마다 필요한 단위를 차감해요. 취소하면 AI 작업이 일시 중지돼요. 요금제에서 자동 차감을 켜면 다시 사용할 수 있어요.`, [
      { text: '취소', style: 'cancel', onPress: () => resolve(false) },
      { text: '사용', onPress: () => resolve(true) },
    ], { cancelable: false }));
}

async function confirmDailyUnits(userId: string, units: number): Promise<WattDailyConsent> {
  if (!userId) return (await confirmUnits(units)) ? 'allow' : 'blocked';
  const key = decisionKey(userId);
  const current = await getWattDailyConsent(userId);
  if (current !== 'unset') return current;
  const pending = dailyPrompts.get(key);
  if (pending) return pending;
  const prompt = (async () => {
    const decision = (await confirmUnits(units)) ? 'allow' : 'blocked';
    try { await saveDailyConsent(userId, decision); }
    catch {
      dailyDecisions.set(key, decision);
      dailyListeners.forEach(listener => listener());
    }
    return decision;
  })();
  dailyPrompts.set(key, prompt);
  try { return await prompt; }
  finally { dailyPrompts.delete(key); }
}

function policyError<T>(code: string, message: string) {
  const response = new Response(JSON.stringify({ error: code, message }), {
    status: 403, headers: { 'Content-Type': 'application/json' },
  });
  return { data: null as T | null, error: new FunctionsHttpError(response) };
}

/** The server still authorizes every request and its exact cost. This only remembers today's UI choice. */
export async function invokeWattAi<T = any>(name: string, options: { body: NonNullable<Parameters<typeof supabase.functions.invoke>[1]>['body']; headers?: Record<string, string> }) {
  const { data: sessionData } = await supabase.auth.getSession();
  const userId = sessionData.session?.user.id ?? '';
  const current = await getWattDailyConsent(userId);
  if (current === 'blocked') {
    return policyError<T>('daily_ai_blocked', 'AI 작업이 일시 중지됐어요. 요금제에서 AI 단위 자동 차감을 켜면 다시 사용할 수 있어요.');
  }

  const key = JSON.stringify([name, options.body, options.headers?.Authorization]);
  const id = pendingRequests.get(key) ?? requestId();
  pendingRequests.set(key, id);
  const invoke = (consent?: number) => supabase.functions.invoke<T>(name, {
    body: options.body, headers: { ...options.headers, 'x-watt-request-id': id, ...(consent ? { 'x-watt-consent': String(consent) } : {}) },
  });
  const first = await invoke();
  if (!first.error) notifyWattBalanceChanged();
  if (!first.error) { pendingRequests.delete(key); return first; }
  let response: { error?: string; units?: number } | null = null;
  try { response = await (first.error.context as Response)?.clone().json(); } catch { /* Preserve the original error. */ }
  if (response?.error !== 'consent_required' || !Number.isInteger(response.units) || !response.units || response.units < 1) {
    notifyWattBalanceChanged();
    if ((first.error.context as Response)?.status === 502 || response?.error === 'request_already_finished') pendingRequests.delete(key);
    return first;
  }

  const decision = await confirmDailyUnits(userId, response.units);
  const latestDecision = userId ? await getWattDailyConsent(userId) : decision;
  if (latestDecision !== 'allow') {
    pendingRequests.delete(key);
    return latestDecision === 'blocked'
      ? policyError<T>('daily_ai_blocked', 'AI 작업이 일시 중지됐어요. 요금제에서 AI 단위 자동 차감을 켜면 다시 사용할 수 있어요.')
      : policyError<T>('daily_auto_charge_off', '하루 무료 사용량을 모두 썼습니다. 요금제에서 오늘의 AI 단위 자동 차감을 켜면 계속 이용할 수 있습니다.');
  }
  const accepted = await invoke(response.units);
  notifyWattBalanceChanged();
  if (!accepted.error || (accepted.error.context as Response)?.status === 502) pendingRequests.delete(key);
  return accepted;
}
