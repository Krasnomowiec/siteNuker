interface IconButtonProps {
  children: React.ReactNode;
  onClick: () => void;
  active: boolean;
  'aria-label': string;
}

export function IconButton({ children, onClick, active, 'aria-label': ariaLabel }: IconButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={ariaLabel}
      className={`
        w-9 h-9 flex items-center justify-center rounded-sm transition-colors hover:bg-bg-tertiary
        ${active ? 'text-accent-red-soft bg-bg-tertiary' : 'text-text-tertiary hover:text-text-primary'}
      `}
    >
      {children}
    </button>
  );
}
