#!/usr/bin/env node
/**
 * Prisma schema'dan Mermaid ER diagram üretici (sıfır dependency).
 *
 * Çıktı: docs/architecture/er-diagram.md (GitHub Mermaid native render eder).
 *
 * Çalıştırma:
 *   node scripts/generate-er-diagram.js            → docs/architecture/er-diagram.md
 *   node scripts/generate-er-diagram.js --check    → diff kontrolü (CI gate)
 *
 * CI:
 *   .github/workflows/backend-migrate-and-test.yml job'ına eklenir.
 *   PR'da schema değiştiyse ER diagram güncellenmediyse CI kırmızı yapar (--check).
 */

const fs = require('fs');
const path = require('path');

const SCHEMA = path.join(__dirname, '..', 'prisma', 'schema.prisma');
const OUTPUT = path.join(__dirname, '..', '..', '..', 'docs', 'architecture', 'er-diagram.md');

const CHECK = process.argv.includes('--check');

if (!fs.existsSync(SCHEMA)) {
  console.error('[erd] schema.prisma bulunamadı:', SCHEMA);
  process.exit(1);
}

const src = fs.readFileSync(SCHEMA, 'utf8');

// ── Parse: enum'lar ──────────────────────────────────────────────────────────
const enums = new Set();
const enumRegex = /enum\s+(\w+)\s*\{/g;
let m;
while ((m = enumRegex.exec(src))) enums.add(m[1]);

// ── Parse: modeller + alanlar + ilişkiler ────────────────────────────────────
const models = []; // { name, fields: [{ name, type, attrs }], relations: [{ to, cardinality }] }
const modelRegex = /model\s+(\w+)\s*\{([\s\S]*?)\n\}/g;
let mm;
while ((mm = modelRegex.exec(src))) {
  const modelName = mm[1];
  const body = mm[2];
  const fields = [];
  const relations = [];

  for (const rawLine of body.split('\n')) {
    const line = rawLine.trim();
    if (!line || line.startsWith('//') || line.startsWith('@@')) continue;
    // Format: <name>  <type>[?|[]]  <@attrs...>
    const fieldMatch = line.match(/^(\w+)\s+([\w[\]?]+)(.*)/);
    if (!fieldMatch) continue;
    const fieldName = fieldMatch[1];
    const fieldTypeRaw = fieldMatch[2];
    const rest = fieldMatch[3].trim();

    const isOptional = fieldTypeRaw.endsWith('?');
    const isList = fieldTypeRaw.endsWith('[]');
    const baseType = fieldTypeRaw.replace(/[?\[\]]/g, '');

    // İlişki tespiti: tipi başka bir model ise
    const isModelRef = models.some((mx) => mx.name === baseType) || (() => {
      // İleri-bildirim: regex tek pass; ileride başka modellere bakacağız.
      return src.match(new RegExp(`\\bmodel\\s+${baseType}\\s*\\{`));
    })();

    if (isModelRef && !enums.has(baseType)) {
      relations.push({
        from: modelName,
        to: baseType,
        field: fieldName,
        cardinality: isList ? '||--o{' : isOptional ? '||--o|' : '||--||',
      });
    }

    const isId = rest.includes('@id');
    const isUnique = rest.includes('@unique');
    const isFk = rest.includes('@relation');

    // Skalar veya enum field'ı tabloya ekle (ilişki referans field'ları için
    // foreign key olanları da skalar olarak gösterir; ilişki çizgisi ayrıca).
    const isScalar = !isModelRef || enums.has(baseType);
    if (isScalar || isFk) {
      fields.push({
        name: fieldName,
        type: baseType + (isList ? '[]' : '') + (isOptional ? '?' : ''),
        marker: isId ? 'PK' : isUnique ? 'UK' : isFk ? 'FK' : '',
      });
    }
  }

  models.push({ name: modelName, fields, relations });
}

// ── Mermaid markdown üret ────────────────────────────────────────────────────
const lines = [];
lines.push('# ER Diagram');
lines.push('');
lines.push('> Bu dosya `scripts/generate-er-diagram.js` tarafından otomatik üretildi.');
lines.push('> Elle düzenleme; schema.prisma değişince CI tarafından yeniden üretilir.');
lines.push('');
lines.push(`**Toplam:** ${models.length} model, ${enums.size} enum, ${models.reduce((s, m) => s + m.relations.length, 0)} ilişki`);
lines.push('');
lines.push('```mermaid');
lines.push('erDiagram');

for (const model of models) {
  lines.push(`  ${model.name} {`);
  for (const f of model.fields.slice(0, 15)) {
    // Mermaid alan adlarında özel karakter desteklemez → temizle
    const typeName = f.type.replace(/[?\[\]]/g, '');
    const marker = f.marker ? ` ${f.marker}` : '';
    lines.push(`    ${typeName} ${f.name}${marker}`);
  }
  if (model.fields.length > 15) {
    lines.push(`    rest_${model.fields.length - 15}_fields  "..."`);
  }
  lines.push('  }');
}
lines.push('');

// İlişkileri tekilleştir
const seen = new Set();
for (const model of models) {
  for (const rel of model.relations) {
    const key = `${rel.from}->${rel.to}:${rel.field}`;
    if (seen.has(key)) continue;
    seen.add(key);
    lines.push(`  ${rel.from} ${rel.cardinality} ${rel.to} : "${rel.field}"`);
  }
}

lines.push('```');
lines.push('');
lines.push('## Modeller');
lines.push('');
lines.push('| Model | Alan sayısı | İlişki sayısı |');
lines.push('|---|---|---|');
for (const model of models) {
  lines.push(`| ${model.name} | ${model.fields.length} | ${model.relations.length} |`);
}
lines.push('');
lines.push('## Enum\'lar');
lines.push('');
lines.push([...enums].sort().join(', '));
lines.push('');
lines.push('---');
lines.push('');
lines.push('*Üretim tarihi: ' + new Date().toISOString() + '*');

const newContent = lines.join('\n') + '\n';

if (CHECK) {
  if (!fs.existsSync(OUTPUT)) {
    console.error('[erd:check] ER diagram yok ama schema değişti. `npm run db:erd` çalıştır.');
    process.exit(2);
  }
  const existing = fs.readFileSync(OUTPUT, 'utf8');
  // Tarih satırı her zaman değişir; karşılaştırırken o satırı atla
  const stripDate = (s) => s.replace(/\*Üretim tarihi:.*\*/g, '*Üretim tarihi: TIMESTAMP*');
  if (stripDate(existing) !== stripDate(newContent)) {
    console.error('[erd:check] Schema değişmiş ama er-diagram.md güncel değil.');
    console.error('  Yapılacak: cd apps/backend && npm run db:erd');
    process.exit(3);
  }
  console.log('[erd:check] ER diagram güncel.');
  process.exit(0);
}

// Output dir varsa yaz
const outDir = path.dirname(OUTPUT);
if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });
fs.writeFileSync(OUTPUT, newContent, 'utf8');
console.log(`[erd] ${OUTPUT} güncellendi.`);
console.log(`  ${models.length} model · ${enums.size} enum · ${[...seen].length} ilişki`);
