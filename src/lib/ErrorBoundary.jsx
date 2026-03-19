import { Component } from "react";

export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { error: null, info: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    console.error(`[ErrorBoundary:${this.props.label || "App"}]`, error, info?.componentStack);
    this.setState({ info });
  }

  render() {
    if (this.state.error) {
      const isDev = import.meta.env.DEV;
      return (
        <div className="error-boundary-fallback">
          <div className="error-boundary-inner">
            <div className="eyebrow">Błąd widoku</div>
            <h3>{this.props.label || "Widok"}</h3>
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
                {"\n"}
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
