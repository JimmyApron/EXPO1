import AsyncStorage from '@react-native-async-storage/async-storage';
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';

import { useAuth } from '@/hooks/use-auth';
import { useRealtimeRefresh } from '@/hooks/use-realtime-refresh';
import { enableDevicePush, disableDevicePush } from '@/lib/notification-push';
import { supabase } from '@/lib/supabase';
import type { AppNotification, NotificationKind } from '@/types/notification';

export type AppNotificationPreferences = {
  deadline: boolean;
  ideareview: boolean;
  finalselection: boolean;
  stalledidea: boolean;
  feedback: boolean;
  likesurge: boolean;
  team_evaluation: boolean;
  team_reminder: boolean;
  team_feedback: boolean;
  team_changes: boolean;
  team_room: boolean;
  push_enabled: boolean;
  deadlinedays: number;
  stalledideadays: number;
  likesurgethreshold: number;
  quiet_start: number;
  quiet_end: number;
  timezone: string;
};

const defaults: AppNotificationPreferences = {
  deadline: true, ideareview: true, finalselection: true, stalledidea: true,
  feedback: true, likesurge: true, team_evaluation: true, team_reminder: true,
  team_feedback: true, team_changes: true, team_room: true, push_enabled: false,
  deadlinedays: 3, stalledideadays: 3, likesurgethreshold: 3,
  quiet_start: 22, quiet_end: 8, timezone: 'Asia/Seoul',
};

type StoredLegacyState = {
  readIds?: string[];
  deletedIds?: string[];
  settings?: Partial<AppNotificationPreferences>;
};

type Row = {
  id: string; projectid: string | null; roomid: string | null; scope: 'personal' | 'team';
  kind: string; sourcekey: string; title: string; message: string; target: string;
  createdat: string; readat: string | null; dismissedat: string | null;
};

function legacyKey(sourcekey: string) {
  if (sourcekey.startsWith('deadline:')) return sourcekey.split(':').slice(0, 3).join(':');
  if (sourcekey.startsWith('review:')) return `ideareview:${sourcekey.split(':')[1]}`;
  if (sourcekey.startsWith('selection:')) return `finalselection:${sourcekey.split(':')[1]}`;
  if (sourcekey.startsWith('stalled:')) return `stalledidea:${sourcekey.split(':')[1]}`;
  if (sourcekey.startsWith('likes:')) return `likesurge:${sourcekey.split(':')[1]}:${sourcekey.split(':')[2]}:${sourcekey.split(':')[3]}`;
  return sourcekey;
}

type Value = {
  notifications: AppNotification[];
  unreadCount: number;
  isLoading: boolean;
  error: string;
  preferences: AppNotificationPreferences;
  updatePreferences: (patch: Partial<AppNotificationPreferences>) => Promise<void>;
  enablePush: () => Promise<string>;
  disablePush: () => Promise<void>;
  markAsRead: (id: string) => Promise<void>;
  markAllAsRead: () => Promise<void>;
  deleteNotification: (id: string) => Promise<void>;
  deleteAllNotifications: () => Promise<void>;
  refresh: () => Promise<void>;
};

const Context = createContext<Value | null>(null);

