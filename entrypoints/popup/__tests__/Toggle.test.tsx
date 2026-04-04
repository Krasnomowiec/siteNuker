import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Toggle } from '../components/Toggle';

describe('Toggle', () => {
  it('renders ON state with aria-checked true', () => {
    render(<Toggle isOn={true} onToggle={() => {}} />);
    const toggle = screen.getByRole('switch');
    expect(toggle).toHaveAttribute('aria-checked', 'true');
    expect(screen.getByText('ON')).toBeInTheDocument();
  });

  it('renders OFF state with aria-checked false', () => {
    render(<Toggle isOn={false} onToggle={() => {}} />);
    const toggle = screen.getByRole('switch');
    expect(toggle).toHaveAttribute('aria-checked', 'false');
    expect(screen.getByText('OFF')).toBeInTheDocument();
  });

  it('calls onToggle when clicked', async () => {
    const user = userEvent.setup();
    const onToggle = vi.fn();
    render(<Toggle isOn={true} onToggle={onToggle} />);

    await user.click(screen.getByRole('switch'));
    expect(onToggle).toHaveBeenCalledOnce();
  });

  it('does not call onToggle when disabled', async () => {
    const user = userEvent.setup();
    const onToggle = vi.fn();
    render(<Toggle isOn={true} onToggle={onToggle} disabled />);

    const toggle = screen.getByRole('switch');
    expect(toggle).toBeDisabled();
    await user.click(toggle);
    expect(onToggle).not.toHaveBeenCalled();
  });
});
