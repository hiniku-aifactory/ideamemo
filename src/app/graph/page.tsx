"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import * as d3 from "d3";
import { GitBranch, Loader2 } from "lucide-react";
import { mockDb } from "@/lib/mock/db";
import { BottomSheet } from "@/components/bottom-sheet";
import type { Idea, Connection } from "@/lib/types";

type FilterRange = "all" | "7d" | "30d";

interface GraphNode extends d3.SimulationNodeDatum {
  id: string;
  summary: string;
  keywords: string[];
  created_at: string;
  r: number;
}

interface GraphLink extends d3.SimulationLinkDatum<GraphNode> {
  id: string;
  connection_type: string;
  source_type: string;
}

export default function GraphPage() {
  const router = useRouter();
  const svgRef = useRef<SVGSVGElement>(null);
  const [ideas, setIdeas] = useState<Idea[]>([]);
  const [connections, setConnections] = useState<Connection[]>([]);
  const [filter, setFilter] = useState<FilterRange>("all");
  const [selectedNode, setSelectedNode] = useState<GraphNode | null>(null);
  const [combineMode, setCombineMode] = useState(false);
  const [combineNodeA, setCombineNodeA] = useState<GraphNode | null>(null);
  const [combineResult, setCombineResult] = useState<{
    connection: Connection;
    ideaA: { summary: string };
    ideaB: { summary: string };
  } | null>(null);
  const [combineLoading, setCombineLoading] = useState(false);

  useEffect(() => {
    setIdeas(mockDb.ideas.list());
    setConnections(mockDb.connections.list());
  }, []);

  // フィルタ適用
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

  // D3 グラフ描画
  useEffect(() => {
    if (!svgRef.current || filteredIdeas.length === 0) return;

    const svg = d3.select(svgRef.current);
    svg.selectAll("*").remove();

    const width = svgRef.current.clientWidth;
    const height = svgRef.current.clientHeight;

    const g = svg.append("g");

    // ズーム/パン
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
      r: Math.min(20, 10 + idea.keywords.length * 2),
    }));

    // リンクデータ（idea_to_idがあるもののみ）
    const nodeIds = new Set(nodes.map((n) => n.id));
    const links: GraphLink[] = filteredConnections
      .filter((c) => c.idea_to_id && nodeIds.has(c.idea_from_id) && nodeIds.has(c.idea_to_id!))
      .map((c) => ({
        id: c.id,
        source: c.idea_from_id,
        target: c.idea_to_id!,
        connection_type: c.connection_type,
        source_type: c.source,
      }));

    // Force simulation
    const simulation = d3.forceSimulation(nodes)
      .force("charge", d3.forceManyBody().strength(-80))
      .force("center", d3.forceCenter(width / 2, height / 2))
      .force("collision", d3.forceCollide().radius(30))
      .force("link", d3.forceLink<GraphNode, GraphLink>(links).id((d) => d.id).distance(80));

    // エッジ描画
    const link = g.selectAll<SVGLineElement, GraphLink>("line")
      .data(links)
      .enter()
      .append("line")
      .attr("stroke", (d) => d.connection_type === "combination" ? "var(--accent)" : "var(--accent)")
      .attr("stroke-opacity", (d) => d.connection_type === "combination" ? 0.5 : 0.3)
      .attr("stroke-width", 1)
      .attr("stroke-dasharray", (d) => d.connection_type === "combination" ? "4 4" : "none");

    // ノード描画
    const node = g.selectAll<SVGCircleElement, GraphNode>("circle")
      .data(nodes)
      .enter()
      .append("circle")
      .attr("r", (d) => d.r)
      .attr("fill", "var(--bg-secondary)")
      .attr("stroke", "var(--border)")
      .attr("stroke-width", 1.5)
      .attr("cursor", "pointer")
      .on("click", (_event, d) => {
        if (combineMode && combineNodeA) {
          handleCombineSelect(d);
        } else {
          setSelectedNode(d);
        }
      });

    // tick
    simulation.on("tick", () => {
      link
        .attr("x1", (d) => (d.source as GraphNode).x ?? 0)
        .attr("y1", (d) => (d.source as GraphNode).y ?? 0)
        .attr("x2", (d) => (d.target as GraphNode).x ?? 0)
        .attr("y2", (d) => (d.target as GraphNode).y ?? 0);

      node
        .attr("cx", (d) => d.x ?? 0)
        .attr("cy", (d) => d.y ?? 0);
    });

    // 微動アニメーション
    let animId: number;
    function animate() {
      const t = Date.now() / 1000;
      node.each(function (d, i) {
        const el = d3.select(this);
        const baseX = d.x ?? 0;
        const baseY = d.y ?? 0;
        el.attr("cx", baseX + Math.sin(t * 0.8 + i) * 0.3)
          .attr("cy", baseY + Math.cos(t * 0.6 + i * 1.3) * 0.3);
      });
      animId = requestAnimationFrame(animate);
    }

    // simulationが落ち着いてから微動開始
    simulation.on("end", () => {
      animate();
    });

    return () => {
      simulation.stop();
      if (animId) cancelAnimationFrame(animId);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filteredIdeas, filteredConnections, combineMode, combineNodeA]);

  const handleCombineSelect = useCallback(async (nodeB: GraphNode) => {
    if (!combineNodeA || combineNodeA.id === nodeB.id) return;

    setCombineMode(false);
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
      // 接続リスト更新
      setConnections(mockDb.connections.list());
    } catch (err) {
      console.error("Combine error:", err);
    } finally {
      setCombineLoading(false);
      setCombineNodeA(null);
    }
  }, [combineNodeA]);

  const startCombine = (node: GraphNode) => {
    setCombineNodeA(node);
    setCombineMode(true);
    setSelectedNode(null);
  };

  const nodeConnectionCount = selectedNode
    ? connections.filter(
        (c) => c.idea_from_id === selectedNode.id || c.idea_to_id === selectedNode.id
      ).length
    : 0;

  // エンプティステート
  if (ideas.length === 0) {
    return (
      <main className="flex flex-col min-h-dvh animate-page-enter">
        <header
          className="flex items-center justify-between px-6 pb-3"
          style={{ paddingTop: "calc(12px + env(safe-area-inset-top))" }}
        >
          <h1
            className="text-lg font-light"
            style={{
              fontFamily: "var(--font-noto-serif-jp), 'Noto Serif JP', serif",
              color: "var(--text-primary)",
            }}
          >
            グラフ
          </h1>
        </header>
        <div className="flex-1 flex flex-col items-center justify-center" style={{ paddingBottom: "20vh" }}>
          <GitBranch size={48} style={{ color: "var(--accent)", opacity: 0.5 }} />
          <p className="mt-4 text-sm" style={{ color: "var(--text-secondary)" }}>
            まだメモがありません
          </p>
          <p className="mt-2 text-xs text-center" style={{ color: "var(--text-muted)" }}>
            最初のメモを録音すると
            <br />
            ここにあなたの思考の地図が表示されます
          </p>
        </div>
      </main>
    );
  }

  return (
    <main className="flex flex-col min-h-dvh animate-page-enter">
      {/* Header */}
      <header
        className="flex items-center justify-between px-6 pb-3"
        style={{ paddingTop: "calc(12px + env(safe-area-inset-top))" }}
      >
        <h1
          className="text-lg font-light"
          style={{
            fontFamily: "var(--font-noto-serif-jp), 'Noto Serif JP', serif",
            color: "var(--text-primary)",
          }}
        >
          グラフ
        </h1>
        <div className="flex gap-3">
          {(["all", "7d", "30d"] as FilterRange[]).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className="text-xs"
              style={{
                color: filter === f ? "var(--accent)" : "var(--text-secondary)",
                textDecoration: filter === f ? "underline" : "none",
                textUnderlineOffset: "3px",
              }}
            >
              {f === "all" ? "すべて" : f === "7d" ? "7日" : "30日"}
            </button>
          ))}
        </div>
      </header>

      {/* 掛け合わせモードバナー */}
      {combineMode && (
        <div
          className="mx-4 mb-2 py-2 rounded-lg text-center text-sm"
          style={{ background: "var(--accent)", color: "#0A0A0A" }}
        >
          2つ目のメモをタップしてください
        </div>
      )}

      {/* 掛け合わせローディング */}
      {combineLoading && (
        <div className="flex items-center justify-center gap-2 py-3">
          <Loader2 size={16} className="animate-spin" style={{ color: "var(--accent)" }} />
          <span className="text-sm" style={{ color: "var(--text-muted)" }}>アイデアを生成中...</span>
        </div>
      )}

      {/* SVG */}
      <div className="flex-1 relative">
        <svg
          ref={svgRef}
          className="w-full h-full"
          style={{ touchAction: "none" }}
        />
      </div>

      {/* 凡例 + カウンター */}
      <div className="px-6 pb-24">
        <div className="flex items-center gap-4 mb-1">
          <div className="flex items-center gap-1">
            <div className="w-4 h-px" style={{ background: "var(--accent)", opacity: 0.3 }} />
            <span className="text-[10px]" style={{ color: "var(--text-muted)" }}>AI接続</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-4 h-px" style={{ background: "var(--accent)", opacity: 0.5, borderTop: "1px dashed var(--accent)" }} />
            <span className="text-[10px]" style={{ color: "var(--text-muted)" }}>掛け合わせ</span>
          </div>
        </div>
        <p
          className="text-xs"
          style={{
            color: "var(--text-muted)",
            fontFamily: "var(--font-jetbrains-mono), 'JetBrains Mono', monospace",
          }}
        >
          {filteredIdeas.length}メモ  {filteredConnections.filter((c) => c.idea_to_id).length}つながり
        </p>
      </div>

      {/* ノード詳細ボトムシート */}
      <BottomSheet open={!!selectedNode} onClose={() => setSelectedNode(null)}>
        {selectedNode && (
          <div>
            <p className="text-base" style={{ color: "var(--text-primary)" }}>
              {selectedNode.summary}
            </p>
            <div className="flex flex-wrap gap-1.5 mt-2">
              {selectedNode.keywords.map((kw) => (
                <span
                  key={kw}
                  className="text-[11px] px-2 py-0.5 rounded-full"
                  style={{ background: "var(--accent)", color: "#0A0A0A" }}
                >
                  {kw}
                </span>
              ))}
            </div>
            <p className="text-xs mt-2" style={{ color: "var(--text-secondary)" }}>
              つながり: {nodeConnectionCount}件
            </p>
            <div className="flex gap-3 mt-4">
              <button
                onClick={() => {
                  setSelectedNode(null);
                  router.push(`/memo/${selectedNode.id}`);
                }}
                className="flex-1 py-2 rounded-lg text-sm"
                style={{ background: "var(--bg-tertiary)", color: "var(--text-primary)" }}
              >
                詳細を見る
              </button>
              <button
                onClick={() => startCombine(selectedNode)}
                className="flex-1 py-2 rounded-lg text-sm"
                style={{ background: "var(--accent)", color: "#0A0A0A" }}
              >
                掛け合わせ
              </button>
            </div>
          </div>
        )}
      </BottomSheet>

      {/* 掛け合わせ結果ボトムシート */}
      <BottomSheet open={!!combineResult} onClose={() => setCombineResult(null)}>
        {combineResult && (
          <div>
            <p className="text-base font-medium" style={{ color: "var(--accent)" }}>
              掛け合わせアイデア
            </p>
            <div className="flex items-center gap-2 mt-3">
              <div className="flex-1 p-2 rounded-lg text-xs" style={{ background: "var(--bg-tertiary)", color: "var(--text-primary)" }}>
                {combineResult.ideaA.summary}
              </div>
              <span className="text-xs" style={{ color: "var(--text-muted)" }}>+</span>
              <div className="flex-1 p-2 rounded-lg text-xs" style={{ background: "var(--bg-tertiary)", color: "var(--text-primary)" }}>
                {combineResult.ideaB.summary}
              </div>
            </div>
            <p className="mt-3 text-sm leading-relaxed" style={{ color: "var(--text-primary)", lineHeight: 1.7 }}>
              {combineResult.connection.reason}
            </p>
            <div className="mt-3">
              <p className="text-xs font-medium mb-1" style={{ color: "var(--accent-dim)" }}>TRY THIS</p>
              <p className="text-sm" style={{ color: "var(--text-secondary)" }}>
                {combineResult.connection.action_suggestion}
              </p>
            </div>
            <div className="flex gap-3 mt-4">
              <button
                onClick={() => setCombineResult(null)}
                className="flex-1 py-2 rounded-lg text-sm"
                style={{ background: "var(--bg-tertiary)", color: "var(--text-primary)" }}
              >
                閉じる
              </button>
              <button
                onClick={() => {
                  setCombineResult(null);
                  router.push(`/chat?connection=${combineResult.connection.id}`);
                }}
                className="flex-1 py-2 rounded-lg text-sm"
                style={{ background: "var(--accent)", color: "#0A0A0A" }}
              >
                深掘り
              </button>
            </div>
          </div>
        )}
      </BottomSheet>
    </main>
  );
}
