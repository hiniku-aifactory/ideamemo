"use client";

import { useEffect, useRef } from "react";

interface Props {
  analyser: AnalyserNode | null;
}

export function WaveformBars({ analyser }: Props) {
  const barsRef = useRef<HTMLDivElement>(null);
  const rafRef = useRef<number>(0);

  useEffect(() => {
    if (!barsRef.current) return;

    if (analyser) {
      // 実音声データ連動
      const data = new Uint8Array(analyser.frequencyBinCount);

      function draw() {
        analyser!.getByteFrequencyData(data);
        const bars = barsRef.current?.children;
        if (!bars) return;
        for (let i = 0; i < bars.length; i++) {
          const val = data[i] ?? 0;
          const h = Math.max(2, (val / 255) * 32);
          (bars[i] as HTMLElement).style.height = `${h}px`;
        }
        rafRef.current = requestAnimationFrame(draw);
      }
      rafRef.current = requestAnimationFrame(draw);
    } else {
      // モックモードフォールバック: sin + ランダム
      let t = 0;
      const el = barsRef.current;

      const barCount = el.children.length;
      const half = (barCount - 1) / 2;
      function animateMock() {
        t += 0.05;
        const bars = el.children;
        for (let i = 0; i < bars.length; i++) {
          const distFromCenter = Math.abs(i - half) / half;
          const centerBoost = 1 - distFromCenter * 0.7;
          const sin = Math.sin(t + i * 0.3) * 0.5 + 0.5;
          const noise = Math.random() * 0.2;
          const h = Math.max(2, (sin + noise) * 28 * centerBoost);
          (bars[i] as HTMLElement).style.height = `${h}px`;
        }
        rafRef.current = requestAnimationFrame(animateMock);
      }
      rafRef.current = requestAnimationFrame(animateMock);
    }

    return () => cancelAnimationFrame(rafRef.current);
  }, [analyser]);

  return (
    <div ref={barsRef} className="flex items-end justify-center gap-[3px] h-8">
      {Array.from({ length: 32 }).map((_, i) => (
        <div
          key={i}
          className="w-[3px] rounded-full transition-all duration-100"
          style={{
            background: "var(--accent)",
            height: "2px",
            opacity: analyser ? 0.8 : 0.2,
          }}
        />
      ))}
    </div>
  );
}
