/**
 * k6 yük testi — Test çözme akışı.
 *
 * Senaryo: login → kütüphane → attempt start → 10 cevap gönder → submit.
 * AttemptAnomalyEvent + cevap kuyruğu + heartbeat akışı stress altında.
 */

import http from 'k6/http';
import { check, sleep, group } from 'k6';
import { Rate } from 'k6/metrics';

const BASE_URL = __ENV.BASE_URL || 'https://staging.sinavsalonu.example';

const attemptSuccess = new Rate('attempt_success');

export const options = {
  stages: [
    { duration: '1m', target: 5 },
    { duration: '8m', target: 30 }, // 30 concurrent test çözen
    { duration: '1m', target: 0 },
  ],
  thresholds: {
    'http_req_duration{type:start}': ['p(95)<600'],
    'http_req_duration{type:answer}': ['p(95)<300'], // her cevap hızlı
    'http_req_duration{type:submit}': ['p(95)<800'],
    'http_req_failed': ['rate<0.01'],
    'attempt_success': ['rate>0.99'],
  },
  tags: { scenario: 'attempt' },
};

export function setup() {
  const loginRes = http.post(
    `${BASE_URL}/auth/login`,
    JSON.stringify({ email: 'aday@demo.com', password: 'demo123' }),
    { headers: { 'Content-Type': 'application/json', 'X-Client-App': 'k6' } },
  );
  const token = loginRes.json('accessToken');

  // Aday'ın aldığı paketleri çek
  const purchasesRes = http.get(`${BASE_URL}/me/purchases`, {
    headers: { 'Authorization': `Bearer ${token}`, 'X-Client-App': 'k6' },
  });

  const purchases = purchasesRes.json() || [];
  const validPurchase = purchases.find((p) => p.package?.tests?.length > 0);

  if (!validPurchase) {
    throw new Error('Demo aday için satın alınmış paket yok — seed gerekli');
  }

  return {
    token,
    testId: validPurchase.package.tests[0].id,
  };
}

export default function (data) {
  let attemptId;
  let questions = [];

  group('1. Attempt başlat', () => {
    const startRes = http.post(
      `${BASE_URL}/tests/${data.testId}/start`,
      '{}',
      {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${data.token}`,
          'X-Client-App': 'k6',
        },
        tags: { type: 'start' },
      },
    );
    const ok = check(startRes, {
      'start status 200/201': (r) => r.status === 200 || r.status === 201,
    });
    if (!ok) return;
    attemptId = startRes.json('attemptId') || startRes.json('id');

    // Soru listesini al
    const stateRes = http.get(`${BASE_URL}/attempts/${attemptId}/state`, {
      headers: { 'Authorization': `Bearer ${data.token}`, 'X-Client-App': 'k6' },
    });
    questions = stateRes.json('questions') || [];
  });

  if (!attemptId || questions.length === 0) {
    attemptSuccess.add(false);
    return;
  }

  group('2. 5 cevap gönder', () => {
    for (let i = 0; i < Math.min(5, questions.length); i++) {
      const q = questions[i];
      const opt = q.options?.[Math.floor(Math.random() * q.options.length)];
      if (!opt) continue;

      const ansRes = http.post(
        `${BASE_URL}/attempts/${attemptId}/answer`,
        JSON.stringify({ questionId: q.id, selectedOptionId: opt.id }),
        {
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${data.token}`,
            'X-Client-App': 'k6',
          },
          tags: { type: 'answer' },
        },
      );
      check(ansRes, { 'answer 200/201': (r) => r.status === 200 || r.status === 201 });
      sleep(0.3); // İnsan ritmi simülasyonu
    }
  });

  group('3. Submit', () => {
    const submitRes = http.post(
      `${BASE_URL}/attempts/${attemptId}/finish`,
      '{}',
      {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${data.token}`,
          'X-Client-App': 'k6',
        },
        tags: { type: 'submit' },
      },
    );
    const ok = check(submitRes, {
      'submit status 200': (r) => r.status === 200,
      'submit returns score': (r) => r.json('score') !== undefined,
    });
    attemptSuccess.add(ok);
  });

  sleep(1);
}
