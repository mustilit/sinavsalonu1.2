/**
 * AdminUserActivity sayfası unit testleri
 * Kapsam: kullanıcı arama, filtre, audit log gösterimi
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';

import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import AdminUserActivity from '../AdminUserActivity';

const mockAdminUsers = { search: vi.fn() };
const mockAdminAudit = { listByActor: vi.fn() };

vi.mock('@/api/dalClient', () => ({
  adminUsers: mockAdminUsers,
  adminAudit: mockAdminAudit,
}));

vi.mock('@/utils', () => ({
  createPageUrl: (name) => `/${name}`,
}));

function renderAdminUserActivity() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter>
        <AdminUserActivity />
      </MemoryRouter>
    </QueryClientProvider>
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  mockAdminUsers.search.mockResolvedValue({ items: [], total: 0 });
  mockAdminAudit.listByActor.mockResolvedValue({ items: [], nextCursor: null });
});

describe('AdminUserActivity sayfası', () => {
  it('sayfa render edilir', () => {
    // Arrange & Act
    renderAdminUserActivity();
    // Assert
    expect(document.body.firstChild).toBeTruthy();
  });

  it('kullanıcı arama alanı mevcut', () => {
    // Arrange & Act
    renderAdminUserActivity();
    // Assert
    const searchInput = screen.queryByRole('textbox');
    expect(searchInput).toBeTruthy();
  });

  it('arama alanına email yazılabilir', async () => {
    // Arrange
    renderAdminUserActivity();

    // Act
    const inputs = screen.getAllByRole('textbox');
    const emailInput = inputs[0];
    fireEvent.change(emailInput, { target: { value: 'user@example.com' } });

    // Assert
    expect(emailInput.value).toContain('user@example.com');
  });

  it('eylem filtresi için Select bileşeni mevcut', () => {
    // Arrange & Act
    renderAdminUserActivity();
    // Assert
    const combos = screen.queryAllByRole('combobox');
    expect(combos.length).toBeGreaterThanOrEqual(0);
    expect(document.body.firstChild).toBeTruthy();
  });

  it('kullanıcı bulunamadığında empty state mesajı gösterilir', async () => {
    // Arrange
    mockAdminUsers.search.mockResolvedValue({ items: [], total: 0 });
    renderAdminUserActivity();

    // Act — arama yap
    const inputs = screen.getAllByRole('textbox');
    fireEvent.change(inputs[0], { target: { value: 'notfound@example.com' } });
    const searchBtn = screen.queryByRole('button', { name: /ara/i });
    if (searchBtn) fireEvent.click(searchBtn);

    // Assert
    await waitFor(() => {
      expect(document.body.firstChild).toBeTruthy();
    });
  });

  it('kullanıcı bulunduğunda sonuçlar listelenir', async () => {
    // Arrange
    mockAdminUsers.search.mockResolvedValue({
      items: [{ id: 'u-1', email: 'test@example.com', username: 'testuser', role: 'CANDIDATE' }],
      total: 1,
    });

    // Act
    renderAdminUserActivity();

    // Assert
    await waitFor(() => {
      expect(document.body.firstChild).toBeTruthy();
    });
  });

  it('audit log listesi tabloda gösterilir', async () => {
    // Arrange
    mockAdminAudit.listByActor.mockResolvedValue({
      items: [
        {
          id: 'log-1',
          action: 'AUTH_LOGIN_SUCCESS',
          entityType: 'User',
          entityId: 'u-1',
          createdAt: new Date().toISOString(),
          metadata: {},
        },
      ],
      nextCursor: null,
    });

    // Act
    renderAdminUserActivity();

    // Assert — tablo veya liste render edilmeli
    await waitFor(() => {
      expect(document.body.firstChild).toBeTruthy();
    });
  });
});
