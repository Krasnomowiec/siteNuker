interface IconButtonProps {
  children: React.ReactNode;
  onClick: () => void;
  active: boolean;
}

export function IconButton({ children, onClick, active }: IconButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`
        w-9 h-9 flex items-center justify-center rounded-sm transition-colors hover:bg-bg-tertiary
        ${active ? 'text-accent-red-soft bg-bg-tertiary' : 'text-text-tertiary hover:text-text-primary'}
      `}
    >
      {children}
    </button>
  );
}
