import { Component, ReactNode } from 'react';
import { useErrorLogStore } from '../store/errorLogStore';
import './ErrorBoundaryStyles.css';

interface ErrorBoundaryProps {
  label?: string;
  children?: ReactNode;
}

interface ErrorBoundaryState {
  error: Error | null;
  info: { componentStack?: string } | null;
}

export default class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { error: null, info: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { error, info: null };
  }

  componentDidCatch(error: Error, info: { componentStack?: string }) {
    console.error(`[ErrorBoundary:${this.props.label || 'App'}]`, error, info?.componentStack);
    this.setState({ info });
    try {
      useErrorLogStore.getState().addError({
        type: 'react-boundary',
        message: error.message,
        stack: error.stack,
        context: `ErrorBoundary:${this.props.label || 'App'}`,
      });
    } catch {
      // store may not be ready
    }
  }

  render(): ReactNode {
    if (this.state.error) {
      const isDev = import.meta.env.DEV;
      return (
        <div className="error-boundary-fallback">
          <div className="error-boundary-inner">
            <div className="eyebrow">Błąd widoku</div>
            <h3>{this.props.label || 'Widok'}</h3>
            <p>Wystąpił nieoczekiwany błąd. Spróbuj odświeżyć widok lub przeładuj stronę.</p>
            <button
              type="button"
              className="primary-button"
              onClick={() => this.setState({ error: null, info: null })}
            >
              Odśwież widok
            </button>
            {isDev && (
              <pre className="error-boundary-stack">
                {String(this.state.error)}
                {'\n'}
                {this.state.info?.componentStack}
              </pre>
            )}
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
