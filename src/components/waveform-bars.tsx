"use client";

import { useEffect, useRef } from "react";

interface Props {
  active: boolean;
}

export function WaveformBars({ active }: Props) {
  const barsRef = useRef<HTMLDivElement>(null);
  const rafRef = useRef<number>(0);

  useEffect(() => {
    if (!active || !barsRef.current) {
      // Reset bars
      if (barsRef.current) {
        const bars = barsRef.current.children;
        for (let i = 0; i < bars.length; i++) {
          (bars[i] as HTMLElement).style.height = "2px";
        }
      }
      return;
    }

    const el = barsRef.current;
    let t = 0;

    function animate() {
      t += 0.05;
      const bars = el.children;
      for (let i = 0; i < bars.length; i++) {
        const sin = Math.sin(t + i * 0.3) * 0.5 + 0.5;
        const noise = Math.random() * 0.3;
        const h = Math.max(2, (sin + noise) * 24);
        (bars[i] as HTMLElement).style.height = `${h}px`;
      }
      rafRef.current = requestAnimationFrame(animate);
    }

    rafRef.current = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(rafRef.current);
  }, [active]);

  return (
    <div ref={barsRef} className="flex items-end justify-center gap-[3px] h-8">
      {Array.from({ length: 32 }).map((_, i) => (
        <div
          key={i}
          className="w-[3px] rounded-full transition-all duration-100"
          style={{
            background: "var(--accent)",
            height: "2px",
            opacity: active ? 0.8 : 0.2,
          }}
        />
      ))}
    </div>
  );
}
