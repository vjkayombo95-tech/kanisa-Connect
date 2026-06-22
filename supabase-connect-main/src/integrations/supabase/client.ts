import { createClient } from '@supabase/supabase-js';
import type { Database } from './types';
import { isEnvironmentValid, supabaseAnonKey, supabaseUrl } from '@/lib/environment';

export const isSupabaseConfigured = isEnvironmentValid;
export const PASSWORD_RECOVERY_PENDING_KEY = 'kanisa-password-recovery-pending';

export const supabase = createClient<Database>(
  supabaseUrl || 'https://invalid.supabase.co',
  supabaseAnonKey || 'placeholder-anon-key',
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
