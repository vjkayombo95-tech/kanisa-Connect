import { createClient } from '@supabase/supabase-js';
import type { Database } from './types';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseAnonKey);
export const PASSWORD_RECOVERY_PENDING_KEY = 'kanisa-password-recovery-pending';

export const supabase = createClient<Database>(
  supabaseUrl || 'https://placeholder.supabase.co',
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
