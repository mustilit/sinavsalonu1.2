# k6 Yük Testleri — Sınav Salonu

5 kritik kullanıcı akışı için Grafana k6 senaryoları. Her senaryo
production öncesi staging environment'a yöneltilir.

## Kurulum

```bash
# k6 binary indir
brew install k6                    # macOS
choco install k6                   # Windows
sudo apt-get install k6            # Linux
# veya: https://k6.io/docs/get-started/installation/
```

## Çalıştırma

```bash
# Tek senaryo
k6 run tests/load/01-auth.js

# Tüm senaryolar (sırayla)
for f in tests/load/0*.js; do k6 run "$f" || break; done

# Cloud (Grafana k6 Cloud) — büyük ölçek + dashboard
k6 cloud tests/load/03-purchase.js
```

## Senaryolar

| Dosya | Akış | Hedef RPS | Süre |
|---|---|---|---|
| `01-auth.js` | Kayıt + login + token refresh | 50 | 5 dk |
| `02-marketplace.js` | Explore listele + filtre + arama | 100 | 5 dk |
| `03-purchase.js` | Satın alma uçtan uca | 20 | 10 dk |
| `04-test-attempt.js` | Aday test çözme + cevap gönder + submit | 30 | 10 dk |
| `05-live-session.js` | Canlı sınav 50 katılımcı + polling | 100 | 5 dk |

## Threshold'lar (her senaryoda)

| Metric | Pass | Warning | Fail |
|---|---|---|---|
| http_req_duration p95 | < 500ms | 500-1000ms | > 1000ms |
| http_req_duration p99 | < 1500ms | 1500-3000ms | > 3000ms |
| http_req_failed | < 1% | 1-3% | > 3% |
| iteration_duration p95 | < 2s | 2-5s | > 5s |

## CI Entegrasyonu

Manuel tetikleme (GitHub Actions workflow_dispatch). Otomatik koşum:
prod release öncesi staging'e yönelik. PR'da koşmaz (gecikmeli + maliyet).

```yaml
# .github/workflows/load-test.yml (gelecek)
on:
  workflow_dispatch:
  release:
    types: [created]
```

## Sonuç yorumlama

```bash
k6 run tests/load/03-purchase.js | tee results.log
```

`Checks`, `http_req_duration`, `iteration_duration` çıktısı kritik.
`vus`, `vus_max`, `iterations` — load profile özeti.

Threshold ihlali varsa **exit code != 0** — CI gate.

## Test data setup

k6 senaryoları DEMO seed verilerine yöneltilir (`apps/backend/prisma/seed.ts`):
- `aday@demo.com` / `demo123` — CANDIDATE
- `educator@demo.com` / `demo123` — EDUCATOR
- `admin@demo.com` / `demo123` — ADMIN

Production'da seed çalışmaz — k6 cloud için canary user havuzu hazırlanmalı.
