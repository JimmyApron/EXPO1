import 'react-native-url-polyfill/auto';

import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';
import { Platform } from 'react-native';

const supabaseurl = process.env.EXPO_PUBLIC_SUPABASE_URL ?? '';
const supabaseanonkey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? '';

export const issupabaseconfigured = Boolean(supabaseurl && supabaseanonkey);

const isServerRendering = Platform.OS === 'web' && typeof window === 'undefined';

export const supabase = createClient(
  issupabaseconfigured ? supabaseurl : 'https://placeholder.supabase.co',
  issupabaseconfigured ? supabaseanonkey : 'placeholder-anon-key',
  {
    auth: {
      storage: isServerRendering ? undefined : AsyncStorage,
      autoRefreshToken: !isServerRendering,
      persistSession: !isServerRendering,
      detectSessionInUrl: false,
    },
  },
);
