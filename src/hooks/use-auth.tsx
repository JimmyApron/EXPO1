import type { Session, User } from '@supabase/supabase-js';
import { createContext, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Linking from 'expo-linking';

import { issupabaseconfigured, supabase } from '@/lib/supabase';
import { disableDevicePush } from '@/lib/notification-push';

type AuthContextValue = {
  session: Session | null;
  user: User | null;
  isauthloading: boolean;
  autherror: string;
  authflow: AuthFlow | null;
  cancelAuthFlow: () => Promise<void>;
  signin: (email: string, password: string) => Promise<void>;
  sendSignupLink: (email: string) => Promise<void>;
  resendSignupLink: () => Promise<void>;
  completeSignup: (password: string) => Promise<void>;
  resetpassword: (email: string) => Promise<void>;
  resendResetLink: () => Promise<void>;
  completePasswordReset: (password: string) => Promise<void>;
  signout: () => Promise<void>;
  updateaccount: (input: { email?: string; nickname?: string; avatarurl?: string; avatarpath?: string }) => Promise<void>;
  changepassword: (password: string) => Promise<void>;
  deleteaccount: () => Promise<void>;
};

type AuthFlow = {
  mode: 'signup' | 'reset';
  stage: 'sent' | 'password';
  email: string;
  sentAt: number | null;
};

const AUTH_FLOW_STORAGE_KEY = 'watt.auth-flow.v1';
const AUTH_REDIRECT_URL = Linking.createURL('');

function parseAuthFlow(value: string | null): AuthFlow | null {
  if (!value) return null;
  try {
    const parsed = JSON.parse(value) as Record<string, unknown>;
    if ((parsed.mode !== 'signup' && parsed.mode !== 'reset') || !['email', 'verify', 'sent', 'password'].includes(String(parsed.stage)) || typeof parsed.email !== 'string') return null;
    return {
      mode: parsed.mode,
      stage: parsed.stage === 'password' ? 'password' : 'sent',
      email: parsed.email,
      sentAt: typeof parsed.sentAt === 'number' ? parsed.sentAt : null,
    };
  } catch {
    return null;
  }
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const authLink = Linking.useLinkingURL();
  const [session, setSession] = useState<Session | null>(null);
  const [isauthloading, setIsauthloading] = useState(issupabaseconfigured);
  const [autherror, setAutherror] = useState('');
  const [authflow, setAuthflow] = useState<AuthFlow | null>(null);
  const flowLoadedRef = useRef(false);

  const saveAuthFlow = async (next: AuthFlow | null) => {
    setAuthflow(next);
    if (next) await AsyncStorage.setItem(AUTH_FLOW_STORAGE_KEY, JSON.stringify(next));
    else await AsyncStorage.removeItem(AUTH_FLOW_STORAGE_KEY);
  };

  useEffect(() => {
    if (!issupabaseconfigured || !authLink) return;
    let iscancelled = false;

    const completeAuthLink = async () => {
      const url = new URL(authLink);
      const query = new URLSearchParams(url.search);
      const fragment = new URLSearchParams(url.hash.replace(/^#/, ''));
      const getParam = (key: string) => query.get(key) ?? fragment.get(key);
      const linkError = getParam('error_description') ?? getParam('error');
      if (linkError) {
        if (!iscancelled) setAutherror(linkError);
        return;
      }

      const code = getParam('code');
      const accessToken = getParam('access_token');
      const refreshToken = getParam('refresh_token');
      if (code) {
        const { error } = await supabase.auth.exchangeCodeForSession(code);
        if (error) throw error;
      } else if (accessToken && refreshToken) {
        const { error } = await supabase.auth.setSession({ access_token: accessToken, refresh_token: refreshToken });
        if (error) throw error;
      }
    };

    void completeAuthLink().catch((error: Error) => {
      if (!iscancelled) setAutherror(error.message);
    });

    return () => { iscancelled = true; };
  }, [authLink]);

  useEffect(() => {
    if (!issupabaseconfigured) {
      return;
    }

    let iscancelled = false;
    const sessiontimeout = new Promise<never>((_, reject) => {
      setTimeout(() => reject(new Error('인증 서버에 연결할 수 없습니다.')), 8000);
    });

    Promise.all([Promise.race([supabase.auth.getSession(), sessiontimeout]), AsyncStorage.getItem(AUTH_FLOW_STORAGE_KEY)])
      .then(async ([{ data, error }, storedFlow]) => {
        if (iscancelled) return;
        if (error) setAutherror(error.message);
        let flow = parseAuthFlow(storedFlow);
        if (flow) {
          const verifiedSessionMatchesEmail = data.session?.user.email?.trim().toLowerCase() === flow.email;
          if (flow.stage === 'sent' && verifiedSessionMatchesEmail) flow = { ...flow, stage: 'password' };
          else if (flow.stage === 'password' && !verifiedSessionMatchesEmail) flow = { ...flow, stage: 'sent' };
          if (flow.stage !== parseAuthFlow(storedFlow)?.stage) {
            await AsyncStorage.setItem(AUTH_FLOW_STORAGE_KEY, JSON.stringify(flow));
          }
        }
        setAuthflow(flow);
        flowLoadedRef.current = true;
        setSession(data.session);
        setIsauthloading(false);
      })
      .catch((error: Error) => {
        if (iscancelled) return;
        setAutherror(error.message);
        flowLoadedRef.current = true;
        setIsauthloading(false);
      });

    const { data } = supabase.auth.onAuthStateChange((_event, nextsession) => {
      setSession(nextsession);
      setAutherror('');
      if (flowLoadedRef.current) setIsauthloading(false);
      if (nextsession?.user.email) {
        const signedInEmail = nextsession.user.email.trim().toLowerCase();
        void AsyncStorage.getItem(AUTH_FLOW_STORAGE_KEY).then(async (storedFlow) => {
          const flow = parseAuthFlow(storedFlow);
          if (!flow || flow.stage !== 'sent' || flow.email !== signedInEmail) return;
          const nextFlow = { ...flow, stage: 'password' as const };
          setAuthflow(nextFlow);
          await AsyncStorage.setItem(AUTH_FLOW_STORAGE_KEY, JSON.stringify(nextFlow));
        }).catch(() => {});
      }
    });

    return () => {
      iscancelled = true;
      data.subscription.unsubscribe();
    };
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      session,
      user: session?.user ?? null,
      isauthloading,
      autherror,
      authflow,
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
      sendSignupLink: async (email: string) => {
        setAutherror('');
        const normalizedEmail = email.trim().toLowerCase();
        const { error } = await supabase.auth.signInWithOtp({
          email: normalizedEmail,
          options: { shouldCreateUser: true, emailRedirectTo: AUTH_REDIRECT_URL },
        });
        if (error) {
          setAutherror(error.message);
          throw error;
        }
        await saveAuthFlow({ mode: 'signup', stage: 'sent', email: normalizedEmail, sentAt: Date.now() });
      },
      resendSignupLink: async () => {
        if (!authflow || authflow.mode !== 'signup') throw new Error('회원가입 인증 정보가 만료되었습니다. 다시 시작해 주세요.');
        setAutherror('');
        const { error } = await supabase.auth.resend({
          type: 'signup',
          email: authflow.email,
          options: { emailRedirectTo: AUTH_REDIRECT_URL },
        });
        if (error) { setAutherror(error.message); throw error; }
        await saveAuthFlow({ ...authflow, stage: 'sent', sentAt: Date.now() });
      },
      completeSignup: async (password: string) => {
        if (!authflow || authflow.mode !== 'signup' || authflow.stage !== 'password') throw new Error('이메일 인증을 먼저 완료해 주세요.');
        setAutherror('');
        const { data: alreadyCompleted, error: statusError } = await supabase.rpc('watt_is_signup_completed');
        if (statusError) { setAutherror(statusError.message); throw statusError; }
        if (alreadyCompleted) { await saveAuthFlow(null); return; }
        const { error: eligibilityError } = await supabase.rpc('watt_signup_can_set_password');
        if (eligibilityError) {
          const error = new Error(eligibilityError.code === 'P0001' ? '이미 가입된 계정입니다. 로그인 화면으로 이동해 주세요.' : eligibilityError.message);
          setAutherror(error.message); throw error;
        }
        const { data: current } = await supabase.auth.getUser();
        const user = current.user;
        if (!user?.id || !user.email) throw new Error('인증 세션이 만료되었습니다. 이메일 인증을 다시 진행해 주세요.');
        const profileName = String(user.user_metadata?.nickname ?? user.email.split('@')[0]).slice(0, 20) || 'Watt 사용자';
        const { error } = await supabase.auth.updateUser({ password });
        if (error) { setAutherror(error.message); throw error; }
        const { error: profileError } = await supabase.from('profiles').upsert({
          id: user.id,
          email: user.email,
          nickname: profileName,
          updatedat: new Date().toISOString(),
        });
        if (profileError) { setAutherror(profileError.message); throw profileError; }
        const { error: completionError } = await supabase.rpc('watt_complete_signup');
        if (completionError) { setAutherror(completionError.message); throw completionError; }
        await saveAuthFlow(null);
      },
      resendResetLink: async () => {
        if (!authflow || authflow.mode !== 'reset') throw new Error('비밀번호 재설정 정보를 찾을 수 없습니다.');
        setAutherror('');
        const { error } = await supabase.auth.resetPasswordForEmail(authflow.email, { redirectTo: AUTH_REDIRECT_URL });
        if (error) { setAutherror(error.message); throw error; }
        await saveAuthFlow({ ...authflow, stage: 'sent', sentAt: Date.now() });
      },
      resetpassword: async (email: string) => {
        setAutherror('');
        const normalizedEmail = email.trim().toLowerCase();
        const { error } = await supabase.auth.resetPasswordForEmail(normalizedEmail, { redirectTo: AUTH_REDIRECT_URL });

        if (error) {
          setAutherror(error.message);
          throw error;
        }
        await saveAuthFlow({ mode: 'reset', stage: 'sent', email: normalizedEmail, sentAt: Date.now() });
      },
      completePasswordReset: async (password: string) => {
        if (!authflow || authflow.mode !== 'reset' || authflow.stage !== 'password') throw new Error('비밀번호 인증을 먼저 완료해 주세요.');
        setAutherror('');
        const { error } = await supabase.auth.updateUser({ password });
        if (error) { setAutherror(error.message); throw error; }
        await supabase.auth.signOut({ scope: 'local' });
        setSession(null);
        await saveAuthFlow(null);
      },
      cancelAuthFlow: async () => {
        await supabase.auth.signOut({ scope: 'local' });
        setSession(null);
        await saveAuthFlow(null);
      },
      signout: async () => {
        setAutherror('');
        if (session?.user.id) {
          try { await disableDevicePush(session.user.id); } catch { /* Sign-out still proceeds. */ }
        }
        const { error } = await supabase.auth.signOut();

        if (error) {
          setAutherror(error.message);
          throw error;
        }
      },
      updateaccount: async ({ email, nickname, avatarurl, avatarpath }) => {
        setAutherror('');
        const metadata = {
          ...(session?.user.user_metadata ?? {}),
          ...(nickname !== undefined ? { nickname } : {}),
          ...(avatarurl !== undefined ? { avatarurl } : {}),
          ...(avatarpath !== undefined ? { avatarpath } : {}),
        };
        const { error } = await supabase.auth.updateUser({
          ...(email ? { email: email.trim() } : {}),
          data: metadata,
        });

        if (error) {
          setAutherror(error.message);
          throw error;
        }
      },
      changepassword: async (password: string) => {
        setAutherror('');
        const { error } = await supabase.auth.updateUser({ password });

        if (error) {
          setAutherror(error.message);
          throw error;
        }
      },
      deleteaccount: async () => {
        setAutherror('');
        const { error } = await supabase.functions.invoke('delete-account');

        if (error) {
          setAutherror(error.message);
          throw error;
        }

        await supabase.auth.signOut({ scope: 'local' });
        setSession(null);
      },
    }),
    [autherror, authflow, isauthloading, session],
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
