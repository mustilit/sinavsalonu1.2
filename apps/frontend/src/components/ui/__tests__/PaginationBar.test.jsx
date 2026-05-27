/**
 * PaginationBar bileşeni unit testleri
 * Kapsam: prev/next disabled durumları, totalPages <= 1 gizleme, onPageChange
 */
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import PaginationBar from '../../ui/PaginationBar';

describe('PaginationBar bileşeni', () => {
  it('totalPages <= 1 iken hiçbir şey render edilmez', () => {
    // Arrange & Act
    const { container } = render(
      <PaginationBar page={1} totalPages={1} onPageChange={vi.fn()} />
    );
    // Assert
    expect(container.firstChild).toBeNull();
  });

  it('totalPages null iken hiçbir şey render edilmez', () => {
    // Arrange & Act
    const { container } = render(
      <PaginationBar page={1} totalPages={null} onPageChange={vi.fn()} />
    );
    // Assert
    expect(container.firstChild).toBeNull();
  });

  it('totalPages 0 iken hiçbir şey render edilmez', () => {
    // Arrange & Act
    const { container } = render(
      <PaginationBar page={1} totalPages={0} onPageChange={vi.fn()} />
    );
    // Assert
    expect(container.firstChild).toBeNull();
  });

  it('totalPages > 1 iken prev ve next butonları render edilir', () => {
    // Arrange & Act
    render(<PaginationBar page={2} totalPages={5} onPageChange={vi.fn()} />);
    // Assert
    expect(screen.getByRole('button', { name: /önceki/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /sonraki/i })).toBeInTheDocument();
  });

  it('ilk sayfada Önceki butonu disabled', () => {
    // Arrange & Act
    render(<PaginationBar page={1} totalPages={5} onPageChange={vi.fn()} />);
    // Assert
    expect(screen.getByRole('button', { name: /önceki/i })).toBeDisabled();
  });

  it('son sayfada Sonraki butonu disabled', () => {
    // Arrange & Act
    render(<PaginationBar page={5} totalPages={5} onPageChange={vi.fn()} />);
    // Assert
    expect(screen.getByRole('button', { name: /sonraki/i })).toBeDisabled();
  });

  it('orta sayfada her iki buton da aktif', () => {
    // Arrange & Act
    render(<PaginationBar page={3} totalPages={5} onPageChange={vi.fn()} />);
    // Assert
    expect(screen.getByRole('button', { name: /önceki/i })).not.toBeDisabled();
    expect(screen.getByRole('button', { name: /sonraki/i })).not.toBeDisabled();
  });

  it('Sonraki butonuna tıklanınca page+1 ile onPageChange çağrılır', () => {
    // Arrange
    const onPageChange = vi.fn();
    render(<PaginationBar page={2} totalPages={5} onPageChange={onPageChange} />);

    // Act
    fireEvent.click(screen.getByRole('button', { name: /sonraki/i }));

    // Assert
    expect(onPageChange).toHaveBeenCalledWith(3);
  });

  it('Önceki butonuna tıklanınca page-1 ile onPageChange çağrılır', () => {
    // Arrange
    const onPageChange = vi.fn();
    render(<PaginationBar page={3} totalPages={5} onPageChange={onPageChange} />);

    // Act
    fireEvent.click(screen.getByRole('button', { name: /önceki/i }));

    // Assert
    expect(onPageChange).toHaveBeenCalledWith(2);
  });

  it('mevcut sayfa ve toplam sayfa sayfa göstergesinde görünür', () => {
    // Arrange & Act
    render(<PaginationBar page={3} totalPages={7} onPageChange={vi.fn()} />);
    // Assert — sayfa bilgisi metin içinde
    const pageText = screen.getByText(/3/);
    expect(pageText).toBeInTheDocument();
  });

  it('disabled butonlara tıklanınca onPageChange çağrılmaz', () => {
    // Arrange
    const onPageChange = vi.fn();
    render(<PaginationBar page={1} totalPages={5} onPageChange={onPageChange} />);

    // Act — Önceki butonu disabled; onClick handler sadece canPrev=true ise çalışır
    fireEvent.click(screen.getByRole('button', { name: /önceki/i }));

    // Assert
    expect(onPageChange).not.toHaveBeenCalled();
  });
});
