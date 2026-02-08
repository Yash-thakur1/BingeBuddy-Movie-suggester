'use client';

import { ReactNode } from 'react';

interface PerformanceProviderProps {
  children: ReactNode;
}

/**
 * Performance Provider — passthrough wrapper.
 * All optimization systems are disabled for baseline stability.
 */
export function PerformanceProvider({ children }: PerformanceProviderProps) {
  return <>{children}</>;
}

export default PerformanceProvider;
