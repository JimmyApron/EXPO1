import 'react-native-url-polyfill/auto';

import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient, type SupportedStorage } from '@supabase/supabase-js';

const supabaseurl = process.env.EXPO_PUBLIC_SUPABASE_URL ?? '';
const supabaseanonkey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? '';

export const issupabaseconfigured = Boolean(supabaseurl && supabaseanonkey);

const authstorage: SupportedStorage = {
  getItem: (key: string) => {
    if (typeof window === 'undefined') {
      return Promise.resolve(null);
    }

    return AsyncStorage.getItem(key);
  },
  setItem: async (key: string, value: string) => {
    if (typeof window === 'undefined') {
      return;
    }

    await AsyncStorage.setItem(key, value);
  },
  removeItem: async (key: string) => {
    if (typeof window === 'undefined') {
      return;
    }

    await AsyncStorage.removeItem(key);
  },
};

export const supabase = createClient(
  issupabaseconfigured ? supabaseurl : 'https://placeholder.supabase.co',
  issupabaseconfigured ? supabaseanonkey : 'placeholder-anon-key',
  {
    auth: {
      storage: authstorage,
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: false,
    },
  },
);
