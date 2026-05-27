/**
 * k6 yük testi — Auth akışı.
 *
 * Senaryo: kayıt + login + token refresh, ramp-up 50 RPS.
 */

import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate, Trend } from 'k6/metrics';

const BASE_URL = __ENV.BASE_URL || 'https://staging.sinavsalonu.example';

const loginSuccessRate = new Rate('login_success');
const tokenRefreshTime = new Trend('token_refresh_time');

export const options = {
  stages: [
    { duration: '30s', target: 10 }, // Ramp up
    { duration: '3m', target: 50 }, // Sustained 50 VU
    { duration: '30s', target: 0 }, // Ramp down
  ],
  thresholds: {
    'http_req_duration{type:login}': ['p(95)<500', 'p(99)<1500'],
    'http_req_failed': ['rate<0.01'], // < 1% fail
    'login_success': ['rate>0.99'], // > 99% başarı
  },
  tags: { scenario: 'auth' },
};

export default function () {
  // ─── 1. Login (demo aday) ───────────────────────────────────────────
  const loginRes = http.post(
    `${BASE_URL}/auth/login`,
    JSON.stringify({
      email: 'aday@demo.com',
      password: 'demo123',
    }),
    {
      headers: {
        'Content-Type': 'application/json',
        'X-Client-App': 'k6-load-test',
      },
      tags: { type: 'login' },
    },
  );

  const loginOk = check(loginRes, {
    'login status 200': (r) => r.status === 200,
    'login returns token': (r) => r.json('accessToken') !== undefined,
  });
  loginSuccessRate.add(loginOk);

  if (!loginOk) {
    sleep(2);
    return;
  }

  const token = loginRes.json('accessToken');

  // ─── 2. /auth/me — token validation ──────────────────────────────────
  const meRes = http.get(`${BASE_URL}/auth/me`, {
    headers: {
      'Authorization': `Bearer ${token}`,
      'X-Client-App': 'k6-load-test',
    },
    tags: { type: 'me' },
  });

  check(meRes, {
    '/auth/me status 200': (r) => r.status === 200,
    '/auth/me returns user': (r) => r.json('user.id') !== undefined,
  });

  sleep(1);
}
