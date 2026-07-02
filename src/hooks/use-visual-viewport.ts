"use client";

import { useEffect, useState } from "react";

export interface VisualViewportRect {
  height: number;
  offsetTop: number;
}

/**
 * Tracks window.visualViewport so fixed-position UI (dialogs) can stay
 * centered in the *visible* area when the mobile keyboard opens.
 */
export function useVisualViewport(): VisualViewportRect | null {
  const [rect, setRect] = useState<VisualViewportRect | null>(null);

  useEffect(() => {
    const viewport = window.visualViewport;
    if (!viewport) return;

    const update = () =>
      setRect({ height: viewport.height, offsetTop: viewport.offsetTop });
    update();
    viewport.addEventListener("resize", update);
    viewport.addEventListener("scroll", update);
    return () => {
      viewport.removeEventListener("resize", update);
      viewport.removeEventListener("scroll", update);
    };
  }, []);

  return rect;
}
