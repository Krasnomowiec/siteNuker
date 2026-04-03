import { ChevronIcon } from './icons';

interface PageHeaderProps {
  title: string;
  onBack: () => void;
}

export function PageHeader({ title, onBack }: PageHeaderProps) {
  return (
    <div className="px-4 pt-4 pb-1 shrink-0 flex items-center gap-1.5">
      <button
        type="button"
        onClick={onBack}
        aria-label="Go back"
        className="flex items-center justify-center h-5 p-0 text-text-tertiary hover:text-text-primary transition-colors"
      >
        <ChevronIcon size={18} className="rotate-90" />
      </button>
      <h1 className="font-headline font-bold text-header text-accent-red">
        {title}
      </h1>
    </div>
  );
}
