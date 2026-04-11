"use client";

import type { Connection } from "@/lib/types";

interface CombinePanelProps {
  result: { connection: Connection; ideaA: { summary: string }; ideaB: { summary: string } };
  onDeepDive: (connectionId: string) => void;
  onClose: () => void;
}

export function CombinePanel({ result, onDeepDive, onClose }: CombinePanelProps) {
  return (
    <div className="absolute left-4 right-4 rounded-xl p-3.5 animate-page-enter"
      style={{
        bottom: "calc(80px + env(safe-area-inset-bottom, 0px))",
        background: "var(--bg-secondary)", border: "0.5px solid var(--border-light)",
        boxShadow: "0 -2px 8px rgba(0,0,0,0.04)",
      }}>
      <div className="flex items-center gap-2 text-[11px]" style={{ color: "var(--text-muted)" }}>
        <span style={{ color: "var(--text-primary)" }}>●</span>
        <span>{result.ideaA.summary.slice(0, 15)}</span>
        <span>×</span>
        <span style={{ color: "var(--text-primary)" }}>●</span>
        <span>{result.ideaB.summary.slice(0, 15)}</span>
      </div>
      <p className="text-[13px] mt-2" style={{ color: "var(--text-primary)", lineHeight: 1.8 }}>{result.connection.reason}</p>
      <div className="flex items-center gap-3 mt-2">
        <button onClick={(e) => { e.stopPropagation(); onDeepDive(result.connection.id); }}
          className="text-[11px]" style={{ color: "var(--accent)" }}>deep dive →</button>
        <button onClick={(e) => { e.stopPropagation(); onClose(); }}
          className="text-[11px]" style={{ color: "var(--text-muted)" }}>close</button>
      </div>
    </div>
  );
}
