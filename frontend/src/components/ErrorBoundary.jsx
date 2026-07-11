import React from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('ErrorBoundary caught an error:', error, errorInfo);
    this.setState({ errorInfo });
  }

  handleReload = () => window.location.reload();

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-4">
          <div className="max-w-md w-full bg-white rounded-xl shadow-lg p-8 text-center border border-red-100">
            <div className="flex justify-center mb-6">
              <div className="p-4 bg-red-100 rounded-full">
                <AlertTriangle className="h-12 w-12 text-red-600" />
              </div>
            </div>

            <h1 className="text-2xl font-bold text-gray-900 mb-3">
              Something went wrong
            </h1>
            <p className="text-gray-600 mb-8">
              An unexpected error occurred while rendering this page. You can
              try refreshing the page to recover.
            </p>

            <button
              onClick={this.handleReload}
              className="inline-flex items-center justify-center w-full px-4 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors"
            >
              <RefreshCw className="mr-2 h-5 w-5" />
              Refresh Page
            </button>

            {import.meta.env?.DEV && this.state.error && (
              <div className="mt-8 text-left border-t pt-4">
                <p className="text-sm font-semibold text-red-600 mb-2">
                  Developer Details:
                </p>
                <div className="bg-gray-100 p-3 rounded-lg overflow-auto max-h-48">
                  <p className="text-xs font-mono text-red-800 font-bold">
                    {this.state.error.toString()}
                  </p>
                  <pre className="text-xs text-gray-800 font-mono mt-2">
                    {this.state.errorInfo?.componentStack}
                  </pre>
                </div>
              </div>
            )}
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
