"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import * as d3 from "d3";
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
  const svgRef = useRef<SVGSVGElement>(null);
  const [ideas, setIdeas] = useState<Idea[]>([]);
  const [connections, setConnections] = useState<Connection[]>([]);
  const [filter, setFilter] = useState<FilterRange>("all");

  // ミニパネル
  const [selectedNode, setSelectedNode] = useState<GraphNode | null>(null);
  const [expandedNodeId, setExpandedNodeId] = useState<string | null>(null);

  // 掛け合わせ
  const [combineNodeA, setCombineNodeA] = useState<GraphNode | null>(null);
  const [combineResult, setCombineResult] = useState<{
    connection: Connection;
    ideaA: { summary: string };
    ideaB: { summary: string };
  } | null>(null);
  const [combineLoading, setCombineLoading] = useState(false);

  // 長押しドラッグ
  const longPressTimerRef = useRef<NodeJS.Timeout | null>(null);
  const [dragMode, setDragMode] = useState(false);
  const [dragFrom, setDragFrom] = useState<GraphNode | null>(null);

  useEffect(() => {
    setIdeas(mockDb.ideas.list());
    setConnections(mockDb.connections.list());
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

  // ノードタップ
  const handleNodeClick = useCallback((d: GraphNode) => {
    if (d.isKnowledge) {
      setSelectedNode(d);
      return;
    }

    if (combineNodeA && combineNodeA.id !== d.id) {
      handleCombine(d);
      return;
    }

    if (selectedNode?.id === d.id) {
      // 同一ノード2回タップ → メモ詳細
      router.push(`/memo/${d.id}`);
      return;
    }

    setCombineNodeA(null);
    setCombineResult(null);
    setExpandedNodeId(null);
    setSelectedNode(d);
  }, [selectedNode, combineNodeA, router]);

  // 掛け合わせ
  const handleCombine = useCallback(async (nodeB: GraphNode) => {
    if (!combineNodeA || combineNodeA.id === nodeB.id) return;
    setCombineLoading(true);
    setSelectedNode(null);

    try {
      const res = await fetch("/api/combine", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ideaAId: combineNodeA.id, ideaBId: nodeB.id }),
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
  }, [combineNodeA]);

  // 外部知識展開
  const handleExpand = useCallback(() => {
    if (!selectedNode || selectedNode.isKnowledge) return;
    if (expandedNodeId === selectedNode.id) {
      setExpandedNodeId(null);
    } else {
      setExpandedNodeId(selectedNode.id);
    }
  }, [selectedNode, expandedNodeId]);

  // 掛け合わせ開始
  const startCombine = useCallback(() => {
    if (!selectedNode || selectedNode.isKnowledge) return;
    setCombineNodeA(selectedNode);
    setSelectedNode(null);
  }, [selectedNode]);

  // D3 グラフ描画
  useEffect(() => {
    if (!svgRef.current || filteredIdeas.length === 0) return;

    const svg = d3.select(svgRef.current);
    svg.selectAll("*").remove();

    const width = svgRef.current.clientWidth;
    const height = svgRef.current.clientHeight;
    const g = svg.append("g");

    const zoomBehavior = d3.zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.3, 3])
      .on("zoom", (event) => g.attr("transform", event.transform));
    svg.call(zoomBehavior);

    // ノードデータ
    const nodes: GraphNode[] = filteredIdeas.map((idea) => ({
      id: idea.id,
      summary: idea.summary,
      keywords: idea.keywords,
      created_at: idea.created_at,
      r: 18,
    }));

    // 展開された外部知識ノードを追加
    if (expandedNodeId) {
      const knowledgeConnections = connections.filter(
        (c) => c.idea_from_id === expandedNodeId && c.connection_type === "external_knowledge"
      );
      knowledgeConnections.forEach((c) => {
        nodes.push({
          id: `k-${c.id}`,
          summary: c.external_knowledge_title ?? "",
          keywords: [],
          created_at: c.created_at,
          r: 12,
          isKnowledge: true,
          knowledgeTitle: c.external_knowledge_title ?? "",
          knowledgeDescription: c.external_knowledge_summary ?? "",
          knowledgeUrl: c.external_knowledge_url,
          parentIdeaId: expandedNodeId,
        });
      });
    }

    // リンクデータ
    const nodeIds = new Set(nodes.map((n) => n.id));
    const links: GraphLink[] = filteredConnections
      .filter((c) => c.idea_to_id && nodeIds.has(c.idea_from_id) && nodeIds.has(c.idea_to_id!))
      .map((c) => ({
        id: c.id,
        source: c.idea_from_id,
        target: c.idea_to_id!,
        connection_type: c.connection_type,
        isDashed: c.connection_type === "combination",
      }));

    // 展開された外部知識リンク
    if (expandedNodeId) {
      const knowledgeConnections = connections.filter(
        (c) => c.idea_from_id === expandedNodeId && c.connection_type === "external_knowledge"
      );
      knowledgeConnections.forEach((c) => {
        const kNodeId = `k-${c.id}`;
        if (nodeIds.has(kNodeId)) {
          links.push({
            id: `kl-${c.id}`,
            source: expandedNodeId,
            target: kNodeId,
            connection_type: "knowledge_link",
            isDashed: true,
          });
        }
      });
    }

    // Force simulation
    const simulation = d3.forceSimulation(nodes)
      .force("charge", d3.forceManyBody().strength(-80))
      .force("center", d3.forceCenter(width / 2, height / 2))
      .force("collision", d3.forceCollide().radius((d) => (d as GraphNode).r + 8))
      .force("link", d3.forceLink<GraphNode, GraphLink>(links).id((d) => d.id).distance(80));

    // エッジ
    g.selectAll<SVGLineElement, GraphLink>("line")
      .data(links)
      .enter()
      .append("line")
      .attr("stroke", (d) => d.isDashed ? "#CCCCCC" : "#E0E0E0")
      .attr("stroke-width", 0.5)
      .attr("stroke-dasharray", (d) => d.isDashed ? "4 2" : "none");

    // ノードグループ
    const nodeGroup = g.selectAll<SVGGElement, GraphNode>(".node")
      .data(nodes)
      .enter()
      .append("g")
      .attr("class", "node")
      .attr("cursor", "pointer");

    // ノード円
    nodeGroup.append("circle")
      .attr("r", (d) => d.r)
      .attr("fill", "#FFFFFF")
      .attr("stroke", (d) => {
        if (d.isKnowledge) return "#CCCCCC";
        if (selectedNode?.id === d.id || combineNodeA?.id === d.id) return "#222222";
        return "#DDDDDD";
      })
      .attr("stroke-width", (d) => {
        if (selectedNode?.id === d.id || combineNodeA?.id === d.id) return 1.5;
        return 0.5;
      })
      .attr("stroke-dasharray", (d) => d.isKnowledge ? "3 2" : "none");

    // ノードラベル
    nodeGroup.append("text")
      .attr("text-anchor", "middle")
      .attr("dy", "0.35em")
      .attr("font-size", (d) => d.isKnowledge ? "7px" : "9px")
      .attr("fill", "#888888")
      .text((d) => {
        const label = d.isKnowledge ? (d.knowledgeTitle ?? "") : d.summary;
        return label.slice(0, 4);
      });

    // クリック
    nodeGroup.on("click", (_event, d) => handleNodeClick(d));

    // 非関連ノードのフェード
    if (selectedNode && !selectedNode.isKnowledge) {
      const connectedIds = new Set<string>();
      connectedIds.add(selectedNode.id);
      connections.forEach((c) => {
        if (c.idea_from_id === selectedNode.id && c.idea_to_id) connectedIds.add(c.idea_to_id);
        if (c.idea_to_id === selectedNode.id) connectedIds.add(c.idea_from_id);
      });
      // 外部知識ノードも関連扱い
      if (expandedNodeId === selectedNode.id) {
        nodes.forEach((n) => {
          if (n.parentIdeaId === selectedNode.id) connectedIds.add(n.id);
        });
      }
      nodeGroup.attr("opacity", (d) => connectedIds.has(d.id) ? 1 : 0.3);
    }

    // tick
    const linkElements = g.selectAll<SVGLineElement, GraphLink>("line");
    simulation.on("tick", () => {
      linkElements
        .attr("x1", (d) => (d.source as GraphNode).x ?? 0)
        .attr("y1", (d) => (d.source as GraphNode).y ?? 0)
        .attr("x2", (d) => (d.target as GraphNode).x ?? 0)
        .attr("y2", (d) => (d.target as GraphNode).y ?? 0);

      nodeGroup.attr("transform", (d) => `translate(${d.x ?? 0},${d.y ?? 0})`);
    });

    // 微動アニメーション
    let animId: number;
    function animate() {
      const t = Date.now() / 1000;
      nodeGroup.each(function (d, i) {
        const el = d3.select(this);
        const bx = d.x ?? 0;
        const by = d.y ?? 0;
        el.attr("transform", `translate(${bx + Math.sin(t * 0.8 + i) * 0.3},${by + Math.cos(t * 0.6 + i * 1.3) * 0.3})`);
      });
      animId = requestAnimationFrame(animate);
    }
    simulation.on("end", () => animate());

    return () => {
      simulation.stop();
      if (animId) cancelAnimationFrame(animId);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filteredIdeas, filteredConnections, expandedNodeId, selectedNode, combineNodeA]);

  // エンプティステート
  if (ideas.length === 0) {
    return (
      <main className="flex flex-col min-h-dvh animate-page-enter">
        <header
          className="flex items-center justify-between px-5 pb-3"
          style={{ paddingTop: "calc(12px + env(safe-area-inset-top))" }}
        >
          <span className="text-[11px]" style={{ color: "var(--text-muted)", fontFamily: "'JetBrains Mono', ui-monospace, monospace" }}>
            0 nodes
          </span>
        </header>
        <div className="flex-1 flex flex-col items-center justify-center" style={{ paddingBottom: "20vh" }}>
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
      </main>
    );
  }

  return (
    <main className="flex flex-col min-h-dvh animate-page-enter">
      {/* Header */}
      <header
        className="flex items-center justify-between px-5 pb-2"
        style={{ paddingTop: "calc(12px + env(safe-area-inset-top))" }}
      >
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
      </header>

      {/* 掛け合わせモードバナー */}
      {combineNodeA && (
        <div
          className="mx-5 mb-2 py-1.5 rounded text-center text-[11px]"
          style={{ background: "var(--bg-tertiary)", color: "var(--text-secondary)" }}
        >
          2つ目のノードをタップ
        </div>
      )}

      {/* SVG */}
      <div className="flex-1 relative" onClick={() => { if (!dragMode) { setSelectedNode(null); setCombineResult(null); } }}>
        <svg
          ref={svgRef}
          className="w-full h-full"
          style={{ touchAction: "none" }}
          onClick={(e) => e.stopPropagation()}
        />
      </div>

      {/* ミニパネル: ノード選択時 */}
      {selectedNode && !combineResult && (
        <div
          className="mx-5 mb-24 rounded-lg p-3 animate-page-enter"
          style={{ background: "var(--bg-secondary)", border: "0.5px solid var(--border-light)" }}
        >
          {selectedNode.isKnowledge ? (
            // 外部知識ノード詳細
            <div>
              <p className="text-[13px] font-medium" style={{ color: "var(--text-primary)" }}>
                {selectedNode.knowledgeTitle}
              </p>
              <p className="text-[13px] mt-1" style={{ color: "var(--text-body, var(--text-secondary))", lineHeight: 1.8 }}>
                {selectedNode.knowledgeDescription}
              </p>
              {selectedNode.knowledgeUrl && (
                <a
                  href={selectedNode.knowledgeUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[10px] mt-1 inline-block"
                  style={{ color: "var(--accent)" }}
                >
                  source ↗
                </a>
              )}
            </div>
          ) : (
            // メモノード詳細
            <div>
              <p className="text-[13px] truncate" style={{ color: "var(--text-primary)" }}>
                {selectedNode.summary}
              </p>
              <div className="flex flex-wrap gap-1 mt-1.5">
                {selectedNode.keywords.map((kw) => (
                  <span
                    key={kw}
                    className="text-[10px] px-1.5 py-0.5 rounded"
                    style={{ border: "0.5px solid var(--border)", color: "var(--text-muted)" }}
                  >
                    {kw}
                  </span>
                ))}
              </div>
              <div className="flex items-center gap-3 mt-2">
                <button
                  onClick={() => router.push(`/memo/${selectedNode.id}`)}
                  className="text-[11px]"
                  style={{ color: "var(--accent)" }}
                >
                  detail →
                </button>
                <button
                  onClick={handleExpand}
                  className="text-[11px]"
                  style={{ color: expandedNodeId === selectedNode.id ? "var(--text-primary)" : "var(--text-muted)" }}
                >
                  {expandedNodeId === selectedNode.id ? "− collapse" : "⊕ expand"}
                </button>
                <button
                  onClick={startCombine}
                  className="text-[11px]"
                  style={{ color: "var(--text-muted)" }}
                >
                  × combine
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* 掛け合わせローディング */}
      {combineLoading && (
        <div className="mx-5 mb-24 flex items-center justify-center gap-2 py-3">
          <div
            className="h-3 w-3 rounded-full border border-t-transparent animate-spin"
            style={{ borderColor: "var(--border)", borderTopColor: "transparent" }}
          />
          <span
            className="text-[11px]"
            style={{ color: "var(--text-muted)", fontFamily: "'JetBrains Mono', ui-monospace, monospace" }}
          >
            combining
          </span>
        </div>
      )}

      {/* 掛け合わせ結果ミニパネル */}
      {combineResult && (
        <div
          className="mx-5 mb-24 rounded-lg p-3 animate-page-enter"
          style={{ background: "var(--bg-secondary)", border: "0.5px solid var(--border-light)" }}
        >
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
              onClick={() => {
                setCombineResult(null);
                router.push(`/chat?connection=${combineResult.connection.id}`);
              }}
              className="text-[11px]"
              style={{ color: "var(--accent)" }}
            >
              deep dive →
            </button>
          </div>
        </div>
      )}
    </main>
  );
}
