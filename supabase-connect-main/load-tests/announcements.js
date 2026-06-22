import http from 'k6/http'; import { check, sleep } from 'k6'; import { supabaseUrl, headers, requireEnvironment } from './lib/config.js';
export const options = { vus: 30, duration: '3m' };
export function setup() { requireEnvironment({ auth: true }); if (!__ENV.TEST_CHURCH_ID) throw new Error('TEST_CHURCH_ID is required.'); }
export default function () { const r = http.get(`${supabaseUrl}/rest/v1/announcements?church_id=eq.${__ENV.TEST_CHURCH_ID}&is_published=eq.true&order=published_at.desc&limit=25`, { headers: headers(true) }); check(r, { 'announcements return': (x) => x.status === 200 }); sleep(1); }
