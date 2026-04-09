"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import * as d3 from "d3";
import { AppHeader } from "@/components/app-header";
import { mockDb } from "@/lib/mock/db";
import type { Idea, Connection } from "@/lib/types";

type FilterRange = "all" | "7d" | "30d";

interface GraphNode extends d3.SimulationNodeDatum {
  id: string;
  summary: string;
  keywords: string[];
  created_at: string;
  r: number;
  isKnowledge?: boolean;
  knowledgeTitle?: string;
  knowledgeDescription?: string;
  knowledgeUrl?: string | null;
  parentIdeaId?: string;
}

interface GraphLink extends d3.SimulationLinkDatum<GraphNode> {
  id: string;
  connection_type: string;
  isDashed?: boolean;
}

export default function GraphPage() {
  const router = useRouter();
  const containerRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const [ideas, setIdeas] = useState<Idea[]>([]);
  const [connections, setConnections] = useState<Connection[]>([]);
  const [filter, setFilter] = useState<FilterRange>("all");
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 });

  const [selectedNode, setSelectedNode] = useState<GraphNode | null>(null);
  const [expandedNodeId, setExpandedNodeId] = useState<string | null>(null);
  const [combineNodeA, setCombineNodeA] = useState<GraphNode | null>(null);
  const [combineResult, setCombineResult] = useState<{
    connection: Connection;
    ideaA: { summary: string };
    ideaB: { summary: string };
  } | null>(null);
  const [combineLoading, setCombineLoading] = useState(false);

  const selectedNodeRef = useRef<GraphNode | null>(null);
  const combineNodeARef = useRef<GraphNode | null>(null);
  selectedNodeRef.current = selectedNode;
  combineNodeARef.current = combineNodeA;

  useEffect(() => {
    setIdeas(mockDb.ideas.list());
    setConnections(mockDb.connections.list());
  }, []);

  // コンテナは常にDOMに存在するので、ResizeObserverは初回から確実に動作する
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const ro = new ResizeObserver((entries) => {
      const { width, height } = entries[0].contentRect;
      if (width > 0 && height > 0) {
        setDimensions({ width, height });
      }
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const filteredIdeas = ideas.filter((idea) => {
    if (filter === "all") return true;
    const days = filter === "7d" ? 7 : 30;
    const cutoff = Date.now() - days * 24 * 60 * 60 * 1000;
    return new Date(idea.created_at).getTime() > cutoff;
  });

  const filteredIdeaIds = new Set(filteredIdeas.map((i) => i.id));
  const filteredConnections = connections.filter(
    (c) => filteredIdeaIds.has(c.idea_from_id) && (!c.idea_to_id || filteredIdeaIds.has(c.idea_to_id))
  );
  const linkCount = filteredConnections.filter((c) => c.idea_to_id).length;

  const handleNodeClick = useCallback((d: GraphNode) => {
    if (d.isKnowledge) { setSelectedNode(d); return; }
    const currentCombineA = combineNodeARef.current;
    if (currentCombineA && currentCombineA.id !== d.id) { handleCombine(d); return; }
    const currentSelected = selectedNodeRef.current;
    if (currentSelected?.id === d.id) { router.push(`/memo/${d.id}`); return; }
    setCombineNodeA(null);
    setCombineResult(null);
    setExpandedNodeId(null);
    setSelectedNode(d);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router]);

  const handleCombine = useCallback(async (nodeB: GraphNode) => {
    const currentCombineA = combineNodeARef.current;
    if (!currentCombineA || currentCombineA.id === nodeB.id) return;
    setCombineLoading(true);
    setSelectedNode(null);
    try {
      const res = await fetch("/api/combine", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ideaAId: currentCombineA.id, ideaBId: nodeB.id }),
      });
      const data = await res.json();
      setCombineResult(data);
      setConnections(mockDb.connections.list());
    } catch (err) {
      console.error("Combine error:", err);
    } finally {
      setCombineLoading(false);
      setCombineNodeA(null);
    }
  }, []);

  const handleExpand = useCallback(() => {
    if (!selectedNode || selectedNode.isKnowledge) return;
    setExpandedNodeId(expandedNodeId === selectedNode.id ? null : selectedNode.id);
  }, [selectedNode, expandedNodeId]);

  const startCombine = useCallback(() => {
    if (!selectedNode || selectedNode.isKnowledge) return;
    setCombineNodeA(selectedNode);
    setSelectedNode(null);
  }, [selectedNode]);

  // D3描画: dimensions > 0 かつ ideas > 0 になった時点で実行
  useEffect(() => {
    const { width, height } = dimensions;
    if (!svgRef.current || width === 0 || height === 0 || filteredIdeas.length === 0) return;

    const svg = d3.select(svgRef.current);
    svg.selectAll("*").remove();
    svg.attr("width", width).attr("height", height);

    const g = svg.append("g");
    svg.call(
      d3.zoom<SVGSVGElement, unknown>()
        .scaleExtent([0.3, 3])
        .on("zoom", (event) => g.attr("transform", event.transform))
    );

    const baseR = Math.max(22, Math.min(width, height) * 0.04);

    const nodes: GraphNode[] = filteredIdeas.map((idea) => ({
      id: idea.id, summary: idea.summary, keywords: idea.keywords,
      created_at: idea.created_at, r: baseR,
    }));

    if (expandedNodeId) {
      connections
        .filter((c) => c.idea_from_id === expandedNodeId && c.connection_type === "external_knowledge")
        .forEach((c) => nodes.push({
          id: `k-${c.id}`, summary: c.external_knowledge_title ?? "",
          keywords: [], created_at: c.created_at, r: baseR * 0.6,
          isKnowledge: true,
          knowledgeTitle: c.external_knowledge_title ?? "",
          knowledgeDescription: c.external_knowledge_summary ?? "",
          knowledgeUrl: c.external_knowledge_url,
          parentIdeaId: expandedNodeId,
        }));
    }

    const nodeIds = new Set(nodes.map((n) => n.id));
    const links: GraphLink[] = filteredConnections
      .filter((c) => c.idea_to_id && nodeIds.has(c.idea_from_id) && nodeIds.has(c.idea_to_id!))
      .map((c) => ({
        id: c.id, source: c.idea_from_id, target: c.idea_to_id!,
        connection_type: c.connection_type, isDashed: c.connection_type === "combination",
      }));

    if (expandedNodeId) {
      connections
        .filter((c) => c.idea_from_id === expandedNodeId && c.connection_type === "external_knowledge")
        .forEach((c) => {
          const kId = `k-${c.id}`;
          if (nodeIds.has(kId)) links.push({
            id: `kl-${c.id}`, source: expandedNodeId, target: kId,
            connection_type: "knowledge_link", isDashed: true,
          });
        });
    }

    const simulation = d3.forceSimulation(nodes)
      .force("charge", d3.forceManyBody().strength(-200))
      .force("center", d3.forceCenter(width / 2, height / 2))
      .force("collision", d3.forceCollide().radius((d) => (d as GraphNode).r + 12))
      .force("link", d3.forceLink<GraphNode, GraphLink>(links).id((d) => d.id).distance(baseR * 5))
      .force("x", d3.forceX(width / 2).strength(0.05))
      .force("y", d3.forceY(height / 2).strength(0.05));

    const linkEls = g.selectAll<SVGLineElement, GraphLink>("line")
      .data(links).enter().append("line")
      .attr("stroke", (d) => d.isDashed ? "#CCCCCC" : "#E0E0E0")
      .attr("stroke-width", 0.5)
      .attr("stroke-dasharray", (d) => d.isDashed ? "4 2" : "none");

    const nodeGroup = g.selectAll<SVGGElement, GraphNode>(".node")
      .data(nodes).enter().append("g")
      .attr("class", "node").attr("cursor", "pointer");

    nodeGroup.append("circle")
      .attr("r", (d) => d.r)
      .attr("fill", "#FFFFFF")
      .attr("stroke", (d) => d.isKnowledge ? "#BBBBBB" : "#CCCCCC")
      .attr("stroke-width", 1)
      .attr("stroke-dasharray", (d) => d.isKnowledge ? "3 2" : "none");

    nodeGroup.append("text")
      .attr("text-anchor", "middle").attr("dy", "0.35em")
      .attr("font-size", (d) => d.isKnowledge ? "8px" : "10px")
      .attr("fill", "#888888").attr("pointer-events", "none")
      .text((d) => {
        const label = d.isKnowledge ? (d.knowledgeTitle ?? "") : d.summary;
        return label.length > 6 ? label.slice(0, 5) + "…" : label;
      });

    nodeGroup.on("click", (_event, d) => {
      _event.stopPropagation();
      handleNodeClick(d);
    });

    simulation.on("tick", () => {
      linkEls
        .attr("x1", (d) => (d.source as GraphNode).x ?? 0)
        .attr("y1", (d) => (d.source as GraphNode).y ?? 0)
        .attr("x2", (d) => (d.target as GraphNode).x ?? 0)
        .attr("y2", (d) => (d.target as GraphNode).y ?? 0);
      nodeGroup.attr("transform", (d) => `translate(${d.x ?? 0},${d.y ?? 0})`);
    });

    let animId: number;
    simulation.on("end", () => {
      function animate() {
        const t = Date.now() / 1000;
        nodeGroup.each(function (d, i) {
          const bx = d.x ?? 0;
          const by = d.y ?? 0;
          d3.select(this).attr("transform",
            `translate(${bx + Math.sin(t * 0.8 + i) * 0.3},${by + Math.cos(t * 0.6 + i * 1.3) * 0.3})`
          );
        });
        animId = requestAnimationFrame(animate);
      }
      animate();
    });

    return () => {
      simulation.stop();
      if (animId) cancelAnimationFrame(animId);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filteredIdeas, filteredConnections, expandedNodeId, dimensions]);

  const handleBackgroundClick = useCallback(() => {
    setSelectedNode(null);
    setCombineResult(null);
    setCombineNodeA(null);
  }, []);

  // 早期returnを廃止。コンテナdivは常にDOMに存在させることでResizeObserverが確実に動作する
  return (
    <main className="flex flex-col h-dvh overflow-hidden animate-page-enter">
      <AppHeader />

      {/* フィルタバー（ideasがある時のみ表示） */}
      {ideas.length > 0 && (
        <div className="flex-none flex items-center justify-between px-5 pb-2">
          <div className="flex gap-3">
            {(["all", "7d", "30d"] as FilterRange[]).map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className="text-[11px]"
                style={{
                  color: filter === f ? "var(--text-primary)" : "var(--text-muted)",
                  fontFamily: "'JetBrains Mono', ui-monospace, monospace",
                }}
              >
                {f}
              </button>
            ))}
          </div>
          <span
            className="text-[11px]"
            style={{ color: "var(--text-muted)", fontFamily: "'JetBrains Mono', ui-monospace, monospace" }}
          >
            {filteredIdeas.length} nodes · {linkCount} links
          </span>
        </div>
      )}

      {/* 掛け合わせモードバナー */}
      {combineNodeA && (
        <div
          className="mx-5 mb-2 py-1.5 rounded text-center text-[11px]"
          style={{ background: "var(--bg-tertiary)", color: "var(--text-secondary)" }}
        >
          2つ目のノードをタップ
        </div>
      )}

      {/* SVGコンテナ: 常にレンダリング。ResizeObserverが初回から確実に起動する */}
      <div
        ref={containerRef}
        className="flex-1 min-h-0 relative"
        onClick={handleBackgroundClick}
      >
        {/* エンプティステートはSVGコンテナの中に表示 */}
        {ideas.length === 0 && (
          <div className="absolute inset-0 flex flex-col items-center justify-center" style={{ paddingBottom: "20vh" }}>
            <svg width="80" height="80" viewBox="0 0 80 80" fill="none">
              <circle cx="40" cy="40" r="38" stroke="#E0E0E0" strokeWidth="0.5" />
              <circle cx="40" cy="40" r="24" stroke="#E0E0E0" strokeWidth="0.5" />
              <circle cx="40" cy="40" r="10" stroke="#E0E0E0" strokeWidth="0.5" />
            </svg>
            <span
              className="mt-4 text-xs"
              style={{ color: "var(--text-muted)", fontFamily: "'JetBrains Mono', ui-monospace, monospace" }}
            >
              0 nodes
            </span>
          </div>
        )}
        <svg
          ref={svgRef}
          className="absolute inset-0"
          style={{ touchAction: "none" }}
        />
      </div>

      {/* ミニパネル: ノード選択時 */}
      {selectedNode && !combineResult && (
        <div
          className="absolute left-5 right-5 rounded-lg p-3 animate-page-enter"
          style={{
            bottom: "calc(80px + env(safe-area-inset-bottom, 0px))",
            background: "var(--bg-secondary)",
            border: "0.5px solid var(--border-light)",
            boxShadow: "0 -2px 8px rgba(0,0,0,0.04)",
          }}
        >
          {selectedNode.isKnowledge ? (
            <div>
              <p className="text-[13px] font-medium" style={{ color: "var(--text-primary)" }}>
                {selectedNode.knowledgeTitle}
              </p>
              <p className="text-[13px] mt-1" style={{ color: "var(--text-body, var(--text-secondary))", lineHeight: 1.8 }}>
                {selectedNode.knowledgeDescription}
              </p>
              {selectedNode.knowledgeUrl && (
                <a href={selectedNode.knowledgeUrl} target="_blank" rel="noopener noreferrer"
                  className="text-[10px] mt-1 inline-block" style={{ color: "var(--accent)" }}>
                  source ↗
                </a>
              )}
            </div>
          ) : (
            <div>
              <p className="text-[13px] truncate" style={{ color: "var(--text-primary)" }}>
                {selectedNode.summary}
              </p>
              <div className="flex flex-wrap gap-1 mt-1.5">
                {selectedNode.keywords.map((kw) => (
                  <span key={kw} className="text-[10px] px-1.5 py-0.5 rounded"
                    style={{ border: "0.5px solid var(--border)", color: "var(--text-muted)" }}>
                    {kw}
                  </span>
                ))}
              </div>
              <div className="flex items-center gap-3 mt-2">
                <button onClick={(e) => { e.stopPropagation(); router.push(`/memo/${selectedNode.id}`); }}
                  className="text-[11px]" style={{ color: "var(--accent)" }}>
                  detail →
                </button>
                <button onClick={(e) => { e.stopPropagation(); handleExpand(); }}
                  className="text-[11px]"
                  style={{ color: expandedNodeId === selectedNode.id ? "var(--text-primary)" : "var(--text-muted)" }}>
                  {expandedNodeId === selectedNode.id ? "− collapse" : "⊕ expand"}
                </button>
                <button onClick={(e) => { e.stopPropagation(); startCombine(); }}
                  className="text-[11px]" style={{ color: "var(--text-muted)" }}>
                  × combine
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {combineLoading && (
        <div className="absolute left-5 right-5 flex items-center justify-center gap-2 py-3"
          style={{ bottom: "calc(80px + env(safe-area-inset-bottom, 0px))" }}>
          <div className="h-3 w-3 rounded-full border border-t-transparent animate-spin"
            style={{ borderColor: "var(--border)", borderTopColor: "transparent" }} />
          <span className="text-[11px]"
            style={{ color: "var(--text-muted)", fontFamily: "'JetBrains Mono', ui-monospace, monospace" }}>
            combining
          </span>
        </div>
      )}

      {combineResult && (
        <div className="absolute left-5 right-5 rounded-lg p-3 animate-page-enter"
          style={{
            bottom: "calc(80px + env(safe-area-inset-bottom, 0px))",
            background: "var(--bg-secondary)",
            border: "0.5px solid var(--border-light)",
            boxShadow: "0 -2px 8px rgba(0,0,0,0.04)",
          }}>
          <div className="flex items-center gap-2 text-[11px]" style={{ color: "var(--text-muted)" }}>
            <span style={{ color: "var(--text-primary)" }}>●</span>
            <span>{combineResult.ideaA.summary.slice(0, 15)}</span>
            <span>×</span>
            <span style={{ color: "var(--text-primary)" }}>●</span>
            <span>{combineResult.ideaB.summary.slice(0, 15)}</span>
          </div>
          <p className="text-[13px] mt-2" style={{ color: "var(--text-primary)", lineHeight: 1.8 }}>
            {combineResult.connection.reason}
          </p>
          <div className="flex items-center gap-3 mt-2">
            <button
              onClick={(e) => {
                e.stopPropagation();
                const connId = combineResult.connection.id;
                setCombineResult(null);
                router.push(`/chat?connection=${connId}`);
              }}
              className="text-[11px]" style={{ color: "var(--accent)" }}>
              deep dive →
            </button>
          </div>
        </div>
      )}
    </main>
  );
}
