import AsyncStorage from '@react-native-async-storage/async-storage';
import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { useAuth } from '@/hooks/use-auth';
import type { FontSize } from '@/utils/fontSize';
import { experienceStorageKey, parseExperience, readExperience } from '@/utils/onboardingStorage';

const ExperienceContext = createContext({ fontSize: 'default' as FontSize, setFontSize: (_: FontSize) => {}, onboarding: false, openOnboarding: () => {}, closeOnboarding: (_: boolean) => {}, error: '' });
export const useExperience = () => useContext(ExperienceContext);

export function ExperienceProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  return <UserExperience key={user?.id ?? 'guest'} userId={user?.id}>{children}</UserExperience>;
}
function UserExperience({ children, userId }: { children: ReactNode; userId?: string }) {
  const [fontSize, setSize] = useState<FontSize>('default');
  const [onboarding, setOnboarding] = useState(false);
  const [error, setError] = useState('');
  const interacted = useRef(false);
  const key = experienceStorageKey(userId ?? 'guest');
  useEffect(() => {
    let active = true;
    if (userId) void readExperience(AsyncStorage, userId).then(({ preferences, failed }) => {
      if (!active || interacted.current) return;
      setSize(preferences.fontSize);
      if (failed) setError('설정을 읽지 못했어요. 기본 설정으로 계속 사용할 수 있어요.');
      else setOnboarding(!preferences.completed);
    });
    return () => { active = false; };
  }, [key, userId]);
  const completed = useRef<boolean | undefined>(undefined);
  const writes = useRef(Promise.resolve());
  const save = (size: FontSize) => {
    if (!userId) return;
    writes.current = writes.current.then(async () => {
      const raw = await AsyncStorage.getItem(key);
      let previous = {};
      try { previous = parseExperience(raw); } catch { /* replace corrupt preferences */ }
      await AsyncStorage.setItem(key, JSON.stringify({ ...previous, fontSize: size, ...(completed.current === undefined ? {} : { completed: completed.current }) }));
      setError('');
    }).catch(() => setError('설정을 저장하지 못했어요. 현재 화면에서는 적용되며 다음 방문에 다시 설정할 수 있어요.'));
  };
  return <ExperienceContext.Provider value={{ fontSize, error, onboarding,
    setFontSize: (size) => { interacted.current = true; setSize(size); save(size); },
    openOnboarding: () => { interacted.current = true; setOnboarding(true); },
    closeOnboarding: (remember) => { interacted.current = true; setOnboarding(false); if (remember) { completed.current = true; save(fontSize); } },
  }}>{children}</ExperienceContext.Provider>;
}
