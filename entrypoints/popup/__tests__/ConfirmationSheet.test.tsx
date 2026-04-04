import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ConfirmationSheet } from '../components/ConfirmationSheet';

describe('ConfirmationSheet', () => {
  const defaultProps = {
    title: 'Confirm action?',
    description: 'This cannot be undone.',
    confirmLabel: 'Yes',
    cancelLabel: 'No',
    onConfirm: vi.fn(),
    onCancel: vi.fn(),
  };

  it('renders title, description, and button labels', () => {
    render(<ConfirmationSheet {...defaultProps} />);
    expect(screen.getByText('Confirm action?')).toBeInTheDocument();
    expect(screen.getByText('This cannot be undone.')).toBeInTheDocument();
    expect(screen.getByText('Yes')).toBeInTheDocument();
    expect(screen.getByText('No')).toBeInTheDocument();
  });

  it('calls onConfirm when confirm button clicked', async () => {
    const user = userEvent.setup();
    const onConfirm = vi.fn();
    render(<ConfirmationSheet {...defaultProps} onConfirm={onConfirm} />);

    await user.click(screen.getByText('Yes'));
    expect(onConfirm).toHaveBeenCalledOnce();
  });

  it('calls onCancel when cancel button clicked', async () => {
    const user = userEvent.setup();
    const onCancel = vi.fn();
    render(<ConfirmationSheet {...defaultProps} onCancel={onCancel} />);

    await user.click(screen.getByText('No'));
    expect(onCancel).toHaveBeenCalledOnce();
  });
});
