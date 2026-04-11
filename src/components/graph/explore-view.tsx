"use client";

import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { useRouter } from "next/navigation";
import * as d3 from "d3";
import { AppHeader } from "@/components/app-header";
import { DetailPanel } from "@/components/graph/detail-panel";
import { CombinePanel } from "@/components/graph/combine-panel";
import { mockDb } from "@/lib/mock/db";
import type { Idea, Connection } from "@/lib/types";
import type { GraphNode, GraphLink } from "@/lib/graph/types";
import {
  layoutSatellites,
  layoutWithCollisionAvoidance,
  calcNodeRadius,
  IDEA_DISTANCE,
  KNOWLEDGE_DISTANCE,
} from "@/lib/graph/layout";

interface ExploreViewProps {
  rootId: string;
}

function getLinkStyle(type: GraphLink["connectionType"]): {
  stroke: string;
  strokeWidth: number;
  strokeDasharray: string;
} {
  switch (type) {
    case "external_knowledge":
    case "knowledge_link":
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

export function ExploreView({ rootId }: ExploreViewProps) {
  const router = useRouter();
  const containerRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const zoomRef = useRef<d3.ZoomBehavior<SVGSVGElement, unknown> | null>(null);

  const [allIdeas, setAllIdeas] = useState<Idea[]>([]);
  const [allConnections, setAllConnections] = useState<Connection[]>([]);
  const [centerNodeId, setCenterNodeId] = useState<string>(rootId);
  const [expandedNodeIds, setExpandedNodeIds] = useState<Set<string>>(() => new Set([rootId]));
  const [visibleNodes, setVisibleNodes] = useState<GraphNode[]>([]);
  const [visibleLinks, setVisibleLinks] = useState<GraphLink[]>([]);
  const [selectedNode, setSelectedNode] = useState<GraphNode | null>(null);
  const [combineMode, setCombineMode] = useState(false);
  const [combineNodeA, setCombineNodeA] = useState<GraphNode | null>(null);
  const [combineResult, setCombineResult] = useState<{
    connection: Connection;
    ideaA: { summary: string };
    ideaB: { summary: string };
  } | null>(null);
  const [combineLoading, setCombineLoading] = useState(false);
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 });

  useEffect(() => {
    setAllIdeas(mockDb.ideas.list());
    setAllConnections(mockDb.connections.list());
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

  const connCountMap = useMemo(() => {
    const map = new Map<string, number>();
    allConnections.forEach((c) => {
      map.set(c.idea_from_id, (map.get(c.idea_from_id) || 0) + 1);
      if (c.idea_to_id) map.set(c.idea_to_id, (map.get(c.idea_to_id) || 0) + 1);
    });
    return map;
  }, [allConnections]);

  // ---- グラフ構築 ----
  useEffect(() => {
    if (allIdeas.length === 0 || dimensions.width === 0) return;

    const nodes: GraphNode[] = [];
    const links: GraphLink[] = [];
    const nodePositions = new Map<string, { x: number; y: number }>();
    const addedNodeIds = new Set<string>();
    const expandedArray = Array.from(expandedNodeIds);

    expandedArray.forEach((expandedId, expandIndex) => {
      const idea = allIdeas.find((i) => i.id === expandedId);
      if (!idea) return;

      if (!addedNodeIds.has(expandedId)) {
        const isRoot = expandIndex === 0;
        const pos = isRoot
          ? { x: dimensions.width / 2, y: dimensions.height / 2 }
          : nodePositions.get(expandedId) ?? { x: dimensions.width / 2, y: dimensions.height / 2 };
        const connCount = connCountMap.get(expandedId) || 0;
        nodes.push({
          id: expandedId, summary: idea.summary, graphLabel: idea.graph_label, keywords: idea.keywords,
          tags: idea.tags, created_at: idea.created_at, r: expandedId === centerNodeId ? 42 : calcNodeRadius(connCount),
          x: pos.x, y: pos.y, isKnowledge: false, connCount,
        });
        nodePositions.set(expandedId, pos);
        addedNodeIds.add(expandedId);
      }

      const parentPos = nodePositions.get(expandedId)!;

      // idea接続先
      const relatedConns = allConnections.filter(
        (c) => (c.idea_from_id === expandedId && c.idea_to_id) || c.idea_to_id === expandedId
      );
      const ideaNeighborIds: string[] = [];
      relatedConns.forEach((c) => {
        if (c.connection_type === "external_knowledge") return;
        const neighborId = c.idea_from_id === expandedId ? c.idea_to_id! : c.idea_from_id;
        if (!addedNodeIds.has(neighborId) && !ideaNeighborIds.includes(neighborId)) {
          ideaNeighborIds.push(neighborId);
        }
        const linkId = c.id;
        if (!links.some((l) => l.id === linkId)) {
          links.push({ id: linkId, sourceId: c.idea_from_id, targetId: c.idea_to_id!, connectionType: c.connection_type });
        }
      });

      const newIdeaNeighbors = ideaNeighborIds.filter((id) => !addedNodeIds.has(id));
      if (newIdeaNeighbors.length > 0) {
        const positions = layoutWithCollisionAvoidance(parentPos.x, parentPos.y, newIdeaNeighbors.length, IDEA_DISTANCE, nodes);
        newIdeaNeighbors.forEach((neighborId, i) => {
          const neighborIdea = allIdeas.find((idea) => idea.id === neighborId);
          if (!neighborIdea) return;
          const connCount = connCountMap.get(neighborId) || 0;
          const pos = positions[i];
          nodes.push({
            id: neighborId, summary: neighborIdea.summary, graphLabel: neighborIdea.graph_label,
            keywords: neighborIdea.keywords, tags: neighborIdea.tags,
            created_at: neighborIdea.created_at, r: calcNodeRadius(connCount),
            x: pos.x, y: pos.y, isKnowledge: false, connCount,
          });
          nodePositions.set(neighborId, pos);
          addedNodeIds.add(neighborId);
        });
      }

      // external_knowledge
      const knowledgeConns = allConnections.filter(
        (c) => c.idea_from_id === expandedId && c.connection_type === "external_knowledge"
      );
      const newKnowledge = knowledgeConns.filter((c) => !addedNodeIds.has(`k-${c.id}`)).slice(0, 6);
      if (newKnowledge.length > 0) {
        const kPositions = layoutSatellites(parentPos.x, parentPos.y, newKnowledge.length, KNOWLEDGE_DISTANCE, -45);
        newKnowledge.forEach((c, i) => {
          const kId = `k-${c.id}`;
          const pos = kPositions[i];
          nodes.push({
            id: kId, summary: c.external_knowledge_title ?? "", graphLabel: "", keywords: [],
            tags: [], created_at: c.created_at, r: 14, x: pos.x, y: pos.y,
            isKnowledge: true, knowledgeTitle: c.external_knowledge_title ?? "",
            knowledgeDescription: c.external_knowledge_summary ?? "",
            knowledgeUrl: c.external_knowledge_url, parentIdeaId: expandedId, connCount: 0,
          });
          nodePositions.set(kId, pos);
          addedNodeIds.add(kId);
          links.push({ id: `kl-${c.id}`, sourceId: expandedId, targetId: kId, connectionType: "external_knowledge" });
        });
      }
    });

    // 表示済みノード間の未追加リンク
    allConnections.forEach((c) => {
      if (!c.idea_to_id) return;
      if (addedNodeIds.has(c.idea_from_id) && addedNodeIds.has(c.idea_to_id)) {
        if (!links.some((l) => l.id === c.id)) {
          links.push({ id: c.id, sourceId: c.idea_from_id, targetId: c.idea_to_id, connectionType: c.connection_type });
        }
      }
    });

    setVisibleNodes(nodes);
    setVisibleLinks(links);
  }, [allIdeas, allConnections, expandedNodeIds, centerNodeId, connCountMap, dimensions]);

  // ---- ノードタップ ----
  const handleNodeTap = useCallback((node: GraphNode) => {
    if (combineMode && combineNodeA && !node.isKnowledge) {
      if (node.id === combineNodeA.id) return;
      setCombineLoading(true);
      setCombineMode(false);
      setSelectedNode(null);
      fetch("/api/combine", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ideaAId: combineNodeA.id, ideaBId: node.id }),
      })
        .then((res) => res.json())
        .then((data) => {
          setCombineResult(data);
          setAllConnections(mockDb.connections.list());
        })
        .catch((err) => console.error("Combine error:", err))
        .finally(() => { setCombineLoading(false); setCombineNodeA(null); });
      return;
    }

    if (node.isKnowledge) { setSelectedNode(node); return; }

    setSelectedNode(node);
    setCombineResult(null);
    setCenterNodeId(node.id);
    setExpandedNodeIds((prev) => { const next = new Set(prev); next.add(node.id); return next; });

    if (svgRef.current && zoomRef.current) {
      const svg = d3.select(svgRef.current);
      const zoom = zoomRef.current;
      const tx = d3.zoomIdentity.translate(dimensions.width / 2 - node.x, dimensions.height / 2 - node.y);
      svg.transition().duration(600).ease(d3.easeCubicOut).call(zoom.transform, tx);
    }
  }, [combineMode, combineNodeA, dimensions]);

  const handleBackgroundTap = useCallback(() => {
    if (combineMode) { setCombineMode(false); setCombineNodeA(null); return; }
    setSelectedNode(null);
    setCombineResult(null);
  }, [combineMode]);

  const handleStartCombine = useCallback(() => {
    if (!selectedNode || selectedNode.isKnowledge) return;
    setCombineNodeA(selectedNode);
    setCombineMode(true);
    setSelectedNode(null);
  }, [selectedNode]);

  const handleCancelCombine = useCallback(() => {
    setCombineMode(false);
    setCombineNodeA(null);
  }, []);

  const getConnectionId = useCallback((nodeId: string): string | null => {
    const conn = allConnections.find(
      (c) => (c.idea_from_id === centerNodeId && c.idea_to_id === nodeId) ||
             (c.idea_from_id === nodeId && c.idea_to_id === centerNodeId)
    );
    return conn?.id ?? null;
  }, [allConnections, centerNodeId]);

  // ---- SVG描画 ----
  useEffect(() => {
    if (!svgRef.current || dimensions.width === 0 || visibleNodes.length === 0) return;

    const svg = d3.select(svgRef.current);
    svg.selectAll("*").remove();
    svg.attr("width", dimensions.width).attr("height", dimensions.height).style("touch-action", "none");

    const g = svg.append("g");

    const zoom = d3.zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.3, 3])
      .on("zoom", (event) => { g.attr("transform", event.transform); });
    svg.call(zoom);
    zoomRef.current = zoom;

    const centerNode = visibleNodes.find((n) => n.id === centerNodeId);
    if (centerNode) {
      const initialTransform = d3.zoomIdentity.translate(
        dimensions.width / 2 - centerNode.x, dimensions.height / 2 - centerNode.y
      );
      svg.call(zoom.transform, initialTransform);
    }

    // エッジ
    const linkData = visibleLinks.filter((link) =>
      visibleNodes.some((n) => n.id === link.sourceId) && visibleNodes.some((n) => n.id === link.targetId)
    );
    g.selectAll("line.graph-link").data(linkData, (d) => (d as GraphLink).id)
      .enter().append("line").attr("class", "graph-link")
      .attr("x1", (d) => visibleNodes.find((n) => n.id === d.sourceId)!.x)
      .attr("y1", (d) => visibleNodes.find((n) => n.id === d.sourceId)!.y)
      .attr("x2", (d) => visibleNodes.find((n) => n.id === d.targetId)!.x)
      .attr("y2", (d) => visibleNodes.find((n) => n.id === d.targetId)!.y)
      .each(function (d) {
        const style = getLinkStyle(d.connectionType);
        d3.select(this).attr("stroke", style.stroke).attr("stroke-width", style.strokeWidth).attr("stroke-dasharray", style.strokeDasharray);
      });

    // ノード
    let pointerStart = { x: 0, y: 0 };
    const nodeGroup = g.selectAll<SVGGElement, GraphNode>("g.graph-node")
      .data(visibleNodes, (d) => (d as GraphNode).id)
      .enter().append("g").attr("class", "graph-node")
      .attr("transform", (d) => `translate(${d.x},${d.y})`)
      .attr("cursor", "pointer")
      .on("pointerdown", (event) => { pointerStart = { x: event.clientX, y: event.clientY }; })
      .on("pointerup", (event, d) => {
        const dist = Math.hypot(event.clientX - pointerStart.x, event.clientY - pointerStart.y);
        if (dist <= 5) { event.stopPropagation(); handleNodeTap(d); }
      });

    // 円
    nodeGroup.append("circle").attr("r", (d) => d.r)
      .attr("fill", "#FFFFFF")
      .attr("stroke", (d) => {
        if (d.id === centerNodeId) return "#222222";
        if (d.isKnowledge) return "#CCCCCC";
        return "#E0E0E0";
      })
      .attr("stroke-width", (d) => (d.id === centerNodeId ? 1.5 : 0.5))
      .attr("stroke-dasharray", (d) => (d.isKnowledge ? "3 2" : "none"));

    // combineインジケータ
    if (combineMode) {
      nodeGroup.filter((d) => !d.isKnowledge && d.id !== combineNodeA?.id)
        .append("circle").attr("r", (d) => d.r + 4).attr("fill", "none")
        .attr("stroke", "#BBBBBB").attr("stroke-width", 1).attr("opacity", 0.5)
        .append("animate").attr("attributeName", "opacity").attr("values", "0.2;0.6;0.2")
        .attr("dur", "1.6s").attr("repeatCount", "indefinite");
    }

    // テキスト
    nodeGroup.append("text").attr("text-anchor", "middle").attr("dominant-baseline", "central")
      .attr("font-size", (d) => { if (d.id === centerNodeId) return "13px"; if (d.isKnowledge) return "9px"; return "11px"; })
      .attr("font-weight", (d) => (d.id === centerNodeId ? "500" : "400"))
      .attr("fill", (d) => { if (d.id === centerNodeId) return "#222222"; if (d.isKnowledge) return "#BBBBBB"; return "#888888"; })
      .attr("pointer-events", "none")
      .attr("dy", (d) => (d.id === centerNodeId ? "-6px" : "0"))
      .text((d) => {
        if (d.id === centerNodeId) return d.summary.length > 7 ? d.summary.slice(0, 7) + "\u2026" : d.summary;
        if (d.isKnowledge) { const t = d.knowledgeTitle ?? ""; return t.length > 4 ? t.slice(0, 4) + "\u2026" : t; }
        return d.summary.length > 5 ? d.summary.slice(0, 5) + "\u2026" : d.summary;
      });

    // 中心ノード接続数ラベル
    nodeGroup.filter((d) => d.id === centerNodeId).append("text")
      .attr("text-anchor", "middle").attr("dominant-baseline", "central")
      .attr("font-size", "10px").attr("fill", "#BBBBBB").attr("pointer-events", "none")
      .attr("dy", "8px").text((d) => `${d.connCount} conn`);

    // 背景タップ
    svg.on("click", (event) => {
      if (event.target === svgRef.current) handleBackgroundTap();
    });
  }, [visibleNodes, visibleLinks, centerNodeId, dimensions, combineMode, combineNodeA, handleNodeTap, handleBackgroundTap]);

  return (
    <main className="flex flex-col h-dvh overflow-hidden animate-page-enter">
      <AppHeader showBack title={allIdeas.find((i) => i.id === centerNodeId)?.summary.slice(0, 12) ?? ""} />

      {combineMode && (
        <button className="mx-5 mb-2 py-1.5 rounded text-center text-[11px] w-auto"
          style={{ background: "var(--bg-tertiary)", color: "var(--text-secondary)" }}
          onClick={handleCancelCombine}>
          組み合わせる相手をタップ（キャンセル）
        </button>
      )}

      {combineLoading && (
        <div className="mx-5 mb-2 flex items-center justify-center gap-2 py-2">
          <div className="h-3 w-3 rounded-full border border-t-transparent animate-spin"
            style={{ borderColor: "var(--border)", borderTopColor: "transparent" }} />
          <span className="text-[11px]" style={{ color: "var(--text-muted)", fontFamily: "var(--font-mono)" }}>combining</span>
        </div>
      )}

      <div ref={containerRef} className="flex-1 min-h-0 relative"
        onClick={(e) => { if (e.target === e.currentTarget) handleBackgroundTap(); }}>
        <svg ref={svgRef} className="absolute inset-0" />
      </div>

      {selectedNode && !combineResult && !combineMode && (
        <DetailPanel node={selectedNode}
          connectionId={!selectedNode.isKnowledge ? getConnectionId(selectedNode.id) : null}
          onDetail={() => { if (!selectedNode.isKnowledge) router.push(`/memo/${selectedNode.id}`); }}
          onDeepDive={(connId) => { router.push(`/chat?connection=${connId}`); }}
          onCombine={handleStartCombine} />
      )}

      {combineResult && (
        <CombinePanel result={combineResult}
          onDeepDive={(connId) => { setCombineResult(null); router.push(`/chat?connection=${connId}`); }}
          onClose={() => setCombineResult(null)} />
      )}
    </main>
  );
}
