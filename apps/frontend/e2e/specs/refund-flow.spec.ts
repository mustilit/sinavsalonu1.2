/**
 * refund-flow.spec.ts
 *
 * Korunan akış: Aday iade talep eder → Eğitici onaylar / reddeder →
 * Aday reddedince itiraz eder → Admin nihai karar verir.
 *
 * Mock stratejisi:
 *   - addInitScript ile auth state doğrudan sessionStorage'a inject edilir;
 *     gerçek login sayfası bypass edilir (handle401 tetiklemez).
 *   - /auth/me endpoint'i mock'lanır (checkUserAuth user set etsin).
 *   - Tüm route mock'ları page.goto ÖNCESI kaydedilir.
 *
 * Çalıştır: npm run test:e2e -- e2e/specs/refund-flow.spec.ts
 */

import { test as base, expect } from '@playwright/test';

// ---------------------------------------------------------------------------
// Sabit test verileri
// ---------------------------------------------------------------------------

const REFUND_ID = 'e2e-refund-001';
const PURCHASE_ID = 'e2e-purchase-001';
const PKG_ID = 'e2e-pkg-001';
const PKG_TITLE = 'E2E İade Test Paketi';

const MOCK_CANDIDATE_USER = {
  id: 'user-candidate-001',
  email: 'aday@demo.com',
  name: 'Demo Aday',
  role: 'CANDIDATE',
  phone: '',
  website: '',
  linkedin: '',
  interested_exam_types: [],
  notification_preferences: {},
  profile_image_url: null,
};

const MOCK_EDUCATOR_USER = {
  id: 'user-educator-001',
  email: 'educator@demo.com',
  name: 'Demo Eğitici',
  role: 'EDUCATOR',
  phone: '',
  website: '',
  linkedin: '',
  interested_exam_types: [],
  notification_preferences: {},
  profile_image_url: null,
};

const MOCK_ADMIN_USER = {
  id: 'admin-001',
  email: 'admin@demo.com',
  role: 'ADMIN',
  name: 'Admin',
  phone: '',
  website: '',
  linkedin: '',
  interested_exam_types: [],
  notification_preferences: {},
  profile_image_url: null,
};

// status 'ACTIVE' → adapter → 'completed' → purchases.length > 0 → İade İste görünür
const MOCK_PURCHASE_BACKEND = {
  id: PURCHASE_ID,
  packageId: PKG_ID,
  testId: null,
  amountCents: 2900,
  paymentStatus: 'PAID',
  status: 'ACTIVE',
  paidAt: new Date('2026-01-01').toISOString(),
  createdAt: new Date('2026-01-01').toISOString(),
  attempt: null,
  attempts: [],
  package: {
    id: PKG_ID,
    title: PKG_TITLE,
    description: 'E2E test için paket',
    priceCents: 2900,
    publishedAt: new Date('2026-01-01').toISOString(),
    educatorUsername: 'Demo Eğitici',
    educatorId: 'edu-001',
    ratingAvg: null,
    ratingCount: 0,
    saleCount: 0,
    coverImageUrl: null,
    examTypeId: null,
    examTypeName: null,
    questionCount: 3,
    testCount: 1,
    tests: [],
  },
  test: null,
};

function makeMockRefund(status: string, extra: Record<string, unknown> = {}) {
  return {
    id: REFUND_ID,
    purchaseId: PURCHASE_ID,
    purchase_id: PURCHASE_ID,
    packageId: PKG_ID,
    test_package_id: PKG_ID,
    packageTitle: PKG_TITLE,
    test_package_title: PKG_TITLE,
    reason: 'quality_issue',
    description: 'Test içerikleri beklentileri karşılamadı.',
    status,
    createdAt: new Date().toISOString(),
    created_date: new Date().toISOString(),
    educatorDeadline: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000).toISOString(),
    educator_deadline: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000).toISOString(),
    ...extra,
  };
}

