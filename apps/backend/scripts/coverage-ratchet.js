#!/usr/bin/env node
/**
 * Coverage Ratchet — jest.config.cjs threshold'larını otomatik sıkıştırır.
 *
 * Mantık:
 *   1. `coverage/coverage-summary.json` okunur (jest --coverage çıktısı)
 *   2. Mevcut threshold'lar (jest.config.cjs) parse edilir
 *   3. Her path için: yeni baseline = max(eski threshold, ölçüm - tampon)
 *   4. Yeni değerler eski'den ≥1 puan yüksekse, jest.config.cjs günceller
 *   5. Düşüş ASLA uygulanmaz (ratchet = sadece bir yöne hareket)
 *
 * Kullanım:
 *   # Önce coverage ölç:
 *   npm test -- --coverage
 *
 *   # Sonra ratchet çalıştır:
 *   node scripts/coverage-ratchet.js                  → dry-run (sadece raporlar)
 *   node scripts/coverage-ratchet.js --apply          → jest.config.cjs günceller
 *   node scripts/coverage-ratchet.js --buffer=3       → tampon 3 puan (default 2)
 *
 * CI:
 *   .github/workflows/coverage-ratchet.yml manuel veya cron tetiklenir;
 *   PR oluşturarak değişikliği önerir (merge admin onaylar).
 *
 * Tasarım disiplini:
 *   - Tampon = CI dalgalanma toleransı (test runner sırası, env değişikliği)
 *   - Branch coverage daha volatil; tampon branches için +1 puan ekstra
 *   - PR'da yeni dosya eklenince mevcut threshold geçici olarak aşağı düşebilir;
 *     ratchet bunu DEĞIŞTİRMEZ — sadece artırılır.
 */

const fs = require('fs');
const path = require('path');

const COVERAGE_PATH = path.join(__dirname, '..', 'coverage', 'coverage-summary.json');
const JEST_CONFIG_PATH = path.join(__dirname, '..', 'jest.config.cjs');

const args = process.argv.slice(2);
const APPLY = args.includes('--apply');
const BUFFER = parseInt(
  (args.find((a) => a.startsWith('--buffer=')) || '--buffer=2').split('=')[1],
  10,
);

if (!fs.existsSync(COVERAGE_PATH)) {
  console.error(`[ratchet] coverage-summary.json bulunamadı: ${COVERAGE_PATH}`);
  console.error('[ratchet] Önce "npm test -- --coverage" çalıştır.');
  process.exit(1);
}

const summary = JSON.parse(fs.readFileSync(COVERAGE_PATH, 'utf8'));

/**
 * coverage-summary.json'da her path için 4 metric:
 *   { statements, branches, functions, lines } = { total, covered, skipped, pct }
 *
 * Threshold isimleri jest config ile aynı: statements, branches, functions, lines.
 */
const METRICS = ['statements', 'branches', 'functions', 'lines'];

/** Bir path için ölçülen pct değerlerini topla. */
function measurePath(targetPath) {
  // jest path'leri "./src/application/use-cases/" şeklinde; summary key'leri absolute.
  // Match: summary[key].path veya key absolute mu kontrol et
  const normalized = targetPath
    .replace(/^\.\//, '')
    .replace(/\/$/, '')
    .replace(/\\/g, '/');

  const matches = Object.entries(summary).filter(([key, value]) => {
    if (key === 'total') return false;
    const keyNorm = String(key).replace(/\\/g, '/');
    return keyNorm.includes('/' + normalized + '/') || keyNorm.endsWith('/' + normalized);
  });

  if (matches.length === 0) {
    // Tam dosya yolu eşleşmesi olmazsa "total"'a düş
    return null;
  }

  const sums = {};
  for (const m of METRICS) {
    sums[m] = { total: 0, covered: 0 };
  }
  for (const [, value] of matches) {
    for (const m of METRICS) {
      sums[m].total += value[m]?.total ?? 0;
      sums[m].covered += value[m]?.covered ?? 0;
    }
  }
  const pct = {};
  for (const m of METRICS) {
    pct[m] = sums[m].total > 0 ? (sums[m].covered / sums[m].total) * 100 : 0;
  }
  return pct;
}

/** Global toplam (tüm dosyalar). */
function measureGlobal() {
  const t = summary.total;
  if (!t) return null;
  return {
    statements: t.statements.pct,
    branches: t.branches.pct,
    functions: t.functions.pct,
    lines: t.lines.pct,
  };
}

/** jest.config.cjs içinden coverageThreshold blokunu çıkar (basit regex). */
function readJestConfig() {
  const src = fs.readFileSync(JEST_CONFIG_PATH, 'utf8');
  // require() etmek riskli (yan etkiler); regex ile bul.
  const match = src.match(/coverageThreshold:\s*({[\s\S]*?\n  })/);
  if (!match) return { src, thresholds: null };
  // eval güvenli değil — manuel parse: her satırda "<path>: { ... }" yakala
  // Yeterli olan: her path için { branches, functions, lines, statements } sayıları
  const block = match[1];
  const thresholds = {};

  // Path tanımları: './src/...' veya 'global'
  const pathRegex =
    /(?:'([^']+)'|"([^"]+)"|(global)):\s*{\s*branches:\s*(\d+),\s*functions:\s*(\d+),\s*lines:\s*(\d+),\s*statements:\s*(\d+),?\s*}/g;
  let m;
  while ((m = pathRegex.exec(block))) {
    const key = m[1] || m[2] || m[3];
    thresholds[key] = {
      branches: parseInt(m[4], 10),
      functions: parseInt(m[5], 10),
      lines: parseInt(m[6], 10),
      statements: parseInt(m[7], 10),
    };
  }
  return { src, thresholds };
}

