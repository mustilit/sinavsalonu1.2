import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import * as AuthContext from '@/lib/AuthContext';
import MyTestPackages from './MyTestPackages';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: false },
  },
});

vi.mock('@/api/dalClient', () => ({
  auth: {
    login: vi.fn(),
    logout: vi.fn(),
    getCurrentUser: vi.fn(),
  },
  entities: {
    TestPackage: {
      filter: vi.fn().mockResolvedValue([]),
      update: vi.fn().mockResolvedValue({}),
    },
    ExamType: {
      filter: vi.fn().mockResolvedValue([]),
    },
  },
}));

describe('MyTestPackages', () => {
  beforeEach(() => {
    vi.spyOn(AuthContext, 'useAuth').mockReturnValue({
      user: { id: 'edu-1', role: 'EDUCATOR', email: 'educator@demo.com' },
      isAuthenticated: true,
    });
  });

  it('renders page title and empty state when educator has no tests', async () => {
    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter>
          <MyTestPackages />
        </MemoryRouter>
      </QueryClientProvider>
    );

    expect(screen.getByText(/Test Paketlerim/i)).toBeInTheDocument();
    // v5+ i18n: desc "Oluşturduğun test paketlerini yönet"
    expect(screen.getByText(/Oluşturduğun test paketlerini yönet/i)).toBeInTheDocument();

    // Empty state should appear after loading
    expect(await screen.findByText(/Henüz test oluşturmadın/i)).toBeInTheDocument();
  });
});
