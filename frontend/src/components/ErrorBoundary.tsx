import React, { Component } from 'react';
import type { ErrorInfo } from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';

interface Props {
  children: React.ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('[ERROR_BOUNDARY] Uncaught error:', error, info);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-[400px] flex items-center justify-center p-8">
          <div className="glass-panel rounded-2xl p-8 max-w-md w-full text-center space-y-4">
            <div className="flex justify-center">
              <div className="w-16 h-16 rounded-full bg-red-500/10 flex items-center justify-center">
                <AlertTriangle className="w-8 h-8 text-red-400" />
              </div>
            </div>
            <h2 className="text-xl font-semibold text-slate-100">Something went wrong</h2>
            <p className="text-slate-400 text-sm leading-relaxed">
              {this.state.error?.message || 'An unexpected error occurred. Please try refreshing the page.'}
            </p>
            <button
              onClick={() => window.location.reload()}
              className="inline-flex items-center gap-2 px-5 py-2.5 bg-brand-500 hover:bg-brand-600 text-white rounded-xl font-medium text-sm transition-colors duration-200"
            >
              <RefreshCw className="w-4 h-4" />
              Refresh page
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
