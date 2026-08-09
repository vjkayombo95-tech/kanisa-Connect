import { createClient } from '@supabase/supabase-js';
import type { Database } from './types';
import { isEnvironmentValid, supabaseAnonKey, supabaseUrl } from '@/lib/environment';
import { markStartupEvent } from '@/lib/startup-diagnostics';

export const isSupabaseConfigured = isEnvironmentValid;
export const PASSWORD_RECOVERY_PENDING_KEY = 'kanisa-password-recovery-pending';
const DISABLED_SUPABASE_URL = 'https://disabled.supabase.co';
const DISABLED_SUPABASE_CLIENT_KEY = 'disabled-client-key';
let firstSupabaseRequestLogged = false;

const monitoredFetch: typeof fetch = async (input, init) => {
  const startedAt = typeof performance !== 'undefined' ? performance.now() : Date.now();
  const url = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url;
  const pathname = (() => {
    try {
      return new URL(url).pathname;
    } catch {
      return 'unknown';
    }
  })();
  const isFirstSupabaseRequest = !firstSupabaseRequestLogged;

  if (import.meta.env.DEV && isFirstSupabaseRequest) {
    firstSupabaseRequestLogged = true;
    markStartupEvent('first_supabase_request_started', { path: pathname });
  }

  try {
    const response = await fetch(input, init);
    const durationMs = Math.round((typeof performance !== 'undefined' ? performance.now() : Date.now()) - startedAt);
    if (import.meta.env.DEV) {
      if (isFirstSupabaseRequest) {
        markStartupEvent('first_supabase_request_completed', {
          path: pathname,
          status: response.status,
          durationMs,
        });
      }
      if (durationMs > 2000) {
        console.warn('[startup]', {
          event: 'slow_supabase_request',
          path: pathname,
          status: response.status,
          durationMs,
        });
      }
    }
    return response;
  } catch (error) {
    const durationMs = Math.round((typeof performance !== 'undefined' ? performance.now() : Date.now()) - startedAt);
    if (import.meta.env.DEV) {
      console.warn('[startup]', {
        event: 'supabase_request_failed',
        path: pathname,
        durationMs,
        error: error instanceof Error ? error.name : 'unknown',
      });
    }
    throw error;
  }
};

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
    global: {
      fetch: monitoredFetch,
    },
  }
);

export const isDemoMode = !isSupabaseConfigured;
