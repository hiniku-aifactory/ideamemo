"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import * as d3 from "d3";
import { AppHeader } from "@/components/app-header";
import { mockDb } from "@/lib/mock/db";
import type { Idea, Connection, ConnectionType } from "@/lib/types";

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
  connectionType?: ConnectionType;
}

interface GraphLink extends d3.SimulationLinkDatum<GraphNode> {
  id: string;
  connection_type: ConnectionType | "knowledge_link";
}

type GraphPositions = Record<string, { x: number; y: number }>;

const POSITIONS_KEY = "ideamemo-graph-positions";
const BASE_R = 30;

function loadPositions(): GraphPositions {
  try {
    return JSON.parse(localStorage.getItem(POSITIONS_KEY) || "{}");
  } catch {
    return {};
  }
}

function savePositions(positions: GraphPositions) {
  try {
    localStorage.setItem(POSITIONS_KEY, JSON.stringify(positions));
  } catch {
    // ignore storage errors
  }
}

function getLinkStyle(type: ConnectionType | "knowledge_link"): {
  stroke: string;
  strokeWidth: number;
  strokeDasharray: string;
} {
  switch (type) {
    case "external_knowledge":
      return { stroke: "#CCCCCC", strokeWidth: 0.5, strokeDasharray: "4 2" };
    case "combination":
      return { stroke: "#999999", strokeWidth: 1.5, strokeDasharray: "none" };
    case "manual":
      return { stroke: "#CCCCCC", strokeWidth: 0.5, strokeDasharray: "none" };
    case "chat_derived":
      return { stroke: "#CCCCCC", strokeWidth: 0.5, strokeDasharray: "2 2" };
    default:
      return { stroke: "#E0E0E0", strokeWidth: 0.5, strokeDasharray: "4 2" };
  }
}

