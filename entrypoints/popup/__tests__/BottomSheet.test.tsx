import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { BottomSheet } from '../components/BottomSheet';

describe('BottomSheet', () => {
  it('renders nothing when closed', () => {
    const { container } = render(
      <BottomSheet isOpen={false} onClose={() => {}}>
        <p>Content</p>
      </BottomSheet>,
    );
    expect(container.innerHTML).toBe('');
  });

  it('renders children when open', () => {
    render(
      <BottomSheet isOpen={true} onClose={() => {}}>
        <p>Sheet content</p>
      </BottomSheet>,
    );
    expect(screen.getByText('Sheet content')).toBeInTheDocument();
  });

  it('has dialog role with aria-modal', () => {
    render(
      <BottomSheet isOpen={true} onClose={() => {}}>
        <p>Content</p>
      </BottomSheet>,
    );
    const dialog = screen.getByRole('dialog');
    expect(dialog).toHaveAttribute('aria-modal', 'true');
  });

  it('calls onClose when Escape is pressed', async () => {
    const onClose = vi.fn();
    render(
      <BottomSheet isOpen={true} onClose={onClose}>
        <button>inside</button>
      </BottomSheet>,
    );

    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    expect(onClose).toHaveBeenCalledOnce();
  });
});
