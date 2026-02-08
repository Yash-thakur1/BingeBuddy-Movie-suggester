'use client';

import { useRef, useCallback, useEffect } from 'react';

/**
 * Mobile long-press gesture hook.
 *
 * Fires `onLongPress` after the user holds a touch for `delay` ms
 * without scrolling more than `moveThreshold` px.
 *
 * - Does NOT interfere with normal tap (< delay) or scroll behaviour.
 * - Cancels if a scroll gesture is detected (touchmove beyond threshold).
 * - Automatically cleans up on unmount.
 * - Only active on touch devices (ignores mouse events).
 */

interface UseLongPressOptions {
  /** Milliseconds before the press fires (default 450) */
  delay?: number;
  /** Max px of movement allowed before cancelling (default 10) */
  moveThreshold?: number;
  /** Callback when long press is triggered */
  onLongPress: () => void;
  /** Callback when long press is cancelled or released */
  onCancel?: () => void;
  /** Disable the hook entirely */
  disabled?: boolean;
}

export function useLongPress({
  delay = 450,
  moveThreshold = 10,
  onLongPress,
  onCancel,
  disabled = false,
}: UseLongPressOptions) {
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const startPos = useRef<{ x: number; y: number } | null>(null);
  const firedRef = useRef(false);
  const activeRef = useRef(false);

  const clear = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    if (activeRef.current && !firedRef.current) {
      onCancel?.();
    }
    activeRef.current = false;
    firedRef.current = false;
    startPos.current = null;
  }, [onCancel]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  const onTouchStart = useCallback(
    (e: React.TouchEvent) => {
      if (disabled) return;
      const touch = e.touches[0];
      startPos.current = { x: touch.clientX, y: touch.clientY };
      activeRef.current = true;
      firedRef.current = false;

      timerRef.current = setTimeout(() => {
        firedRef.current = true;
        onLongPress();
      }, delay);
    },
    [delay, onLongPress, disabled]
  );

  const onTouchMove = useCallback(
    (e: React.TouchEvent) => {
      if (!activeRef.current || !startPos.current) return;
      const touch = e.touches[0];
      const dx = Math.abs(touch.clientX - startPos.current.x);
      const dy = Math.abs(touch.clientY - startPos.current.y);

      // Cancel if user moved beyond threshold (scrolling)
      if (dx > moveThreshold || dy > moveThreshold) {
        clear();
      }
    },
    [moveThreshold, clear]
  );

  const onTouchEnd = useCallback(() => {
    clear();
  }, [clear]);

  return {
    onTouchStart,
    onTouchMove,
    onTouchEnd,
  };
}
