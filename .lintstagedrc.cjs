/**
 * lint-staged config — Sınav Salonu monorepo.
 *
 * Function form kullanılır çünkü:
 *   - Backend tsc tüm projeyi kontrol eder (staged dosya argümanı kabul etmez)
 *   - Frontend ESLint relative path'i kendi tsconfig'inden çözümler
 *   - Windows + monorepo'da `cd subdir &&` güvensiz
 *
 * Hook'u atlamak için: git commit --no-verify (önerilmez).
 */

const path = require('path');

module.exports = {
  // Backend TS dosyaları staged ise → tüm backend project'i tsc --noEmit
  // (tek dosya bağlam izolasyonu yapmak monorepo'da risk; full check güvenli).
  'apps/backend/**/*.ts': () => [
    'npm --prefix apps/backend run typecheck',
  ],

  // Frontend JS/JSX staged ise → cross-platform Node script ile ESLint --fix
  // (Windows cmd.exe `cd subdir &&` formatını yanlış yorumluyordu; Git Bash + cmd
  // farklı davranır). scripts/lint-staged-frontend.js cwd'yi process.chdir ile
  // bağımsız ayarlar.
  'apps/frontend/**/*.{js,jsx}': (files) => {
    if (files.length === 0) return [];
    const args = files.map((f) => `"${f}"`).join(' ');
    return [`node scripts/lint-staged-frontend.js ${args}`];
  },
};
