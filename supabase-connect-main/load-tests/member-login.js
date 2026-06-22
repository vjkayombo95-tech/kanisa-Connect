import http from 'k6/http'; import { check, sleep } from 'k6'; import { supabaseUrl, anonKey, requireEnvironment } from './lib/config.js';
export const options = { vus: 10, duration: '2m' };
export function setup() { requireEnvironment(); if (!__ENV.TEST_USER_EMAIL || !__ENV.TEST_USER_PASSWORD) throw new Error('TEST_USER_EMAIL and TEST_USER_PASSWORD are required.'); }
export default function () { const r = http.post(`${supabaseUrl}/auth/v1/token?grant_type=password`, JSON.stringify({ email: __ENV.TEST_USER_EMAIL, password: __ENV.TEST_USER_PASSWORD }), { headers: { apikey: anonKey, 'Content-Type': 'application/json' } }); check(r, { 'login succeeds': (x) => x.status === 200 }); sleep(1); }
