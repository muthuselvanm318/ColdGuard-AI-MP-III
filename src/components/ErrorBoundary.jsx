import React from 'react';

export class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('[ErrorBoundary] Render exception caught:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="glass-card section-card text-center py-12 my-6">
          <h3 className="text-danger font-bold text-lg mb-2">Something went wrong rendering this view</h3>
          <p className="text-xs text-muted mb-4">
            {this.state.error?.message || 'An unexpected rendering error occurred.'}
          </p>
          <button 
            className="btn-primary" 
            onClick={() => {
              this.setState({ hasError: false, error: null });
              window.location.reload();
            }}
          >
            Reload Dashboard
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
