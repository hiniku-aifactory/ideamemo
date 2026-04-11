"use client";

import type { GraphNode } from "@/lib/graph/types";

interface DetailPanelProps {
  node: GraphNode;
  connections: { id: string; targetSummary: string }[];
  onDetail: () => void;
  onDeepDive: (connectionId: string) => void;
  onDeepDiveSingle: () => void;
  onCombine: () => void;
}

export function DetailPanel({ node, connections, onDetail, onDeepDive, onDeepDiveSingle, onCombine }: DetailPanelProps) {
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
          <div className="flex items-center gap-4 mt-2">
            {node.knowledgeUrl && (
              <a href={node.knowledgeUrl} target="_blank" rel="noopener noreferrer"
                className="text-[11px]" style={{ color: "var(--accent)" }}>source ↗</a>
            )}
            <button onClick={(e) => { e.stopPropagation(); onDeepDive(node.id.slice(2)); }}
              className="text-[11px]" style={{ color: "var(--accent)" }}>深掘り →</button>
          </div>
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

          {/* 単体深掘り */}
          <div className="flex items-center justify-between mt-2.5">
            <span className="text-[11px]" style={{ color: "var(--text-muted)" }}>このメモを</span>
            <button onClick={(e) => { e.stopPropagation(); onDeepDiveSingle(); }}
              className="text-[11px]" style={{ color: "var(--accent)" }}>深掘り →</button>
          </div>

          {/* 接続別深掘り（各行に個別配置） */}
          {connections.length > 0 && (
            <div className="mt-1 space-y-1">
              {connections.map((conn) => (
                <div key={conn.id} className="flex items-center justify-between">
                  <span className="text-[11px] truncate mr-2" style={{ color: "var(--text-muted)" }}>
                    {conn.targetSummary.slice(0, 22)}{conn.targetSummary.length > 22 ? "…" : ""}
                  </span>
                  <button onClick={(e) => { e.stopPropagation(); onDeepDive(conn.id); }}
                    className="flex-shrink-0 text-[11px]" style={{ color: "var(--accent)" }}>深掘り →</button>
                </div>
              ))}
            </div>
          )}

          <div className="flex items-center gap-4 mt-2.5 pt-2"
            style={{ borderTop: "0.5px solid var(--border-light)" }}>
            <button onClick={(e) => { e.stopPropagation(); onDetail(); }}
              className="text-[11px]" style={{ color: "var(--accent)" }}>detail →</button>
            <button onClick={(e) => { e.stopPropagation(); onCombine(); }}
              className="text-[11px]" style={{ color: "var(--text-muted)" }}>combine</button>
          </div>
        </>
      )}
    </div>
  );
}