/** Yeni threshold = floor(pct - tampon), eski threshold'tan yüksekse uygula. */
function computeNew(measuredPct, oldThreshold) {
  const result = {};
  let changed = false;
  for (const m of METRICS) {
    const measured = measuredPct[m] ?? 0;
    // Branch coverage daha volatil → +1 ekstra tampon
    const extra = m === 'branches' ? 1 : 0;
    const proposed = Math.max(0, Math.floor(measured - BUFFER - extra));
    const old = oldThreshold[m] ?? 0;
    // Ratchet: sadece yukarı, en az 1 puan delta
    const next = proposed > old ? proposed : old;
    if (next !== old) changed = true;
    result[m] = next;
  }
  return { result, changed };
}

/** jest.config.cjs içinde belirli bir path'in threshold'larını güncelle. */
function patchJestConfig(src, pathKey, newThresholds) {
  // Path key 'global' ise farklı pattern
  const isGlobal = pathKey === 'global';
  const keyPattern = isGlobal
    ? 'global'
    : `['"]${pathKey.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}['"]`;
  // Eski bloğu bul ve replace et
  const blockRegex = new RegExp(
    `(${keyPattern}:\\s*{)([^}]*)(})`,
    'm',
  );
  const newBody = `\n      branches: ${newThresholds.branches},\n      functions: ${newThresholds.functions},\n      lines: ${newThresholds.lines},\n      statements: ${newThresholds.statements},\n    `;
  return src.replace(blockRegex, `$1${newBody}$3`);
}

// ── Çalıştır ─────────────────────────────────────────────────────────────────

const { src: jestSrc, thresholds } = readJestConfig();
if (!thresholds) {
  console.error('[ratchet] jest.config.cjs içinde coverageThreshold parse edilemedi.');
  process.exit(2);
}

let updatedSrc = jestSrc;
let totalChanges = 0;
const report = [];

for (const [key, oldT] of Object.entries(thresholds)) {
  const measured = key === 'global' ? measureGlobal() : measurePath(key);
  if (!measured) {
    report.push({ key, status: 'SKIPPED (no coverage data)' });
    continue;
  }
  const { result: newT, changed } = computeNew(measured, oldT);
  report.push({
    key,
    measured,
    old: oldT,
    new: newT,
    changed,
  });
  if (changed) {
    totalChanges++;
    updatedSrc = patchJestConfig(updatedSrc, key, newT);
  }
}

// ── Rapor ────────────────────────────────────────────────────────────────────

console.log('\n=== Coverage Ratchet Raporu ===');
console.log(`Buffer: ${BUFFER}pt (branches +1)`);
console.log(`Mode: ${APPLY ? 'APPLY (jest.config.cjs güncellenecek)' : 'DRY-RUN'}\n`);

for (const r of report) {
  console.log(`📂 ${r.key}`);
  if (r.status) {
    console.log(`   ${r.status}\n`);
    continue;
  }
  for (const m of METRICS) {
    const oldV = r.old[m];
    const newV = r.new[m];
    const measuredV = r.measured[m].toFixed(1);
    const arrow = newV > oldV ? '→' : ' ';
    const flag = newV > oldV ? `+${newV - oldV}pt` : '';
    console.log(
      `   ${m.padEnd(11)}: ${String(oldV).padStart(3)} ${arrow} ${String(newV).padStart(3)} (ölçüm: ${measuredV}%) ${flag}`,
    );
  }
  console.log();
}

console.log(`Toplam değişiklik: ${totalChanges} path`);

if (APPLY && totalChanges > 0) {
  fs.writeFileSync(JEST_CONFIG_PATH, updatedSrc, 'utf8');
  console.log(`\n✓ jest.config.cjs güncellendi.`);
  console.log('  Git diff ile kontrol et: git diff apps/backend/jest.config.cjs');
} else if (APPLY) {
  console.log('\n• Hiçbir threshold değişmedi (zaten optimal veya tampon içinde).');
} else if (totalChanges > 0) {
  console.log('\n• Uygulamak için: node scripts/coverage-ratchet.js --apply');
}
