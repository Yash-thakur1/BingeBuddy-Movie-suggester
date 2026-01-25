'use client';

import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { WifiOff, Wifi, AlertTriangle, X, Clock } from 'lucide-react';
import { useNetworkStore, initNetworkMonitoring, formatOfflineDuration } from '@/lib/network';
import { cn } from '@/lib/utils';

/**
 * Network Status Banner
 * Shows a subtle banner when offline or on slow connection
 */
export function NetworkStatusBanner() {
  const { status, isOffline, isSlowConnection } = useNetworkStore();
  const [isDismissed, setIsDismissed] = useState(false);
  const [showReconnected, setShowReconnected] = useState(false);
  const [wasOffline, setWasOffline] = useState(false);

  // Initialize network monitoring
  useEffect(() => {
    const cleanup = initNetworkMonitoring();
    return cleanup;
  }, []);

  // Track reconnection
  useEffect(() => {
    if (isOffline) {
      setWasOffline(true);
      setIsDismissed(false);
    } else if (wasOffline && !isOffline) {
      setShowReconnected(true);
      setWasOffline(false);
      
      // Auto-hide reconnected message after 3 seconds
      const timer = setTimeout(() => {
        setShowReconnected(false);
      }, 3000);
      
      return () => clearTimeout(timer);
    }
  }, [isOffline, wasOffline]);

  const handleDismiss = () => {
    setIsDismissed(true);
  };

  // Don't show if dismissed (for slow connection only)
  if (isDismissed && !isOffline) return null;

  return (
    <AnimatePresence>
      {/* Offline Banner */}
      {isOffline && (
        <motion.div
          initial={{ height: 0, opacity: 0 }}
          animate={{ height: 'auto', opacity: 1 }}
          exit={{ height: 0, opacity: 0 }}
          className="bg-yellow-500/10 border-b border-yellow-500/20 overflow-hidden"
        >
          <div className="container mx-auto px-4 py-2">
            <div className="flex items-center justify-center gap-3 text-sm">
              <WifiOff className="w-4 h-4 text-yellow-500 shrink-0" />
              <span className="text-yellow-500">
                You're offline. Some features may be limited.
              </span>
              <span className="text-yellow-500/60 text-xs hidden sm:inline">
                Last online: {formatOfflineDuration()}
              </span>
            </div>
          </div>
        </motion.div>
      )}

      {/* Slow Connection Banner */}
      {isSlowConnection && !isOffline && !isDismissed && (
        <motion.div
          initial={{ height: 0, opacity: 0 }}
          animate={{ height: 'auto', opacity: 1 }}
          exit={{ height: 0, opacity: 0 }}
          className="bg-orange-500/10 border-b border-orange-500/20 overflow-hidden"
        >
          <div className="container mx-auto px-4 py-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3 text-sm">
                <AlertTriangle className="w-4 h-4 text-orange-500 shrink-0" />
                <span className="text-orange-500">
                  Slow connection detected. Loading optimized content.
                </span>
              </div>
              <button
                onClick={handleDismiss}
                className="text-orange-500/60 hover:text-orange-500 p-1"
                aria-label="Dismiss"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>
        </motion.div>
      )}

      {/* Reconnected Toast */}
      {showReconnected && (
        <motion.div
          initial={{ y: -100, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: -100, opacity: 0 }}
          className="fixed top-20 left-1/2 -translate-x-1/2 z-50"
        >
          <div className="bg-green-500 text-white px-4 py-2 rounded-full shadow-lg flex items-center gap-2 text-sm font-medium">
            <Wifi className="w-4 h-4" />
            Back online!
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

/**
 * Freshness Indicator
 * Shows when data was last updated
 */
interface FreshnessIndicatorProps {
  timestamp: number | null;
  className?: string;
  showIcon?: boolean;
}

export function FreshnessIndicator({
  timestamp,
  className,
  showIcon = true,
}: FreshnessIndicatorProps) {
  const [timeAgo, setTimeAgo] = useState<string>('');

  useEffect(() => {
    const updateTimeAgo = () => {
      if (!timestamp) {
        setTimeAgo('');
        return;
      }

      const now = Date.now();
      const diff = now - timestamp;

      const seconds = Math.floor(diff / 1000);
      const minutes = Math.floor(seconds / 60);
      const hours = Math.floor(minutes / 60);
      const days = Math.floor(hours / 24);

      if (days > 0) {
        setTimeAgo(`${days}d ago`);
      } else if (hours > 0) {
        setTimeAgo(`${hours}h ago`);
      } else if (minutes > 0) {
        setTimeAgo(`${minutes}m ago`);
      } else {
        setTimeAgo('Just now');
      }
    };

    updateTimeAgo();
    const interval = setInterval(updateTimeAgo, 60000); // Update every minute

    return () => clearInterval(interval);
  }, [timestamp]);

  if (!timestamp || !timeAgo) return null;

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 text-xs text-gray-500',
        className
      )}
    >
      {showIcon && <Clock className="w-3 h-3" />}
      <span>Updated {timeAgo}</span>
    </span>
  );
}

/**
 * Loading Indicator with network awareness
 */
interface SmartLoadingProps {
  isLoading: boolean;
  children: React.ReactNode;
  skeleton?: React.ReactNode;
  minLoadTime?: number;
}

export function SmartLoading({
  isLoading,
  children,
  skeleton,
  minLoadTime = 200,
}: SmartLoadingProps) {
  const [showLoading, setShowLoading] = useState(false);
  const { isSlowConnection } = useNetworkStore();

  useEffect(() => {
    if (isLoading) {
      // Don't show loading immediately to avoid flash
      const timer = setTimeout(() => {
        setShowLoading(true);
      }, isSlowConnection ? 0 : minLoadTime);

      return () => clearTimeout(timer);
    } else {
      setShowLoading(false);
    }
  }, [isLoading, minLoadTime, isSlowConnection]);

  if (isLoading && showLoading && skeleton) {
    return <>{skeleton}</>;
  }

  if (isLoading && showLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="loading-spinner" />
      </div>
    );
  }

  return <>{children}</>;
}

export default NetworkStatusBanner;
