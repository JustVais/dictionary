import { useRef, useState } from "react";

export interface UseSwipeOptions {
  onSwipeLeft: () => void;
  onSwipeRight: () => void;
  onTap?: () => void;
  threshold?: number; // px
}

export function useSwipe({
  onSwipeLeft,
  onSwipeRight,
  onTap,
  threshold = 80,
}: UseSwipeOptions) {
  const [dragX, setDragX] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const startX = useRef(0);
  const dragging = useRef(false);

  function onPointerDown(e: React.PointerEvent) {
    e.currentTarget.setPointerCapture(e.pointerId);
    startX.current = e.clientX;
    dragging.current = true;
    setIsDragging(true);
  }

  function onPointerMove(e: React.PointerEvent) {
    if (!dragging.current) return;
    setDragX(e.clientX - startX.current);
  }

  function onPointerUp() {
    if (!dragging.current) return;
    dragging.current = false;
    setIsDragging(false);
    if (Math.abs(dragX) > threshold) {
      if (dragX > 0) onSwipeRight();
      else onSwipeLeft();
    } else if (Math.abs(dragX) < 10) {
      onTap?.();
    }
    setDragX(0);
  }

  return {
    handlers: {
      onPointerDown,
      onPointerMove,
      onPointerUp,
      onPointerCancel: onPointerUp,
    },
    style: {
      transform: `translateX(${dragX}px) rotate(${dragX / 20}deg)`,
      transition: isDragging ? "none" : "transform 200ms ease",
    } satisfies React.CSSProperties,
  };
}
