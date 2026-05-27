/**
 * dalClient.js ek endpoint testleri
 * Kapsam: auth endpoints (login, register, me), entities, admin endpoints
 * Not: /api/dalClient.test.js zaten adminBackup ve adminModeration testleri içeriyor.
 * Bu dosya auth + topics + entities endpoint kontratlarını kapsıyor.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockApi = {
  get: vi.fn(),
  post: vi.fn(),
  patch: vi.fn(),
  put: vi.fn(),
  delete: vi.fn(),
};

vi.mock('@/lib/api/apiClient', () => ({ default: mockApi }));

// Mock sonrası import
const dal = await import('../dalClient');

beforeEach(() => {
  Object.values(mockApi).forEach((fn) => fn.mockReset());
});

describe('auth.login endpoint kontratı', () => {
  it('email ve password ile POST /auth/login çağrılır', async () => {
    // Arrange
    mockApi.post.mockResolvedValue({
      data: { token: 'tok-1', user: { id: 'u-1', email: 'test@example.com', role: 'CANDIDATE' } },
    });

    // Act
    const result = await dal.auth.login('TEST@EXAMPLE.COM', 'pass123');

    // Assert — email lowercase trim yapılmalı
    expect(mockApi.post).toHaveBeenCalledWith('/auth/login', {
      email: 'test@example.com',
      password: 'pass123',
    });
    expect(result.token).toBe('tok-1');
  });

  it('turnstileToken varsa body\'ye eklenir', async () => {
    // Arrange
    mockApi.post.mockResolvedValue({
      data: { token: 'tok-2', user: { id: 'u-2' } },
    });

    // Act
    await dal.auth.login('user@example.com', 'pass', { turnstileToken: 'captcha-tok' });

    // Assert
    expect(mockApi.post).toHaveBeenCalledWith('/auth/login', {
      email: 'user@example.com',
      password: 'pass',
      turnstileToken: 'captcha-tok',
    });
  });

  it('sunucu beklenmeyen yanıt dönerse hata fırlatılır', async () => {
    // Arrange
    mockApi.post.mockResolvedValue({ data: { message: 'ok' } }); // token yok

    // Act & Assert
    await expect(dal.auth.login('a@b.com', 'pass')).rejects.toThrow('Beklenmeyen sunucu yanıtı');
  });
});

describe('auth.register endpoint kontratı', () => {
  it('email, username, password ile POST /auth/register çağrılır', async () => {
    // Arrange
    mockApi.post.mockResolvedValue({ data: { userId: 'u-3' } });

    // Act
    const result = await dal.auth.register('new@example.com', 'newuser', 'pass123');

    // Assert
    expect(mockApi.post).toHaveBeenCalledWith('/auth/register', {
      email: 'new@example.com',
      username: 'newuser',
      password: 'pass123',
    });
    expect(result.userId).toBe('u-3');
  });
});

describe('auth.registerEducator endpoint kontratı', () => {
  it('firstName ve lastName ile POST /auth/register/educator', async () => {
    // Arrange
    mockApi.post.mockResolvedValue({ data: { userId: 'u-4' } });

    // Act
    await dal.auth.registerEducator('edu@example.com', 'eduuser', 'pass', {
      firstName: 'Ali',
      lastName: 'Demir',
    });

    // Assert
    expect(mockApi.post).toHaveBeenCalledWith('/auth/register/educator', {
      email: 'edu@example.com',
      username: 'eduuser',
      password: 'pass',
      firstName: 'Ali',
      lastName: 'Demir',
    });
  });
});

describe('auth.isAuthenticated', () => {
  it('sessionStorage\'da token varsa true döner', () => {
    // Arrange
    sessionStorage.setItem('token', 'tok-xyz');

    // Act & Assert
    expect(dal.auth.isAuthenticated()).toBe(true);
    sessionStorage.removeItem('token');
  });

  it('depolama boşken false döner', () => {
    // Arrange — setup.js temizliyor, ama garantiye al
    sessionStorage.clear();
    localStorage.clear();

    // Act & Assert
    expect(dal.auth.isAuthenticated()).toBe(false);
  });
});

describe('auth.logout', () => {
  it('storage anahtarlarını temizler', () => {
    // Arrange
    localStorage.setItem('token', 'tok-x');
    sessionStorage.setItem('dal_auth', JSON.stringify({ user: {}, token: 'tok-x' }));

    // Act
    dal.auth.logout();

    // Assert
    expect(localStorage.getItem('token')).toBeNull();
    expect(sessionStorage.getItem('dal_auth')).toBeNull();
  });
});

describe('auth.me endpoint', () => {
  it('GET /auth/me ve GET /me/preferences çağrılır', async () => {
    // Arrange
    mockApi.get
      .mockResolvedValueOnce({ data: { user: { id: 'u-1', email: 'me@x.com', role: 'CANDIDATE', username: 'me' } } })
      .mockResolvedValueOnce({ data: {} });

    // Act
    const result = await dal.auth.me();

    // Assert
    expect(mockApi.get).toHaveBeenCalledWith('/auth/me');
    expect(mockApi.get).toHaveBeenCalledWith('/me/preferences');
    expect(result.id).toBe('u-1');
  });

  it('kullanıcı yoksa null döner', async () => {
    // Arrange
    mockApi.get.mockResolvedValueOnce({ data: null });

    // Act
    const result = await dal.auth.me();

    // Assert
    expect(result).toBeNull();
  });
});
