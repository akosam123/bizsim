import { useEffect, useRef, useState } from 'react';

/**
 * Animates a number toward its target over ~600ms so cash changes
 * count up/down instead of snapping.
 */
export function useTicker(target: number): number {
  const [display, setDisplay] = useState(target);
  const raf = useRef<number | null>(null);
  const fromRef = useRef(target);

  useEffect(() => {
    const from = fromRef.current;
    if (from === target) return;
    const start = performance.now();
    const duration = 600;
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - t, 3);
      const value = from + (target - from) * eased;
      setDisplay(value);
      if (t < 1) {
        raf.current = requestAnimationFrame(tick);
      } else {
        fromRef.current = target;
      }
    };
    raf.current = requestAnimationFrame(tick);
    return () => {
      if (raf.current != null) cancelAnimationFrame(raf.current);
      fromRef.current = target;
    };
  }, [target]);

  return display;
}
