import { createClient } from '@supabase/supabase-js';
import type { Database } from './types';
import { isEnvironmentValid, supabaseAnonKey, supabaseUrl } from '@/lib/environment';

export const isSupabaseConfigured = isEnvironmentValid;
export const PASSWORD_RECOVERY_PENDING_KEY = 'kanisa-password-recovery-pending';
const DISABLED_SUPABASE_URL = 'https://disabled.supabase.co';
const DISABLED_SUPABASE_CLIENT_KEY = 'disabled-client-key';

export const supabase = createClient<Database>(
  isSupabaseConfigured ? supabaseUrl! : DISABLED_SUPABASE_URL,
  isSupabaseConfigured ? supabaseAnonKey! : DISABLED_SUPABASE_CLIENT_KEY,
  {
    auth: {
      detectSessionInUrl: (_url, params) => {
        if (params.type === 'recovery' && typeof window !== 'undefined') {
          window.sessionStorage.setItem(PASSWORD_RECOVERY_PENDING_KEY, 'true');
        }

        return true;
      },
    },
  }
);

export const isDemoMode = !isSupabaseConfigured;
