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

  it('hides backdrop when hideBackdrop is true', () => {
    const { container } = render(
      <BottomSheet isOpen={true} onClose={() => {}} hideBackdrop>
        <p>Content</p>
      </BottomSheet>,
    );
    const backdrop = container.querySelector('.backdrop-blur-sm');
    expect(backdrop).toBeNull();
  });

  it('calls onClose when close button is clicked', () => {
    const onClose = vi.fn();
    render(
      <BottomSheet isOpen={true} onClose={onClose}>
        <p>Content</p>
      </BottomSheet>,
    );
    const closeBtn = screen.getByLabelText('Close');
    closeBtn.click();
    expect(onClose).toHaveBeenCalledOnce();
  });

  it('calls onClose when clicking outside the sheet panel', () => {
    const onClose = vi.fn();
    const { container } = render(
      <BottomSheet isOpen={true} onClose={onClose} hideBackdrop>
        <p>Content</p>
      </BottomSheet>,
    );
    // Click the outer wrapper (outside sheet panel)
    const wrapper = container.querySelector('.flex.items-end')!;
    wrapper.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    expect(onClose).toHaveBeenCalledOnce();
  });

  it('does not call onClose when clicking inside the sheet panel', () => {
    const onClose = vi.fn();
    render(
      <BottomSheet isOpen={true} onClose={onClose}>
        <p>Sheet content</p>
      </BottomSheet>,
    );
    screen.getByText('Sheet content').click();
    expect(onClose).not.toHaveBeenCalled();
  });
});
