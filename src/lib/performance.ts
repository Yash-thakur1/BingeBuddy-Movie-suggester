/**
 * Performance Monitoring System
 * 
 * Tracks and logs key performance metrics:
 * - Time to first content render
 * - Page load times
 * - API response durations
 * - Component render times
 */

// Performance entry types
export interface PerformanceEntry {
  name: string;
  type: 'navigation' | 'api' | 'render' | 'interaction';
  startTime: number;
  duration: number;
  metadata?: Record<string, unknown>;
}

// Performance metrics store
class PerformanceMonitor {
  private entries: PerformanceEntry[] = [];
  private isEnabled: boolean;
  private maxEntries = 100;
  private onEntryCallbacks: ((entry: PerformanceEntry) => void)[] = [];

  constructor() {
    this.isEnabled = typeof window !== 'undefined' && 
      process.env.NODE_ENV === 'development';
  }

  /**
   * Start timing an operation
   */
  startTimer(name: string): () => PerformanceEntry {
    const startTime = typeof performance !== 'undefined' ? performance.now() : Date.now();
    
    return () => {
      const endTime = typeof performance !== 'undefined' ? performance.now() : Date.now();
      const duration = endTime - startTime;
      
      const entry: PerformanceEntry = {
        name,
        type: 'render',
        startTime,
        duration,
      };
      
      this.addEntry(entry);
      return entry;
    };
  }

  /**
   * Track API call performance
   */
  async trackAPI<T>(
    name: string,
    fetcher: () => Promise<T>,
    metadata?: Record<string, unknown>
  ): Promise<{ data: T; duration: number }> {
    const startTime = typeof performance !== 'undefined' ? performance.now() : Date.now();
    
    try {
      const data = await fetcher();
      const duration = (typeof performance !== 'undefined' ? performance.now() : Date.now()) - startTime;
      
      const entry: PerformanceEntry = {
        name,
        type: 'api',
        startTime,
        duration,
        metadata: { ...metadata, success: true },
      };
      
      this.addEntry(entry);
      return { data, duration };
    } catch (error) {
      const duration = (typeof performance !== 'undefined' ? performance.now() : Date.now()) - startTime;
      
      const entry: PerformanceEntry = {
        name,
        type: 'api',
        startTime,
        duration,
        metadata: { ...metadata, success: false, error: (error as Error).message },
      };
      
      this.addEntry(entry);
      throw error;
    }
  }

  /**
   * Add a performance entry
   */
  addEntry(entry: PerformanceEntry): void {
    if (!this.isEnabled) return;
    
    this.entries.push(entry);
    
    // Keep only recent entries
    if (this.entries.length > this.maxEntries) {
      this.entries = this.entries.slice(-this.maxEntries);
    }
    
    // Log in development
    this.logEntry(entry);
    
    // Notify callbacks
    this.onEntryCallbacks.forEach(cb => cb(entry));
  }

  /**
   * Log entry to console in development
   */
  private logEntry(entry: PerformanceEntry): void {
    if (process.env.NODE_ENV !== 'development') return;
    
    const color = this.getColorForDuration(entry.duration);
    const icon = this.getIconForType(entry.type);
    
    console.log(
      `%c${icon} [${entry.type.toUpperCase()}] ${entry.name}: ${entry.duration.toFixed(2)}ms`,
      `color: ${color}; font-weight: bold;`
    );
  }

  private getColorForDuration(duration: number): string {
    if (duration < 100) return '#22c55e'; // Green - fast
    if (duration < 500) return '#eab308'; // Yellow - moderate
    if (duration < 1000) return '#f97316'; // Orange - slow
    return '#ef4444'; // Red - very slow
  }

  private getIconForType(type: string): string {
    switch (type) {
      case 'navigation': return '🧭';
      case 'api': return '🌐';
      case 'render': return '🎨';
      case 'interaction': return '👆';
      default: return '📊';
    }
  }

