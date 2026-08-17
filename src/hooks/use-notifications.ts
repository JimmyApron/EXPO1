import AsyncStorage from '@react-native-async-storage/async-storage';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { useNotificationToasts } from '@/components/notification/notification-toast-provider';
import { useAuth } from '@/hooks/use-auth';
import { supabase } from '@/lib/supabase';
import { normalizeIdeaStatus, type IdeaStatus } from '@/types/idea';
import type { AppNotification, NotificationSettings } from '@/types/notification';
import type { Project } from '@/types/project';

const defaultNotificationSettings: NotificationSettings = {
  deadline: true,
  ideareview: true,
  finalselection: true,
  stalledidea: true,
  feedback: true,
  likesurge: true,
  deadlinedays: 3,
  stalledideadays: 3,
  likesurgethreshold: 3,
};

type NotificationIdeaRow = {
  id?: string;
  projectid?: string;
  title?: string;
  status?: IdeaStatus;
  createdat?: string;
  updatedat?: string;
};

type NotificationFeedbackRow = {
  ideaid?: string;
  userid?: string;
  createdat?: string;
};

type NotificationLikeRow = {
  ideaid?: string;
  createdat?: string;
};

type StoredNotificationState = {
  readIds: string[];
  deletedIds: string[];
  shownToastIds?: string[];
  settings?: Partial<NotificationSettings>;
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

function getAgeInDays(value?: string) {
  if (!value) {
    return 0;
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return 0;
  }

  return Math.floor((Date.now() - date.getTime()) / 86_400_000);
}

function getLatestDate(values: (string | undefined)[]) {
  return values.filter(Boolean).sort((left, right) => String(right).localeCompare(String(left)))[0] ?? new Date().toISOString();
}

function createNotifications(
  projects: Project[],
  ideas: NotificationIdeaRow[],
  feedbacks: NotificationFeedbackRow[],
  likes: NotificationLikeRow[],
  readIds: Set<string>,
  settings: NotificationSettings,
  userid?: string,
) {
  const ideasByProject = new Map<string, NotificationIdeaRow[]>();
  const projectIdByIdeaId = new Map<string, string>();
  const feedbacksByProject = new Map<string, NotificationFeedbackRow[]>();
  const likesByIdea = new Map<string, NotificationLikeRow[]>();

  ideas.forEach((idea) => {
    if (!idea.projectid) {
      return;
    }

    const current = ideasByProject.get(idea.projectid) ?? [];
    current.push(idea);
    ideasByProject.set(idea.projectid, current);

    if (idea.id) {
      projectIdByIdeaId.set(idea.id, idea.projectid);
    }
  });

  feedbacks.forEach((feedback) => {
    if (!feedback.ideaid || feedback.userid === userid) {
      return;
    }

    const projectid = projectIdByIdeaId.get(feedback.ideaid);
    if (!projectid) {
      return;
    }

    const current = feedbacksByProject.get(projectid) ?? [];
    current.push(feedback);
    feedbacksByProject.set(projectid, current);
  });

  likes.forEach((like) => {
    if (!like.ideaid) {
      return;
    }

    const current = likesByIdea.get(like.ideaid) ?? [];
    current.push(like);
    likesByIdea.set(like.ideaid, current);
  });

  return projects.flatMap<AppNotification>((project) => {
    const projectIdeas = ideasByProject.get(project.id) ?? [];
    const projectFeedbacks = feedbacksByProject.get(project.id) ?? [];
    const notifications: AppNotification[] = [];
    const daysUntil = project.deadline ? getDaysUntil(project.deadline) : null;

    if (settings.deadline && daysUntil !== null && daysUntil >= 0 && daysUntil <= settings.deadlinedays) {
      const id = `deadline:${project.id}:${project.deadline}`;
      notifications.push({
        id,
        projectid: project.id,
        title: `${project.title} 마감 임박`,
        message: getDeadlineMessage(daysUntil),
        kind: 'deadline',
        createdat: project.updatedat,
        isread: readIds.has(id),
      });
    }

    const researchIdeas = projectIdeas.filter((idea) => normalizeIdeaStatus(idea.status) === 'research');
    if (settings.ideareview && researchIdeas.length > 0) {
      const id = `ideareview:${project.id}`;
      const latestUpdate = researchIdeas
        .map((idea) => idea.updatedat ?? '')
        .sort((left, right) => right.localeCompare(left))[0];

      notifications.push({
        id,
        projectid: project.id,
        title: `${project.title} 아이디어 확인`,
        message:
          researchIdeas.length === 1
            ? '조사 필요 상태의 아이디어가 있습니다.'
            : `조사 필요 상태의 아이디어가 ${researchIdeas.length}개 있습니다.`,
        kind: 'ideareview',
        createdat: latestUpdate || project.updatedat,
        isread: readIds.has(id),
      });
    }

    const hasSelectedIdea = projectIdeas.some((idea) => normalizeIdeaStatus(idea.status) === 'selected');
    if (settings.finalselection && projectIdeas.length > 0 && !hasSelectedIdea) {
      const id = `finalselection:${project.id}`;
      notifications.push({
        id,
        projectid: project.id,
        title: `${project.title} 최종 선택 필요`,
        message: '최종 사용 아이디어가 아직 선택되지 않았습니다.',
        kind: 'finalselection',
        createdat: project.updatedat,
        isread: readIds.has(id),
      });
    }

    const stalledIdeas = projectIdeas.filter(
      (idea) =>
        normalizeIdeaStatus(idea.status) === 'thought' &&
        getAgeInDays(idea.updatedat ?? idea.createdat) >= settings.stalledideadays,
    );
    if (settings.stalledidea && stalledIdeas.length > 0) {
      const id = `stalledidea:${project.id}`;
      notifications.push({
        id,
        projectid: project.id,
        title: `${project.title} 진행 정체`,
        message:
          stalledIdeas.length === 1
            ? '생각 단계에 오래 머문 아이디어가 있습니다.'
            : `생각 단계에 오래 머문 아이디어가 ${stalledIdeas.length}개 있습니다.`,
        kind: 'stalledidea',
        createdat: getLatestDate(stalledIdeas.map((idea) => idea.updatedat ?? idea.createdat)),
        isread: readIds.has(id),
      });
    }

    if (settings.feedback && projectFeedbacks.length > 0) {
      const latestFeedback = getLatestDate(projectFeedbacks.map((feedback) => feedback.createdat));
      const id = `feedback:${project.id}:${latestFeedback}`;
      notifications.push({
        id,
        projectid: project.id,
        title: `${project.title} 피드백 도착`,
        message:
          projectFeedbacks.length === 1
            ? '새 피드백이 도착했습니다.'
            : `새 피드백이 ${projectFeedbacks.length}개 도착했습니다.`,
        kind: 'feedback',
        createdat: latestFeedback,
        isread: readIds.has(id),
      });
    }

    const popularIdeas = settings.likesurge
      ? projectIdeas.filter((idea) => idea.id && (likesByIdea.get(idea.id)?.length ?? 0) >= settings.likesurgethreshold)
      : [];
    popularIdeas.forEach((idea) => {
      if (!idea.id) {
        return;
      }

      const ideaLikes = likesByIdea.get(idea.id) ?? [];
      const likeCount = ideaLikes.length;
      const id = `likesurge:${project.id}:${idea.id}:${likeCount}`;
      notifications.push({
        id,
        projectid: project.id,
        title: `${project.title} 반응 증가`,
        message: `"${idea.title || '아이디어'}"에 ${likeCount}명이 공감했습니다.`,
        kind: 'likesurge',
        createdat: getLatestDate(ideaLikes.map((like) => like.createdat)),
        isread: readIds.has(id),
      });
    });

    return notifications;
  });
}

export function useNotifications(projects: Project[]) {
  const { user } = useAuth();
  const { showNotificationToast } = useNotificationToasts();
  const [ideas, setIdeas] = useState<NotificationIdeaRow[]>([]);
  const [feedbacks, setFeedbacks] = useState<NotificationFeedbackRow[]>([]);
  const [likes, setLikes] = useState<NotificationLikeRow[]>([]);
  const [readIds, setReadIds] = useState<Set<string>>(new Set());
  const [deletedIds, setDeletedIds] = useState<Set<string>>(new Set());
  const [settings, setSettings] = useState<NotificationSettings>(defaultNotificationSettings);
  const shownToastIdsRef = useRef<Set<string>>(new Set());
  const [isLoadingNotifications, setIsLoadingNotifications] = useState(true);
  const [notificationError, setNotificationError] = useState('');

  const storageKey = user ? `notifications:${user.id}` : '';

  useEffect(() => {
    let isActive = true;

    async function loadNotifications() {
      if (!user) {
        setIdeas([]);
        setFeedbacks([]);
        setLikes([]);
        setReadIds(new Set());
        setDeletedIds(new Set());
        setSettings(defaultNotificationSettings);
        shownToastIdsRef.current = new Set();
        setIsLoadingNotifications(false);
        return;
      }

      setIsLoadingNotifications(true);
      setNotificationError('');

      const [storedState, ideaResult] = await Promise.all([
        AsyncStorage.getItem(storageKey),
        supabase.from('ideas').select('id, projectid, title, status, createdat, updatedat').eq('userid', user.id),
      ]);

      if (!isActive) {
        return;
      }

      if (storedState) {
        try {
          const parsed = JSON.parse(storedState) as Partial<StoredNotificationState>;
          setReadIds(new Set(Array.isArray(parsed.readIds) ? parsed.readIds : []));
          setDeletedIds(new Set(Array.isArray(parsed.deletedIds) ? parsed.deletedIds : []));
          shownToastIdsRef.current = new Set(Array.isArray(parsed.shownToastIds) ? parsed.shownToastIds : []);
          setSettings({ ...defaultNotificationSettings, ...parsed.settings });
        } catch {
          setReadIds(new Set());
          setDeletedIds(new Set());
          setSettings(defaultNotificationSettings);
          shownToastIdsRef.current = new Set();
        }
      }

      if (ideaResult.error) {
        setNotificationError(ideaResult.error.message);
        setIdeas([]);
        setFeedbacks([]);
        setLikes([]);
      } else {
        const nextIdeas = (ideaResult.data ?? []) as NotificationIdeaRow[];
        setIdeas(nextIdeas);

        const ideaIds = nextIdeas.map((idea) => idea.id).filter((id): id is string => Boolean(id));
        if (ideaIds.length === 0) {
          setFeedbacks([]);
          setLikes([]);
        } else {
          const [feedbackResult, likeResult] = await Promise.all([
            supabase.from('feedbacks').select('ideaid, userid, createdat').in('ideaid', ideaIds),
            supabase.from('idealikes').select('ideaid, createdat').in('ideaid', ideaIds),
          ]);

          if (!isActive) {
            return;
          }

          if (feedbackResult.error) {
            setNotificationError(feedbackResult.error.message);
            setFeedbacks([]);
          } else {
            setFeedbacks((feedbackResult.data ?? []) as NotificationFeedbackRow[]);
          }

          if (likeResult.error) {
            setNotificationError(likeResult.error.message);
            setLikes([]);
          } else {
            setLikes((likeResult.data ?? []) as NotificationLikeRow[]);
          }
        }
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
          shownToastIds: Array.from(shownToastIdsRef.current),
          settings,
        } satisfies StoredNotificationState),
      );
    },
    [settings, storageKey],
  );

  const notifications = useMemo(
    () =>
      createNotifications(projects, ideas, feedbacks, likes, readIds, settings, user?.id)
        .filter((notification) => !deletedIds.has(notification.id))
        .sort((left, right) => {
          if (left.isread !== right.isread) {
            return left.isread ? 1 : -1;
          }
          return right.createdat.localeCompare(left.createdat);
        }),
    [deletedIds, feedbacks, ideas, likes, projects, readIds, settings, user],
  );

  useEffect(() => {
    if (isLoadingNotifications) {
      return;
    }

    const toastNotifications = notifications.filter(
      (notification) => !notification.isread && !shownToastIdsRef.current.has(notification.id),
    );

    if (toastNotifications.length === 0) {
      return;
    }

    toastNotifications.forEach((notification) => {
      shownToastIdsRef.current.add(notification.id);
      showNotificationToast(notification);
    });

    if (storageKey) {
      void AsyncStorage.setItem(
        storageKey,
        JSON.stringify({
            readIds: Array.from(readIds),
            deletedIds: Array.from(deletedIds),
            shownToastIds: Array.from(shownToastIdsRef.current),
            settings,
          } satisfies StoredNotificationState),
      );
    }
  }, [
    deletedIds,
    isLoadingNotifications,
    notifications,
    readIds,
    showNotificationToast,
    settings,
    storageKey,
  ]);

  const updateNotificationSettings = useCallback(
    async (nextSettings: Partial<NotificationSettings>) => {
      const mergedSettings = { ...settings, ...nextSettings };
      setSettings(mergedSettings);

      if (!storageKey) {
        return;
      }

      await AsyncStorage.setItem(
        storageKey,
        JSON.stringify({
          readIds: Array.from(readIds),
          deletedIds: Array.from(deletedIds),
          shownToastIds: Array.from(shownToastIdsRef.current),
          settings: mergedSettings,
        } satisfies StoredNotificationState),
      );
    },
    [deletedIds, readIds, settings, storageKey],
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

  const deleteAllNotifications = useCallback(() => {
    setDeletedIds((current) => {
      const next = new Set(current);
      notifications.forEach((notification) => next.add(notification.id));
      void persistState(readIds, next);
      return next;
    });
  }, [notifications, persistState, readIds]);

  return {
    notifications,
    unreadCount: notifications.filter((notification) => !notification.isread).length,
    isLoadingNotifications,
    notificationError,
    notificationSettings: settings,
    updateNotificationSettings,
    markAsRead,
    markAllAsRead,
    deleteNotification,
    deleteAllNotifications,
  };
}
