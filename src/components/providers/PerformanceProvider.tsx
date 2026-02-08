'use client';

import { useEffect, ReactNode } from 'react';

interface PerformanceProviderProps {
  children: ReactNode;
}

/**
 * Performance Provider
 * Initializes all performance optimization systems after hydration
 * via dynamic imports so none of these modules land in the initial JS bundle.
 */
export function PerformanceProvider({ children }: PerformanceProviderProps) {
  useEffect(() => {
    let cleanupNetwork: (() => void) | undefined;
    let cleanupScroll: (() => void) | undefined;

    async function init() {
      const [
        { trackWebVitals, performanceMonitor },
        { initNetworkMonitoring },
        { initScrollTracking, configurePrefetch },
        { initCache },
        { initServiceWorker },
      ] = await Promise.all([
        import('@/lib/performance'),
        import('@/lib/network'),
        import('@/lib/smartPrefetch'),
        import('@/lib/multiLayerCache'),
        import('@/lib/serviceWorker'),
      ]);

      // Initialize Web Vitals tracking
      trackWebVitals();

      // Initialize network monitoring
      cleanupNetwork = initNetworkMonitoring();

      // Initialize scroll tracking for prefetching
      cleanupScroll = initScrollTracking();

      // Configure prefetch based on device capabilities
      configurePrefetch({
        hoverDelay: 100,
        viewportMargin: '300px',
        maxConcurrent: navigator.hardwareConcurrency > 4 ? 4 : 2,
        maxQueueSize: 30,
      });

      // Initialize multi-layer cache
      initCache();

      // Initialize service worker (production only)
      initServiceWorker();

      // Log initial page load summary (dev only)
      if (process.env.NODE_ENV === 'development') {
        setTimeout(() => {
          const summary = performanceMonitor.getSummary();
          if (summary.totalEntries > 0) {
            console.log(
              '%c📊 Performance Summary',
              'color: #3b82f6; font-weight: bold; font-size: 14px;'
            );
            console.log(`  Total entries: ${summary.totalEntries}`);
            console.log(`  Avg API time: ${summary.averageApiTime.toFixed(2)}ms`);
            if (summary.slowestApi) {
              console.log(`  Slowest API: ${summary.slowestApi.name} (${summary.slowestApi.duration.toFixed(2)}ms)`);
            }
          }
        }, 3000);
      }
    }

    init();

    // Track page navigation timing
    const handleRouteChange = () => {
      const navEntry = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming;
      if (navEntry) {
        import('@/lib/performance').then(({ performanceMonitor }) => {
          performanceMonitor.addEntry({
            name: 'Route Change',
            type: 'navigation',
            startTime: navEntry.startTime,
            duration: navEntry.duration,
          });
        });
      }
    };

    window.addEventListener('popstate', handleRouteChange);

    return () => {
      window.removeEventListener('popstate', handleRouteChange);
      cleanupNetwork?.();
      cleanupScroll?.();
    };
  }, []);

  return <>{children}</>;
}

export default PerformanceProvider;