  /**
   * Get all entries
   */
  getEntries(): PerformanceEntry[] {
    return [...this.entries];
  }

  /**
   * Get entries by type
   */
  getEntriesByType(type: PerformanceEntry['type']): PerformanceEntry[] {
    return this.entries.filter(e => e.type === type);
  }

  /**
   * Get average duration for a metric
   */
  getAverageDuration(name: string): number {
    const matchingEntries = this.entries.filter(e => e.name === name);
    if (matchingEntries.length === 0) return 0;
    
    const total = matchingEntries.reduce((sum, e) => sum + e.duration, 0);
    return total / matchingEntries.length;
  }

  /**
   * Get performance summary
   */
  getSummary(): {
    totalEntries: number;
    averageApiTime: number;
    slowestApi: PerformanceEntry | null;
    fastestApi: PerformanceEntry | null;
  } {
    const apiEntries = this.getEntriesByType('api');
    
    return {
      totalEntries: this.entries.length,
      averageApiTime: apiEntries.length > 0
        ? apiEntries.reduce((sum, e) => sum + e.duration, 0) / apiEntries.length
        : 0,
      slowestApi: apiEntries.length > 0
        ? apiEntries.reduce((a, b) => a.duration > b.duration ? a : b)
        : null,
      fastestApi: apiEntries.length > 0
        ? apiEntries.reduce((a, b) => a.duration < b.duration ? a : b)
        : null,
    };
  }

  /**
   * Subscribe to new entries
   */
  onEntry(callback: (entry: PerformanceEntry) => void): () => void {
    this.onEntryCallbacks.push(callback);
    return () => {
      this.onEntryCallbacks = this.onEntryCallbacks.filter(cb => cb !== callback);
    };
  }

  /**
   * Clear all entries
   */
  clear(): void {
    this.entries = [];
  }

  /**
   * Enable/disable monitoring
   */
  setEnabled(enabled: boolean): void {
    this.isEnabled = enabled;
  }
}

// Singleton instance
export const performanceMonitor = new PerformanceMonitor();

/**
 * Track Web Vitals (Core Web Vitals metrics)
 */
export function trackWebVitals(): void {
  if (typeof window === 'undefined') return;

  // Track First Contentful Paint
  const observer = new PerformanceObserver((list) => {
    for (const entry of list.getEntries()) {
      if (entry.name === 'first-contentful-paint') {
        performanceMonitor.addEntry({
          name: 'FCP (First Contentful Paint)',
          type: 'navigation',
          startTime: 0,
          duration: entry.startTime,
        });
      }
      if (entry.name === 'largest-contentful-paint') {
        performanceMonitor.addEntry({
          name: 'LCP (Largest Contentful Paint)',
          type: 'navigation',
          startTime: 0,
          duration: entry.startTime,
        });
      }
    }
  });

  try {
    observer.observe({ type: 'paint', buffered: true });
    observer.observe({ type: 'largest-contentful-paint', buffered: true });
  } catch {
    // Observer not supported
  }

  // Track page load time
  window.addEventListener('load', () => {
    const timing = performance.timing || (performance as any).getEntriesByType?.('navigation')?.[0];
    if (timing) {
      const loadTime = timing.loadEventEnd - timing.navigationStart;
      if (loadTime > 0) {
        performanceMonitor.addEntry({
          name: 'Page Load Time',
          type: 'navigation',
          startTime: timing.navigationStart,
          duration: loadTime,
        });
      }
    }
  });
}

/**
 * Measure component render time
 */
export function measureRender(componentName: string): () => void {
  return performanceMonitor.startTimer(`Render: ${componentName}`);
}

/**
 * Measure API call
 */
export async function measureAPI<T>(
  apiName: string,
  fetcher: () => Promise<T>
): Promise<T> {
  const { data } = await performanceMonitor.trackAPI(apiName, fetcher);
  return data;
}

export default performanceMonitor;
