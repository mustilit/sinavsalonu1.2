#!/usr/bin/env node
/**
 * i18n key extraction script
 *
 * Sınav Salonu frontend 47 sayfa + 50 component. Çoğunda hâlâ Türkçe sabit
 * string'ler var. Bu script:
 *   1. src/pages/ + src/components/ altındaki tüm .jsx dosyalarını tarar
 *   2. JSX text node'ları + props.placeholder + props.title + props.label'da
 *      Türkçe karakter içeren sabit string'leri bulur
 *   3. Önerilen key'i üretir: pages.<dosya>.<text-slug>
 *   4. JSON çıktısı: scripts/i18n-extraction-report.json
 *   5. PR yorum modu: --check ile farkları gösterir
 *
 * KULLANIM:
 *   node scripts/i18n-extract.js                  → rapor + JSON çıktı
 *   node scripts/i18n-extract.js --update-locales → locales/tr/extracted.json güncelle
 *   node scripts/i18n-extract.js --check          → CI gate (yeni Türkçe string varsa fail)
 *
 * SCOPE NOTU: Bu script string'i otomatik DEĞİŞTİRMEZ. Sadece tespit eder ve
 * developer'ın elle migration yapması için bir rapor üretir. Otomatik
 * değiştirme JSX yapı bütünlüğünü bozabilir (template literal'da string
 * concatenation, ternary'de farklı dallar, vb.).
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const SCAN_DIRS = [
  path.join(ROOT, 'src', 'pages'),
  path.join(ROOT, 'src', 'components'),
];

const OUTPUT_JSON = path.join(__dirname, 'i18n-extraction-report.json');
const LOCALES_TR = path.join(ROOT, 'src', 'locales', 'tr', 'pages.json');

const args = process.argv.slice(2);
const UPDATE_LOCALES = args.includes('--update-locales');
const CHECK = args.includes('--check');

// Türkçe karakter setini içeren string'leri tespit etme regex'i.
// ASCII içeren ama Türkçe karakteri olmayan teknik string'leri (CSS class,
// id, vb.) atlamak için içerikte Türkçe karakter şartı koyarız.
const TR_CHAR_RE = /[ğĞüÜşŞıİöÖçÇ]/;

// JSX text node: > ...içerik... < (basit yaklaşım — perfect değil ama %90 yakalar)
const JSX_TEXT_RE = />\s*([^<>{}\n]{3,})\s*</g;

// Props: placeholder="...", title="...", aria-label="...", label="..."
const PROP_RE = /(placeholder|title|aria-label|label|alt|description)\s*=\s*(?:"([^"]+)"|'([^']+)'|\{['"]([^'"]+)['"]\})/g;

/** Slug üret: "Test Çözmeye Başla" → "testCozmeyeBasla" */
function slugify(text) {
  return text
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[ığİşŞ]/g, (c) => ({ ı: 'i', ğ: 'g', İ: 'I', ş: 's', Ş: 'S' }[c] || c))
    .replace(/[^a-zA-Z0-9 ]/g, '')
    .trim()
    .split(/\s+/)
    .map((word, i) =>
      i === 0
        ? word.toLowerCase()
        : word.charAt(0).toUpperCase() + word.slice(1).toLowerCase(),
    )
    .join('')
    .slice(0, 40);
}

function* walk(dir) {
  if (!fs.existsSync(dir)) return;
  for (const name of fs.readdirSync(dir)) {
    const full = path.join(dir, name);
    const stat = fs.statSync(full);
    if (stat.isDirectory()) {
      if (name === 'node_modules' || name === 'dist' || name === '__tests__') continue;
      yield* walk(full);
    } else if (/\.(jsx?|tsx?)$/.test(name) && !name.endsWith('.test.jsx') && !name.endsWith('.test.js')) {
      yield full;
    }
  }
}

const findings = [];
let totalFiles = 0;
let totalStrings = 0;

