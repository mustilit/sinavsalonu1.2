#!/usr/bin/env node
/**
 * Cross-platform ESLint runner — lint-staged için.
 *
 * Windows + Linux + macOS aynı şekilde çalışır. `cd apps/frontend && npx ...`
 * Windows cmd.exe'de path resolution problemi yaratıyordu.
 *
 * KULLANIM (lint-staged.cjs içinden):
 *   node scripts/lint-staged-frontend.js <file1> <file2> ...
 *
 * Path'ler repo root'tan absolute geliyor; apps/frontend relative'e çevrilir.
 */

const { execSync } = require('child_process');
const path = require('path');

const files = process.argv.slice(2);
if (files.length === 0) process.exit(0);

const frontendDir = path.join(__dirname, '..', 'apps', 'frontend');

// Path'leri apps/frontend kökünden relative yap
const relPaths = files
  .map((f) => {
    const abs = path.resolve(f);
    return path.relative(frontendDir, abs).replace(/\\/g, '/');
  })
  .map((f) => `"${f}"`)
  .join(' ');

try {
  execSync(`npx eslint --fix --no-warn-ignored ${relPaths}`, {
    cwd: frontendDir,
    stdio: 'inherit',
  });
} catch (err) {
  process.exit(err.status || 1);
}
