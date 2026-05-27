/**
 * Visual regression — Playwright native snapshot karşılaştırma.
 *
 * 5 kritik sayfa için ekran görüntüsü baseline'ı tutulur. Her PR'da
 * baseline ile karşılaştırılır; pixel diff %0.1'i aşarsa CI kırmızı.
 *
 * BASELINE OLUŞTURMA:
 *   npx playwright test e2e/specs/visual-regression.spec.ts --update-snapshots
 *
 * NORMAL ÇALIŞTIRMA:
 *   npx playwright test e2e/specs/visual-regression.spec.ts
 *
 * Diff sonucu test-results/ altında: actual.png, expected.png, diff.png
 *
 * KAPSAM:
 *   - Home (giriş yapmamış kullanıcı için landing)
 *   - Login form
 *   - TestDetail (paket detayı)
 *   - MyTests (aday kütüphane)
 *   - AdminDashboard
 *
 * Diğer akışlar (TakeTest, PaymentModal, etc.) zaten functional spec'lerde.
 * Bu dosya yalnızca pixel-perfect koruma için.
 *
 * UYARI:
 *   - Animasyonlar disabled: animations: 'disabled'
 *   - Font yükleme bekleniyor: waitForFonts
 *   - Dynamic content (tarih, sayı) maskeleniyor: mask option
 */

import { test, expect } from '@playwright/test';

const VIEWPORT = { width: 1280, height: 720 };
const TOLERANCE = { threshold: 0.1, maxDiffPixels: 100 };

// Animasyonları kapat, font'ları bekle, dynamic content'i maskele
async function preparePage(page: any) {
  await page.addStyleTag({
    content: `
      *, *::before, *::after {
        transition: none !important;
        animation: none !important;
      }
    `,
  });
  // Font'lar yüklenmeden snapshot alma
  await page.evaluate(() => document.fonts.ready);
}

test.describe('Visual regression — 5 kritik sayfa', () => {
  test.use({ viewport: VIEWPORT });

  test('Home page — landing görseli', async ({ page }) => {
    await page.goto('/', { waitUntil: 'networkidle' });
    await preparePage(page);
    await expect(page).toHaveScreenshot('home.png', {
      ...TOLERANCE,
      fullPage: false,
      // Tarih/saat içerikleri maske
      mask: [page.locator('[data-dynamic]')],
    });
  });

  test('Login form', async ({ page }) => {
    await page.goto('/Login', { waitUntil: 'networkidle' });
    await preparePage(page);
    await expect(page).toHaveScreenshot('login.png', { ...TOLERANCE });
  });

  test('TestDetail — paket detay sayfası', async ({ page }) => {
    // Demo paketler veya mock route — gerçek paket id bilinmediği için
    // marketplace ilk paketinden id al
    await page.goto('/Explore', { waitUntil: 'networkidle' });
    const firstPackage = page.locator('a[href*="/TestDetail"]').first();
    if ((await firstPackage.count()) === 0) {
      test.skip(true, 'Marketplace boş — TestDetail snapshot atlanıyor');
      return;
    }
    await firstPackage.click();
    await page.waitForLoadState('networkidle');
    await preparePage(page);
    await expect(page).toHaveScreenshot('test-detail.png', {
      ...TOLERANCE,
      mask: [
        page.locator('text=/satış|satıldı/i'), // dinamik satış sayısı
        page.locator('text=/\\d+ değerlendirme/i'),
      ],
    });
  });

  test('MyTests — kütüphane', async ({ page }) => {
    // Aday login gerekli — demo aday credential'ları
    await page.goto('/Login');
    await page.locator('input[type="email"]').fill('aday@demo.com');
    await page.locator('input[type="password"]').fill('demo123');
    await page.locator('button:has-text("Giriş Yap")').first().click();
    await page.waitForURL((url) => !url.pathname.includes('/Login'), { timeout: 15000 });

    await page.goto('/MyTests', { waitUntil: 'networkidle' });
    await preparePage(page);
    await expect(page).toHaveScreenshot('my-tests.png', {
      ...TOLERANCE,
      mask: [
        page.locator('text=/\\d+ test/i'),
        page.locator('text=/son.*çözüm/i'),
      ],
    });
  });

  test('AdminDashboard — admin paneli', async ({ page }) => {
    await page.goto('/Login');
    await page.locator('input[type="email"]').fill('admin@demo.com');
    await page.locator('input[type="password"]').fill('demo123');
    await page.locator('button:has-text("Giriş Yap")').first().click();
    await page.waitForURL((url) => !url.pathname.includes('/Login'), { timeout: 15000 });

    await page.goto('/AdminDashboard', { waitUntil: 'networkidle' });
    await preparePage(page);
    await expect(page).toHaveScreenshot('admin-dashboard.png', {
      ...TOLERANCE,
      mask: [
        page.locator('text=/\\d+/').first(), // stat sayıları
      ],
    });
  });
});
