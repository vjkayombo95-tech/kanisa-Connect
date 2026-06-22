import http from 'k6/http'; import { check, sleep } from 'k6'; import { supabaseUrl, headers, requireEnvironment } from './lib/config.js';
export const options = { vus: 25, duration: '3m' };
export function setup() { requireEnvironment({ auth: true }); if (!__ENV.TEST_MEMBER_ID) throw new Error('TEST_MEMBER_ID is required.'); }
export default function () { const r = http.get(`${supabaseUrl}/rest/v1/contributions?member_id=eq.${__ENV.TEST_MEMBER_ID}&order=created_at.desc&limit=25`, { headers: headers(true) }); check(r, { 'history returns': (x) => x.status === 200 }); sleep(1); }