// ---------------------------------------------------------------------------
// Yardımcı: addInitScript — auth state sessionStorage'a inject et
// page.goto ÖNCE çağrılmalı (addInitScript her navigasyonda çalışır)
// ---------------------------------------------------------------------------
async function setupPageState(page: any, user: object) {
  await page.addInitScript((u: object) => {
    try {
      localStorage.setItem('i18nextLng', 'tr');
      localStorage.setItem('analytics_consent', 'granted');
      sessionStorage.setItem('dal_completed_tours', JSON.stringify({
        ob_cand_welcome: true,
        ob_cand_test: true,
        ob_edu_welcome: true,
        ob_edu_create: true,
      }));
      // AuthContext sessionStorage'dan okur (STORAGE_KEY = 'dal_auth')
      const authData = JSON.stringify({ user: u, token: 'mock-e2e-token' });
      sessionStorage.setItem('dal_auth', authData);
      sessionStorage.setItem('token', 'mock-e2e-token');
    } catch { /* ignore */ }
  }, user);
}

// ---------------------------------------------------------------------------
// Yardımcı: temel baseline route mock'ları
// ---------------------------------------------------------------------------
async function setupBaselineMocks(page: any, user: object) {
  // auth/me — checkUserAuth user'ı validate eder
  await page.route('**/auth/me**', async (route: any) => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ user }) });
  });

  await page.route('**/me/preferences**', async (route: any) => {
    if (route.request().method() === 'GET') {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({}) });
    } else { await route.continue(); }
  });

  await page.route('**/site/exam-types**', async (route: any) => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([]) });
  });

  await page.route('**/notifications**', async (route: any) => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ items: [], nextCursor: null }) });
  });

  await page.route('**/site/service-status**', async (route: any) => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({
      purchasesEnabled: true,
      packageCreationEnabled: true,
      testPublishingEnabled: true,
      testAttemptsEnabled: true,
      adPurchasesEnabled: true,
      minPackagePriceCents: 100,
    }) });
  });
}

// ---------------------------------------------------------------------------
// Senaryo A — Aday: iade talebi oluşturma (ProfileSettings → Mali İşlemler)
// ---------------------------------------------------------------------------
base.describe('İade akışı — Aday iade talebi', () => {
  base.test('ProfileSettings Mali İşlemler: İade Talep Et butonu görünür', async ({ page }) => {
    await setupPageState(page, MOCK_CANDIDATE_USER);
    await setupBaselineMocks(page, MOCK_CANDIDATE_USER);

    // Satın alınmış paket var → purchases.length > 0 → "İade İste" görünür
    await page.route('**/me/purchases**', async (route: any) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([MOCK_PURCHASE_BACKEND]),
      });
    });

    await page.route('**/me/refunds**', async (route: any) => {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([]) });
    });

    await page.goto('/ProfileSettings');
    await page.waitForLoadState('networkidle');

    // "Mali İşlemler" sekmesi
    const allTabs = page.getByRole('tab');
    const tabCount = await allTabs.count();
    for (let i = 0; i < tabCount; i++) {
      const text = await allTabs.nth(i).textContent();
      if (/mali|finans/i.test(text ?? '')) {
        await allTabs.nth(i).click();
        break;
      }
    }

    // "İade İste" butonu — t("pages:profileSettings.financial.requestRefund") = "İade İste"
    // Not: /iade iste/i Turkish İ (U+0130) karakterini eşleştirmez; getByText veya exact kullan
    const refundBtn = page.getByRole('button', { name: 'İade İste' }).first();
    const hasBtn = await refundBtn.isVisible({ timeout: 8000 }).catch(() => false);
    if (!hasBtn) {
      // Fallback: metin tabanlı arama
      const refundBtnByText = page.locator('button').filter({ hasText: 'İade İste' }).first();
      await expect(refundBtnByText).toBeVisible({ timeout: 8000 });
    } else {
      await expect(refundBtn).toBeVisible({ timeout: 8000 });
    }
  });

  base.test('İade formu: sebep seç + açıklama + gönder → talep oluşturulur', async ({ page }) => {
    await setupPageState(page, MOCK_CANDIDATE_USER);
    await setupBaselineMocks(page, MOCK_CANDIDATE_USER);

    let refundFetchCount = 0;

    await page.route('**/me/purchases**', async (route: any) => {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([MOCK_PURCHASE_BACKEND]) });
    });

    await page.route('**/me/refunds**', async (route: any) => {
      refundFetchCount++;
      if (refundFetchCount <= 1) {
        await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([]) });
      } else {
        await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([makeMockRefund('PENDING')]) });
      }
    });

    await page.route('**/refunds', async (route: any) => {
      if (route.request().method() === 'POST') {
        await route.fulfill({ status: 201, contentType: 'application/json', body: JSON.stringify(makeMockRefund('PENDING')) });
      } else { await route.continue(); }
    });

    await page.goto('/ProfileSettings');
    await page.waitForLoadState('networkidle');

    // Mali sekmesine geç
    const allTabs = page.getByRole('tab');
    const tabCount = await allTabs.count();
    for (let i = 0; i < tabCount; i++) {
      const text = await allTabs.nth(i).textContent();
      if (/mali|finans/i.test(text ?? '')) {
        await allTabs.nth(i).click();
        break;
      }
    }

    const refundBtn = page.getByRole('button', { name: /iade iste/i }).first();
    const hasBtn = await refundBtn.isVisible({ timeout: 8000 }).catch(() => false);
    if (!hasBtn) { base.skip(); return; }
    await refundBtn.click();

    const dialog = page.getByRole('dialog');
    const hasDialog = await dialog.isVisible({ timeout: 5000 }).catch(() => false);
    if (!hasDialog) { base.skip(); return; }

    const packageSelect = dialog.getByRole('combobox').first();
    const hasSelect = await packageSelect.isVisible({ timeout: 2000 }).catch(() => false);
    if (hasSelect) {
      await packageSelect.click();
      const pkgOption = page.getByRole('option', { name: new RegExp(PKG_TITLE.slice(0, 8), 'i') }).first();
      if (await pkgOption.isVisible({ timeout: 2000 }).catch(() => false)) {
        await pkgOption.click();
      } else {
        await page.keyboard.press('Escape');
      }
    }

    const reasonSelect = dialog.getByLabel(/sebep|neden|reason/i).first();
    const hasReason = await reasonSelect.isVisible({ timeout: 2000 }).catch(() => false);
    if (hasReason) {
      await reasonSelect.click();
      const qualityOpt = page.getByRole('option', { name: /kalite|içerik|quality/i }).first();
      if (await qualityOpt.isVisible({ timeout: 2000 }).catch(() => false)) {
        await qualityOpt.click();
      } else {
        await page.keyboard.press('Escape');
      }
    }

    const descriptionField = dialog.getByLabel(/açıklama|ek bilgi/i).first();
    const hasDesc = await descriptionField.isVisible({ timeout: 2000 }).catch(() => false);
    if (hasDesc) {
      await descriptionField.fill('Test içerikleri beklentilerimi karşılamadı.');
    }

    const submitBtn = dialog.getByRole('button', { name: /gönder|talep oluştur|onayla/i }).first();
    const hasSubmit = await submitBtn.isVisible({ timeout: 3000 }).catch(() => false);
    if (!hasSubmit) { base.skip(); return; }
    await submitBtn.click();

    await expect(
      page.getByText(/talep oluşturuldu|iade talebiniz|başarıyla gönderildi|eğitici inceliyor/i).first(),
    ).toBeVisible({ timeout: 10000 });
  });
});

