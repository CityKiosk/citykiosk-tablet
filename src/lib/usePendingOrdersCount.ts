"use client";

import { useEffect, useState } from "react";
import { getPendingOrders, QUEUE_CHANGED_EVENT } from "./orderQueue";

/**
 * Live count of orders waiting in the offline retry queue.
 * Updates on queue mutations (QUEUE_CHANGED_EVENT), cross-tab localStorage
 * changes and online/offline transitions. Starts at 0 on the server and
 * hydrates on mount — no SSR mismatch.
 */
export function usePendingOrdersCount(): number {
  const [count, setCount] = useState(0);

  useEffect(() => {
    const update = () => setCount(getPendingOrders().length);
    update();
    window.addEventListener(QUEUE_CHANGED_EVENT, update);
    window.addEventListener("storage", update);
    window.addEventListener("online", update);
    window.addEventListener("offline", update);
    return () => {
      window.removeEventListener(QUEUE_CHANGED_EVENT, update);
      window.removeEventListener("storage", update);
      window.removeEventListener("online", update);
      window.removeEventListener("offline", update);
    };
  }, []);

  return count;
}
