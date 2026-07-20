import AsyncStorage from '@react-native-async-storage/async-storage';
import { useCallback, useEffect, useMemo, useState } from 'react';

import { useAuth } from '@/hooks/use-auth';
import { supabase } from '@/lib/supabase';
import { normalizeIdeaStatus, type IdeaStatus } from '@/types/idea';
import type { AppNotification } from '@/types/notification';
import type { Project } from '@/types/project';

const DEADLINE_ALERT_DAYS = 3;

type NotificationIdeaRow = {
  projectid?: string;
  status?: IdeaStatus;
  updatedat?: string;
};

type StoredNotificationState = {
  readIds: string[];
  deletedIds: string[];
};

function parseDateOnly(value: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) {
    return null;
  }

  const date = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
  return Number.isNaN(date.getTime()) ? null : date;
}

function getDaysUntil(deadline: string) {
  const target = parseDateOnly(deadline);
  if (!target) {
    return null;
  }

  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  return Math.round((target.getTime() - today.getTime()) / 86_400_000);
}

function getDeadlineMessage(daysUntil: number) {
  if (daysUntil === 0) {
    return '마감일이 오늘입니다.';
  }

  return `마감일이 ${daysUntil}일 남았습니다.`;
}

function createNotifications(projects: Project[], ideas: NotificationIdeaRow[], readIds: Set<string>) {
  const ideasByProject = new Map<string, NotificationIdeaRow[]>();

  ideas.forEach((idea) => {
    if (!idea.projectid) {
      return;
    }

    const current = ideasByProject.get(idea.projectid) ?? [];
    current.push(idea);
    ideasByProject.set(idea.projectid, current);
  });

  return projects.flatMap<AppNotification>((project) => {
    const projectIdeas = ideasByProject.get(project.id) ?? [];
    const notifications: AppNotification[] = [];
    const daysUntil = project.deadline ? getDaysUntil(project.deadline) : null;

    if (daysUntil !== null && daysUntil >= 0 && daysUntil <= DEADLINE_ALERT_DAYS) {
      const id = `deadline:${project.id}:${project.deadline}`;
      notifications.push({
        id,
        projectId: project.id,
        title: `${project.title} 마감 임박`,
        message: getDeadlineMessage(daysUntil),
        kind: 'deadline',
        createdAt: project.updatedat,
        isRead: readIds.has(id),
      });
    }

    const researchIdeas = projectIdeas.filter((idea) => normalizeIdeaStatus(idea.status) === 'research');
    if (researchIdeas.length > 0) {
      const id = `idea-review:${project.id}`;
      const latestUpdate = researchIdeas
        .map((idea) => idea.updatedat ?? '')
        .sort((left, right) => right.localeCompare(left))[0];

      notifications.push({
        id,
        projectId: project.id,
        title: `${project.title} 아이디어 확인`,
        message:
          researchIdeas.length === 1
            ? '조사 필요 상태의 아이디어가 있습니다.'
            : `조사 필요 상태의 아이디어가 ${researchIdeas.length}개 있습니다.`,
        kind: 'idea-review',
        createdAt: latestUpdate || project.updatedat,
        isRead: readIds.has(id),
      });
    }

    const hasSelectedIdea = projectIdeas.some((idea) => normalizeIdeaStatus(idea.status) === 'selected');
    if (!hasSelectedIdea) {
      const id = `final-selection:${project.id}`;
      notifications.push({
        id,
        projectId: project.id,
        title: `${project.title} 최종 선택 필요`,
        message: '최종 사용 아이디어가 아직 선택되지 않았습니다.',
        kind: 'final-selection',
        createdAt: project.updatedat,
        isRead: readIds.has(id),
      });
    }

    return notifications;
  });
}

export function useNotifications(projects: Project[]) {
  const { user } = useAuth();
  const [ideas, setIdeas] = useState<NotificationIdeaRow[]>([]);
  const [readIds, setReadIds] = useState<Set<string>>(new Set());
  const [deletedIds, setDeletedIds] = useState<Set<string>>(new Set());
  const [isLoadingNotifications, setIsLoadingNotifications] = useState(true);
  const [notificationError, setNotificationError] = useState('');

  const storageKey = user ? `notifications:${user.id}` : '';

  useEffect(() => {
    let isActive = true;

    async function loadNotifications() {
      if (!user) {
        setIdeas([]);
        setReadIds(new Set());
        setDeletedIds(new Set());
        setIsLoadingNotifications(false);
        return;
      }

      setIsLoadingNotifications(true);
      setNotificationError('');

      const [storedState, ideaResult] = await Promise.all([
        AsyncStorage.getItem(storageKey),
        supabase.from('ideas').select('projectid, status, updatedat').eq('userid', user.id),
      ]);

      if (!isActive) {
        return;
      }

      if (storedState) {
        try {
          const parsed = JSON.parse(storedState) as Partial<StoredNotificationState>;
          setReadIds(new Set(Array.isArray(parsed.readIds) ? parsed.readIds : []));
          setDeletedIds(new Set(Array.isArray(parsed.deletedIds) ? parsed.deletedIds : []));
        } catch {
          setReadIds(new Set());
          setDeletedIds(new Set());
        }
      }

      if (ideaResult.error) {
        setNotificationError(ideaResult.error.message);
        setIdeas([]);
      } else {
        setIdeas((ideaResult.data ?? []) as NotificationIdeaRow[]);
      }

      setIsLoadingNotifications(false);
    }

    loadNotifications();
    return () => {
      isActive = false;
    };
  }, [storageKey, user]);

  const persistState = useCallback(
    async (nextReadIds: Set<string>, nextDeletedIds: Set<string>) => {
      if (!storageKey) {
        return;
      }

      await AsyncStorage.setItem(
        storageKey,
        JSON.stringify({
          readIds: Array.from(nextReadIds),
          deletedIds: Array.from(nextDeletedIds),
        } satisfies StoredNotificationState),
      );
    },
    [storageKey],
  );

  const notifications = useMemo(
    () =>
      createNotifications(projects, ideas, readIds)
        .filter((notification) => !deletedIds.has(notification.id))
        .sort((left, right) => {
          if (left.isRead !== right.isRead) {
            return left.isRead ? 1 : -1;
          }
          return right.createdAt.localeCompare(left.createdAt);
        }),
    [deletedIds, ideas, projects, readIds],
  );

  const markAsRead = useCallback(
    (id: string) => {
      setReadIds((current) => {
        const next = new Set(current);
        next.add(id);
        void persistState(next, deletedIds);
        return next;
      });
    },
    [deletedIds, persistState],
  );

  const markAllAsRead = useCallback(() => {
    setReadIds((current) => {
      const next = new Set(current);
      notifications.forEach((notification) => next.add(notification.id));
      void persistState(next, deletedIds);
      return next;
    });
  }, [deletedIds, notifications, persistState]);

  const deleteNotification = useCallback(
    (id: string) => {
      setDeletedIds((current) => {
        const next = new Set(current);
        next.add(id);
        void persistState(readIds, next);
        return next;
      });
    },
    [persistState, readIds],
  );

  return {
    notifications,
    unreadCount: notifications.filter((notification) => !notification.isRead).length,
    isLoadingNotifications,
    notificationError,
    markAsRead,
    markAllAsRead,
    deleteNotification,
  };
}
