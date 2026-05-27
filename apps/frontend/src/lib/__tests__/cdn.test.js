import { describe, it, expect, vi, beforeEach } from 'vitest';

// import.meta.env mock — Vite test runner için
vi.stubGlobal('import.meta', {
  env: { VITE_CDN_BASE_URL: '' },
});

describe('cdn helpers', () => {
  describe('cdnUrl', () => {
    it('CDN tanımlı değilse path olduğu gibi döner', async () => {
      vi.resetModules();
      const { cdnUrl } = await import('../cdn');
      expect(cdnUrl('/uploads/foo.jpg')).toBe('/uploads/foo.jpg');
    });

    it('tam URL ise CDN tanımlı olsa bile dokunmaz (Stripe avatarları)', async () => {
      vi.resetModules();
      const { cdnUrl } = await import('../cdn');
      expect(cdnUrl('https://lh3.googleusercontent.com/a/avatar')).toBe(
        'https://lh3.googleusercontent.com/a/avatar',
      );
    });

    it('boş path için "" döner', async () => {
      const { cdnUrl } = await import('../cdn');
      expect(cdnUrl('')).toBe('');
      expect(cdnUrl(null)).toBe('');
      expect(cdnUrl(undefined)).toBe('');
    });
  });

  describe('responsiveImage', () => {
    it('CDN tanımlı değilse srcset boş string', async () => {
      vi.resetModules();
      const { responsiveImage } = await import('../cdn');
      const result = responsiveImage('/uploads/foo.jpg');
      expect(result.src).toBe('/uploads/foo.jpg');
      expect(result.srcSet).toBe('');
      expect(result.sizes).toContain('max-width');
    });

    it('boş path için boş src + srcSet', async () => {
      const { responsiveImage } = await import('../cdn');
      const result = responsiveImage('');
      expect(result.src).toBe('');
      expect(result.srcSet).toBe('');
    });
  });

  describe('isCdnEnabled', () => {
    it('CDN tanımlı değilse false', async () => {
      vi.resetModules();
      const { isCdnEnabled } = await import('../cdn');
      expect(isCdnEnabled()).toBe(false);
    });
  });
});
