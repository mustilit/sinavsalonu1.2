// Jest configuration — Sınav Salonu backend
//
// Coverage threshold disiplini (KALITE-DEGERLENDIRME §11 — Test Kalitesi):
//   - Global baseline: bugünkü dağılım üzerinde (statements/lines %35, branches %25,
//     functions %30). PR'da düşme kabul edilmez; çeyrek sonunda +%5 hedef.
//   - Use case katmanı: %85 hedef (henüz baseline değil, kademeli sıkılaştırılacak —
//     başlangıçta global ile aynı, refactor sonrası `coverageThreshold` içinden
//     yorum kaldırılır).
//   - Domain saf kod: %95 hedef (aynı).
//
// Çalıştırma:
//   npm test                          → tüm test'ler, coverage kapalı
//   npm test -- --coverage            → tek seferlik coverage raporu (text + lcov + html)
//   npm run test:unit:ci              → CI: --runInBand --coverage --coverageDirectory=./coverage
//
// Codecov: lcov.info ./coverage altına düşüyor; .github/workflows üzerinden yüklenir.
module.exports = {
  testEnvironment: 'node',
  setupFiles: ['<rootDir>/tests/setup.ts'],
  testTimeout: 20000,
  verbose: true,
  testMatch: ['**/tests/**/*.test.(js|ts)'],
  transform: {
    '^.+\\.ts$': ['ts-jest', { tsconfig: 'tsconfig.jest.json' }],
  },
  moduleFileExtensions: ['ts', 'js', 'json'],
  modulePathIgnorePatterns: ['<rootDir>/dist/', '<rootDir>/.stryker-tmp/'],
  testPathIgnorePatterns: ['<rootDir>/dist/', '<rootDir>/.stryker-tmp/'],
  reporters: [
    'default',
    ['jest-junit', { outputDirectory: './test-reports', outputName: 'junit.xml' }],
  ],
  collectCoverage: false,
  collectCoverageFrom: [
    'src/**/*.ts',
    '!src/**/*.dto.ts',
    '!src/**/*.module.ts',
    '!src/**/index.ts',
    '!src/main.ts',
    '!src/index.ts',
    '!src/instrument.ts',
  ],
  coverageDirectory: './coverage',
  coverageReporters: ['text', 'lcov', 'json-summary', 'html'],
  coveragePathIgnorePatterns: ['/node_modules/', '/dist/', '/prisma/', '/scripts/'],
  // Threshold disiplini:
  //   Bugünkü baseline ile başla; PR'da düşmesin. Her sprint hedefe doğru sıkıştır.
  //   Path-spesifik threshold'lar (use-cases, guards) aktarılmadan önce
  //   o klasördeki test coverage'ı baseline'a ulaşmalı; yoksa CI sürekli kırmızı kalır.
  coverageThreshold: {
    // Global baseline — 27 May 2026 (sprint 2+3 sonrası, ~73 use-case test edilmiş):
    //   sprint 1 (24 May): stmts %9.51 — sprint 2 (test-writer 35 dosya): ~%14-16
    //   sprint 3 (test-writer 30 dosya, devam ediyor): ~%18-22 hedef
    // Threshold = baseline - 2 pt (CI dalgalanma toleransı). Ratchet workflow ile artırılır.
    global: {
      branches: 7,
      functions: 9,
      lines: 13,
      statements: 12,
    },
    // Use-cases katmanı: sprint 1: %22 → sprint 2: %38 (test-writer agent raporu).
    // sprint 3 devam ediyor (hedef %45+). Threshold = ölçüm - 3pt tampon.
    // Hedef: %85 (sprint 5-6 itibarıyla).
    './src/application/use-cases/': {
      branches: 28,
      functions: 32,
      lines: 35,
      statements: 35,
    },
    // Path-spesifik baseline — yeni eklenen testlerin kapsadığı klasörler.
    // Yeni dosya/branch eklerken PR'da düşmeyi engeller.
    './src/nest/guards/': {
      // 24 May 2026 ölçüm: lines %28.3, branches %17.3, fn %42.9.
      // worker-permissions + internal-only test'leri eklendi (Roles/Jwt/Captcha açık).
      statements: 27,
      branches: 16,
      functions: 40,
      lines: 27,
    },
    './src/nest/interceptors/': {
      // 24 May 2026 ölçüm: lines %85.5, branches %57.7, fn %73.7
      // metrics + idempotency interceptor full kapsamlı.
      statements: 80,
      branches: 55,
      functions: 70,
      lines: 80,
    },
    './src/common/': {
      // 24 May 2026 ölçüm: lines %90.9, fn %75 (tenant + AsyncLocalStorage)
      statements: 85,
      branches: 20,
      functions: 70,
      lines: 85,
    },
    './src/infrastructure/metrics/': {
      // 24 May 2026 ölçüm: lines %88.9 (prom-client registry + interceptor target)
      statements: 80,
      branches: 0,
      functions: 0,
      lines: 80,
    },
    // './src/domain/': { branches: 85, functions: 90, lines: 90, statements: 90 },
  },
};

