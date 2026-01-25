'use client';

import { useEffect, ReactNode } from 'react';
import { trackWebVitals, performanceMonitor } from '@/lib/performance';

interface PerformanceProviderProps {
  children: ReactNode;
}

/**
 * Performance Provider
 * Initializes performance monitoring and Web Vitals tracking
 */
export function PerformanceProvider({ children }: PerformanceProviderProps) {
  useEffect(() => {
    // Initialize Web Vitals tracking
    trackWebVitals();

    // Track page navigation timing
    const handleRouteChange = () => {
      const navEntry = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming;
      if (navEntry) {
        performanceMonitor.addEntry({
          name: 'Route Change',
          type: 'navigation',
          startTime: navEntry.startTime,
          duration: navEntry.duration,
        });
      }
    };

    // Listen for popstate (browser back/forward)
    window.addEventListener('popstate', handleRouteChange);

    // Log initial page load summary
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

    return () => {
      window.removeEventListener('popstate', handleRouteChange);
    };
  }, []);

  return <>{children}</>;
}

export default PerformanceProvider;
