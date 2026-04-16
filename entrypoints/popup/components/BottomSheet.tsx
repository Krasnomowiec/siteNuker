import { useState, useEffect, useRef, useCallback } from 'react';
import { CloseIcon } from './icons';

interface BottomSheetProps {
  isOpen: boolean;
  onClose: () => void;
  children: React.ReactNode;
  hideBackdrop?: boolean;
}

const FOCUSABLE_SELECTOR =
  'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])';

export function BottomSheet({
  isOpen,
  onClose,
  children,
  hideBackdrop,
}: BottomSheetProps) {
  const sheetRef = useRef<HTMLDivElement>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);

  const handleKeyDown = useCallback(
    (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
        return;
      }

      if (event.key !== 'Tab' || !sheetRef.current) return;

      const focusable =
        sheetRef.current.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR);
      if (focusable.length === 0) return;

      const first = focusable[0]!;
      const last = focusable[focusable.length - 1]!;

      if (event.shiftKey) {
        if (document.activeElement === first) {
          event.preventDefault();
          last.focus();
        }
      } else {
        if (document.activeElement === last) {
          event.preventDefault();
          first.focus();
        }
      }
    },
    [onClose],
  );

  useEffect(() => {
    if (!isOpen) return;

    previousFocusRef.current = document.activeElement as HTMLElement | null;

    document.addEventListener('keydown', handleKeyDown);

    const focusTimer = setTimeout(() => {
      const focusable =
        sheetRef.current?.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR);
      if (focusable && focusable.length > 0) {
        focusable[0]!.focus();
      }
    }, 260);

    return () => {
      clearTimeout(focusTimer);
      document.removeEventListener('keydown', handleKeyDown);
      previousFocusRef.current?.focus();
    };
  }, [isOpen, handleKeyDown]);

  if (!isOpen) return null;

  return (
    <div className="absolute inset-0 z-50 flex items-end" onClick={onClose}>
      {!hideBackdrop && (
        <div className="absolute inset-0 bg-black/60 backdrop-blur-sm animate-fade-in" />
      )}

      <div
        ref={sheetRef}
        role="dialog"
        aria-modal="true"
        className="relative w-full bg-bg-elevated rounded-t-sm px-6 pt-6 pb-8 animate-slide-up"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="absolute top-4 right-4 p-1 text-text-tertiary hover:text-text-primary transition-colors"
        >
          <CloseIcon size={16} />
        </button>
        {children}
      </div>
    </div>
  );
}

interface AnimatedBackdropProps {
  isVisible: boolean;
  onClick: () => void;
}

const EXIT_DURATION = 200;

export function AnimatedBackdrop({ isVisible, onClick }: AnimatedBackdropProps) {
  const [prevVisible, setPrevVisible] = useState(isVisible);
  const [isFading, setIsFading] = useState(false);

  if (prevVisible !== isVisible) {
    setPrevVisible(isVisible);
    if (!isVisible && !isFading) {
      setIsFading(true);
    }
    if (isVisible && isFading) {
      setIsFading(false);
    }
  }

  useEffect(() => {
    if (!isFading) return;
    const timer = setTimeout(() => setIsFading(false), EXIT_DURATION);
    return () => clearTimeout(timer);
  }, [isFading]);

  const show = isVisible || isFading;
  if (!show) return null;

  return (
    <div
      className={`absolute inset-0 z-40 bg-black/60 backdrop-blur-sm ${
        isFading ? 'animate-fade-out' : 'animate-fade-in'
      }`}
      onClick={onClick}
    />
  );
}
