"use client";

import { useEffect, useRef } from "react";

type Props = {
  /** Inactivity threshold in ms. When no user event fires for this long,
   * onExpire is called. */
  timeoutMs: number;
  onExpire: () => void;
};

/**
 * Fires `onExpire` after `timeoutMs` of no user interaction on the window.
 *
 * Used to auto-relock the admin PIN gate so an unattended tablet doesn't
 * stay unlocked indefinitely. Interaction = pointerdown, keydown, scroll,
 * touchstart — mousemove is intentionally excluded as too noisy.
 *
 * Renders nothing. Siblings stay mounted; this is a pure side-effect
 * component.
 */
export default function IdleLock({ timeoutMs, onExpire }: Props) {
  // Keep the latest onExpire in a ref so we don't re-bind listeners on
  // every render if the parent passes a fresh callback.
  const onExpireRef = useRef(onExpire);
  useEffect(() => {
    onExpireRef.current = onExpire;
  }, [onExpire]);

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | null = null;

    const schedule = () => {
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => onExpireRef.current(), timeoutMs);
    };

    const reset = () => schedule();

    schedule();

    const events = ["pointerdown", "keydown", "scroll", "touchstart"] as const;
    events.forEach((e) => window.addEventListener(e, reset, { passive: true }));

    return () => {
      if (timer) clearTimeout(timer);
      events.forEach((e) => window.removeEventListener(e, reset));
    };
  }, [timeoutMs]);

  return null;
}

/** Admin idle-lock threshold. Unattended tablet relocks after 5 minutes. */
export const ADMIN_IDLE_LOCK_MS = 5 * 60 * 1000;
