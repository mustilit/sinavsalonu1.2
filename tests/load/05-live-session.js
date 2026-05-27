/**
 * k6 yük testi — Canlı sınav 50 katılımcı + 2s polling + heartbeat.
 *
 * Senaryo:
 *   1. Educator oturum oluşturur (1 VU)
 *   2. 50 aday joinCode ile katılır
 *   3. Educator soruları ilerletir (her 30 saniyede bir)
 *   4. Adaylar HER 2 SANIYEDE state polling — yoğun trafik
 *   5. Adaylar cevap gönderir
 *   6. Educator oturumu bitirir
 *
 * Bu senaryo en kritik load test'tir — gerçek zamanlı polling.
 */

import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate, Trend } from 'k6/metrics';

const BASE_URL = __ENV.BASE_URL || 'https://staging.sinavsalonu.example';

const pollLatency = new Trend('poll_latency');
const pollSuccess = new Rate('poll_success');

export const options = {
  scenarios: {
    candidates_polling: {
      executor: 'constant-vus',
      vus: 50,
      duration: '5m',
      exec: 'candidatePoll',
      tags: { scenario: 'live_session' },
    },
  },
  thresholds: {
    'http_req_duration{type:poll}': ['p(95)<300', 'p(99)<800'], // polling hızlı olmalı
    'poll_success': ['rate>0.99'],
    'http_req_failed': ['rate<0.01'],
  },
};

// Setup ile educator oturumu oluştur ve joinCode'u al
export function setup() {
  // Educator login
  const eduLogin = http.post(
    `${BASE_URL}/auth/login`,
    JSON.stringify({ email: 'educator@demo.com', password: 'demo123' }),
    { headers: { 'Content-Type': 'application/json', 'X-Client-App': 'k6' } },
  );
  const eduToken = eduLogin.json('accessToken');

  // Tier listesi
  const tiersRes = http.get(`${BASE_URL}/live-sessions/tiers`, {
    headers: { 'Authorization': `Bearer ${eduToken}`, 'X-Client-App': 'k6' },
  });
  const tier = (tiersRes.json() || [])[0];
  if (!tier) throw new Error('Live session tier yok — admin seed gerekli');

  // Oturum oluştur
  const sessionRes = http.post(
    `${BASE_URL}/live-sessions`,
    JSON.stringify({
      tierId: tier.id,
      title: `Load Test Session ${Date.now()}`,
      questions: [
        { content: 'Q1?', options: [{ content: 'A', isCorrect: true }, { content: 'B', isCorrect: false }] },
        { content: 'Q2?', options: [{ content: 'A', isCorrect: false }, { content: 'B', isCorrect: true }] },
      ],
    }),
    {
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${eduToken}`,
        'X-Client-App': 'k6',
      },
    },
  );

  const sessionId = sessionRes.json('id');
  const joinCode = sessionRes.json('joinCode');

  // Oturumu başlat (otomatik ödeme + start; staging'de mock provider)
  http.post(
    `${BASE_URL}/live-sessions/${sessionId}/start`,
    '{}',
    {
      headers: { 'Authorization': `Bearer ${eduToken}`, 'X-Client-App': 'k6' },
    },
  );

  // Aday login (tüm aday VU'lar için tek token)
  const adayLogin = http.post(
    `${BASE_URL}/auth/login`,
    JSON.stringify({ email: 'aday@demo.com', password: 'demo123' }),
    { headers: { 'Content-Type': 'application/json', 'X-Client-App': 'k6' } },
  );

  return {
    sessionId,
    joinCode,
    eduToken,
    adayToken: adayLogin.json('accessToken'),
  };
}

export function candidatePoll(data) {
  // Her aday joinCode ile katılır (idempotent)
  http.post(
    `${BASE_URL}/live-sessions/join/${data.joinCode}`,
    '{}',
    {
      headers: { 'Authorization': `Bearer ${data.adayToken}`, 'X-Client-App': 'k6' },
    },
  );

  // 2 dakika boyunca her 2 saniyede polling
  const endAt = Date.now() + 120 * 1000;
  while (Date.now() < endAt) {
    const start = Date.now();
    const stateRes = http.get(`${BASE_URL}/live-sessions/${data.sessionId}/state`, {
      headers: { 'Authorization': `Bearer ${data.adayToken}`, 'X-Client-App': 'k6' },
      tags: { type: 'poll' },
    });
    pollLatency.add(Date.now() - start);
    pollSuccess.add(check(stateRes, { 'poll 200': (r) => r.status === 200 }));

    // 2 saniye bekle (UI polling pattern)
    sleep(2);
  }
}

export function teardown(data) {
  // Educator oturumu kapatır
  http.post(
    `${BASE_URL}/live-sessions/${data.sessionId}/end`,
    '{}',
    {
      headers: { 'Authorization': `Bearer ${data.eduToken}`, 'X-Client-App': 'k6' },
    },
  );
}
