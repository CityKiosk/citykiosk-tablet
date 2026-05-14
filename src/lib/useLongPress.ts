"use client";

import { useCallback, useRef } from "react";

type Options = {
  /** Press duration before the long-press fires. Default 700 ms — the
   *  designer-recommended threshold for the cart-sheet discount gesture. */
  durationMs?: number;
  /** Pixels of finger drift that cancel the gesture (so a scroll start
   *  doesn't accidentally trigger). Default 12. */
  movementToleranceMs?: number;
};

type Handlers = {
  onPointerDown: (e: React.PointerEvent) => void;
  onPointerUp: () => void;
  onPointerLeave: () => void;
  onPointerCancel: () => void;
  onPointerMove: (e: React.PointerEvent) => void;
  onContextMenu: (e: React.MouseEvent) => void;
};

/** Mouse + touch long-press detection. Cancels on drag so it doesn't trigger
 *  during a scroll, and on right-click context menu so iOS Safari doesn't
 *  show the magnifier. */
export function useLongPress(onLongPress: () => void, opts: Options = {}): Handlers {
  const duration = opts.durationMs ?? 700;
  const tolerance = opts.movementToleranceMs ?? 12;
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const startRef = useRef<{ x: number; y: number } | null>(null);

  const cancel = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    startRef.current = null;
  }, []);

  const onPointerDown = useCallback(
    (e: React.PointerEvent) => {
      startRef.current = { x: e.clientX, y: e.clientY };
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => {
        timerRef.current = null;
        // Brief haptic so the owner knows the gesture registered. Customer
        // pointing at the screen would not feel this on their finger.
        try {
          if (typeof navigator !== "undefined" && navigator.vibrate) navigator.vibrate(15);
        } catch {}
        onLongPress();
      }, duration);
    },
    [duration, onLongPress],
  );

  const onPointerMove = useCallback(
    (e: React.PointerEvent) => {
      if (!startRef.current || !timerRef.current) return;
      const dx = e.clientX - startRef.current.x;
      const dy = e.clientY - startRef.current.y;
      if (Math.hypot(dx, dy) > tolerance) cancel();
    },
    [cancel, tolerance],
  );

  return {
    onPointerDown,
    onPointerUp: cancel,
    onPointerLeave: cancel,
    onPointerCancel: cancel,
    onPointerMove,
    // Block the iOS magnifier / right-click menu on the gesture target.
    onContextMenu: (e) => e.preventDefault(),
  };
}
