import { fail } from 'k6';

export const baseUrl = __ENV.BASE_URL;
export const supabaseUrl = __ENV.SUPABASE_URL;
export const anonKey = __ENV.SUPABASE_ANON_KEY;
export const accessToken = __ENV.TEST_ACCESS_TOKEN;

export function requireEnvironment({ auth = false } = {}) {
  if (!baseUrl || !supabaseUrl || !anonKey) fail('BASE_URL, SUPABASE_URL, and SUPABASE_ANON_KEY are required.');
  if (!supabaseUrl.includes('.supabase.co') || /production/i.test(baseUrl)) fail('Refusing a non-Supabase or production-looking target.');
  if (auth && !accessToken) fail('TEST_ACCESS_TOKEN is required for this test.');
}

export function headers(auth = false) {
  return {
    apikey: anonKey,
    Authorization: auth ? `Bearer ${accessToken}` : `Bearer ${anonKey}`,
    'Content-Type': 'application/json',
  };
}
