#!/usr/bin/env node
/**
 * Contract test — backend OpenAPI schema vs frontend dalClient.js karşılaştırma.
 *
 * Sınav Salonu'nun büyüklüğü: 45+ controller, 213 use-case, 100+ endpoint.
 * Frontend dalClient.js bu endpoint'leri manuel sarar. Backend endpoint adı
 * veya parametre değişirse drift gizlice oluşur — frontend 404 alır.
 *
 * Bu script:
 *   1. Backend OpenAPI (Swagger) JSON çıktısını okur (openapi:export script'i üretir)
 *   2. Frontend dalClient.js dosyasındaki `api.get/post/put/delete` çağrılarını parse eder
 *   3. Her dalClient çağrısı OpenAPI path listesinde var mı kontrol eder
 *   4. Drift varsa exit 1 (CI gate)
 *
 * KULLANIM:
 *   # Önce OpenAPI export:
 *   cd apps/backend && npm run openapi:export -- --output ./openapi.json
 *
 *   # Sonra contract test:
 *   node scripts/contract-test.js
 *   node scripts/contract-test.js --verbose
 *
 * LIMITS:
 *   - Path parameter substitution (`${id}`) için basit normalizasyon var.
 *   - Query parameter doğrulaması yok (sadece path).
 *   - Tip uyumu doğrulaması yok — schema validation ayrı bir adım.
 *
 * GELECEK:
 *   - @openapitools/openapi-generator-cli ile frontend TypeScript SDK üretimi.
 *   - Bu durumda dalClient.js elle yazılmaz, generated client kullanılır.
 *   - Şu an için manuel dalClient + bu drift detector yeterli.
 */

const fs = require('fs');
const path = require('path');

const OPENAPI_PATH = path.join(__dirname, '..', 'openapi.json');
const DAL_CLIENT_PATH = path.join(__dirname, '..', '..', 'frontend', 'src', 'api', 'dalClient.js');

const args = process.argv.slice(2);
const VERBOSE = args.includes('--verbose');

if (!fs.existsSync(OPENAPI_PATH)) {
  console.error('[contract] OpenAPI JSON bulunamadı:', OPENAPI_PATH);
  console.error('  Önce: cd apps/backend && npm run openapi:export -- --output openapi.json');
  process.exit(1);
}

if (!fs.existsSync(DAL_CLIENT_PATH)) {
  console.error('[contract] dalClient.js bulunamadı:', DAL_CLIENT_PATH);
  process.exit(1);
}

// ── OpenAPI path'lerini topla ───────────────────────────────────────────────
const openapi = JSON.parse(fs.readFileSync(OPENAPI_PATH, 'utf8'));
const backendEndpoints = new Set();

for (const [pathStr, methods] of Object.entries(openapi.paths || {})) {
  // OpenAPI param formatı: /users/{id} → normalize et: /users/{}
  const normalized = pathStr.replace(/\{[^}]+\}/g, '{}');
  for (const method of Object.keys(methods).filter((m) => ['get', 'post', 'put', 'patch', 'delete'].includes(m))) {
    backendEndpoints.add(`${method.toUpperCase()} ${normalized}`);
  }
}

console.log(`[contract] Backend OpenAPI: ${backendEndpoints.size} endpoint`);

// ── dalClient.js'i parse et ─────────────────────────────────────────────────
const dalSrc = fs.readFileSync(DAL_CLIENT_PATH, 'utf8');

// `api.get('/path')`, `api.post('/path', body)`, vs.
// Template literal'lar: `/path/${id}` → `/path/{}`
const CLIENT_CALL_RE = /\bapi\.(get|post|put|patch|delete)\s*\(\s*[`'"]([^`'"]+)[`'"]/g;
const frontendCalls = new Map(); // "METHOD /path/{}" → [line, original]

let m;
let lineNo = 0;
const lines = dalSrc.split('\n');
for (let i = 0; i < lines.length; i++) {
  const line = lines[i];
  let lm;
  const lineRe = /\bapi\.(get|post|put|patch|delete)\s*\(\s*[`'"]([^`'"]+)[`'"]/g;
  while ((lm = lineRe.exec(line))) {
    const method = lm[1].toUpperCase();
    let pathRaw = lm[2];
    // Query string strip
    pathRaw = pathRaw.split('?')[0];
    // Template literal parametreleri normalize et (`${id}` → `{}`)
    const normalized = pathRaw.replace(/\$\{[^}]+\}/g, '{}');
    const key = `${method} ${normalized}`;
    if (!frontendCalls.has(key)) {
      frontendCalls.set(key, { line: i + 1, originalPath: pathRaw });
    }
  }
}

console.log(`[contract] Frontend dalClient: ${frontendCalls.size} endpoint çağrısı`);

// ── Drift tespiti ───────────────────────────────────────────────────────────
const missing = []; // Frontend çağırıyor ama backend'de yok
const orphaned = []; // Backend'de var ama frontend hiç çağırmıyor

for (const [call, info] of frontendCalls) {
  if (!backendEndpoints.has(call)) {
    missing.push({ call, ...info });
  }
}

for (const ep of backendEndpoints) {
  if (!frontendCalls.has(ep)) {
    orphaned.push(ep);
  }
}

// ── Rapor ────────────────────────────────────────────────────────────────────
if (missing.length === 0 && orphaned.length === 0) {
  console.log('\n✓ Contract test PASS — frontend ↔ backend tam senkron.');
  process.exit(0);
}

console.log('\n=== Contract Test Raporu ===\n');

if (missing.length > 0) {
  console.error(`❌ KRITIK: Frontend çağırıyor ama backend'de YOK (${missing.length}):`);
  for (const item of missing) {
    console.error(`  ${item.call}`);
    console.error(`    dalClient.js:${item.line} → ${item.originalPath}`);
  }
}

if (orphaned.length > 0 && VERBOSE) {
  console.log(`\n⚠️  Backend'de var ama frontend hiç çağırmıyor (${orphaned.length}):`);
  for (const ep of orphaned.slice(0, 20)) console.log(`  ${ep}`);
  if (orphaned.length > 20) console.log(`  ... ve ${orphaned.length - 20} tane daha`);
}

if (missing.length > 0) {
  console.error('\n❌ Contract test FAIL — drift var.');
  console.error('  Çözüm: backend endpoint adını veya frontend dalClient çağrısını uydur.');
  process.exit(2);
}

console.log('\n⚠️  Orphaned endpoint\'ler bilgi amaçlı — frontend\'in henüz kullanmadığı backend endpoint\'leri.');
process.exit(0);
