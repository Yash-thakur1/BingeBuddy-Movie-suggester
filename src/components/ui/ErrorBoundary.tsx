'use client';

import React, { Component, ReactNode } from 'react';
import { AlertTriangle, RefreshCw, Home, WifiOff } from 'lucide-react';
import { Button } from '@/components/ui';

interface ErrorBoundaryProps {
  children: ReactNode;
  fallback?: ReactNode;
  onError?: (error: Error, errorInfo: React.ErrorInfo) => void;
  showRetry?: boolean;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

/**
 * Error Boundary Component
 * Catches JavaScript errors anywhere in child component tree
 */
export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('[ErrorBoundary] Caught error:', error, errorInfo);
    this.props.onError?.(error, errorInfo);
  }

  handleRetry = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <ErrorFallback
          error={this.state.error}
          onRetry={this.props.showRetry !== false ? this.handleRetry : undefined}
        />
      );
    }

    return this.props.children;
  }
}

/**
 * Default Error Fallback UI
 */
interface ErrorFallbackProps {
  error?: Error | null;
  onRetry?: () => void;
  title?: string;
  description?: string;
}

export function ErrorFallback({
  error,
  onRetry,
  title = 'Something went wrong',
  description = 'We encountered an error while loading this content.',
}: ErrorFallbackProps) {
  return (
    <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
      <div className="w-16 h-16 mb-6 rounded-full bg-red-500/10 flex items-center justify-center">
        <AlertTriangle className="w-8 h-8 text-red-500" />
      </div>
      
      <h3 className="text-xl font-semibold text-white mb-2">{title}</h3>
      <p className="text-gray-400 mb-6 max-w-md">{description}</p>
      
      {error && process.env.NODE_ENV === 'development' && (
        <pre className="text-xs text-red-400 bg-dark-800 p-4 rounded-lg mb-6 max-w-lg overflow-auto">
          {error.message}
        </pre>
      )}
      
      <div className="flex gap-4">
        {onRetry && (
          <Button onClick={onRetry} variant="primary">
            <RefreshCw className="w-4 h-4 mr-2" />
            Try Again
          </Button>
        )}
        <Button onClick={() => window.location.href = '/'} variant="secondary">
          <Home className="w-4 h-4 mr-2" />
          Go Home
        </Button>
      </div>
    </div>
  );
}

/**
 * Offline Fallback UI
 */
interface OfflineFallbackProps {
  cachedContent?: ReactNode;
  onRetry?: () => void;
}

export function OfflineFallback({ cachedContent, onRetry }: OfflineFallbackProps) {
  if (cachedContent) {
    return (
      <div>
        {/* Offline banner */}
        <div className="bg-yellow-500/10 border-b border-yellow-500/20 px-4 py-2">
          <div className="container mx-auto flex items-center justify-center gap-2 text-sm text-yellow-500">
            <WifiOff className="w-4 h-4" />
            <span>You're offline. Showing cached content.</span>
          </div>
        </div>
        {cachedContent}
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
      <div className="w-16 h-16 mb-6 rounded-full bg-yellow-500/10 flex items-center justify-center">
        <WifiOff className="w-8 h-8 text-yellow-500" />
      </div>
      
      <h3 className="text-xl font-semibold text-white mb-2">You're Offline</h3>
      <p className="text-gray-400 mb-6 max-w-md">
        Please check your internet connection and try again.
      </p>
      
      {onRetry && (
        <Button onClick={onRetry} variant="primary">
          <RefreshCw className="w-4 h-4 mr-2" />
          Retry
        </Button>
      )}
    </div>
  );
}

/**
 * API Error Fallback
 */
interface APIErrorFallbackProps {
  error?: string;
  onRetry?: () => void;
}

export function APIErrorFallback({ error, onRetry }: APIErrorFallbackProps) {
  return (
    <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
      <div className="w-12 h-12 mb-4 rounded-full bg-dark-800 flex items-center justify-center">
        <AlertTriangle className="w-6 h-6 text-gray-400" />
      </div>
      
      <h4 className="text-lg font-medium text-white mb-1">Failed to load content</h4>
      <p className="text-sm text-gray-400 mb-4">
        {error || 'Something went wrong. Please try again.'}
      </p>
      
      {onRetry && (
        <Button onClick={onRetry} variant="secondary" size="sm">
          <RefreshCw className="w-4 h-4 mr-2" />
          Retry
        </Button>
      )}
    </div>
  );
}

/**
 * Empty State Fallback
 */
interface EmptyStateFallbackProps {
  icon?: ReactNode;
  title: string;
  description?: string;
  action?: ReactNode;
}

export function EmptyStateFallback({
  icon,
  title,
  description,
  action,
}: EmptyStateFallbackProps) {
  return (
    <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
      {icon && (
        <div className="w-16 h-16 mb-6 rounded-full bg-dark-800 flex items-center justify-center text-gray-500">
          {icon}
        </div>
      )}
      
      <h3 className="text-xl font-semibold text-white mb-2">{title}</h3>
      {description && (
        <p className="text-gray-400 mb-6 max-w-md">{description}</p>
      )}
      
      {action}
    </div>
  );
}

export default ErrorBoundary;
