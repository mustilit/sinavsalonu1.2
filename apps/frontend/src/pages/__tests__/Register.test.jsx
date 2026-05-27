/**
 * Register sayfası unit testleri
 * Kapsam: form render, alan validasyonu, submit akışı, hata state, educator modu
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import Register from '../Register';

// auth modülünü mock'la — ağ çağrısı yapma
vi.mock('@/api/dalClient', () => ({
  auth: {
    register: vi.fn(),
    registerEducator: vi.fn(),
  },
  entities: {},
}));

// TurnstileWidget — Cloudflare widget; test ortamında render etme
vi.mock('@/components/auth/TurnstileWidget', () => ({
  default: ({ onSuccess }) => (
    <button type="button" data-testid="turnstile-mock" onClick={() => onSuccess('token-123')}>
      Captcha
    </button>
  ),
}));

// GoogleSignInButton — harici script
vi.mock('@/components/auth/GoogleSignInButton', () => ({
  default: () => <div data-testid="google-btn" />,
}));

vi.mock('@/lib/navigation', () => ({
  useAppNavigate: () => vi.fn(),
}));

vi.mock('@/utils', () => ({
  createPageUrl: (name) => `/${name}`,
}));

const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });

function renderRegister(search = '') {
  // Register sayfası window.location.search ile URL parametrelerini okuyor
  const originalSearch = window.location.search;
  Object.defineProperty(window, 'location', {
    writable: true,
    value: { ...window.location, search },
  });

  const result = render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[`/Register${search}`]}>
        <Register />
      </MemoryRouter>
    </QueryClientProvider>
  );

  // Cleanup
  Object.defineProperty(window, 'location', {
    writable: true,
    value: { ...window.location, search: originalSearch },
  });

  return result;
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('Register sayfası', () => {
  // --- Arrange/Act/Assert ---

  it('aday modu URL\'si olmadığında temel form alanları render edilir', () => {
    // Arrange & Act
    renderRegister();
    // Assert
    expect(screen.getByLabelText(/e-posta/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/kullanıcı adı/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/şifre/i)).toBeInTheDocument();
  });

  it('educator rolü seçildiğinde ad ve soyad alanları görünür', () => {
    // Arrange & Act
    renderRegister('?role=educator');
    // Assert — educator alanları render edilmeli
    expect(screen.getByLabelText(/ad/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/soyad/i)).toBeInTheDocument();
  });

  it('aday modu seçildiğinde ad/soyad alanları görünmez', () => {
    // Arrange & Act
    renderRegister('?role=candidate');
    // Assert
    expect(screen.queryByLabelText(/^ad$/i)).not.toBeInTheDocument();
  });

  it('submit butonu mevcut ve başlangıçta aktif', () => {
    // Arrange & Act
    renderRegister();
    // Assert
    const btn = screen.getByRole('button', { name: /kayıt ol/i });
    expect(btn).toBeInTheDocument();
    expect(btn).not.toBeDisabled();
  });

  it('başarılı aday kaydında auth.register çağrılır', async () => {
    // Arrange
    const { auth } = await import('@/api/dalClient');
    auth.register.mockResolvedValue({ ok: true });
    renderRegister();

    // Act
    fireEvent.change(screen.getByLabelText(/e-posta/i), { target: { value: 'test@example.com' } });
    fireEvent.change(screen.getByLabelText(/kullanıcı adı/i), { target: { value: 'testuser' } });
    fireEvent.change(screen.getByLabelText(/şifre/i), { target: { value: 'pass123' } });
    fireEvent.submit(screen.getByRole('button', { name: /kayıt ol/i }).closest('form'));

    // Assert
    await waitFor(() => {
      expect(auth.register).toHaveBeenCalledWith(
        'test@example.com',
        'testuser',
        'pass123',
        expect.objectContaining({})
      );
    });
  });

  it('API hata döndüğünde hata mesajı gösterilir', async () => {
    // Arrange
    const { auth } = await import('@/api/dalClient');
    auth.register.mockRejectedValue({
      response: { data: { message: 'Bu email zaten kayıtlı' } },
    });
    renderRegister();

    // Act
    fireEvent.change(screen.getByLabelText(/e-posta/i), { target: { value: 'existing@example.com' } });
    fireEvent.change(screen.getByLabelText(/kullanıcı adı/i), { target: { value: 'existinguser' } });
    fireEvent.change(screen.getByLabelText(/şifre/i), { target: { value: 'pass123' } });
    fireEvent.submit(screen.getByRole('button', { name: /kayıt ol/i }).closest('form'));

    // Assert
    await waitFor(() => {
      expect(screen.getByText('Bu email zaten kayıtlı')).toBeInTheDocument();
    });
  });

  it('Login sayfasına giden link mevcut', () => {
    // Arrange & Act
    renderRegister();
    // Assert
    const loginLink = screen.getByRole('link', { name: /giriş yap/i });
    expect(loginLink).toBeInTheDocument();
    expect(loginLink).toHaveAttribute('href', '/Login');
  });
});
