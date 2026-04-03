interface ToggleProps {
  isOn: boolean;
  onToggle: () => void;
  disabled?: boolean;
}

export function Toggle({ isOn, onToggle, disabled = false }: ToggleProps) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={isOn}
      aria-disabled={disabled}
      onClick={onToggle}
      disabled={disabled}
      className={`
        flex items-center gap-2 px-2 py-1 rounded-sm transition-colors
        ${isOn ? 'bg-accent-green/20' : 'bg-bg-elevated hover:bg-bg-tertiary'}
        ${disabled ? 'opacity-40 cursor-not-allowed' : 'cursor-pointer'}
      `}
    >
      <span
        className={`
          text-[10px] font-bold font-headline uppercase min-w-[22px] text-center
          ${isOn ? 'text-accent-green-bright' : 'text-text-secondary'}
        `}
      >
        {isOn ? 'ON' : 'OFF'}
      </span>
      <div
        className={`
          relative w-8 h-4 rounded-full transition-colors duration-200
          ${isOn ? 'bg-accent-green' : 'bg-bg-tertiary ring-1 ring-text-tertiary/30'}
        `}
      >
        <span
          className={`
            absolute top-[2px] left-[2px] w-3 h-3 rounded-full
            transition-all duration-200
            ${isOn ? 'translate-x-[16px] bg-accent-green-bright' : 'translate-x-0 bg-text-secondary'}
          `}
        />
      </div>
    </button>
  );
}