export default function GraphPage() {
  const router = useRouter();
  const containerRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const [ideas, setIdeas] = useState<Idea[]>([]);
  const [connections, setConnections] = useState<Connection[]>([]);
  const [filter, setFilter] = useState<FilterRange>("all");
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 });

  // 選択・展開状態
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

  // 紐付けモード（§6）
  const [linkMode, setLinkMode] = useState(false);
  const [linkNodeA, setLinkNodeA] = useState<GraphNode | null>(null);

  const selectedNodeRef = useRef<GraphNode | null>(null);
  const combineNodeARef = useRef<GraphNode | null>(null);
  const linkModeRef = useRef(false);
  const linkNodeARef = useRef<GraphNode | null>(null);
  selectedNodeRef.current = selectedNode;
  combineNodeARef.current = combineNodeA;
  linkModeRef.current = linkMode;
  linkNodeARef.current = linkNodeA;

  // D3オブジェクトをrefで保持（rerender跨ぎ）
  const zoomRef = useRef<d3.ZoomBehavior<SVGSVGElement, unknown> | null>(null);
  const nodesDataRef = useRef<GraphNode[]>([]);
  const linkElsRef = useRef<d3.Selection<SVGLineElement, GraphLink, SVGGElement, unknown> | null>(null);
  const nodeGroupRef = useRef<d3.Selection<SVGGElement, GraphNode, SVGGElement, unknown> | null>(null);

  useEffect(() => {
    setIdeas(mockDb.ideas.list());
    setConnections(mockDb.connections.list());
  }, []);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const ro = new ResizeObserver((entries) => {
      const { width, height } = entries[0].contentRect;
      if (width > 0 && height > 0) setDimensions({ width, height });
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
    (c) =>
      filteredIdeaIds.has(c.idea_from_id) &&
      (!c.idea_to_id || filteredIdeaIds.has(c.idea_to_id))
  );
  const linkCount = filteredConnections.filter((c) => c.idea_to_id).length;

  const handleNodeClick = useCallback(
    (d: GraphNode) => {
      if (linkModeRef.current) {
        const nodeA = linkNodeARef.current;
        if (!nodeA || d.isKnowledge) return;
        if (nodeA.id === d.id) return;
        // 紐付け実行
        const newConn: Connection = {
          id: `conn-manual-${Date.now()}`,
          idea_from_id: nodeA.id,
          idea_to_id: d.id,
          connection_type: "manual",
          source: "manual",
          persona_label: null,
          reason: "",
          action_suggestion: "",
          quality_score: null,
          external_knowledge_title: null,
          external_knowledge_url: null,
          external_knowledge_summary: null,
          source_idea_summary: null,
          user_note: null,
          feedback: null,
          feedback_at: null,
          bookmarked: false,
          created_at: new Date().toISOString(),
        };
        mockDb.connections.insert(newConn);
        setConnections(mockDb.connections.list());
        setLinkMode(false);
        setLinkNodeA(null);
        setSelectedNode(null);
        return;
      }

      if (d.isKnowledge) {
        setSelectedNode(d);
        return;
      }

      const currentCombineA = combineNodeARef.current;
      if (currentCombineA && currentCombineA.id !== d.id) {
        handleCombine(d);
        return;
      }

      const currentSelected = selectedNodeRef.current;
      if (currentSelected?.id === d.id) {
        router.push(`/memo/${d.id}`);
        return;
      }

      // 別ノード選択 → ズームイン → 外部知識展開
      setCombineNodeA(null);
      setCombineResult(null);
      setSelectedNode(d);

      if (!svgRef.current || !zoomRef.current) return;
      const { width, height } = dimensions;
      const svg = d3.select(svgRef.current);
      const zoom = zoomRef.current;
      const tx = d3.zoomIdentity
        .translate(width / 2 - d.x! * 1.8, height / 2 - d.y! * 1.8)
        .scale(1.8);

      svg
        .transition()
        .duration(600)
        .ease(d3.easeCubicOut)
        .call(zoom.transform, tx)
        .on("end", () => {
          setExpandedNodeId(d.id);
        });
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [router, dimensions]
  );

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

  const startCombine = useCallback(() => {
    if (!selectedNode || selectedNode.isKnowledge) return;
    setCombineNodeA(selectedNode);
    setSelectedNode(null);
  }, [selectedNode]);

  const startLink = useCallback(() => {
    if (!selectedNode || selectedNode.isKnowledge) return;
    setLinkNodeA(selectedNode);
    setLinkMode(true);
    setSelectedNode(null);
  }, [selectedNode]);

  const cancelLinkMode = useCallback(() => {
    setLinkMode(false);
    setLinkNodeA(null);
  }, []);

  const handleBackgroundClick = useCallback(() => {
    if (linkModeRef.current) {
      cancelLinkMode();
      return;
    }
    setSelectedNode(null);
    setCombineResult(null);
    setCombineNodeA(null);
    setExpandedNodeId(null);
  }, [cancelLinkMode]);

  // D3描画
  useEffect(() => {
    const { width, height } = dimensions;
    if (!svgRef.current || width === 0 || height === 0 || filteredIdeas.length === 0) return;

    const svg = d3.select(svgRef.current);
    svg.selectAll("*").remove();
    svg.attr("width", width).attr("height", height);

    const g = svg.append("g");

    const zoom = d3
      .zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.3, 3])
      .on("zoom", (event) => {
        g.attr("transform", event.transform);
        // ピンチアウトで展開を閉じる
        if (event.transform.k < 0.9 && expandedNodeId) {
          setExpandedNodeId(null);
          setSelectedNode(null);
        }
      });

    svg.call(zoom);
    zoomRef.current = zoom;

    // 接続数カウント
    const connCountMap = new Map<string, number>();
    filteredConnections.forEach((c) => {
      connCountMap.set(c.idea_from_id, (connCountMap.get(c.idea_from_id) || 0) + 1);
      if (c.idea_to_id) {
        connCountMap.set(c.idea_to_id, (connCountMap.get(c.idea_to_id) || 0) + 1);
      }
    });

    // 保存済み位置を読み込み
    const savedPositions = loadPositions();

    const nodes: GraphNode[] = filteredIdeas.map((idea) => {
      const connCount = connCountMap.get(idea.id) || 0;
      const r = Math.min(BASE_R * 1.5, BASE_R + connCount * 3);
      return {
        id: idea.id,
        summary: idea.summary,
        keywords: idea.keywords,
        created_at: idea.created_at,
        r,
      };
    });

    // 展開中の外部知識ノードを追加
    if (expandedNodeId) {
      const parentNode = nodes.find((n) => n.id === expandedNodeId);
      if (parentNode) {
        const knowledgeConns = connections.filter(
          (c) =>
            c.idea_from_id === expandedNodeId &&
            c.connection_type === "external_knowledge"
        );
        knowledgeConns.slice(0, 6).forEach((c, i) => {
          const total = Math.min(knowledgeConns.length, 6);
          const angleDeg = -90 + (360 / total) * i;
          const rad = (angleDeg * Math.PI) / 180;
          const kR = BASE_R * 0.5;
          const dist = BASE_R * 4;
          nodes.push({
            id: `k-${c.id}`,
            summary: c.external_knowledge_title ?? "",
            keywords: [],
            created_at: c.created_at,
            r: kR,
            isKnowledge: true,
            knowledgeTitle: c.external_knowledge_title ?? "",
            knowledgeDescription: c.external_knowledge_summary ?? "",
            knowledgeUrl: c.external_knowledge_url,
            parentIdeaId: expandedNodeId,
            x: (parentNode.x ?? width / 2) + dist * Math.cos(rad),
            y: (parentNode.y ?? height / 2) + dist * Math.sin(rad),
            fx: (parentNode.x ?? width / 2) + dist * Math.cos(rad),
            fy: (parentNode.y ?? height / 2) + dist * Math.sin(rad),
          });
        });
      }
    }

    // 保存済み位置を適用。未保存のノードのみsimulationで配置
    nodes.forEach((n) => {
      if (n.isKnowledge) return;
      const pos = savedPositions[n.id];
      if (pos) {
        n.fx = pos.x;
        n.fy = pos.y;
        n.x = pos.x;
        n.y = pos.y;
      }
    });

    const nodeIds = new Set(nodes.map((n) => n.id));
    const links: GraphLink[] = [];

    filteredConnections
      .filter((c) => c.idea_to_id && nodeIds.has(c.idea_from_id) && nodeIds.has(c.idea_to_id!))
      .forEach((c) => {
        links.push({
          id: c.id,
          source: c.idea_from_id,
          target: c.idea_to_id!,
          connection_type: c.connection_type,
        });
      });

    if (expandedNodeId) {
      connections
        .filter(
          (c) =>
            c.idea_from_id === expandedNodeId &&
            c.connection_type === "external_knowledge"
        )
        .slice(0, 6)
        .forEach((c) => {
          const kId = `k-${c.id}`;
          if (nodeIds.has(kId)) {
            links.push({
              id: `kl-${c.id}`,
              source: expandedNodeId,
              target: kId,
              connection_type: "external_knowledge",
            });
          }
        });
    }

    const simulation = d3
      .forceSimulation(nodes)
      .force("charge", d3.forceManyBody().strength(-200))
      .force("center", d3.forceCenter(width / 2, height / 2))
      .force("collision", d3.forceCollide().radius((d) => (d as GraphNode).r + 12))
      .force(
        "link",
        d3
          .forceLink<GraphNode, GraphLink>(links)
          .id((d) => d.id)
          .distance(BASE_R * 5)
      )
      .force("x", d3.forceX(width / 2).strength(0.05))
      .force("y", d3.forceY(height / 2).strength(0.05));

    const linkEls = g
      .selectAll<SVGLineElement, GraphLink>("line")
      .data(links)
      .enter()
      .append("line")
      .each(function (d) {
        const style = getLinkStyle(d.connection_type);
        d3.select(this)
          .attr("stroke", style.stroke)
          .attr("stroke-width", style.strokeWidth)
          .attr("stroke-dasharray", style.strokeDasharray);
      });

    linkElsRef.current = linkEls;

    const nodeGroup = g
      .selectAll<SVGGElement, GraphNode>(".node")
      .data(nodes)
      .enter()
      .append("g")
      .attr("class", "node")
      .attr("cursor", "pointer")
      .attr("opacity", (d) => (d.isKnowledge ? 0 : 1));

    nodeGroup
      .append("circle")
      .attr("r", (d) => d.r)
      .attr("fill", "#FFFFFF")
      .attr("stroke", (d) => (d.isKnowledge ? "#BBBBBB" : "#CCCCCC"))
      .attr("stroke-width", 1)
      .attr("stroke-dasharray", (d) => (d.isKnowledge ? "3 2" : "none"));

    nodeGroup
      .append("text")
      .attr("text-anchor", "middle")
      .attr("dy", "0.35em")
      .attr("font-size", (d) => (d.isKnowledge ? "8px" : "10px"))
      .attr("fill", (d) => (d.isKnowledge ? "#BBBBBB" : "#888888"))
      .attr("pointer-events", "none")
      .text((d) => {
        if (d.isKnowledge) {
          const t = d.knowledgeTitle ?? "";
          return t.length > 5 ? t.slice(0, 5) + "…" : t;
        }
        return d.summary.length > 7 ? d.summary.slice(0, 7) + "…" : d.summary;
      });

    // 展開ノードをフェードイン
    if (expandedNodeId) {
      nodeGroup
        .filter((d) => d.isKnowledge === true)
        .transition()
        .duration(300)
        .ease(d3.easeQuadOut)
        .attr("opacity", 1);
    }

    nodeGroupRef.current = nodeGroup;
    nodesDataRef.current = nodes;

    // ドラッグ
    let dragStartPos = { x: 0, y: 0 };

    const drag = d3
      .drag<SVGGElement, GraphNode>()
      .on("start", (event) => {
        dragStartPos = { x: event.x, y: event.y };
      })
      .on("drag", (event, d) => {
        if (d.isKnowledge) return;
        d.fx = event.x;
        d.fy = event.y;
        d.x = event.x;
        d.y = event.y;
        d3.select<SVGGElement, GraphNode>(event.sourceEvent.target.parentNode as SVGGElement).attr(
          "transform",
          `translate(${event.x},${event.y})`
        );
        linkEls
          .filter(
            (l) =>
              (l.source as GraphNode).id === d.id ||
              (l.target as GraphNode).id === d.id
          )
          .attr("x1", (l) => (l.source as GraphNode).x ?? 0)
          .attr("y1", (l) => (l.source as GraphNode).y ?? 0)
          .attr("x2", (l) => (l.target as GraphNode).x ?? 0)
          .attr("y2", (l) => (l.target as GraphNode).y ?? 0);
      })
      .on("end", (event, d) => {
        if (d.isKnowledge) return;
        const dist = Math.hypot(event.x - dragStartPos.x, event.y - dragStartPos.y);
        if (dist <= 5) {
          handleNodeClick(d);
        } else {
          const saved = loadPositions();
          saved[d.id] = { x: d.fx ?? event.x, y: d.fy ?? event.y };
          savePositions(saved);
        }
      });

    nodeGroup.call(drag);

    // tick
    simulation.on("tick", () => {
      linkEls
        .attr("x1", (d) => (d.source as GraphNode).x ?? 0)
        .attr("y1", (d) => (d.source as GraphNode).y ?? 0)
        .attr("x2", (d) => (d.target as GraphNode).x ?? 0)
        .attr("y2", (d) => (d.target as GraphNode).y ?? 0);
      nodeGroup.attr("transform", (d) => `translate(${d.x ?? 0},${d.y ?? 0})`);
    });

    // simulation終了 → 位置保存（微動なし）
    simulation.on("end", () => {
      const positions: GraphPositions = {};
      nodes.forEach((n) => {
        if (!n.isKnowledge && n.x != null && n.y != null) {
          positions[n.id] = { x: n.x, y: n.y };
        }
      });
      savePositions(positions);
    });

    return () => {
      simulation.stop();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filteredIdeas, filteredConnections, expandedNodeId, dimensions]);

  return (
    <main className="flex flex-col h-dvh overflow-hidden animate-page-enter">
      <AppHeader />

      {/* フィルタバー */}
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
            style={{
              color: "var(--text-muted)",
              fontFamily: "'JetBrains Mono', ui-monospace, monospace",
            }}
          >
            {filteredIdeas.length} nodes · {linkCount} links
          </span>
        </div>
      )}

      {/* 掛け合わせバナー */}
      {combineNodeA && (
        <div
          className="mx-5 mb-2 py-1.5 rounded text-center text-[11px]"
          style={{ background: "var(--bg-tertiary)", color: "var(--text-secondary)" }}
        >
          2つ目のノードをタップ
        </div>
      )}

      {/* 紐付けモードバナー（§6） */}
      {linkMode && (
        <button
          className="mx-5 mb-2 py-1.5 rounded text-center text-[11px] w-auto"
          style={{ background: "var(--bg-tertiary)", color: "var(--text-secondary)" }}
          onClick={cancelLinkMode}
        >
          接続先のノードをタップ（タップでキャンセル）
        </button>
      )}

      {/* SVGコンテナ */}
      <div
        ref={containerRef}
        className="flex-1 min-h-0 relative"
        onClick={handleBackgroundClick}
      >
        {ideas.length === 0 && (
          <div
            className="absolute inset-0 flex flex-col items-center justify-center"
            style={{ paddingBottom: "20vh" }}
          >
            <svg width="80" height="80" viewBox="0 0 80 80" fill="none">
              <circle cx="40" cy="40" r="38" stroke="#E0E0E0" strokeWidth="0.5" />
              <circle cx="40" cy="40" r="24" stroke="#E0E0E0" strokeWidth="0.5" />
              <circle cx="40" cy="40" r="10" stroke="#E0E0E0" strokeWidth="0.5" />
            </svg>
            <span
              className="mt-4 text-xs"
              style={{
                color: "var(--text-muted)",
                fontFamily: "'JetBrains Mono', ui-monospace, monospace",
              }}
            >
              0 nodes
            </span>
          </div>
        )}
        <svg ref={svgRef} className="absolute inset-0" style={{ touchAction: "none" }} />
      </div>

      {/* ミニパネル */}
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
              <p
                className="text-[13px] font-medium"
                style={{ color: "var(--text-primary)" }}
              >
                {selectedNode.knowledgeTitle}
              </p>
              <p
                className="text-[12px] mt-1"
                style={{ color: "var(--text-secondary)", lineHeight: 1.8 }}
              >
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
            <div>
              <p
                className="text-[13px] truncate"
                style={{ color: "var(--text-primary)" }}
              >
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
              <div className="flex items-center gap-4 mt-2">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    router.push(`/memo/${selectedNode.id}`);
                  }}
                  className="text-[11px]"
                  style={{ color: "var(--accent)" }}
                >
                  detail →
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    startLink();
                  }}
                  className="text-[11px]"
                  style={{ color: "var(--text-muted)" }}
                >
                  link
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    startCombine();
                  }}
                  className="text-[11px]"
                  style={{ color: "var(--text-muted)" }}
                >
                  combine
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* 紐付けノードA選択中リング表示（視覚的ヒント） */}
      {linkMode && linkNodeA && (
        <div
          className="absolute left-5 right-5 rounded-lg p-2"
          style={{
            bottom: "calc(80px + env(safe-area-inset-bottom, 0px))",
            background: "var(--bg-secondary)",
            border: "0.5px solid var(--accent)",
          }}
        >
          <p className="text-[11px] text-center" style={{ color: "var(--text-secondary)" }}>
            {linkNodeA.summary.slice(0, 20)} → ?
          </p>
        </div>
      )}

      {combineLoading && (
        <div
          className="absolute left-5 right-5 flex items-center justify-center gap-2 py-3"
          style={{ bottom: "calc(80px + env(safe-area-inset-bottom, 0px))" }}
        >
          <div
            className="h-3 w-3 rounded-full border border-t-transparent animate-spin"
            style={{ borderColor: "var(--border)", borderTopColor: "transparent" }}
          />
          <span
            className="text-[11px]"
            style={{
              color: "var(--text-muted)",
              fontFamily: "'JetBrains Mono', ui-monospace, monospace",
            }}
          >
            combining
          </span>
        </div>
      )}

      {combineResult && (
        <div
          className="absolute left-5 right-5 rounded-lg p-3 animate-page-enter"
          style={{
            bottom: "calc(80px + env(safe-area-inset-bottom, 0px))",
            background: "var(--bg-secondary)",
            border: "0.5px solid var(--border-light)",
            boxShadow: "0 -2px 8px rgba(0,0,0,0.04)",
          }}
        >
          <div
            className="flex items-center gap-2 text-[11px]"
            style={{ color: "var(--text-muted)" }}
          >
            <span style={{ color: "var(--text-primary)" }}>●</span>
            <span>{combineResult.ideaA.summary.slice(0, 15)}</span>
            <span>×</span>
            <span style={{ color: "var(--text-primary)" }}>●</span>
            <span>{combineResult.ideaB.summary.slice(0, 15)}</span>
          </div>
          <p
            className="text-[13px] mt-2"
            style={{ color: "var(--text-primary)", lineHeight: 1.8 }}
          >
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
