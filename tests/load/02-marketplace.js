/**
 * k6 yük testi — Marketplace browsing.
 *
 * Senaryo: Explore listele + filtre + arama + paket detayı.
 * Public endpoint'ler — JWT yok.
 */

import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate } from 'k6/metrics';

const BASE_URL = __ENV.BASE_URL || 'https://staging.sinavsalonu.example';

const browseSuccessRate = new Rate('browse_success');

export const options = {
  stages: [
    { duration: '1m', target: 20 },
    { duration: '3m', target: 100 }, // Yoğun browse — 100 VU
    { duration: '1m', target: 0 },
  ],
  thresholds: {
    'http_req_duration{type:list}': ['p(95)<400', 'p(99)<1000'],
    'http_req_duration{type:detail}': ['p(95)<500', 'p(99)<1200'],
    'http_req_duration{type:search}': ['p(95)<800', 'p(99)<2000'], // tsvector search
    'http_req_failed': ['rate<0.01'],
    'browse_success': ['rate>0.99'],
  },
  tags: { scenario: 'marketplace' },
};

const SEARCH_TERMS = ['LGS', 'KPSS', 'TUS', 'MSÜ', 'YKS', 'matematik', 'türkçe'];

export default function () {
  // ─── 1. Marketplace listele (paginated) ─────────────────────────────
  const listRes = http.get(`${BASE_URL}/marketplace/packages?limit=20`, {
    tags: { type: 'list' },
  });
  const listOk = check(listRes, {
    'list status 200': (r) => r.status === 200,
    'list returns items': (r) => Array.isArray(r.json('items')) || Array.isArray(r.json()),
  });
  browseSuccessRate.add(listOk);
  sleep(0.5);

  // ─── 2. Search (tsvector) ───────────────────────────────────────────
  const term = SEARCH_TERMS[Math.floor(Math.random() * SEARCH_TERMS.length)];
  const searchRes = http.get(`${BASE_URL}/marketplace/packages?q=${encodeURIComponent(term)}&limit=20`, {
    tags: { type: 'search' },
  });
  check(searchRes, {
    'search status 200': (r) => r.status === 200,
  });
  sleep(0.5);

  // ─── 3. Paket detayı (rastgele bir paket) ───────────────────────────
  const items = listRes.json('items') || listRes.json() || [];
  if (Array.isArray(items) && items.length > 0) {
    const pkg = items[Math.floor(Math.random() * items.length)];
    const detailRes = http.get(`${BASE_URL}/marketplace/packages/${pkg.id}`, {
      tags: { type: 'detail' },
    });
    check(detailRes, {
      'detail status 200': (r) => r.status === 200,
    });
  }

  sleep(1);
}