for (const dir of SCAN_DIRS) {
  for (const file of walk(dir)) {
    totalFiles++;
    const content = fs.readFileSync(file, 'utf8');
    const relPath = path.relative(ROOT, file).replace(/\\/g, '/');
    const pageName = path.basename(file, path.extname(file));

    // Mevcut t() çağrıları olan dosyalarda dahi yine ham TR string olabilir
    const usesI18n = /useTranslation\s*\(|i18nKey\s*=|\bt\s*\(/.test(content);

    // JSX text node'lar
    let m;
    const seenInFile = new Set();
    while ((m = JSX_TEXT_RE.exec(content))) {
      const text = m[1].trim();
      if (!TR_CHAR_RE.test(text)) continue;
      if (text.includes('{') || text.includes('}')) continue;
      if (seenInFile.has(text)) continue;
      seenInFile.add(text);

      // Yorum içinde mi? Basit kontrol
      const beforeIdx = m.index;
      const lineStart = content.lastIndexOf('\n', beforeIdx);
      const lineEnd = content.indexOf('\n', beforeIdx);
      const line = content.slice(lineStart + 1, lineEnd === -1 ? undefined : lineEnd);
      if (line.trim().startsWith('//') || line.trim().startsWith('*')) continue;

      const suggestedKey = `${pageName}.${slugify(text)}`;
      findings.push({
        file: relPath,
        location: 'jsx-text',
        text,
        suggestedKey,
        usesI18n,
      });
      totalStrings++;
    }

    // Props
    JSX_TEXT_RE.lastIndex = 0;
    while ((m = PROP_RE.exec(content))) {
      const propName = m[1];
      const text = (m[2] || m[3] || m[4] || '').trim();
      if (!text || !TR_CHAR_RE.test(text)) continue;
      if (seenInFile.has(text)) continue;
      seenInFile.add(text);

      const suggestedKey = `${pageName}.${propName}.${slugify(text)}`;
      findings.push({
        file: relPath,
        location: `prop:${propName}`,
        text,
        suggestedKey,
        usesI18n,
      });
      totalStrings++;
    }
    PROP_RE.lastIndex = 0;
  }
}

// ── Çıktı ────────────────────────────────────────────────────────────────────

// Dosya bazında grupla
const byFile = {};
for (const f of findings) {
  if (!byFile[f.file]) byFile[f.file] = [];
  byFile[f.file].push(f);
}

console.log(`\n=== i18n Extraction Raporu ===`);
console.log(`Taranan dosya: ${totalFiles}`);
console.log(`Bulunan Türkçe sabit string: ${totalStrings}`);
console.log(`Etkilenen dosya: ${Object.keys(byFile).length}`);
console.log(`\nTop 10 dosya (en çok hardcoded string):`);

const sortedFiles = Object.entries(byFile)
  .sort(([, a], [, b]) => b.length - a.length)
  .slice(0, 10);
for (const [file, items] of sortedFiles) {
  const i18nMark = items[0].usesI18n ? '🔧' : '❌';
  console.log(`  ${i18nMark} ${items.length.toString().padStart(3)} — ${file}`);
}

// JSON raporu yaz
fs.writeFileSync(OUTPUT_JSON, JSON.stringify({ summary: { totalFiles, totalStrings, affectedFiles: Object.keys(byFile).length }, findings }, null, 2));
console.log(`\nDetaylı rapor: ${path.relative(ROOT, OUTPUT_JSON)}`);

if (UPDATE_LOCALES) {
  // pages.json'a "extracted" namespace altında öneri ekle
  let pagesJson = {};
  if (fs.existsSync(LOCALES_TR)) {
    pagesJson = JSON.parse(fs.readFileSync(LOCALES_TR, 'utf8'));
  }
  pagesJson.extracted = pagesJson.extracted || {};
  for (const f of findings) {
    if (!pagesJson.extracted[f.suggestedKey]) {
      pagesJson.extracted[f.suggestedKey] = f.text;
    }
  }
  fs.writeFileSync(LOCALES_TR, JSON.stringify(pagesJson, null, 2));
  console.log(`\n✓ ${LOCALES_TR} güncellendi — ${Object.keys(pagesJson.extracted).length} key extracted namespace altında.`);
}

if (CHECK && totalStrings > 0) {
  console.error(`\n❌ CI gate: ${totalStrings} hardcoded Türkçe string tespit edildi.`);
  console.error('   Bunları t() çağrısı ile değiştir, sonra: npm run i18n:extract');
  process.exit(1);
}
