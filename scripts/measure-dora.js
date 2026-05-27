#!/usr/bin/env node
/**
 * DORA Metrics ölçüm scripti.
 *
 * 4 metrik:
 *   1. Deployment Frequency       — release tag/main push'u sıklığı
 *   2. Lead Time for Changes      — first commit → release tag (medyan)
 *   3. Mean Time to Restore       — incident issue açılış → close (medyan)
 *   4. Change Failure Rate        — bug/incident issue / total deployment
 *
 * Veri kaynağı: GitHub API + lokal git log.
 *
 * KULLANIM:
 *   DAYS_BACK=30 GITHUB_TOKEN=ghp_xxx node scripts/measure-dora.js
 *
 * Çıktı: stdout'a Markdown rapor (CI'da issue olarak yayınlanır).
 */

const { execSync } = require('child_process');

const DAYS_BACK = parseInt(process.env.DAYS_BACK || '30', 10);
const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
const REPO = process.env.GITHUB_REPOSITORY || 'mustilit/sinavsalonu1_6';

const since = new Date(Date.now() - DAYS_BACK * 24 * 60 * 60 * 1000);
const sinceIso = since.toISOString();

function ghFetch(path) {
  if (!GITHUB_TOKEN) return null;
  try {
    const cmd = `curl -s -H "Authorization: Bearer ${GITHUB_TOKEN}" -H "Accept: application/vnd.github+json" "https://api.github.com${path}"`;
    return JSON.parse(execSync(cmd, { encoding: 'utf8' }));
  } catch (e) {
    return null;
  }
}

function gitLog(args) {
  try {
    return execSync(`git log ${args}`, { encoding: 'utf8' });
  } catch (e) {
    return '';
  }
}

// ─── 1. Deployment Frequency ──────────────────────────────────────────────
// main branch'e merge edilen commit sayısı (deployment proxy)
const mainCommits = gitLog(`--oneline --since="${sinceIso}" main 2>/dev/null`).trim().split('\n').filter(Boolean);
const deploymentFrequency = mainCommits.length / DAYS_BACK; // per day

// ─── 2. Lead Time for Changes ─────────────────────────────────────────────
// PR merged içindeki ilk commit → merge arası süre (gün)
// Lokal git'ten direkt çıkaramayız; basit yaklaşım: tag'ler arası süre
const tags = execSync('git tag --sort=-creatordate | head -10', { encoding: 'utf8' })
  .trim()
  .split('\n')
  .filter(Boolean);

const leadTimes = [];
for (let i = 0; i < tags.length - 1; i++) {
  try {
    const prevDate = execSync(`git log -1 --format=%ai ${tags[i + 1]}`, { encoding: 'utf8' }).trim();
    const currDate = execSync(`git log -1 --format=%ai ${tags[i]}`, { encoding: 'utf8' }).trim();
    const diffDays = (new Date(currDate) - new Date(prevDate)) / (1000 * 60 * 60 * 24);
    if (diffDays > 0 && diffDays < 100) leadTimes.push(diffDays);
  } catch (e) {
    /* skip */
  }
}
leadTimes.sort((a, b) => a - b);
const leadTimeMedian = leadTimes.length > 0 ? leadTimes[Math.floor(leadTimes.length / 2)] : null;

// ─── 3. MTTR + Change Failure Rate (GitHub Issues) ───────────────────────
let mttrMedian = null;
let changeFailureRate = null;

if (GITHUB_TOKEN) {
  const incidents = ghFetch(`/repos/${REPO}/issues?labels=incident,bug&state=closed&since=${sinceIso}&per_page=100`);
  if (Array.isArray(incidents)) {
    const ttrs = incidents
      .filter((i) => i.closed_at && i.created_at)
      .map((i) => (new Date(i.closed_at) - new Date(i.created_at)) / (1000 * 60 * 60)); // saat
    ttrs.sort((a, b) => a - b);
    mttrMedian = ttrs.length > 0 ? ttrs[Math.floor(ttrs.length / 2)] : null;

    // Change Failure Rate: incident / deployment
    if (mainCommits.length > 0) {
      changeFailureRate = (incidents.length / mainCommits.length) * 100;
    }
  }
}

// ─── Rapor ────────────────────────────────────────────────────────────────
const out = [];
out.push(`# DORA Metrics — Son ${DAYS_BACK} Gün\n`);
out.push(`**Tarih aralığı:** ${since.toISOString().slice(0, 10)} → ${new Date().toISOString().slice(0, 10)}\n`);

out.push(`## 1. Deployment Frequency 🚀`);
out.push(`- Toplam commit: **${mainCommits.length}**`);
out.push(`- Günlük ortalama: **${deploymentFrequency.toFixed(2)}**`);
out.push(`- Seviye: ${
  deploymentFrequency >= 1 ? '🟢 Elite (>1/gün)' :
  deploymentFrequency >= 0.14 ? '🟡 High (haftada birkaç)' :
  deploymentFrequency >= 0.03 ? '🟠 Medium (aylık)' : '🔴 Low (aylıktan az)'
}\n`);

out.push(`## 2. Lead Time for Changes ⏱️`);
out.push(`- Medyan tag-arası süre: ${leadTimeMedian !== null ? `**${leadTimeMedian.toFixed(1)} gün**` : 'veri yok'}`);
out.push(`- Tag sayısı: ${tags.length}`);
out.push(`- Seviye: ${
  leadTimeMedian === null ? '⚪ Veri yok' :
  leadTimeMedian < 1 ? '🟢 Elite (<1 gün)' :
  leadTimeMedian < 7 ? '🟡 High (<1 hafta)' :
  leadTimeMedian < 30 ? '🟠 Medium (<1 ay)' : '🔴 Low (>1 ay)'
}\n`);

out.push(`## 3. Mean Time to Restore 🔧`);
if (mttrMedian !== null) {
  out.push(`- Medyan recovery süresi: **${mttrMedian.toFixed(1)} saat**`);
  out.push(`- Seviye: ${
    mttrMedian < 1 ? '🟢 Elite (<1h)' :
    mttrMedian < 24 ? '🟡 High (<24h)' :
    mttrMedian < 168 ? '🟠 Medium (<1 hafta)' : '🔴 Low (>1 hafta)'
  }`);
} else {
  out.push(`- Veri yok (GITHUB_TOKEN gerekli veya incident issue'sı yok)`);
}
out.push('');

out.push(`## 4. Change Failure Rate 📉`);
if (changeFailureRate !== null) {
  out.push(`- Oran: **${changeFailureRate.toFixed(1)}%**`);
  out.push(`- Seviye: ${
    changeFailureRate < 5 ? '🟢 Elite (<5%)' :
    changeFailureRate < 15 ? '🟡 High (<15%)' :
    changeFailureRate < 30 ? '🟠 Medium (<30%)' : '🔴 Low (>30%)'
  }`);
} else {
  out.push(`- Veri yok`);
}

out.push(`\n---`);
out.push(`*Otomatik üretildi: \`.github/workflows/dora-metrics.yml\`*`);

console.log(out.join('\n'));
