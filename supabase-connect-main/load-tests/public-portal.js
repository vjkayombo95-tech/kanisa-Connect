import http from 'k6/http';
import { check, sleep } from 'k6';
import { baseUrl, requireEnvironment } from './lib/config.js';
export const options = { scenarios: { portal: { executor: 'ramping-vus', startVUs: 0, stages: [{ duration: '1m', target: 20 }, { duration: '3m', target: 20 }, { duration: '1m', target: 0 }] } } };
export function setup() { requireEnvironment(); }
export default function () { const r = http.get(`${baseUrl}/`); check(r, { 'portal loads': (x) => x.status === 200 }); sleep(1); }