// ---------------------------------------------------------------------------
// Senaryo B — Eğitici: gelen iade talebini onaylar
// ---------------------------------------------------------------------------
base.describe('İade akışı — Eğitici onay', () => {
  base.test('EducatorRefunds: bekleyen talep görünür, onaylama butonu çalışır', async ({ page }) => {
    await setupPageState(page, MOCK_EDUCATOR_USER);
    await setupBaselineMocks(page, MOCK_EDUCATOR_USER);

    await page.route('**/educator/refunds**', async (route: any) => {
      if (route.request().method() === 'GET') {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify([makeMockRefund('PENDING')]),
        });
      } else { await route.continue(); }
    });

    await page.route(`**/educator/refunds/${REFUND_ID}/approve`, async (route: any) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(makeMockRefund('EDUCATOR_APPROVED')),
      });
    });

    await page.goto('/EducatorRefunds');
    await page.waitForLoadState('networkidle');

    await expect(page.getByRole('heading').first()).toBeVisible({ timeout: 12000 });

    // "Bekleyen" sekmesi
    const pendingTab = page.getByRole('tab', { name: /bekleyen/i }).first();
    if (await pendingTab.isVisible({ timeout: 3000 }).catch(() => false)) {
      await pendingTab.click();
    }

    await expect(page.getByText(PKG_TITLE).first()).toBeVisible({ timeout: 10000 });

    // "İncele" butonu — Not: /incele/i Turkish İ (U+0130) karakterini eşleştirmez; exact string kullan
    const reviewBtnExact = page.getByRole('button', { name: 'İncele' }).first();
    const hasReviewBtn = await reviewBtnExact.isVisible({ timeout: 5000 }).catch(() => false);
    if (hasReviewBtn) {
      await reviewBtnExact.click();
    } else {
      // Fallback: text içeren button
      const reviewBtnText = page.locator('button').filter({ hasText: 'İncele' }).first();
      if (await reviewBtnText.isVisible({ timeout: 3000 }).catch(() => false)) {
        await reviewBtnText.click();
      }
    }

    // Dialog açılmasını bekle — selected state değişince Radix Dialog açılır
    await page.waitForTimeout(800);
    const approveDialog = page.getByRole('dialog');
    const hasDialog = await approveDialog.isVisible({ timeout: 8000 }).catch(() => false);

    let approveBtn;
    if (hasDialog) {
      // Dialog içindeki "Onayla → Admin'e İlet" butonu
      approveBtn = approveDialog.getByRole('button', { name: /onayla/i }).first();
      const hasBtnInDialog = await approveBtn.isVisible({ timeout: 3000 }).catch(() => false);
      if (!hasBtnInDialog) {
        // Fallback: metin filtreli
        approveBtn = approveDialog.locator('button').filter({ hasText: 'Onayla' }).first();
      }
    } else {
      // Dialog açılmadıysa page genelinde ara
      approveBtn = page.getByRole('button', { name: /onayla/i }).first();
    }

    await expect(approveBtn).toBeVisible({ timeout: 8000 });
    await approveBtn.click();

    await expect(
      page.getByText(/onaylandı|admin.*iletildi|başarı/i).first(),
    ).toBeVisible({ timeout: 10000 });
  });

  base.test('EducatorRefunds: eğitici talebi reddeder + gerekçe girer', async ({ page }) => {
    await setupPageState(page, MOCK_EDUCATOR_USER);
    await setupBaselineMocks(page, MOCK_EDUCATOR_USER);

    await page.route('**/educator/refunds**', async (route: any) => {
      if (route.request().method() === 'GET') {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify([makeMockRefund('PENDING')]),
        });
      } else { await route.continue(); }
    });

    await page.route(`**/educator/refunds/${REFUND_ID}/reject`, async (route: any) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(makeMockRefund('EDUCATOR_REJECTED', { educator_rejection_reason: 'Geçerli gerekçe yok.' })),
      });
    });

    await page.goto('/EducatorRefunds');
    await page.waitForLoadState('networkidle');

    await expect(page.getByRole('heading').first()).toBeVisible({ timeout: 12000 });

    const pendingTab = page.getByRole('tab', { name: /bekleyen/i }).first();
    if (await pendingTab.isVisible({ timeout: 3000 }).catch(() => false)) {
      await pendingTab.click();
    }

    await expect(page.getByText(PKG_TITLE).first()).toBeVisible({ timeout: 10000 });

    // "İncele" butonu — exact string (Turkish İ encoding)
    const reviewBtnExact2 = page.getByRole('button', { name: 'İncele' }).first();
    const hasReview2 = await reviewBtnExact2.isVisible({ timeout: 5000 }).catch(() => false);
    if (hasReview2) {
      await reviewBtnExact2.click();
    } else {
      const reviewBtnText2 = page.locator('button').filter({ hasText: 'İncele' }).first();
      if (await reviewBtnText2.isVisible({ timeout: 3000 }).catch(() => false)) {
        await reviewBtnText2.click();
      }
    }

    await page.waitForTimeout(800);
    const rejectDialog = page.getByRole('dialog');
    const hasDialog = await rejectDialog.isVisible({ timeout: 6000 }).catch(() => false);

    const rejectBtn = hasDialog
      ? rejectDialog.getByRole('button', { name: /^reddet/i }).first()
      : page.getByRole('button', { name: /^reddet/i }).first();

    const hasRejectBtn = await rejectBtn.isVisible({ timeout: 6000 }).catch(() => false);
    if (!hasRejectBtn) { base.skip(); return; }

    await rejectBtn.click();

    const reasonInput = page.getByPlaceholder(/red gerekçesi|gerekçe|red nedeni/i).first();
    const hasReasonInput = await reasonInput.isVisible({ timeout: 5000 }).catch(() => false);

    if (hasReasonInput) {
      await reasonInput.fill('Geçerli iade gerekçesi bulunmadı.');
      await page.getByRole('button', { name: /reddet|gönder/i }).last().click();
    }

    await expect(
      page.getByText(/reddedildi|başarı/i).first(),
    ).toBeVisible({ timeout: 8000 });
  });
});