export function AppNotificationsProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [rows, setRows] = useState<Row[]>([]);
  const [preferences, setPreferences] = useState<AppNotificationPreferences>(defaults);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [tick, setTick] = useState(0);
  const requestSequence = useRef(0);

  useRealtimeRefresh({
    channelName: `inbox:${user?.id ?? 'signed-out'}`,
    enabled: Boolean(user),
    onRefresh: () => setTick((value) => value + 1),
    tables: [{ table: 'app_notifications', filter: `recipientid=eq.${user?.id}` }],
  });

  const refresh = useCallback(async () => {
    const requestId = ++requestSequence.current;
    if (!user) { setRows([]); setPreferences(defaults); setIsLoading(false); return; }
    setIsLoading(true);
    const [inbox, settings] = await Promise.all([
      supabase.from('app_notifications')
        .select('id,projectid,roomid,scope,kind,sourcekey,title,message,target,createdat,readat,dismissedat')
        .eq('recipientid', user.id).order('createdat', { ascending: false }).limit(100),
      supabase.from('notification_preferences').select('*').eq('userid', user.id).maybeSingle(),
    ]);
    if (requestId !== requestSequence.current) return;
    if (inbox.error || settings.error) {
      setError(inbox.error?.message ?? settings.error?.message ?? '알림을 불러오지 못했어요.');
      setIsLoading(false);
      return;
    }
    let nextRows = (inbox.data ?? []) as Row[];
    let nextPreferences = { ...defaults, ...(settings.data ?? {}) } as AppNotificationPreferences;
    let migrationError = '';
    const legacy = await AsyncStorage.getItem(`notifications:${user.id}`);
    if (legacy) {
      try {
        const parsed = JSON.parse(legacy) as StoredLegacyState;
        if (!settings.data && parsed.settings) {
          nextPreferences = { ...nextPreferences, ...parsed.settings };
          const { error: saveError } = await supabase.from('notification_preferences')
            .upsert({ userid: user.id, ...nextPreferences }, { onConflict: 'userid' });
          if (saveError) throw saveError;
        }
        const readIds = new Set(parsed.readIds ?? []);
        const deletedIds = new Set(parsed.deletedIds ?? []);
        const updates = nextRows.filter((row) => {
          const key = legacyKey(row.sourcekey);
          return (readIds.has(key) && !row.readat) || (deletedIds.has(key) && !row.dismissedat);
        });
        for (const row of updates) {
          const key = legacyKey(row.sourcekey);
          const patch = {
            ...(readIds.has(key) && !row.readat ? { readat: new Date().toISOString() } : {}),
            ...(deletedIds.has(key) && !row.dismissedat ? { dismissedat: new Date().toISOString() } : {}),
          };
          const { error: updateError } = await supabase.from('app_notifications')
            .update(patch).eq('id', row.id).eq('recipientid', user.id);
          if (updateError) throw updateError;
        }
        if (updates.length > 0) {
          const updated = new Map(updates.map((row) => [row.id, row]));
          nextRows = nextRows.map((row) => updated.has(row.id)
            ? { ...row, readat: readIds.has(legacyKey(row.sourcekey)) ? new Date().toISOString() : row.readat,
                dismissedat: deletedIds.has(legacyKey(row.sourcekey)) ? new Date().toISOString() : row.dismissedat }
            : row);
        }
      } catch (cause) { migrationError = cause instanceof Error ? cause.message : '이전 알림 설정을 가져오지 못했어요.'; }
    }
    if (requestId !== requestSequence.current) return;
    setRows(nextRows);
    setPreferences(nextPreferences);
    setError(migrationError);
    setIsLoading(false);
  }, [user]);

  useEffect(() => {
    const timeout = globalThis.setTimeout(() => void refresh(), 0);
    return () => globalThis.clearTimeout(timeout);
  }, [refresh, tick]);

  const updatePreferences = useCallback(async (patch: Partial<AppNotificationPreferences>) => {
    if (!user) return;
    const next = { ...preferences, ...patch };
    const { error: saveError } = await supabase.from('notification_preferences')
      .upsert({ userid: user.id, ...next, updatedat: new Date().toISOString() }, { onConflict: 'userid' });
    if (saveError) { setError(saveError.message); throw saveError; }
    setPreferences(next);
  }, [preferences, user]);

  const markAsRead = useCallback(async (id: string) => {
    if (!user) return;
    const at = new Date().toISOString();
    const { error: updateError } = await supabase.from('app_notifications').update({ readat: at })
      .eq('id', id).eq('recipientid', user.id);
    if (updateError) { setError(updateError.message); return; }
    setRows((current) => current.map((row) => row.id === id ? { ...row, readat: at } : row));
  }, [user]);

  const markAllAsRead = useCallback(async () => {
    if (!user) return;
    const at = new Date().toISOString();
    const { error: updateError } = await supabase.from('app_notifications').update({ readat: at })
      .eq('recipientid', user.id).is('readat', null).is('dismissedat', null);
    if (updateError) { setError(updateError.message); return; }
    setRows((current) => current.map((row) => row.dismissedat ? row : { ...row, readat: at }));
  }, [user]);

  const deleteNotification = useCallback(async (id: string) => {
    if (!user) return;
    const at = new Date().toISOString();
    const { error: updateError } = await supabase.from('app_notifications').update({ dismissedat: at })
      .eq('id', id).eq('recipientid', user.id);
    if (updateError) { setError(updateError.message); return; }
    setRows((current) => current.map((row) => row.id === id ? { ...row, dismissedat: at } : row));
  }, [user]);

  const deleteAllNotifications = useCallback(async () => {
    if (!user) return;
    const at = new Date().toISOString();
    const { error: updateError } = await supabase.from('app_notifications').update({ dismissedat: at })
      .eq('recipientid', user.id).is('dismissedat', null);
    if (updateError) { setError(updateError.message); return; }
    setRows((current) => current.map((row) => ({ ...row, dismissedat: at })));
  }, [user]);

  const notifications = useMemo<AppNotification[]>(() => rows.filter((row) => !row.dismissedat).map((row) => ({
    id: row.id,
    projectid: row.projectid ?? '',
    roomid: row.roomid,
    scope: row.scope,
    sourcekey: row.sourcekey,
    target: row.target,
    kind: row.kind as NotificationKind,
    title: row.title,
    message: row.message,
    createdat: row.createdat,
    isread: Boolean(row.readat),
  })), [rows]);

  const enablePush = useCallback(async () => {
    if (!user) return '로그인이 필요해요.';
    const message = await enableDevicePush(user.id);
    if (!message) await updatePreferences({ push_enabled: true });
    return message;
  }, [updatePreferences, user]);
  const disablePush = useCallback(async () => {
    if (!user) return;
    await disableDevicePush(user.id);
    await updatePreferences({ push_enabled: false });
  }, [updatePreferences, user]);

  const value = useMemo<Value>(() => ({
    notifications, unreadCount: notifications.filter((item) => !item.isread).length,
    isLoading, error, preferences, updatePreferences, enablePush, disablePush,
    markAsRead, markAllAsRead, deleteNotification, deleteAllNotifications, refresh,
  }), [notifications, isLoading, error, preferences, updatePreferences, enablePush, disablePush,
    markAsRead, markAllAsRead, deleteNotification, deleteAllNotifications, refresh]);
  return <Context.Provider value={value}>{children}</Context.Provider>;
}

export function useAppNotifications() {
  const value = useContext(Context);
  if (!value) throw new Error('useAppNotifications requires AppNotificationsProvider');
  return value;
}
