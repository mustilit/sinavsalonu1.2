/**
 * About sayfası smoke testleri
 * Kapsam: render doğrulaması, başlık varlığı, geri linki, statik bölümler
 */
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import About from '../About';

vi.mock('@/utils', () => ({
  createPageUrl: (name) => `/${name}`,
}));

function renderAbout() {
  return render(
    <MemoryRouter>
      <About />
    </MemoryRouter>
  );
}

describe('About sayfası', () => {
  it('sayfa render edilir ve boş değildir', () => {
    // Arrange & Act
    const { container } = renderAbout();
    // Assert
    expect(container.firstChild).toBeTruthy();
    expect(document.body.textContent.trim().length).toBeGreaterThan(0);
  });

  it('h1 başlığı mevcut', () => {
    // Arrange & Act
    renderAbout();
    // Assert
    const heading = screen.getByRole('heading', { level: 1 });
    expect(heading).toBeInTheDocument();
  });

  it('Ana sayfaya dönüş linki mevcut', () => {
    // Arrange & Act
    renderAbout();
    // Assert
    const backLink = screen.getAllByRole('link').find(
      (el) => el.getAttribute('href') === '/Home'
    );
    expect(backLink).toBeDefined();
  });

  it('misyon bölümü başlığı render edilir', () => {
    // Arrange & Act
    renderAbout();
    // Assert
    const headings = screen.getAllByRole('heading', { level: 2 });
    expect(headings.length).toBeGreaterThan(0);
  });

  it('min-h-screen sınıfıyla tam sayfa yüksekliği ayarlanmış', () => {
    // Arrange & Act
    const { container } = renderAbout();
    // Assert — en üst div min-h-screen içermeli
    expect(container.firstChild.className).toContain('min-h-screen');
  });
});
