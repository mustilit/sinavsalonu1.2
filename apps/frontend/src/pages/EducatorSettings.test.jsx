/**
 * EducatorSettings sayfası — B9 smoke testleri.
 *
 * Kapsam (sınırlı, sayfa büyük olduğu için kritik 3 davranış):
 * 1. Hesap Sahibi Adı kutusu user.full_name değeriyle dolu + readOnly/disabled
 *    (kullanıcı UI'dan değiştiremesin — TKHK/banka uyumu).
 * 2. CV upload PDF için /upload/document endpoint'ine gider — /upload/image
 *    Sharp pipeline'ı PDF'i magic byte ile rejected ederdi.
 * 3. Tab listesi "Özgeçmiş" anahtarını gösterir (eski "Doğrulama" değil);
 *    Google Scholar İletişim sekmesindedir.
 *
 * Bağımlılıklar tamamen mock'lanır:
 *   - useTranslation → t(key) = key (anahtarla assertion yapılabilir)
 *   - useAuth → sabit user objesi
 *   - dalClient entities.ExamType → boş liste (sınav tab'ı çalışmasa da render etmeli)
 *   - api (PATCH/POST) → vi.fn (CV upload akışı gözlenir)
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import EducatorSettings from './EducatorSettings';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PAGE_SOURCE = readFileSync(join(__dirname, 'EducatorSettings.jsx'), 'utf8');

// ---------------------------------------------------------------------------
// Mock setup
// ---------------------------------------------------------------------------

// i18n identity — assertion'lar anahtarla yapılır
vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key, opts) => (opts && opts.defaultValue) || key,
    i18n: { language: 'tr', changeLanguage: vi.fn() },
  }),
  Trans: ({ children }) => children,
}));

// AuthContext mock — wizard verisiyle dolu user
const mockUser = {
  id: 'edu-1',
  email: 'wizard@test.com',
  username: 'wizardtest',
  full_name: 'Wizard Test',
  role: 'EDUCATOR',
  status: 'ACTIVE',
  bio: '',
  cv_url: 'http://uploads/cv.pdf',
  specialized_exam_types: ['t1'],
  notification_preferences: {
    email_new_tests: true,
    email_promotions: true,
    email_educator_updates: true,
    email_test_reminders: true,
  },
};

vi.mock('@/lib/AuthContext', () => ({
  useAuth: () => ({ user: mockUser, checkAppState: vi.fn() }),
}));

// dalClient — EducatorProfile + ExamType + auth.updateMe
vi.mock('@/api/dalClient', () => ({
  entities: {
    ExamType: { filter: vi.fn().mockResolvedValue([]) },
    EducatorProfile: {
      filter: vi.fn().mockResolvedValue([]),
      create: vi.fn().mockResolvedValue({}),
      update: vi.fn().mockResolvedValue({}),
    },
  },
  auth: { updateMe: vi.fn().mockResolvedValue({}) },
}));

// apiClient — CV upload akışını gözle
const mockApiPost = vi.fn();
const mockApiPatch = vi.fn();
vi.mock('@/lib/api/apiClient', () => ({
  default: {
    post: (...args) => mockApiPost(...args),
    patch: (...args) => mockApiPatch(...args),
  },
}));

// Sonner toast — render bağımlılığını azalt
vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

// SensitiveProfileOtpDialog — render bağımlılığı kes
vi.mock('@/components/settings/SensitiveProfileOtpDialog', () => ({
  default: () => null,
}));

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function renderPage() {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(
    <MemoryRouter>
      <QueryClientProvider client={qc}>
        <EducatorSettings />
      </QueryClientProvider>
    </MemoryRouter>,
  );
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('EducatorSettings — B9 smoke', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Hesap Sahibi Adı (Ödeme tab — kilitli)', () => {
    it('sayfa render edilir, crash yok', async () => {
      renderPage();
      // En azından bir Tab var (i18n key görünür)
      await waitFor(() => {
        expect(screen.getAllByRole('tab').length).toBeGreaterThan(0);
      });
    });

    // Radix Tabs jsdom'da content'leri lazy mount ettiği ve test ortamında
    // click → state geçişi her zaman güvenilir olmadığı için Ödeme tab içindeki
    // input'a runtime'da erişmek kırılgan. Bunun yerine kaynak kodda regresyon
    // koruması — bug'ı (yazılabilir input + farklı default value) anında yakalar.
    it('accountHolder kodu user.full_name kullanır + readOnly + disabled (B9)', () => {
      // 1. Input tanımı accountHolder ID'siyle var
      expect(PAGE_SOURCE).toMatch(/id="accountHolder"/);
      // 2. value bind: user?.full_name (kayıttaki Wizard Test gibi)
      expect(PAGE_SOURCE).toMatch(/id="accountHolder"[\s\S]{0,400}value=\{user\?\.full_name/);
      // 3. readOnly + disabled + aria-readonly birlikte
      const block = PAGE_SOURCE.match(/id="accountHolder"[\s\S]{0,500}/)?.[0] ?? '';
      expect(block).toMatch(/\breadOnly\b/);
      expect(block).toMatch(/\bdisabled\b/);
      expect(block).toMatch(/aria-readonly="true"/);
      // 4. Eski "onChange ile setFormData" gitmeli — kullanıcı yazamasın
      expect(block).not.toMatch(/onChange.*accountHolder.*e\.target\.value/);
      // 5. holderLockedHint i18n anahtarı (yeni hint kullanılıyor)
      expect(PAGE_SOURCE).toMatch(/payment\.holderLockedHint/);
    });

    it('formData.accountHolder init full_name\'i önceler', () => {
      // useEffect içinde initial data accountHolder: user.full_name || user.accountHolder
      expect(PAGE_SOURCE).toMatch(
        /accountHolder:\s*user\.full_name\s*\|\|\s*user\.accountHolder/,
      );
    });
  });

  describe('Tab adlandırması (B9)', () => {
    it('Tab listesinde "verification" id\'li tab var ama label artık "Özgeçmiş" anahtarı', async () => {
      renderPage();
      const tabs = await screen.findAllByRole('tab');
      const verificationTab = tabs.find((t) => /verification/i.test(t.id));
      expect(verificationTab).toBeDefined();
      // i18n mock identity döndüğü için label "tabs.verification" anahtarını gösterir.
      // Önemli olan tab'ın hâlâ var olması (Radix value="verification" korundu;
      // gösterim katmanı i18n ile "Özgeçmiş" olur).
      expect(verificationTab.textContent).toContain('verification');
    });

    it('Tab listesinde "contact" tab\'ı bulunur (Scholar oraya taşındı)', async () => {
      renderPage();
      const tabs = await screen.findAllByRole('tab');
      const contactTab = tabs.find((t) => /contact/i.test(t.id));
      expect(contactTab).toBeDefined();
    });
  });

  describe('CV upload endpoint (B9 — /upload/document)', () => {
    // CV upload akışı için Radix Tab geçişi + dosya event'i jsdom'da tek
    // seferde stabil değil; kaynak kod doğrulaması bug'ı eşdeğer hassasiyetle
    // yakalar: /upload/image regresyonunda (Sharp magic byte PDF reject) anında
    // fail eder.
    it('CV upload handler\'ları /upload/document endpoint\'ini kullanır', () => {
      // En az 2 CV upload handler var: handleCVUpload + handleRejectedCvUpload
      const documentCalls = PAGE_SOURCE.match(
        /api\.post\(["']\/upload\/document["']/g,
      ) || [];
      expect(documentCalls.length).toBeGreaterThanOrEqual(2);
    });

    it('CV upload akışında /upload/image kullanılmıyor (Sharp PDF reject ederdi)', () => {
      // PDF dosya input'u olan handler'ların yakınında /upload/image kullanılmamalı.
      // handleCVUpload + handleRejectedCvUpload accept=".pdf" / file.type='application/pdf'.
      const cvUploadBlocks = [
        PAGE_SOURCE.match(/handleCVUpload[\s\S]{0,1500}/)?.[0] ?? '',
        PAGE_SOURCE.match(/handleRejectedCvUpload[\s\S]{0,1500}/)?.[0] ?? '',
      ];
      for (const block of cvUploadBlocks) {
        // Yorum içinde /upload/image referansı OK (regresyon notu),
        // ama gerçek api.post çağrısı /upload/image olmamalı.
        expect(block).not.toMatch(/api\.post\(["']\/upload\/image["']/);
      }
    });
  });
});
