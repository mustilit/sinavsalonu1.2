/**
 * k6 yük testi — Satın alma uçtan uca.
 *
 * Senaryo: login → marketplace browse → checkout başlatma → webhook simulate.
 * Para akışı kritik — idempotency interceptor + webhook signature replay.
 *
 * NOT: Gerçek Stripe webhook'ları k6'dan tetiklenmez. Bu test sadece
 * frontend → backend HTTP path'lerini test eder. Webhook stress test'i
 * için Stripe CLI veya ayrı bir script kullanılır.
 */

import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate, Trend } from 'k6/metrics';

const BASE_URL = __ENV.BASE_URL || 'https://staging.sinavsalonu.example';

const purchaseInitSuccess = new Rate('purchase_init_success');
const checkoutLatency = new Trend('checkout_latency');

export const options = {
  stages: [
    { duration: '1m', target: 5 },
    { duration: '8m', target: 20 }, // Sustained 20 concurrent purchasers
    { duration: '1m', target: 0 },
  ],
  thresholds: {
    'http_req_duration{type:checkout}': ['p(95)<800', 'p(99)<2000'],
    'http_req_failed{type:checkout}': ['rate<0.005'], // < 0.5% para akışında
    'purchase_init_success': ['rate>0.995'],
  },
  tags: { scenario: 'purchase' },
};

export function setup() {
  // Auth token cache (her VU için aynı user — staging seed)
  const loginRes = http.post(
    `${BASE_URL}/auth/login`,
    JSON.stringify({ email: 'aday@demo.com', password: 'demo123' }),
    { headers: { 'Content-Type': 'application/json', 'X-Client-App': 'k6' } },
  );
  return { token: loginRes.json('accessToken') };
}

export default function (data) {
  // ─── 1. Marketplace ilk paket ────────────────────────────────────────
  const listRes = http.get(`${BASE_URL}/marketplace/packages?limit=5`);
  const items = listRes.json('items') || listRes.json() || [];
  if (!Array.isArray(items) || items.length === 0) return;
  const pkg = items[0];

  // ─── 2. Idempotent checkout başlat ──────────────────────────────────
  const idempotencyKey = `k6-${__VU}-${__ITER}-${Date.now()}`;
  const start = Date.now();

  const checkoutRes = http.post(
    `${BASE_URL}/purchases/package/${pkg.id}/initiate`,
    JSON.stringify({ provider: 'iyzico' }),
    {
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${data.token}`,
        'Idempotency-Key': idempotencyKey,
        'X-Client-App': 'k6',
      },
      tags: { type: 'checkout' },
    },
  );

  checkoutLatency.add(Date.now() - start);

  const checkoutOk = check(checkoutRes, {
    'checkout status 200': (r) => r.status === 200 || r.status === 201,
    'checkout returns token or url': (r) => {
      const json = r.json();
      return json?.token || json?.checkoutFormContent || json?.url;
    },
  });
  purchaseInitSuccess.add(checkoutOk);

  sleep(2);

  // ─── 3. Replay idempotency: aynı key tekrar dene → 200 + cached ────
  const replayRes = http.post(
    `${BASE_URL}/purchases/package/${pkg.id}/initiate`,
    JSON.stringify({ provider: 'iyzico' }),
    {
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${data.token}`,
        'Idempotency-Key': idempotencyKey, // Same key
        'X-Client-App': 'k6',
      },
      tags: { type: 'checkout' },
    },
  );

  check(replayRes, {
    'replay idempotent — aynı response': (r) => r.status === checkoutRes.status,
  });

  sleep(3);
}
