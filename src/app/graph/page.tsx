"use client";

import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { useRouter } from "next/navigation";
import * as d3 from "d3";
import { AppHeader } from "@/components/app-header";
import { DetailPanel } from "@/components/graph/detail-panel";
import { CombinePanel } from "@/components/graph/combine-panel";
import { Breadcrumb } from "@/components/graph/breadcrumb";
import { mockDb } from "@/lib/mock/db";
import type { Idea, Connection } from "@/lib/types";
import type { GraphNode, GraphLink, TagCluster } from "@/lib/graph/types";
import {
  layoutTagClusters,
  layoutSatellites,
  layoutWithCollisionAvoidance,
  calcNodeRadius,
  IDEA_DISTANCE,
  KNOWLEDGE_DISTANCE,
} from "@/lib/graph/layout";

type ViewLevel = "tags" | "nodes" | "explore";

export default function GraphPage() {
  const router = useRouter();
  const containerRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const zoomRef = useRef<d3.ZoomBehavior<SVGSVGElement, unknown> | null>(null);

  // データ
  const [allIdeas, setAllIdeas] = useState<Idea[]>([]);
  const [allConnections, setAllConnections] = useState<Connection[]>([]);

  // ビューレベル
  const [viewLevel, setViewLevel] = useState<ViewLevel>("tags");
  const [activeTag, setActiveTag] = useState<string | null>(null);
  const [centerNodeId, setCenterNodeId] = useState<string | null>(null);
  const [expandedNodeIds, setExpandedNodeIds] = useState<Set<string>>(new Set());

  // グラフ要素
  const [tagClusters, setTagClusters] = useState<TagCluster[]>([]);
  const [visibleNodes, setVisibleNodes] = useState<GraphNode[]>([]);
  const [visibleLinks, setVisibleLinks] = useState<GraphLink[]>([]);

  // UI状態
  const [selectedNode, setSelectedNode] = useState<GraphNode | null>(null);
  const [combineMode, setCombineMode] = useState(false);
  const [combineNodeA, setCombineNodeA] = useState<GraphNode | null>(null);
  const [combineResult, setCombineResult] = useState<{
    connection: Connection; ideaA: { summary: string }; ideaB: { summary: string };
  } | null>(null);
  const [combineLoading, setCombineLoading] = useState(false);
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 });

  // パンくず
  const [breadcrumb, setBreadcrumb] = useState<string[]>([]);

  // ---- データ読み込み ----
  useEffect(() => {
    setAllIdeas(mockDb.ideas.list());
    setAllConnections(mockDb.connections.list());
  }, []);

  // ---- コンテナサイズ ----
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

  // ---- 接続数マップ ----
  const connCountMap = useMemo(() => {
    const map = new Map<string, number>();
    allConnections.forEach((c) => {
      map.set(c.idea_from_id, (map.get(c.idea_from_id) || 0) + 1);
      if (c.idea_to_id) map.set(c.idea_to_id, (map.get(c.idea_to_id) || 0) + 1);
    });
    return map;
  }, [allConnections]);

  // ---- Level 1: タグクラスタ構築 ----
  useEffect(() => {
    if (allIdeas.length === 0 || dimensions.width === 0) return;
    const tagMap = new Map<string, string[]>();
    allIdeas.forEach((idea) => {
      const mainTag = idea.tags[0];
      if (!mainTag) return;
      if (!tagMap.has(mainTag)) tagMap.set(mainTag, []);
      tagMap.get(mainTag)!.push(idea.id);
    });
    const rawClusters: TagCluster[] = Array.from(tagMap.entries()).map(([tag, ids]) => ({
      tag, nodeCount: ids.length, ideaIds: ids, x: 0, y: 0, r: 0,
    }));
    const laid = layoutTagClusters(rawClusters, dimensions.width / 2, dimensions.height / 2);
    setTagClusters(laid);
  }, [allIdeas, dimensions]);

  // ---- Level 2: タグ展開 → ノード表示 ----
  const expandTag = useCallback((tag: string) => {
    const cluster = tagClusters.find((c) => c.tag === tag);
    if (!cluster) return;

    const ideas = cluster.ideaIds.map((id) => allIdeas.find((i) => i.id === id)).filter(Boolean) as Idea[];
    const positions = layoutSatellites(cluster.x, cluster.y, ideas.length, IDEA_DISTANCE * 0.8);

    const nodes: GraphNode[] = ideas.map((idea, i) => ({
      id: idea.id, summary: idea.summary, graphLabel: idea.graph_label,
      keywords: idea.keywords, tags: idea.tags, created_at: idea.created_at,
      r: calcNodeRadius(connCountMap.get(idea.id) || 0),
      x: positions[i].x, y: positions[i].y,
      isKnowledge: false, connCount: connCountMap.get(idea.id) || 0,
    }));

    // クロスタグの線: このタグ内ノード同士の接続
    const links: GraphLink[] = [];
    const nodeIds = new Set(nodes.map((n) => n.id));
    allConnections.forEach((c) => {
      if (!c.idea_to_id) return;
      if (nodeIds.has(c.idea_from_id) && nodeIds.has(c.idea_to_id)) {
        links.push({ id: c.id, sourceId: c.idea_from_id, targetId: c.idea_to_id, connectionType: c.connection_type });
      }
    });

    setVisibleNodes(nodes);
    setVisibleLinks(links);
    setActiveTag(tag);
    setViewLevel("nodes");
    setBreadcrumb([tag]);
    setSelectedNode(null);
    setCombineResult(null);
  }, [tagClusters, allIdeas, allConnections, connCountMap]);

  // ---- Level 3: ノード展開 → 接続+外部知識 ----
  const expandNode = useCallback((nodeId: string) => {
    const idea = allIdeas.find((i) => i.id === nodeId);
    if (!idea) return;

    setCenterNodeId(nodeId);
    setExpandedNodeIds((prev) => { const next = new Set(prev); next.add(nodeId); return next; });
    setViewLevel("explore");
    setBreadcrumb((prev) => [...prev, idea.graph_label]);

    // 既存ノードの位置を保持
    const existingPositions = new Map(visibleNodes.map((n) => [n.id, { x: n.x, y: n.y }]));
    const parentPos = existingPositions.get(nodeId) ?? { x: dimensions.width / 2, y: dimensions.height / 2 };

    const newNodes = [...visibleNodes];
    const newLinks = [...visibleLinks];
    const addedIds = new Set(newNodes.map((n) => n.id));

    // 中心ノードのサイズを大きく
    const centerIdx = newNodes.findIndex((n) => n.id === nodeId);
    if (centerIdx >= 0) {
      newNodes[centerIdx] = { ...newNodes[centerIdx], r: 42 };
    }

    // idea接続先を追加
    const relatedConns = allConnections.filter(
      (c) => (c.idea_from_id === nodeId && c.idea_to_id) || c.idea_to_id === nodeId
    );
    const newNeighborIds: string[] = [];
    relatedConns.forEach((c) => {
      if (c.connection_type === "external_knowledge") return;
      const neighborId = c.idea_from_id === nodeId ? c.idea_to_id! : c.idea_from_id;
      if (!addedIds.has(neighborId) && !newNeighborIds.includes(neighborId)) {
        newNeighborIds.push(neighborId);
      }
      if (!newLinks.some((l) => l.id === c.id)) {
        newLinks.push({ id: c.id, sourceId: c.idea_from_id, targetId: c.idea_to_id!, connectionType: c.connection_type });
      }
    });

    if (newNeighborIds.length > 0) {
      const positions = layoutWithCollisionAvoidance(parentPos.x, parentPos.y, newNeighborIds.length, IDEA_DISTANCE, newNodes);
      newNeighborIds.forEach((nid, i) => {
        const neighborIdea = allIdeas.find((idea) => idea.id === nid);
        if (!neighborIdea) return;
        newNodes.push({
          id: nid, summary: neighborIdea.summary, graphLabel: neighborIdea.graph_label,
          keywords: neighborIdea.keywords, tags: neighborIdea.tags, created_at: neighborIdea.created_at,
          r: calcNodeRadius(connCountMap.get(nid) || 0),
          x: positions[i].x, y: positions[i].y,
          isKnowledge: false, connCount: connCountMap.get(nid) || 0,
        });
        addedIds.add(nid);
      });
    }

    // external_knowledge追加
    const knowledgeConns = allConnections.filter(
      (c) => c.idea_from_id === nodeId && c.connection_type === "external_knowledge"
    ).slice(0, 6);
    const newKnowledge = knowledgeConns.filter((c) => !addedIds.has(`k-${c.id}`));
    if (newKnowledge.length > 0) {
      const kPositions = layoutSatellites(parentPos.x, parentPos.y, newKnowledge.length, KNOWLEDGE_DISTANCE, -45);
      newKnowledge.forEach((c, i) => {
        const kId = `k-${c.id}`;
        newNodes.push({
          id: kId, summary: c.external_knowledge_title ?? "", graphLabel: "",
          keywords: [], tags: [], created_at: c.created_at, r: 14,
          x: kPositions[i].x, y: kPositions[i].y,
          isKnowledge: true, knowledgeTitle: c.external_knowledge_title ?? "",
          knowledgeDescription: c.external_knowledge_summary ?? "",
          knowledgeUrl: c.external_knowledge_url, parentIdeaId: nodeId, connCount: 0,
        });
        addedIds.add(kId);
        newLinks.push({ id: `kl-${c.id}`, sourceId: nodeId, targetId: kId, connectionType: "external_knowledge" });
      });
    }

    // 表示済みノード間の未追加リンク
    allConnections.forEach((c) => {
      if (!c.idea_to_id) return;
      if (addedIds.has(c.idea_from_id) && addedIds.has(c.idea_to_id) && !newLinks.some((l) => l.id === c.id)) {
        newLinks.push({ id: c.id, sourceId: c.idea_from_id, targetId: c.idea_to_id, connectionType: c.connection_type });
      }
    });

    setVisibleNodes(newNodes);
    setVisibleLinks(newLinks);

    // SVGパン: ノードを中央に
    if (svgRef.current && zoomRef.current) {
      const svg = d3.select(svgRef.current);
      const zoom = zoomRef.current;
      const tx = d3.zoomIdentity.translate(dimensions.width / 2 - parentPos.x, dimensions.height / 2 - parentPos.y);
      svg.transition().duration(600).ease(d3.easeCubicOut).call(zoom.transform, tx);
    }
  }, [allIdeas, allConnections, connCountMap, visibleNodes, visibleLinks, dimensions]);

  // ---- ノードタップ処理 ----
  const handleNodeTap = useCallback((node: GraphNode) => {
    if (navigator.vibrate) navigator.vibrate(10);

    // combineモード中
    if (combineMode && combineNodeA && !node.isKnowledge) {
      if (node.id === combineNodeA.id) return;
      setCombineLoading(true); setCombineMode(false); setSelectedNode(null);
      fetch("/api/combine", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ideaAId: combineNodeA.id, ideaBId: node.id }),
      }).then((r) => r.json()).then((data) => {
        setCombineResult(data); setAllConnections(mockDb.connections.list());
      }).catch((e) => console.error("Combine error:", e))
        .finally(() => { setCombineLoading(false); setCombineNodeA(null); });
      return;
    }

    if (node.isKnowledge) { setSelectedNode(node); return; }

    // Level 2 → Level 3
    if (viewLevel === "nodes") {
      setSelectedNode(node);
      expandNode(node.id);
      return;
    }

    // Level 3: 別ノードタップ → さらに展開
    setSelectedNode(node);
    setCombineResult(null);
    expandNode(node.id);
  }, [combineMode, combineNodeA, viewLevel, expandNode]);

  // ---- タグタップ ----
  const handleTagTap = useCallback((tag: string) => {
    if (navigator.vibrate) navigator.vibrate(10);
    expandTag(tag);
  }, [expandTag]);

  // ---- 背景タップ ----
  const handleBackgroundTap = useCallback(() => {
    if (combineMode) { setCombineMode(false); setCombineNodeA(null); return; }
    setSelectedNode(null); setCombineResult(null);
  }, [combineMode]);

  // ---- Combine ----
  const handleStartCombine = useCallback(() => {
    if (!selectedNode || selectedNode.isKnowledge) return;
    setCombineNodeA(selectedNode); setCombineMode(true); setSelectedNode(null);
  }, [selectedNode]);

  const handleCancelCombine = useCallback(() => {
    setCombineMode(false); setCombineNodeA(null);
  }, []);

  // ---- 全体表示リセット ----
  const handleResetView = useCallback(() => {
    setViewLevel("tags"); setActiveTag(null); setCenterNodeId(null);
    setExpandedNodeIds(new Set()); setVisibleNodes([]); setVisibleLinks([]);
    setSelectedNode(null); setCombineResult(null); setCombineMode(false);
    setBreadcrumb([]);
    if (svgRef.current && zoomRef.current) {
      const svg = d3.select(svgRef.current);
      svg.transition().duration(400).ease(d3.easeCubicOut)
        .call(zoomRef.current.transform, d3.zoomIdentity);
    }
  }, []);

  // ---- パンくず遷移 ----
  const handleBreadcrumbTap = useCallback((index: number) => {
    if (index === 0 && breadcrumb.length > 0) {
      const tag = breadcrumb[0];
      setViewLevel("nodes"); setCenterNodeId(null);
      setExpandedNodeIds(new Set()); setBreadcrumb([tag]);
      setSelectedNode(null); setCombineResult(null);
      expandTag(tag);
    }
  }, [breadcrumb, expandTag]);

  // ---- 接続ID取得 ----
  const getConnectionId = useCallback((nodeId: string): string | null => {
    if (!centerNodeId) return null;
    const conn = allConnections.find(
      (c) => (c.idea_from_id === centerNodeId && c.idea_to_id === nodeId) ||
             (c.idea_from_id === nodeId && c.idea_to_id === centerNodeId)
    );
    return conn?.id ?? null;
  }, [allConnections, centerNodeId]);

  // ---- エッジスタイル ----
  function getLinkStyle(type: GraphLink["connectionType"]): { stroke: string; strokeWidth: number; strokeDasharray: string } {
    switch (type) {
      case "external_knowledge": case "knowledge_link":
        return { stroke: "#CCCCCC", strokeWidth: 0.5, strokeDasharray: "4 2" };
      case "combination": return { stroke: "#999999", strokeWidth: 1.5, strokeDasharray: "none" };
      case "manual": return { stroke: "#CCCCCC", strokeWidth: 0.5, strokeDasharray: "none" };
      case "chat_derived": return { stroke: "#CCCCCC", strokeWidth: 0.5, strokeDasharray: "2 2" };
      default: return { stroke: "#E0E0E0", strokeWidth: 0.5, strokeDasharray: "4 2" };
    }
  }

  // ==== SVG描画 ====
  useEffect(() => {
    if (!svgRef.current || dimensions.width === 0) return;

    const svg = d3.select(svgRef.current);
    svg.selectAll("*").remove();
    svg.attr("width", dimensions.width).attr("height", dimensions.height).style("touch-action", "none");

    const g = svg.append("g");
    const zoom = d3.zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.3, 3])
      .on("zoom", (event) => { g.attr("transform", event.transform); });
    svg.call(zoom);
    zoomRef.current = zoom;

    let pointerStart = { x: 0, y: 0 };

    // ==== Level 1: タグクラスタ描画 ====
    if (viewLevel === "tags" && tagClusters.length > 0) {
      // タグ間のクロスリンク（同じアイデアが複数タグに属する場合の薄い線）
      const tagPairs: [TagCluster, TagCluster][] = [];
      for (let i = 0; i < tagClusters.length; i++) {
        for (let j = i + 1; j < tagClusters.length; j++) {
          const shared = tagClusters[i].ideaIds.some((id) => {
            const idea = allIdeas.find((idea) => idea.id === id);
            return idea?.tags.includes(tagClusters[j].tag);
          });
          if (shared) tagPairs.push([tagClusters[i], tagClusters[j]]);
        }
      }
      tagPairs.forEach(([a, b]) => {
        g.append("line")
          .attr("x1", a.x).attr("y1", a.y).attr("x2", b.x).attr("y2", b.y)
          .attr("stroke", "#E0E0E0").attr("stroke-width", 0.5).attr("stroke-dasharray", "6 4")
          .attr("opacity", 0.5);
      });

      // タグクラスタ円
      const tagGroup = g.selectAll<SVGGElement, TagCluster>("g.tag-cluster")
        .data(tagClusters).enter().append("g").attr("class", "tag-cluster")
        .attr("transform", (d) => `translate(${d.x},${d.y})`).attr("cursor", "pointer")
        .on("pointerdown", (event) => { pointerStart = { x: event.clientX, y: event.clientY }; })
        .on("pointerup", (event, d) => {
          if (Math.hypot(event.clientX - pointerStart.x, event.clientY - pointerStart.y) <= 5) {
            event.stopPropagation(); handleTagTap(d.tag);
          }
        });

      // 外円
      tagGroup.append("circle").attr("r", (d) => d.r)
        .attr("fill", "#FFFFFF").attr("stroke", "#E0E0E0").attr("stroke-width", 0.5);

      // 中のノード予感（うっすら点）
      tagGroup.each(function (d) {
        const group = d3.select(this);
        const inner = layoutSatellites(0, 0, Math.min(d.nodeCount, 5), d.r * 0.5);
        inner.forEach((pos) => {
          group.append("circle").attr("cx", pos.x).attr("cy", pos.y).attr("r", 4)
            .attr("fill", "#E0E0E0").attr("opacity", 0.4);
        });
      });

      // タグ名
      tagGroup.append("text").attr("text-anchor", "middle").attr("dominant-baseline", "central")
        .attr("dy", "-8px").attr("font-size", "13px").attr("font-weight", "500")
        .attr("fill", "#555555").attr("pointer-events", "none")
        .text((d) => d.tag);

      // ノード数
      tagGroup.append("text").attr("text-anchor", "middle").attr("dominant-baseline", "central")
        .attr("dy", "10px").attr("font-size", "11px").attr("fill", "#BBBBBB")
        .attr("pointer-events", "none")
        .style("font-family", "'JetBrains Mono', ui-monospace, monospace")
        .text((d) => `${d.nodeCount} nodes`);

      return;
    }

    // ==== Level 2 & 3: ノード + エッジ描画 ====
    if (visibleNodes.length === 0) return;

    // 中心ノードにパン
    if (centerNodeId) {
      const cn = visibleNodes.find((n) => n.id === centerNodeId);
      if (cn) svg.call(zoom.transform, d3.zoomIdentity.translate(dimensions.width / 2 - cn.x, dimensions.height / 2 - cn.y));
    } else if (activeTag) {
      const cluster = tagClusters.find((c) => c.tag === activeTag);
      if (cluster) svg.call(zoom.transform, d3.zoomIdentity.translate(dimensions.width / 2 - cluster.x, dimensions.height / 2 - cluster.y));
    }

    // エッジ
    const linkData = visibleLinks.filter((l) =>
      visibleNodes.some((n) => n.id === l.sourceId) && visibleNodes.some((n) => n.id === l.targetId)
    );
    g.selectAll("line.graph-link").data(linkData, (d) => (d as GraphLink).id)
      .enter().append("line").attr("class", "graph-link")
      .attr("x1", (d) => visibleNodes.find((n) => n.id === d.sourceId)!.x)
      .attr("y1", (d) => visibleNodes.find((n) => n.id === d.sourceId)!.y)
      .attr("x2", (d) => visibleNodes.find((n) => n.id === d.targetId)!.x)
      .attr("y2", (d) => visibleNodes.find((n) => n.id === d.targetId)!.y)
      .each(function (d) {
        const s = getLinkStyle(d.connectionType);
        d3.select(this).attr("stroke", s.stroke).attr("stroke-width", s.strokeWidth).attr("stroke-dasharray", s.strokeDasharray);
      });

    // ノード
    const nodeGroup = g.selectAll<SVGGElement, GraphNode>("g.graph-node")
      .data(visibleNodes, (d) => (d as GraphNode).id).enter().append("g").attr("class", "graph-node")
      .attr("transform", (d) => `translate(${d.x},${d.y})`).attr("cursor", "pointer")
      .on("pointerdown", (event) => { pointerStart = { x: event.clientX, y: event.clientY }; })
      .on("pointerup", (event, d) => {
        if (Math.hypot(event.clientX - pointerStart.x, event.clientY - pointerStart.y) <= 5) {
          event.stopPropagation(); handleNodeTap(d);
        }
      });

    // ヒットエリア拡張（透明、見た目r+12px）
    nodeGroup.append("circle").attr("r", (d) => d.r + 12)
      .attr("fill", "transparent").attr("stroke", "none");

    // 表示用円
    nodeGroup.append("circle").attr("r", (d) => d.r)
      .attr("fill", "#FFFFFF")
      .attr("stroke", (d) => {
        if (d.id === centerNodeId) return "#222222";
        if (d.isKnowledge) return "#CCCCCC";
        return "#E0E0E0";
      })
      .attr("stroke-width", (d) => {
        if (d.id === centerNodeId) return 1.5;
        if (expandedNodeIds.size > 0 && d.id === Array.from(expandedNodeIds)[0]) return 2;
        return 0.5;
      })
      .attr("stroke-dasharray", (d) => (d.isKnowledge ? "3 2" : "none"));

    // combineインジケータ
    if (combineMode) {
      nodeGroup.filter((d) => !d.isKnowledge && d.id !== combineNodeA?.id)
        .append("circle").attr("r", (d) => d.r + 4).attr("fill", "none")
        .attr("stroke", "#BBBBBB").attr("stroke-width", 1).attr("opacity", 0.5)
        .append("animate").attr("attributeName", "opacity").attr("values", "0.2;0.6;0.2")
        .attr("dur", "1.6s").attr("repeatCount", "indefinite");
    }

    // 意味的ズーム: ラベル表示はzoom scaleで制御
    const currentScale = d3.zoomTransform(svgRef.current!).k;
    const showLabels = currentScale >= 0.7;

    if (showLabels) {
      // graph_label テキスト
      nodeGroup.filter((d) => !d.isKnowledge).append("text")
        .attr("text-anchor", "middle").attr("dominant-baseline", "central")
        .attr("font-size", (d) => (d.id === centerNodeId ? "13px" : "11px"))
        .attr("font-weight", (d) => (d.id === centerNodeId ? "500" : "400"))
        .attr("fill", (d) => (d.id === centerNodeId ? "#222222" : "#888888"))
        .attr("pointer-events", "none")
        .attr("dy", (d) => (d.id === centerNodeId ? "-6px" : "0"))
        .text((d) => {
          const label = d.graphLabel || d.summary;
          const max = d.id === centerNodeId ? 7 : 5;
          return label.length > max ? label.slice(0, max) + "…" : label;
        });

      // 中心ノード接続数
      nodeGroup.filter((d) => d.id === centerNodeId).append("text")
        .attr("text-anchor", "middle").attr("dominant-baseline", "central")
        .attr("font-size", "10px").attr("fill", "#BBBBBB").attr("pointer-events", "none")
        .attr("dy", "8px").text((d) => `${d.connCount} conn`);

      // 外部知識ラベル
      nodeGroup.filter((d) => d.isKnowledge).append("text")
        .attr("text-anchor", "middle").attr("dominant-baseline", "central")
        .attr("font-size", "9px").attr("fill", "#BBBBBB").attr("pointer-events", "none")
        .text((d) => {
          if (d.parentIdeaId === centerNodeId) {
            const t = d.knowledgeTitle ?? "";
            return t.length > 4 ? t.slice(0, 4) + "…" : t;
          }
          return "";
        });
    }

    // zoom時にラベル表示/非表示を更新
    zoom.on("zoom", (event) => {
      g.attr("transform", event.transform);
      const scale = event.transform.k;
      g.selectAll("text").attr("opacity", scale >= 0.7 ? 1 : 0);
    });

    // 背景タップ
    svg.on("click", (event) => {
      if (event.target === svgRef.current) handleBackgroundTap();
    });
  }, [viewLevel, tagClusters, visibleNodes, visibleLinks, centerNodeId, activeTag, dimensions, combineMode, combineNodeA, expandedNodeIds, handleTagTap, handleNodeTap, handleBackgroundTap, allIdeas]);

  // ---- エンプティ ----
  if (allIdeas.length === 0) {
    return (
      <main className="flex flex-col h-dvh overflow-hidden animate-page-enter">
        <AppHeader />
        <div className="flex-1 flex flex-col items-center justify-center" style={{ paddingBottom: "20vh" }}>
          <svg width="80" height="80" viewBox="0 0 80 80" fill="none">
            <circle cx="40" cy="40" r="38" stroke="#E0E0E0" strokeWidth="0.5" />
            <circle cx="40" cy="40" r="24" stroke="#E0E0E0" strokeWidth="0.5" />
            <circle cx="40" cy="40" r="10" stroke="#E0E0E0" strokeWidth="0.5" />
          </svg>
          <span className="mt-4 text-xs" style={{ color: "var(--text-muted)", fontFamily: "var(--font-mono)" }}>0 nodes</span>
        </div>
      </main>
    );
  }

  return (
    <main className="flex flex-col h-dvh overflow-hidden animate-page-enter">
      <AppHeader rightContent={
        viewLevel !== "tags" ? (
          <button onClick={handleResetView} className="text-[11px]" style={{ color: "var(--text-muted)", fontFamily: "var(--font-mono)" }}>
            reset
          </button>
        ) : undefined
      } />

      {/* パンくず */}
      {breadcrumb.length > 0 && (
        <Breadcrumb items={breadcrumb} onTap={handleBreadcrumbTap} />
      )}

      {/* combineバナー */}
      {combineMode && (
        <button className="mx-5 mb-2 py-1.5 rounded text-center text-[11px]"
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

      {/* SVGキャンバス */}
      <div ref={containerRef} className="flex-1 min-h-0 relative"
        onClick={(e) => { if (e.target === e.currentTarget) handleBackgroundTap(); }}>
        <svg ref={svgRef} className="absolute inset-0" />
      </div>

      {/* 詳細パネル */}
      {selectedNode && !combineResult && !combineMode && (
        <DetailPanel node={selectedNode}
          connectionId={!selectedNode.isKnowledge ? getConnectionId(selectedNode.id) : null}
          onDetail={() => { if (!selectedNode.isKnowledge) router.push(`/memo/${selectedNode.id}`); }}
          onDeepDive={(connId) => router.push(`/chat?connection=${connId}`)}
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
