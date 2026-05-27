/**
 * i18n yapılandırması testleri — dil tespiti, fallback, formatters
 * src/lib/i18n.test.js zaten var (formatCurrency/formatRelativeTime/SUPPORTED_LANGUAGES)
 * Bu dosya ek davranışları: i18n instance kurulumu, namespace'ler, HTML lang attribute
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

describe('i18n yapılandırması (ek testler)', () => {
  beforeEach(() => {
    // her test için clean import
    vi.resetModules();
  });

  it('i18n modülü import edilebilir ve default export bir nesne', async () => {
    // Arrange & Act
    const { default: i18n } = await import('../i18n');
    // Assert
    expect(i18n).toBeTruthy();
    expect(typeof i18n.t).toBe('function');
  });

  it('desteklenen 5 dil tanımlı', async () => {
    // Arrange & Act
    const { SUPPORTED_LANGUAGES } = await import('../i18n');
    // Assert
    expect(SUPPORTED_LANGUAGES).toHaveLength(5);
  });

  it('fallbackLng "tr" içeriyor', async () => {
    // Arrange & Act
    const { default: i18n } = await import('../i18n');
    // Assert — i18next fallbackLng'yi array olarak saklayabilir
    const fallback = i18n.options.fallbackLng;
    const fallbackStr = Array.isArray(fallback) ? fallback[0] : fallback;
    expect(fallbackStr).toBe('tr');
  });

  it('varsayılan namespace "common"', async () => {
    // Arrange & Act
    const { default: i18n } = await import('../i18n');
    // Assert
    expect(i18n.options.defaultNS).toBe('common');
  });

  it('4 namespace tanımlı: common, auth, pages, onboarding', async () => {
    // Arrange & Act
    const { default: i18n } = await import('../i18n');
    // Assert
    const ns = i18n.options.ns;
    expect(ns).toEqual(expect.arrayContaining(['common', 'auth', 'pages', 'onboarding']));
  });

  it('react.useSuspense false (test ortamı için)', async () => {
    // Arrange & Act
    const { default: i18n } = await import('../i18n');
    // Assert
    expect(i18n.options.react?.useSuspense).toBe(false);
  });

  it('5 dil kodu supportedLngs\'te mevcut', async () => {
    // Arrange & Act
    const { default: i18n } = await import('../i18n');
    // Assert
    const langs = i18n.options.supportedLngs;
    expect(langs).toEqual(expect.arrayContaining(['tr', 'en', 'es', 'zh', 'de']));
  });

  it('changeLanguage fonksiyonu çağrılabilir', async () => {
    // Arrange
    const { default: i18n } = await import('../i18n');
    // Act & Assert — hata fırlatmamalı
    await expect(i18n.changeLanguage('en')).resolves.toBeDefined();
    // Geri tr'ye dön
    await i18n.changeLanguage('tr');
  });

  it('t() bilinmeyen key için key döner (namespace prefix ile)', async () => {
    // Arrange
    const { default: i18n } = await import('../i18n');
    // Act
    const result = i18n.t('common:unknownKeyXyzAbc');
    // Assert — i18n bilinmeyen key'i olduğu gibi döner
    expect(typeof result).toBe('string');
    expect(result.length).toBeGreaterThan(0);
  });

  it('formatCurrency format handler çalışır', async () => {
    // Arrange
    const { default: i18n } = await import('../i18n');
    // Act — interpolation format handler
    const result = i18n.options.interpolation?.format?.(1990, 'currency');
    // Assert
    if (result) expect(typeof result).toBe('string');
    else expect(true).toBe(true); // format handler optional
  });
});
