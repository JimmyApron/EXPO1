import 'react-native-url-polyfill/auto';

import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient, type SupportedStorage } from '@supabase/supabase-js';

const supabaseurl = process.env.EXPO_PUBLIC_SUPABASE_URL ?? '';
const supabaseanonkey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? '';

export const issupabaseconfigured = Boolean(supabaseurl && supabaseanonkey);

const authstorage: SupportedStorage = {
  getItem: (key: string) => AsyncStorage.getItem(key),
  setItem: (key: string, value: string) => AsyncStorage.setItem(key, value),
  removeItem: (key: string) => AsyncStorage.removeItem(key),
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
