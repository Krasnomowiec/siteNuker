import { Component } from 'react';
import type { ReactNode, ErrorInfo } from 'react';
import { POPUP_WIDTH } from '@/shared/constants';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error('[SitesNuker] UI crash:', error, info.componentStack);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div
          className="bg-bg-primary text-text-primary font-sans flex flex-col items-center justify-center gap-3 p-6"
          style={{ width: POPUP_WIDTH, height: 200 }}
        >
          <p className="text-body text-text-secondary text-center">
            Something went wrong. Try reopening the popup.
          </p>
        </div>
      );
    }

    return this.props.children;
  }
}
