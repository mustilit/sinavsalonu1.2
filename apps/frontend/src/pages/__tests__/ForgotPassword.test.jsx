/**
 * ForgotPassword sayfası unit testleri
 * Kapsam: form render, email gönder, başarı state, hata state
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';

import { MemoryRouter } from 'react-router-dom';
import ForgotPassword from '../ForgotPassword';

// api/apiClient mock — ağ izolasyonu
vi.mock('@/lib/api/apiClient', () => ({
  default: {
    post: vi.fn(),
    get: vi.fn(),
  },
}));

vi.mock('@/utils', () => ({
  createPageUrl: (name) => `/${name}`,
}));

function renderForgotPassword() {
  return render(
    <MemoryRouter>
      <ForgotPassword />
    </MemoryRouter>
  );
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('ForgotPassword sayfası', () => {
  it('başlık ve email input alanı render edilir', () => {
    // Arrange & Act
    renderForgotPassword();
    // Assert
    expect(screen.getByRole('heading', { level: 1 })).toBeInTheDocument();
    expect(screen.getByRole('textbox')).toBeInTheDocument();
  });

  it('submit butonu mevcut ve başlangıçta aktif', () => {
    // Arrange & Act
    renderForgotPassword();
    // Assert
    const btn = screen.getByRole('button', { name: /şifre sıfırla/i });
    expect(btn).toBeInTheDocument();
    expect(btn).not.toBeDisabled();
  });

  it('başarılı submit sonrası başarı state görüntülenir', async () => {
    // Arrange
    const api = (await import('@/lib/api/apiClient')).default;
    api.post.mockResolvedValue({ data: { message: 'ok' } });
    renderForgotPassword();

    // Act
    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'user@example.com' } });
    fireEvent.submit(screen.getByRole('button', { name: /şifre sıfırla/i }).closest('form'));

    // Assert
    await waitFor(() => {
      expect(screen.getByTestId('forgot-password-success')).toBeInTheDocument();
    });
  });

  it('başarılı submit sonrası Login linkine bağlantı gösterilir', async () => {
    // Arrange
    const api = (await import('@/lib/api/apiClient')).default;
    api.post.mockResolvedValue({ data: { message: 'ok' } });
    renderForgotPassword();

    // Act
    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'user@example.com' } });
    fireEvent.submit(screen.getByRole('button', { name: /şifre sıfırla/i }).closest('form'));

    // Assert
    await waitFor(() => {
      const loginBtn = screen.getByRole('button', { name: /giriş yap/i });
      expect(loginBtn).toBeInTheDocument();
    });
  });

  it('API hata döndüğünde hata mesajı gösterilir', async () => {
    // Arrange
    const api = (await import('@/lib/api/apiClient')).default;
    api.post.mockRejectedValue({
      response: { data: { message: 'Kullanıcı bulunamadı' } },
    });
    renderForgotPassword();

    // Act
    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'notfound@example.com' } });
    fireEvent.submit(screen.getByRole('button', { name: /şifre sıfırla/i }).closest('form'));

    // Assert
    await waitFor(() => {
      expect(screen.getByText('Kullanıcı bulunamadı')).toBeInTheDocument();
    });
  });

  it('sayfa data-testid\'i doğru set edilmiş', () => {
    // Arrange & Act
    renderForgotPassword();
    // Assert
    expect(screen.getByTestId('forgot-password-page')).toBeInTheDocument();
  });

  it('Login sayfasına dönüş linki mevcut', () => {
    // Arrange & Act
    renderForgotPassword();
    // Assert
    const loginLink = screen.getAllByRole('link').find(
      (el) => el.getAttribute('href') === '/Login'
    );
    expect(loginLink).toBeDefined();
  });
});
