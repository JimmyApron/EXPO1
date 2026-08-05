import type { Session, User } from '@supabase/supabase-js';
import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';

import { issupabaseconfigured, supabase } from '@/lib/supabase';

type AuthContextValue = {
  session: Session | null;
  user: User | null;
  isauthloading: boolean;
  autherror: string;
  signin: (email: string, password: string) => Promise<void>;
  signup: (email: string, password: string) => Promise<string>;
  signout: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [isauthloading, setIsauthloading] = useState(issupabaseconfigured);
  const [autherror, setAutherror] = useState('');

  useEffect(() => {
    if (!issupabaseconfigured) {
      return;
    }

    supabase.auth.getSession().then(({ data, error }) => {
      if (error) {
        setAutherror(error.message);
      }
      setSession(data.session);
      setIsauthloading(false);
    });

    const { data } = supabase.auth.onAuthStateChange((_event, nextsession) => {
      setSession(nextsession);
      setAutherror('');
      setIsauthloading(false);
    });

    return () => {
      data.subscription.unsubscribe();
    };
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      session,
      user: session?.user ?? null,
      isauthloading,
      autherror,
      signin: async (email: string, password: string) => {
        setAutherror('');
        const { error } = await supabase.auth.signInWithPassword({
          email: email.trim(),
          password,
        });

        if (error) {
          setAutherror(error.message);
          throw error;
        }
      },
      signup: async (email: string, password: string) => {
        setAutherror('');
        const { data, error } = await supabase.auth.signUp({
          email: email.trim(),
          password,
        });

        if (error) {
          setAutherror(error.message);
          throw error;
        }

        if (!data.session) {
          return '확인 메일을 보냈습니다. 이메일 인증 후 로그인하세요.';
        }

        return '회원가입이 완료되었습니다.';
      },
      signout: async () => {
        setAutherror('');
        const { error } = await supabase.auth.signOut();

        if (error) {
          setAutherror(error.message);
          throw error;
        }
      },
    }),
    [autherror, isauthloading, session],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }

  return context;
}
