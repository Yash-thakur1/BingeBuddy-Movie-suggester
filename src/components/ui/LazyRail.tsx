'use client';

import { useRef, useState, useEffect, type ReactNode } from 'react';

/**
 * LazyRail — Defers rendering of its children until the placeholder
 * enters (or is about to enter) the viewport.
 *
 * Used on dashboard pages to keep the initial HTML payload small:
 * hero + first 2 rails render immediately, remaining rails are
 * replaced by lightweight skeletons until the user scrolls near them.
 *
 * Behaviour:
 *  - Before intersection: renders `fallback` (a skeleton)
 *  - After intersection: renders `children` permanently (no unloading)
 *  - `rootMargin` controls how far ahead to start loading (default 400px)
 */

interface LazyRailProps {
  children: ReactNode;
  /** Skeleton shown before the rail enters the viewport */
  fallback: ReactNode;
  /** How far before the viewport edge to trigger loading */
  rootMargin?: string;
  /** Optional min-height to reserve space and prevent layout shift */
  minHeight?: string;
  /** CSS class for the wrapper */
  className?: string;
}

export function LazyRail({
  children,
  fallback,
  rootMargin = '400px',
  minHeight,
  className,
}: LazyRailProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsVisible(true);
          observer.disconnect();
        }
      },
      { rootMargin, threshold: 0 },
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, [rootMargin]);

  return (
    <div ref={ref} className={className} style={minHeight ? { minHeight } : undefined}>
      {isVisible ? children : fallback}
    </div>
  );
}

export default LazyRail;
