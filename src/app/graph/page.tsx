"use client";

import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { useRouter } from "next/navigation";
import * as d3 from "d3";
import { AppHeader } from "@/components/app-header";
import { DetailPanel } from "@/components/graph/detail-panel";
import { CombinePanel } from "@/components/graph/combine-panel";
import { mockDb } from "@/lib/mock/db";
import type { Idea, Connection } from "@/lib/types";
import type { GraphNode, GraphLink, TagCluster } from "@/lib/graph/types";
import {
  layoutTagClusters,
  layoutNodesInCluster,
  layoutKnowledge,
  calcNodeRadius,
} from "@/lib/graph/layout";

export default function GraphPage() {
  const router = useRouter();
  const containerRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const zoomRef = useRef<d3.ZoomBehavior<SVGSVGElement, unknown> | null>(null);

  // データ
  const [allIdeas, setAllIdeas] = useState<Idea[]>([]);
  const [allConnections, setAllConnections] = useState<Connection[]>([]);
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 });

  // 固定グラフ要素（初期計算後は変わらない）
  const [nodes, setNodes] = useState<GraphNode[]>([]);
  const [clusters, setClusters] = useState<TagCluster[]>([]);
  const [baseLinks, setBaseLinks] = useState<GraphLink[]>([]);

  // フォーカス状態（1ノードのみ。null = 非フォーカス）
  const [focusedNodeId, setFocusedNodeId] = useState<string | null>(null);
  const [knowledgeNodes, setKnowledgeNodes] = useState<GraphNode[]>([]);
  const [knowledgeLinks, setKnowledgeLinks] = useState<GraphLink[]>([]);

  // UI状態
  const [selectedNode, setSelectedNode] = useState<GraphNode | null>(null);
  const [combineMode, setCombineMode] = useState(false);
  const [combineNodeA, setCombineNodeA] = useState<GraphNode | null>(null);
  const [combineResult, setCombineResult] = useState<{
    connection: Connection;
    ideaA: { summary: string };
    ideaB: { summary: string };
  } | null>(null);
  const [combineLoading, setCombineLoading] = useState(false);

  // ---- データ読み込み ----
  useEffect(() => {
    setAllIdeas(mockDb.ideas.list());
    setAllConnections(mockDb.connections.list());
  }, []);

  // ---- コンテナサイズ ----
  // allIdeasが変わるとエンプティ→メイン表示に切り替わりcontainerRefがDOMに入るため依存に含める
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const ro = new ResizeObserver((entries) => {
      const { width, height } = entries[0].contentRect;
      if (width > 0 && height > 0) setDimensions({ width, height });
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, [allIdeas]);

  // ---- 接続数マップ ----
  const connCountMap = useMemo(() => {
    const map = new Map<string, number>();
    allConnections.forEach((c) => {
      map.set(c.idea_from_id, (map.get(c.idea_from_id) || 0) + 1);
      if (c.idea_to_id) map.set(c.idea_to_id, (map.get(c.idea_to_id) || 0) + 1);
    });
    return map;
  }, [allConnections]);

  // ---- 初期レイアウト計算（1回のみ） ----
  useEffect(() => {
    if (allIdeas.length === 0 || dimensions.width === 0) return;
    if (nodes.length > 0) return; // 再計算しない

    // タグ → アイデアIDマップ（先頭タグでグルーピング）
    const tagMap = new Map<string, string[]>();
    allIdeas.forEach((idea) => {
      const mainTag = idea.tags[0];
      if (!mainTag) return;
      if (!tagMap.has(mainTag)) tagMap.set(mainTag, []);
      tagMap.get(mainTag)!.push(idea.id);
    });

    // クラスタ配置
    const rawClusters: TagCluster[] = Array.from(tagMap.entries()).map(([tag, ids]) => ({
      tag, nodeCount: ids.length, ideaIds: ids, x: 0, y: 0, r: 0,
    }));
    const laidClusters = layoutTagClusters(rawClusters, dimensions.width / 2, dimensions.height / 2);
    setClusters(laidClusters);

    // 全ノード配置（各クラスタ内で放射状）
    const allNodes: GraphNode[] = [];
    laidClusters.forEach((cluster) => {
      const positions = layoutNodesInCluster(cluster.x, cluster.y, cluster.ideaIds.length);
      cluster.ideaIds.forEach((ideaId, i) => {
        const idea = allIdeas.find((a) => a.id === ideaId);
        if (!idea) return;
        const pos = positions[i];
        allNodes.push({
          id: idea.id,
          summary: idea.summary,
          graphLabel: idea.graph_label,
          keywords: idea.keywords,
          tags: idea.tags,
          created_at: idea.created_at,
          r: calcNodeRadius(connCountMap.get(idea.id) || 0),
          x: pos.x,
          y: pos.y,
          isKnowledge: false,
          connCount: connCountMap.get(idea.id) || 0,
        });
      });
    });
    setNodes(allNodes);

    // ベースリンク（idea間接続のみ。外部知識は含まない）
    const links: GraphLink[] = [];
    const nodeIdSet = new Set(allNodes.map((n) => n.id));
    allConnections.forEach((c) => {
      if (!c.idea_to_id) return;
      if (c.connection_type === "external_knowledge") return;
      if (nodeIdSet.has(c.idea_from_id) && nodeIdSet.has(c.idea_to_id)) {
        if (!links.some((l) => l.id === c.id)) {
          links.push({ id: c.id, sourceId: c.idea_from_id, targetId: c.idea_to_id, connectionType: c.connection_type });
        }
      }
    });
    setBaseLinks(links);
  }, [allIdeas, allConnections, dimensions, connCountMap, nodes.length]);

  // ---- fit-all ズーム ----
  const applyFitAll = useCallback((nodeList: GraphNode[]) => {
    if (!svgRef.current || !zoomRef.current || nodeList.length === 0) return;
    const xs = nodeList.map((n) => n.x);
    const ys = nodeList.map((n) => n.y);
    const minX = Math.min(...xs) - 60;
    const maxX = Math.max(...xs) + 60;
    const minY = Math.min(...ys) - 60;
    const maxY = Math.max(...ys) + 60;
    const contentW = maxX - minX;
    const contentH = maxY - minY;
    const scale = Math.min(dimensions.width / contentW, dimensions.height / contentH, 1.2) * 0.9;
    const cx = (minX + maxX) / 2;
    const cy = (minY + maxY) / 2;
    const tx = d3.zoomIdentity
      .translate(dimensions.width / 2 - cx * scale, dimensions.height / 2 - cy * scale)
      .scale(scale);
    d3.select(svgRef.current)
      .transition().duration(400).ease(d3.easeCubicOut)
      .call(zoomRef.current.transform, tx);
  }, [dimensions]);

  // ---- リセット ----
  const handleResetView = useCallback(() => {
    setFocusedNodeId(null);
    setKnowledgeNodes([]);
    setKnowledgeLinks([]);
    setSelectedNode(null);
    setCombineResult(null);
    setCombineMode(false);
    setCombineNodeA(null);
    applyFitAll(nodes);
  }, [nodes, applyFitAll]);

  // ---- ノードタップ処理 ----
  const handleNodeTap = useCallback((node: GraphNode) => {
    if (navigator.vibrate) navigator.vibrate(10);

    // combineモード中
    if (combineMode && combineNodeA && !node.isKnowledge) {
      if (node.id === combineNodeA.id) return;
      setCombineLoading(true);
      setCombineMode(false);
      setSelectedNode(null);
      fetch("/api/combine", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ideaAId: combineNodeA.id, ideaBId: node.id }),
      }).then((r) => r.json()).then((data) => {
        setCombineResult(data);
        setAllConnections(mockDb.connections.list());
      }).catch((e) => console.error("Combine error:", e))
        .finally(() => { setCombineLoading(false); setCombineNodeA(null); });
      return;
    }

    // 外部知識ノードタップ
    if (node.isKnowledge) {
      setSelectedNode(node);
      return;
    }

    // 同じノードを再タップ → フォーカス解除
    if (focusedNodeId === node.id) {
      setFocusedNodeId(null);
      setKnowledgeNodes([]);
      setKnowledgeLinks([]);
      setSelectedNode(null);
      return;
    }

    // 新しいノードをフォーカス
    setFocusedNodeId(node.id);
    setSelectedNode(node);

    // 外部知識を一時展開（最大4件）
    const knowledgeConns = allConnections.filter(
      (c) => c.idea_from_id === node.id && c.connection_type === "external_knowledge"
    ).slice(0, 4);

    if (knowledgeConns.length > 0) {
      const positions = layoutKnowledge(
        node.x, node.y, knowledgeConns.length,
        nodes.map((n) => ({ x: n.x, y: n.y }))
      );
      setKnowledgeNodes(knowledgeConns.map((c, i) => ({
        id: `k-${c.id}`,
        summary: c.external_knowledge_title ?? "",
        graphLabel: "",
        keywords: [],
        tags: [],
        created_at: c.created_at,
        r: 14,
        x: positions[i].x,
        y: positions[i].y,
        isKnowledge: true,
        knowledgeTitle: c.external_knowledge_title ?? "",
        knowledgeDescription: c.external_knowledge_summary ?? "",
        knowledgeUrl: c.external_knowledge_url,
        parentIdeaId: node.id,
        connCount: 0,
      })));
      setKnowledgeLinks(knowledgeConns.map((c) => ({
        id: `kl-${c.id}`,
        sourceId: node.id,
        targetId: `k-${c.id}`,
        connectionType: "knowledge_link" as const,
      })));
    } else {
      setKnowledgeNodes([]);
      setKnowledgeLinks([]);
    }

    // パン: フォーカスノードを画面中央に（600ms ease-out）
    if (svgRef.current && zoomRef.current) {
      const currentTransform = d3.zoomTransform(svgRef.current);
      const tx = d3.zoomIdentity
        .translate(
          dimensions.width / 2 - node.x * currentTransform.k,
          dimensions.height / 2 - node.y * currentTransform.k
        )
        .scale(currentTransform.k);
      d3.select(svgRef.current)
        .transition().duration(600).ease(d3.easeCubicOut)
        .call(zoomRef.current.transform, tx);
    }
  }, [focusedNodeId, combineMode, combineNodeA, allConnections, nodes, dimensions]);

  // ---- 背景タップ ----
  const handleBackgroundTap = useCallback(() => {
    if (combineMode) {
      setCombineMode(false);
      setCombineNodeA(null);
      return;
    }
    setFocusedNodeId(null);
    setKnowledgeNodes([]);
    setKnowledgeLinks([]);
    setSelectedNode(null);
    setCombineResult(null);
  }, [combineMode]);

  // d3イベントハンドラ内でstaleにならないよう ref経由で呼ぶ
  const handleNodeTapRef = useRef(handleNodeTap);
  handleNodeTapRef.current = handleNodeTap;
  const handleBackgroundTapRef = useRef(handleBackgroundTap);
  handleBackgroundTapRef.current = handleBackgroundTap;

  // ---- Combine ----
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

  // ---- 接続ID取得 ----
  const getConnectionId = useCallback((nodeId: string): string | null => {
    if (!focusedNodeId) return null;
    const conn = allConnections.find(
      (c) => (c.idea_from_id === focusedNodeId && c.idea_to_id === nodeId) ||
             (c.idea_from_id === nodeId && c.idea_to_id === focusedNodeId)
    );
    return conn?.id ?? null;
  }, [allConnections, focusedNodeId]);

  // ==== 主SVG描画（ノード/クラスタ/baseLinks確定後1回） ====
  useEffect(() => {
    if (!svgRef.current || dimensions.width === 0 || nodes.length === 0) return;

    const svg = d3.select(svgRef.current);
    svg.selectAll("*").remove();
    svg.attr("width", dimensions.width).attr("height", dimensions.height).style("touch-action", "none");

    const g = svg.append("g").attr("class", "canvas");

    // zoom
    const zoom = d3.zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.1, 4])
      .on("zoom", (event) => {
        g.attr("transform", event.transform);
        const k = event.transform.k;

        // タグラベル LOD
        g.selectAll<SVGTextElement, TagCluster>(".tag-label")
          .attr("font-size", k < 0.5 ? 24 / k : k < 1.0 ? 16 / k : 16)
          .attr("opacity", k >= 1.0 ? 0.15 : 1);

        // ノード円 LOD
        g.selectAll<SVGCircleElement, GraphNode>(".node-circle")
          .attr("r", (d) => {
            if (k < 0.5) return 3;
            if (k < 1.0) return calcNodeRadius(d.connCount) * 0.6;
            return calcNodeRadius(d.connCount);
          });

        // graph_label LOD
        g.selectAll(".node-label")
          .attr("opacity", k >= 1.0 ? 1 : 0);

        // 接続線 LOD
        g.selectAll(".base-link")
          .attr("opacity", k < 0.5 ? 0 : k < 1.0 ? 0.15 : 0.3);
      });

    svg.call(zoom);
    zoomRef.current = zoom;

    // レイヤー構築（描画順 = 重なり順）
    g.append("g").attr("class", "layer-links");
    g.append("g").attr("class", "layer-focus-links");
    g.append("g").attr("class", "layer-clusters");
    g.append("g").attr("class", "layer-nodes");
    g.append("g").attr("class", "layer-knowledge");

    // ---- レイヤー1: baseLinks（常時表示、LODでopacity変化） ----
    g.select(".layer-links")
      .selectAll<SVGLineElement, GraphLink>("line.base-link")
      .data(baseLinks)
      .enter().append("line").attr("class", "base-link")
      .attr("x1", (d) => nodes.find((n) => n.id === d.sourceId)?.x ?? 0)
      .attr("y1", (d) => nodes.find((n) => n.id === d.sourceId)?.y ?? 0)
      .attr("x2", (d) => nodes.find((n) => n.id === d.targetId)?.x ?? 0)
      .attr("y2", (d) => nodes.find((n) => n.id === d.targetId)?.y ?? 0)
      .attr("stroke", "var(--border)")
      .attr("stroke-width", 0.5)
      .attr("opacity", 0.3);

    // ---- レイヤー3: クラスタ囲み円 + タグ名 ----
    const layerClusters = g.select(".layer-clusters");
    clusters.forEach((cluster) => {
      layerClusters.append("circle")
        .attr("class", "cluster-circle")
        .attr("cx", cluster.x).attr("cy", cluster.y).attr("r", cluster.r)
        .attr("fill", "none")
        .attr("stroke", "var(--border)")
        .attr("stroke-width", 0.5)
        .attr("stroke-dasharray", "4 3");

      layerClusters.append("text")
        .attr("class", "tag-label")
        .attr("x", cluster.x)
        .attr("y", cluster.y - cluster.r - 8)
        .attr("text-anchor", "middle")
        .attr("font-size", 16)
        .attr("font-weight", "500")
        .attr("fill", "var(--text-secondary)")
        .attr("pointer-events", "none")
        .text(cluster.tag);
    });

    // ---- レイヤー4: ノード ----
    const layerNodes = g.select(".layer-nodes");
    let pointerStart = { x: 0, y: 0 };

    const nodeGroups = layerNodes
      .selectAll<SVGGElement, GraphNode>("g.node-group")
      .data(nodes, (d) => d.id)
      .enter().append("g").attr("class", "node-group")
      .attr("transform", (d) => `translate(${d.x},${d.y})`)
      .attr("cursor", "pointer")
      .on("pointerdown", (event) => {
        pointerStart = { x: event.clientX, y: event.clientY };
      })
      .on("pointerup", (event, d) => {
        if (Math.hypot(event.clientX - pointerStart.x, event.clientY - pointerStart.y) <= 5) {
          event.stopPropagation();
          handleNodeTapRef.current(d);
        }
      });

    // ヒットエリア拡張（r + 12px 透明circle）
    nodeGroups.append("circle")
      .attr("r", (d) => d.r + 12)
      .attr("fill", "transparent")
      .attr("stroke", "none");

    // ノード円
    nodeGroups.append("circle")
      .attr("class", "node-circle")
      .attr("r", (d) => calcNodeRadius(d.connCount))
      .attr("fill", "var(--bg-secondary)")
      .attr("stroke", "var(--border)")
      .attr("stroke-width", 0.5);

    // graph_label（初期opacity:0 → LODで更新）
    nodeGroups.append("text")
      .attr("class", "node-label")
      .attr("text-anchor", "middle")
      .attr("dominant-baseline", "central")
      .attr("font-size", "10px")
      .attr("fill", "var(--text-secondary)")
      .attr("pointer-events", "none")
      .attr("opacity", 0)
      .text((d) => {
        const label = d.graphLabel || d.summary;
        return label.length > 7 ? label.slice(0, 7) + "…" : label;
      });

    // 背景タップ
    svg.on("click", (event) => {
      if (event.target === svgRef.current) handleBackgroundTapRef.current();
    });

    // 初期 fit-all（アニメーションなし）
    const xs = nodes.map((n) => n.x);
    const ys = nodes.map((n) => n.y);
    const minX = Math.min(...xs) - 60;
    const maxX = Math.max(...xs) + 60;
    const minY = Math.min(...ys) - 60;
    const maxY = Math.max(...ys) + 60;
    const contentW = maxX - minX;
    const contentH = maxY - minY;
    const initScale = Math.min(dimensions.width / contentW, dimensions.height / contentH, 1.2) * 0.9;
    const cx = (minX + maxX) / 2;
    const cy = (minY + maxY) / 2;
    const initTx = d3.zoomIdentity
      .translate(dimensions.width / 2 - cx * initScale, dimensions.height / 2 - cy * initScale)
      .scale(initScale);
    svg.call(zoom.transform, initTx);

  }, [nodes, clusters, baseLinks, dimensions]);

  // ==== フォーカス更新（focusedNodeId / knowledgeNodes 変更時） ====
  useEffect(() => {
    if (!svgRef.current || nodes.length === 0) return;
    const svg = d3.select(svgRef.current);
    const g = svg.select<SVGGElement>("g.canvas");
    if (g.empty()) return;

    // ノード円のstroke更新
    g.selectAll<SVGCircleElement, GraphNode>("circle.node-circle")
      .attr("stroke", (d) => d.id === focusedNodeId ? "var(--text-primary)" : "var(--border)")
      .attr("stroke-width", (d) => d.id === focusedNodeId ? 2 : 0.5);

    // ---- レイヤー2: フォーカスリンク更新 ----
    const layerFocusLinks = g.select(".layer-focus-links");
    layerFocusLinks.selectAll("*").remove();

    if (focusedNodeId) {
      const focusedNode = nodes.find((n) => n.id === focusedNodeId);
      if (focusedNode) {
        const focusConns = allConnections.filter((c) => {
          if (c.connection_type === "external_knowledge") return false;
          return (c.idea_from_id === focusedNodeId && c.idea_to_id) ||
                 c.idea_to_id === focusedNodeId;
        });

        focusConns.forEach((c) => {
          const targetId = c.idea_from_id === focusedNodeId ? c.idea_to_id! : c.idea_from_id;
          const targetNode = nodes.find((n) => n.id === targetId);
          if (!targetNode) return;
          const x1 = focusedNode.x, y1 = focusedNode.y;
          const x2 = targetNode.x, y2 = targetNode.y;
          const len = Math.hypot(x2 - x1, y2 - y1);

          layerFocusLinks.append("line")
            .attr("class", "focus-link")
            .attr("x1", x1).attr("y1", y1)
            .attr("x2", x2).attr("y2", y2)
            .attr("stroke", "var(--border-strong)")
            .attr("stroke-width", 1.5)
            .attr("stroke-dasharray", len)
            .attr("stroke-dashoffset", len)
            .transition().duration(800).ease(d3.easeCubicOut)
            .attr("stroke-dashoffset", 0);
        });
      }
    }

    // ---- レイヤー5: 外部知識ノード更新 ----
    const layerKnowledge = g.select(".layer-knowledge");
    layerKnowledge.selectAll("*").remove();

    if (knowledgeNodes.length > 0 && focusedNodeId) {
      const focusedNode = nodes.find((n) => n.id === focusedNodeId);

      // 外部知識への破線
      knowledgeLinks.forEach((kl) => {
        const kNode = knowledgeNodes.find((kn) => kn.id === kl.targetId);
        if (!focusedNode || !kNode) return;
        layerKnowledge.append("line")
          .attr("class", "knowledge-link")
          .attr("x1", focusedNode.x).attr("y1", focusedNode.y)
          .attr("x2", kNode.x).attr("y2", kNode.y)
          .attr("stroke", "var(--border)")
          .attr("stroke-width", 0.5)
          .attr("stroke-dasharray", "3 2")
          .attr("opacity", 0.5);
      });

      // 外部知識ノード
      let kPointerStart = { x: 0, y: 0 };
      const kGroups = layerKnowledge
        .selectAll<SVGGElement, GraphNode>("g.knowledge-group")
        .data(knowledgeNodes)
        .enter().append("g").attr("class", "knowledge-group")
        .attr("transform", (d) => `translate(${d.x},${d.y})`)
        .attr("cursor", "pointer")
        .on("pointerdown", (event) => { kPointerStart = { x: event.clientX, y: event.clientY }; })
        .on("pointerup", (event, d) => {
          if (Math.hypot(event.clientX - kPointerStart.x, event.clientY - kPointerStart.y) <= 5) {
            event.stopPropagation();
            handleNodeTapRef.current(d);
          }
        });

      kGroups.append("circle")
        .attr("r", 14)
        .attr("fill", "var(--bg-secondary)")
        .attr("stroke", "var(--border)")
        .attr("stroke-width", 0.5)
        .attr("stroke-dasharray", "3 2");

      kGroups.append("text")
        .attr("text-anchor", "middle")
        .attr("dominant-baseline", "central")
        .attr("font-size", "9px")
        .attr("fill", "var(--text-muted)")
        .attr("pointer-events", "none")
        .text((d) => {
          const t = d.knowledgeTitle ?? "";
          return t.length > 4 ? t.slice(0, 4) + "…" : t;
        });
    }
  }, [focusedNodeId, knowledgeNodes, knowledgeLinks, nodes, allConnections]);

  // ---- エンプティ ----
  if (allIdeas.length === 0) {
    return (
      <main className="flex flex-col h-dvh overflow-hidden animate-page-enter">
        <AppHeader />
        <div ref={containerRef} className="flex-1 flex flex-col items-center justify-center" style={{ paddingBottom: "20vh" }}>
          <svg width="80" height="80" viewBox="0 0 80 80" fill="none">
            <circle cx="40" cy="40" r="38" stroke="var(--border)" strokeWidth="0.5" />
            <circle cx="40" cy="40" r="24" stroke="var(--border)" strokeWidth="0.5" />
            <circle cx="40" cy="40" r="10" stroke="var(--border)" strokeWidth="0.5" />
          </svg>
          <span className="mt-4 text-xs" style={{ color: "var(--text-muted)", fontFamily: "var(--font-mono)" }}>0 nodes</span>
        </div>
      </main>
    );
  }

  return (
    <main className="flex flex-col h-dvh overflow-hidden animate-page-enter">
      <AppHeader
        rightContent={
          <button onClick={handleResetView} className="text-[11px]"
            style={{ color: "var(--text-muted)", fontFamily: "var(--font-mono)" }}>
            reset
          </button>
        }
      />

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
        onClick={(e) => { if (e.target === e.currentTarget) handleBackgroundTapRef.current(); }}>
        <svg ref={svgRef} className="absolute inset-0" />
      </div>

      {/* 詳細パネル */}
      {selectedNode && !combineResult && !combineMode && (
        <DetailPanel
          node={selectedNode}
          connectionId={!selectedNode.isKnowledge ? getConnectionId(selectedNode.id) : null}
          onDetail={() => { if (!selectedNode.isKnowledge) router.push(`/memo/${selectedNode.id}`); }}
          onDeepDive={(connId) => router.push(`/chat?connection=${connId}`)}
          onCombine={handleStartCombine}
        />
      )}

      {combineResult && (
        <CombinePanel
          result={combineResult}
          onDeepDive={(connId) => { setCombineResult(null); router.push(`/chat?connection=${connId}`); }}
          onClose={() => setCombineResult(null)}
        />
      )}
    </main>
  );
}
