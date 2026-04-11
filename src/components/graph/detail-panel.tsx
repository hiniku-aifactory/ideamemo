"use client";

import type { GraphNode } from "@/lib/graph/types";

interface DetailPanelProps {
  node: GraphNode;
  connectionId: string | null;
  onDetail: () => void;
  onDeepDive: (connectionId: string) => void;
  onCombine: () => void;
}

export function DetailPanel({ node, connectionId, onDetail, onDeepDive, onCombine }: DetailPanelProps) {
  return (
    <div className="absolute left-4 right-4 rounded-xl p-3.5 animate-page-enter"
      style={{
        bottom: "calc(80px + env(safe-area-inset-bottom, 0px))",
        background: "var(--bg-secondary)", border: "0.5px solid var(--border-light)",
        boxShadow: "0 -2px 8px rgba(0,0,0,0.04)",
      }}>
      {node.isKnowledge ? (
        <>
          <p className="text-[13px] font-medium" style={{ color: "var(--text-primary)" }}>{node.knowledgeTitle}</p>
          <p className="text-[11px] mt-1" style={{ color: "var(--text-muted)", lineHeight: 1.6 }}>{node.knowledgeDescription}</p>
          {node.knowledgeUrl && (
            <a href={node.knowledgeUrl} target="_blank" rel="noopener noreferrer"
              className="text-[11px] mt-2 inline-block" style={{ color: "var(--accent)" }}>source ↗</a>
          )}
        </>
      ) : (
        <>
          <p className="text-[13px] font-medium" style={{ color: "var(--text-primary)" }}>{node.graphLabel || node.summary}</p>
          {node.graphLabel && node.graphLabel !== node.summary && (
            <p className="text-[11px] mt-0.5" style={{ color: "var(--text-muted)" }}>
              {node.summary.slice(0, 30)}{node.summary.length > 30 ? "…" : ""}
            </p>
          )}
          {node.keywords.length > 0 && (
            <div className="flex flex-wrap gap-1 mt-1.5">
              {node.keywords.slice(0, 4).map((kw) => (
                <span key={kw} className="text-[10px] px-1.5 py-0.5 rounded"
                  style={{ border: "0.5px solid var(--border)", color: "var(--text-muted)" }}>{kw}</span>
              ))}
            </div>
          )}
          <div className="flex items-center gap-4 mt-2.5">
            <button onClick={(e) => { e.stopPropagation(); onDetail(); }}
              className="text-[11px]" style={{ color: "var(--accent)" }}>detail →</button>
            {connectionId && (
              <button onClick={(e) => { e.stopPropagation(); onDeepDive(connectionId); }}
                className="text-[11px]" style={{ color: "var(--text-muted)" }}>deep dive</button>
            )}
            <button onClick={(e) => { e.stopPropagation(); onCombine(); }}
              className="text-[11px]" style={{ color: "var(--text-muted)" }}>combine</button>
          </div>
        </>
      )}
    </div>
  );
}
