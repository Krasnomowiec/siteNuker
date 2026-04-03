interface ConfirmationSheetProps {
  title: string;
  description: string;
  confirmLabel: string;
  cancelLabel: string;
  onConfirm: () => void;
  onCancel: () => void;
  /** 'danger' = cancel gets CTA style (default), 'cta' = confirm gets CTA style */
  variant?: 'danger' | 'cta';
}

export function ConfirmationSheet({
  title,
  description,
  confirmLabel,
  cancelLabel,
  onConfirm,
  onCancel,
  variant = 'danger',
}: ConfirmationSheetProps) {
  return (
    <div className="space-y-5">
      <div className="space-y-2 text-center">
        <h2 className="text-header font-headline font-bold text-text-primary leading-snug">
          {title}
        </h2>
        <p className="text-secondary text-text-secondary">{description}</p>
      </div>

      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={onCancel}
          className={variant === 'danger' ? 'btn-cta' : 'btn-secondary'}
        >
          {cancelLabel}
        </button>
        <button
          type="button"
          onClick={onConfirm}
          className={variant === 'cta' ? 'btn-cta' : 'btn-secondary'}
        >
          {confirmLabel}
        </button>
      </div>
    </div>
  );
}