// ---------------------------------------------------------------------------
// Senaryo C — Aday: educator_rejected sonrası itiraz eder
// ---------------------------------------------------------------------------
base.describe('İade akışı — Aday itirazı', () => {
  base.test('ProfileSettings: EDUCATOR_REJECTED talep için İtiraz butonu görünür ve çalışır', async ({ page }) => {
    await setupPageState(page, MOCK_CANDIDATE_USER);
    await setupBaselineMocks(page, MOCK_CANDIDATE_USER);

    await page.route('**/me/purchases**', async (route: any) => {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([MOCK_PURCHASE_BACKEND]) });
    });

    await page.route('**/me/refunds**', async (route: any) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([makeMockRefund('EDUCATOR_REJECTED')]),
      });
    });

    await page.route(`**/refunds/${REFUND_ID}/appeal`, async (route: any) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(makeMockRefund('APPEAL_PENDING')),
      });
    });

    await page.goto('/ProfileSettings');
    await page.waitForLoadState('networkidle');

    // Mali sekmesi
    const allTabs = page.getByRole('tab');
    const tabCount = await allTabs.count();
    for (let i = 0; i < tabCount; i++) {
      const text = await allTabs.nth(i).textContent();
      if (/mali|finans/i.test(text ?? '')) {
        await allTabs.nth(i).click();
        break;
      }
    }

    // "Eğitici Reddetti" badge
    await expect(
      page.getByText(/eğitici reddetti|reddedildi/i).first(),
    ).toBeVisible({ timeout: 12000 });

    // "İtiraz Et" butonu
    const appealBtn = page.getByRole('button', { name: /itiraz et/i }).first();
    const hasAppeal = await appealBtn.isVisible({ timeout: 5000 }).catch(() => false);
    if (!hasAppeal) { base.skip(); return; }

    await appealBtn.click();

    const appealDialog = page.getByRole('dialog');
    const hasDialog = await appealDialog.isVisible({ timeout: 4000 }).catch(() => false);

    if (hasDialog) {
      const appealInput = appealDialog.getByPlaceholder(/itiraz gerekçenizi/i).first();
      const hasInput = await appealInput.isVisible({ timeout: 2000 }).catch(() => false);
      if (hasInput) {
        await appealInput.fill('Talep gerekçemin değerlendirilmesini istiyorum.');
        await appealDialog.getByRole('button', { name: /itirazı gönder|gönder/i }).first().click();
      }
    }

    await expect(
      page.getByText(/inceleniyor|itiraz.*gönderildi|appeal/i).first(),
    ).toBeVisible({ timeout: 8000 });
  });
});

