/**
 * Throttle & Performance Utilities
 *
 * Lightweight helpers for scroll-intensive UIs.
 * All functions work in both server and client contexts
 * (no-op in SSR where `requestAnimationFrame` is absent).
 */

/**
 * Classic trailing-edge throttle.
 * Guarantees the callback runs at most once per `wait` ms.
 */
export function throttle<T extends (...args: unknown[]) => void>(
  fn: T,
  wait: number,
): T & { cancel: () => void } {
  let lastTime = 0;
  let timer: ReturnType<typeof setTimeout> | null = null;

  const throttled = function (this: unknown, ...args: unknown[]) {
    const now = Date.now();
    const remaining = wait - (now - lastTime);

    if (remaining <= 0) {
      if (timer) { clearTimeout(timer); timer = null; }
      lastTime = now;
      fn.apply(this, args);
    } else if (!timer) {
      timer = setTimeout(() => {
        lastTime = Date.now();
        timer = null;
        fn.apply(this, args);
      }, remaining);
    }
  } as T & { cancel: () => void };

  throttled.cancel = () => {
    if (timer) { clearTimeout(timer); timer = null; }
  };

  return throttled;
}

/**
 * rAF-based throttle — collapses rapid calls into one repaint.
 * Ideal for scroll / resize handlers that read layout.
 */
export function rafThrottle<T extends (...args: unknown[]) => void>(
  fn: T,
): T & { cancel: () => void } {
  let rafId: number | null = null;
  let lastArgs: unknown[] | null = null;

  const throttled = function (this: unknown, ...args: unknown[]) {
    lastArgs = args;
    if (rafId !== null) return;

    rafId = requestAnimationFrame(() => {
      rafId = null;
      if (lastArgs) fn.apply(this, lastArgs);
    });
  } as T & { cancel: () => void };

  throttled.cancel = () => {
    if (rafId !== null) { cancelAnimationFrame(rafId); rafId = null; }
  };

  return throttled;
}

/**
 * Passive-safe `addEventListener` wrapper.
 * Automatically adds `{ passive: true }` for touch/scroll events.
 */
export function addPassiveListener(
  el: EventTarget,
  event: string,
  handler: EventListener,
): () => void {
  const passive = /^(scroll|wheel|touch)/.test(event);
  el.addEventListener(event, handler, passive ? { passive: true } : false);
  return () => el.removeEventListener(event, handler);
}

/**
 * Schedule work after first paint via `requestIdleCallback` (with rAF fallback).
 */
export function afterPaint(fn: () => void): void {
  if (typeof window === 'undefined') return;
  if ('requestIdleCallback' in window) {
    (window as unknown as { requestIdleCallback: (cb: () => void, opts?: { timeout: number }) => void })
      .requestIdleCallback(fn, { timeout: 2000 });
  } else {
    requestAnimationFrame(() => setTimeout(fn, 0));
  }
}
