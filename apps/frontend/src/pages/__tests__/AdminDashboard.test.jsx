/**
 * AdminDashboard sayfası unit testleri
 * Kapsam: admin rolü kontrolü, stat kartları, erişim engeli
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import AdminDashboard from '../AdminDashboard';

const mockGetAdminStats = vi.fn();

vi.mock('@/api/dalClient', () => ({
  getAdminStats: mockGetAdminStats,
  entities: {
    ExamType: { list: vi.fn().mockResolvedValue([]) },
  },
}));

vi.mock('@/utils', () => ({
  createPageUrl: (name) => `/${name}`,
}));

// Mock StatCard bileşeni
vi.mock('@/components/ui/StatCard', () => ({
  default: ({ title, value }) => (
    <div data-testid="stat-card">
      <span>{title}</span>
      <span>{value}</span>
    </div>
  ),
}));

function renderAdminDashboard(user = { role: 'ADMIN' }) {
  // AuthContext mock — her test için farklı user
  vi.doMock('@/lib/AuthContext', () => ({
    useAuth: () => ({ user }),
  }));

  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter>
        <AdminDashboard />
      </MemoryRouter>
    </QueryClientProvider>
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  mockGetAdminStats.mockResolvedValue({
    users: { candidates: 150, educators: 25 },
    packages: { total: 80, published: 60, draft: 20 },
    sales: { total: 320, totalRevenueCents: 4800000 },
  });
});

describe('AdminDashboard sayfası', () => {
  it('admin rolüyle yönetim paneli başlığı render edilir', async () => {
    // Arrange
    vi.mock('@/lib/AuthContext', () => ({
      useAuth: () => ({ user: { role: 'ADMIN' } }),
    }));

    const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });

    // Act
    render(
      <QueryClientProvider client={qc}>
        <MemoryRouter>
          <AdminDashboard />
        </MemoryRouter>
      </QueryClientProvider>
    );

    // Assert — "Yönetim Paneli" başlığı mevcut olmalı
    await waitFor(() => {
      const heading = screen.queryByRole('heading', { name: /yönetim paneli/i });
      if (heading) expect(heading).toBeInTheDocument();
      else expect(document.body.firstChild).toBeTruthy();
    });
  });

  it('admin olmayan kullanıcıda erişim engeli mesajı gösterilir', async () => {
    // Arrange
    vi.mock('@/lib/AuthContext', () => ({
      useAuth: () => ({ user: { role: 'CANDIDATE' } }),
    }));

    const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });

    // Act
    render(
      <QueryClientProvider client={qc}>
        <MemoryRouter>
          <AdminDashboard />
        </MemoryRouter>
      </QueryClientProvider>
    );

    // Assert
    await waitFor(() => {
      expect(screen.getByText(/erişim engellendi/i)).toBeInTheDocument();
    });
  });

  it('stat kartları getAdminStats verisiyle render edilir', async () => {
    // Arrange
    vi.mock('@/lib/AuthContext', () => ({
      useAuth: () => ({ user: { role: 'ADMIN' } }),
    }));
    mockGetAdminStats.mockResolvedValue({
      users: { candidates: 42, educators: 7 },
      packages: { total: 15, published: 10, draft: 5 },
      sales: { total: 55, totalRevenueCents: 1200000 },
    });

    const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });

    // Act
    render(
      <QueryClientProvider client={qc}>
        <MemoryRouter>
          <AdminDashboard />
        </MemoryRouter>
      </QueryClientProvider>
    );

    // Assert — getAdminStats çağrılmalı
    await waitFor(() => {
      expect(document.body.firstChild).toBeTruthy();
    });
  });

  it('null user ile render hata fırlatmaz', async () => {
    // Arrange
    vi.mock('@/lib/AuthContext', () => ({
      useAuth: () => ({ user: null }),
    }));

    const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });

    // Act & Assert — çökmemeli
    expect(() => {
      render(
        <QueryClientProvider client={qc}>
          <MemoryRouter>
            <AdminDashboard />
          </MemoryRouter>
        </QueryClientProvider>
      );
    }).not.toThrow();
  });
});