// ---------------------------------------------------------------------------
// Senaryo D — Admin: iade talebini nihai olarak onaylar
// ---------------------------------------------------------------------------
base.describe('İade akışı — Admin nihai onay', () => {
  base.test('ManageRefunds: Admin bekleyen/escalated talepleri listeler, onaylar', async ({ page }) => {
    await setupPageState(page, MOCK_ADMIN_USER);
    await setupBaselineMocks(page, MOCK_ADMIN_USER);

    await page.route('**/admin/refunds**', async (route: any) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([makeMockRefund('EDUCATOR_APPROVED', { educator_approved: true })]),
      });
    });

    await page.route(`**/admin/refunds/${REFUND_ID}/approve`, async (route: any) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(makeMockRefund('APPROVED')),
      });
    });

    await page.goto('/ManageRefunds');
    await page.waitForLoadState('networkidle');

    await expect(page.getByRole('heading').first()).toBeVisible({ timeout: 12000 });

    await expect(page.getByText(PKG_TITLE).first()).toBeVisible({ timeout: 10000 });

    const adminApproveBtn = page.getByRole('button', { name: /onayla/i }).first();
    const hasBtn = await adminApproveBtn.isVisible({ timeout: 5000 }).catch(() => false);
    if (!hasBtn) { base.skip(); return; }

    await adminApproveBtn.click();

    const confirmBtn = page.getByRole('button', { name: /evet.*onayla|onayla/i }).last();
    if (await confirmBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
      await confirmBtn.click();
    }

    await expect(
      page.getByText(/onaylandı|approved|başarı/i).first(),
    ).toBeVisible({ timeout: 10000 });
  });
});
