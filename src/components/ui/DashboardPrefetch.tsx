'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

/**
 * DashboardPrefetch — After the initial paint settles, prefetches
 * Next.js route data for the most-likely-clicked detail pages.
 *
 * Runs once via requestIdleCallback so it never competes with the
 * primary render or hydration.  No visual output.
 *
 * Usage (in a server component):
 *   <DashboardPrefetch hrefs={['/movie/123', '/tv/456']} />
 */

interface DashboardPrefetchProps {
  /** Detail-page routes to prefetch (top ~6–10 items) */
  hrefs: string[];
}

export function DashboardPrefetch({ hrefs }: DashboardPrefetchProps) {
  const router = useRouter();

  useEffect(() => {
    if (hrefs.length === 0) return;

    const schedule =
      typeof requestIdleCallback === 'function'
        ? requestIdleCallback
        : (cb: () => void) => setTimeout(cb, 2000);

    const id = schedule(() => {
      hrefs.forEach((href) => {
        try {
          router.prefetch(href);
        } catch {
          /* non-critical — swallow silently */
        }
      });
    });

    return () => {
      if (typeof cancelIdleCallback === 'function') {
        cancelIdleCallback(id as number);
      } else {
        clearTimeout(id as number);
      }
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps — run once

  return null;
}
