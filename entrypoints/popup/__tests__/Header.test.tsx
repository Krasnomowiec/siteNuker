import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Header } from '../components/Header';

describe('Header', () => {
  const defaultProps = {
    isEnabled: true,
    onToggle: vi.fn(),
    onNavigate: vi.fn(),
    currentPage: 'main' as const,
  };

  it('renders title', () => {
    render(<Header {...defaultProps} />);
    expect(screen.getByText('SitesNuker')).toBeInTheDocument();
  });

  it('renders toggle in ON state', () => {
    render(<Header {...defaultProps} />);
    const toggle = screen.getByRole('switch');
    expect(toggle).toHaveAttribute('aria-checked', 'true');
  });

  it('calls onToggle when toggle is clicked', async () => {
    const user = userEvent.setup();
    const onToggle = vi.fn();
    render(<Header {...defaultProps} onToggle={onToggle} />);

    await user.click(screen.getByRole('switch'));
    expect(onToggle).toHaveBeenCalledOnce();
  });

  it('navigates to statistics page', async () => {
    const user = userEvent.setup();
    const onNavigate = vi.fn();
    render(<Header {...defaultProps} onNavigate={onNavigate} />);

    await user.click(screen.getByLabelText('statsTitle'));
    expect(onNavigate).toHaveBeenCalledWith('statistics');
  });

  it('navigates to nuclear page', async () => {
    const user = userEvent.setup();
    const onNavigate = vi.fn();
    render(<Header {...defaultProps} onNavigate={onNavigate} />);

    await user.click(screen.getByLabelText('nuclearTitle'));
    expect(onNavigate).toHaveBeenCalledWith('nuclear');
  });
});
