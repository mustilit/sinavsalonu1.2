import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import * as AuthContext from '@/lib/AuthContext';
import MyResults from './MyResults';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: false },
  },
});

vi.mock('@/api/base44Client', () => ({
  base44: {
    entities: {
      TestResult: {
        filter: vi.fn().mockResolvedValue([]),
      },
    },
  },
}));

describe('MyResults', () => {
  beforeEach(() => {
    vi.spyOn(AuthContext, 'useAuth').mockReturnValue({
      user: { id: 'cand-1', role: 'CANDIDATE', email: 'aday@demo.com' },
      isAuthenticated: true,
    });
  });

  it('renders page title and empty state when candidate has no results', async () => {
    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter>
          <MyResults />
        </MemoryRouter>
      </QueryClientProvider>
    );

    // v5+ i18n: title "Performans Raporlarım", desc "Çözdüğün testlerin sonuçlarını..."
    expect(screen.getByText(/Performans Raporlarım/i)).toBeInTheDocument();
    expect(await screen.findByText(/Performans Raporlarım/i)).toBeInTheDocument();
    expect(screen.getByText(/Çözdüğün testlerin sonuçlarını/i)).toBeInTheDocument();
  });
});
