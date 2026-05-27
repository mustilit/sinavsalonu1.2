/**
 * Explore sayfası unit testleri
 * Kapsam: başlık render, arama input, filtre butonları, auth bağımsız render
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import Explore from '../Explore';

vi.mock('@/api/dalClient', () => ({
  entities: {
    ExamType: { filter: vi.fn().mockResolvedValue([]) },
    TestPackage: { filter: vi.fn().mockResolvedValue([]) },
    Purchase: { filter: vi.fn().mockResolvedValue([]) },
    TestResult: { filter: vi.fn().mockResolvedValue([]) },
    TestProgress: { filter: vi.fn().mockResolvedValue([]) },
  },
}));

vi.mock('@/lib/api/apiClient', () => ({
  default: {
    get: vi.fn().mockResolvedValue({ data: { items: [] } }),
  },
}));

vi.mock('@/lib/AuthContext', () => ({
  useAuth: () => ({ user: null }),
}));

vi.mock('@/lib/navigation', () => ({
  useAppNavigate: () => vi.fn(),
  buildPageUrl: (name) => `/${name}`,
}));

vi.mock('@/utils', () => ({
  createPageUrl: (name) => `/${name}`,
}));

vi.mock('@/components/ui/TestPackageCard', () => ({
  default: ({ test }) => <div data-testid="test-card">{test?.title}</div>,
}));

function renderExplore(windowSearch = '') {
  // Explore sayfası window.location.search kullanır
  if (windowSearch) {
    Object.defineProperty(window, 'location', {
      writable: true,
      value: { ...window.location, search: windowSearch },
    });
  }
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter initialEntries={[`/Explore${windowSearch}`]}>
        <Explore />
      </MemoryRouter>
    </QueryClientProvider>
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  // window.location.search'i temizle
  Object.defineProperty(window, 'location', {
    writable: true,
    value: { ...window.location, search: '' },
  });
});

describe('Explore sayfası', () => {
  it('sayfa başlık ve açıklama render edilir', () => {
    // Arrange & Act
    renderExplore();
    // Assert — Explore h1 başlığı olmalı
    const heading = screen.getByRole('heading', { level: 1 });
    expect(heading).toBeInTheDocument();
  });

  it('arama input alanı placeholder ile mevcut', () => {
    // Arrange & Act
    renderExplore();
    // Assert — placeholder text ile Input bul
    const searchInput = screen.getByPlaceholderText(/test.*ara/i);
    expect(searchInput).toBeInTheDocument();
  });

  it('arama alanına yazınca state güncellenir', () => {
    // Arrange
    renderExplore();

    // Act
    const searchInput = screen.getByPlaceholderText(/test.*ara/i);
    fireEvent.change(searchInput, { target: { value: 'matematik' } });

    // Assert
    expect(searchInput).toHaveValue('matematik');
  });

  it('URL\'de q parametresi varsa arama alanına yansır', () => {
    // Arrange — window.location.search mock
    renderExplore('?q=fizik');

    // Assert — initial state URL params'tan okunmalı
    const searchInput = screen.getByPlaceholderText(/test.*ara/i);
    expect(searchInput.value).toBe('fizik');
  });

  it('sınav türü seçimi için Select bileşeni render edilir', () => {
    // Arrange & Act
    renderExplore();
    // Assert — combobox/select bileşeni olmalı
    const selects = screen.getAllByRole('combobox');
    expect(selects.length).toBeGreaterThanOrEqual(1);
  });

  it('TestPackage.filter ilk render\'da çağrılır', async () => {
    // Arrange
    const { entities } = await import('@/api/dalClient');

    // Act
    renderExplore();

    // Assert
    await waitFor(() => {
      expect(entities.TestPackage.filter).toHaveBeenCalled();
    });
  });

  it('testler geldiğinde kartlar render edilir', async () => {
    // Arrange
    const { entities } = await import('@/api/dalClient');
    entities.TestPackage.filter.mockResolvedValue([
      { id: 'pkg-1', title: 'Matematik Paketi', price: 1990 },
      { id: 'pkg-2', title: 'Fizik Paketi', price: 2490 },
    ]);

    // Act
    renderExplore();

    // Assert
    await waitFor(() => {
      const cards = screen.getAllByTestId('test-card');
      expect(cards).toHaveLength(2);
    });
  });
});
