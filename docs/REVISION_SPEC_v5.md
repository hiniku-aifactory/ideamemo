# REVISION SPEC v5 — 拡張グラフ + 深掘りチャット改善（詳細実装仕様）

> **実行者:** Claude Code (Sonnet)
> **前提:** 実装前に `CLAUDE.md` → `docs/DESIGN_v2.md` → 本ファイルの順に読むこと
> **v4との関係:** v4のグラフ実装（graph/page.tsx の d3 force simulation）を全面書き換え

---

## 全体方針

- 各§完了ごとに `FIX: §N [内容]` プレフィックスでコミット
- 各§完了時に `npx tsc --noEmit` でエラーなしを確認してから次へ
- MOCK_MODE=true のまま進める。外部API呼び出しはゼロ
- CSS custom properties（`var(--xxx)`）を使う。ハードコードした色コードは禁止
- アニメーション: `ease-out` 基本。bounce/spring/overshoot 禁止
- テキストトーン: 命令しない。提案しない。事実を端的に
- **コンポーネントは指示通りのファイルに分割すること。1ファイルに全部書かない**

---

## ファイル構成（最終状態）

```
src/app/graph/page.tsx                    ← §0 カードリスト（全面書き換え）
src/app/graph/explore/page.tsx            ← §1 拡張グラフビュー（新規）
src/components/graph/explore-view.tsx     ← §1 SVG描画ロジック（新規）
src/components/graph/detail-panel.tsx     ← §2 詳細パネル（新規）
src/components/graph/combine-panel.tsx    ← §2 combine結果パネル（新規）
src/lib/graph/layout.ts                  ← §1 幾何学配置計算（新規）
src/lib/graph/types.ts                   ← §1 グラフ用型定義（新規）
src/app/chat/page.tsx                    ← §3-4 チャット改善（変更）
src/components/chat/context-header.tsx   ← §3 コンテキストヘッダー（新規）
src/components/chat/suggest-buttons.tsx  ← §4 サジェストボタン（新規）
src/app/page.tsx                         ← §5 遷移先変更（変更）
CLAUDE.md                                ← §6 更新（変更）
```

---

## §0. グラフ画面 — カードリスト

**対象:** `src/app/graph/page.tsx`（全面書き換え）

v4の d3 force simulation コードを全て削除し、カードリスト画面に書き換える。

### 完全なコード

```tsx
"use client";

import { useState, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import { AppHeader } from "@/components/app-header";
import { mockDb } from "@/lib/mock/db";
import type { Idea, Connection } from "@/lib/types";

type SortMode = "connectivity" | "newest" | "oldest";

const SORT_LABELS: Record<SortMode, string> = {
  connectivity: "connectivity",
  newest: "newest",
  oldest: "oldest",
};

const SORT_ORDER: SortMode[] = ["connectivity", "newest", "oldest"];

function formatRelativeTime(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return "now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(dateStr).toLocaleDateString("ja-JP");
}

function getConnCount(ideaId: string, connections: Connection[]): number {
  return connections.filter(
    (c) => c.idea_from_id === ideaId || c.idea_to_id === ideaId
  ).length;
}

function getLabelChars(summary: string): string {
  return summary.slice(0, 3);
}

export default function GraphPage() {
  const router = useRouter();
  const [ideas, setIdeas] = useState<Idea[]>([]);
  const [connections, setConnections] = useState<Connection[]>([]);
  const [sortMode, setSortMode] = useState<SortMode>("connectivity");

  useEffect(() => {
    setIdeas(mockDb.ideas.list());
    setConnections(mockDb.connections.list());
  }, []);

  const totalLinks = useMemo(() => {
    return connections.filter((c) => c.idea_to_id).length;
  }, [connections]);

  const sortedIdeas = useMemo(() => {
    const list = [...ideas];
    switch (sortMode) {
      case "connectivity":
        return list.sort(
          (a, b) => getConnCount(b.id, connections) - getConnCount(a.id, connections)
        );
      case "newest":
        return list.sort(
          (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
        );
      case "oldest":
        return list.sort(
          (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
        );
    }
  }, [ideas, connections, sortMode]);

  const handleSortToggle = () => {
    const currentIndex = SORT_ORDER.indexOf(sortMode);
    const nextIndex = (currentIndex + 1) % SORT_ORDER.length;
    setSortMode(SORT_ORDER[nextIndex]);
  };

  if (ideas.length === 0) {
    return (
      <main className="flex flex-col h-dvh overflow-hidden animate-page-enter">
        <AppHeader />
        <div
          className="flex-1 flex flex-col items-center justify-center"
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
              fontFamily: "var(--font-mono)",
            }}
          >
            0 nodes
          </span>
        </div>
      </main>
    );
  }

  return (
    <main className="flex flex-col h-dvh overflow-hidden animate-page-enter">
      <AppHeader />
      <div className="flex-none flex items-center justify-between px-5 pb-3">
        <span
          className="text-[11px]"
          style={{ color: "var(--text-muted)", fontFamily: "var(--font-mono)" }}
        >
          {ideas.length} nodes · {totalLinks} links
        </span>
        <button
          onClick={handleSortToggle}
          className="text-[11px]"
          style={{ color: "var(--text-secondary)", fontFamily: "var(--font-mono)" }}
        >
          {SORT_LABELS[sortMode]} ▾
        </button>
      </div>
      <div className="flex-1 overflow-y-auto scrollbar-hide px-4 pb-24">
        <div className="space-y-2">
          {sortedIdeas.map((idea) => {
            const connCount = getConnCount(idea.id, connections);
            const maxDots = Math.min(connCount, 6);
            return (
              <button
                key={idea.id}
                onClick={() => router.push(`/graph/explore?root=${idea.id}`)}
                className="w-full flex items-center gap-3.5 p-3.5 rounded-xl text-left"
                style={{ background: "var(--bg-secondary)" }}
              >
                <div
                  className="flex-shrink-0 flex items-center justify-center rounded-full"
                  style={{
                    width: 44,
                    height: 44,
                    border: "0.5px solid var(--border)",
                    background: "var(--bg-primary)",
                  }}
                >
                  <span className="text-[11px]" style={{ color: "var(--text-secondary)" }}>
                    {getLabelChars(idea.summary)}
                  </span>
                </div>
                <div className="flex-1 min-w-0">
                  <p
                    className="text-[14px] font-medium truncate"
                    style={{ color: "var(--text-primary)" }}
                  >
                    {idea.summary}
                  </p>
                  <p
                    className="text-[11px] mt-0.5"
                    style={{ color: "var(--text-muted)", fontFamily: "var(--font-mono)" }}
                  >
                    {connCount} connections · {formatRelativeTime(idea.created_at)}
                  </p>
                </div>
                <div className="flex-shrink-0 flex gap-1">
                  {Array.from({ length: maxDots }).map((_, i) => (
                    <div
                      key={i}
                      className="rounded-full"
                      style={{ width: 6, height: 6, background: "var(--text-secondary)" }}
                    />
                  ))}
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </main>
  );
}
```

commit: `FIX: §0 グラフ — カードリスト画面`

---

## §1. 拡張グラフビュー

3ファイルを新規作成する。

### §1-1. `src/lib/graph/types.ts`

```typescript
import type { ConnectionType } from "@/lib/types";

export interface GraphNode {
  id: string;
  summary: string;
  keywords: string[];
  created_at: string;
  r: number;
  x: number;
  y: number;
  isKnowledge: boolean;
  knowledgeTitle?: string;
  knowledgeDescription?: string;
  knowledgeUrl?: string | null;
  parentIdeaId?: string;
  connectionType?: ConnectionType;
  connCount: number;
}

export interface GraphLink {
  id: string;
  sourceId: string;
  targetId: string;
  connectionType: ConnectionType | "knowledge_link";
}

export interface ExploreState {
  centerNodeId: string;
  expandedNodeIds: Set<string>;
  nodePositions: Map<string, { x: number; y: number }>;
  visibleNodes: GraphNode[];
  visibleLinks: GraphLink[];
}
```

### §1-2. `src/lib/graph/layout.ts`

```typescript
import type { GraphNode } from "./types";

const IDEA_DISTANCE = 140;
const KNOWLEDGE_DISTANCE = 100;
const BASE_R = 22;

export function layoutSatellites(
  centerX: number,
  centerY: number,
  count: number,
  distance: number,
  startAngleDeg: number = -90
): { x: number; y: number }[] {
  if (count === 0) return [];
  return Array.from({ length: count }, (_, i) => {
    const angleDeg = startAngleDeg + (360 / count) * i;
    const rad = (angleDeg * Math.PI) / 180;
    return {
      x: centerX + distance * Math.cos(rad),
      y: centerY + distance * Math.sin(rad),
    };
  });
}

export function layoutWithCollisionAvoidance(
  centerX: number,
  centerY: number,
  count: number,
  distance: number,
  existingNodes: GraphNode[]
): { x: number; y: number }[] {
  const minSeparation = BASE_R * 3;

  for (let attempt = 0; attempt < 3; attempt++) {
    const startAngle = -90 + attempt * 30;
    const extraDist = attempt * 20;
    const positions = layoutSatellites(
      centerX,
      centerY,
      count,
      distance + extraDist,
      startAngle
    );

    const hasCollision = positions.some((pos) =>
      existingNodes.some((existing) => {
        const dx = pos.x - existing.x;
        const dy = pos.y - existing.y;
        return Math.hypot(dx, dy) < minSeparation;
      })
    );

    if (!hasCollision) return positions;
  }

  return layoutSatellites(centerX, centerY, count, distance + 60, -90);
}

export function calcNodeRadius(connCount: number): number {
  return Math.min(28, BASE_R + connCount * 2);
}

export { IDEA_DISTANCE, KNOWLEDGE_DISTANCE, BASE_R };
```

### §1-3. `src/app/graph/explore/page.tsx`

```tsx
"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { ExploreView } from "@/components/graph/explore-view";

function ExploreInner() {
  const searchParams = useSearchParams();
  const rootId = searchParams.get("root");

  if (!rootId) {
    return (
      <main className="flex min-h-dvh items-center justify-center">
        <p className="text-sm" style={{ color: "var(--text-muted)" }}>
          No root node specified
        </p>
      </main>
    );
  }

  return <ExploreView rootId={rootId} />;
}

export default function ExplorePage() {
  return (
    <Suspense
      fallback={
        <main className="flex min-h-dvh items-center justify-center">
          <div
            className="h-8 w-8 rounded-full border-2 border-t-transparent animate-spin"
            style={{ borderColor: "var(--border)", borderTopColor: "transparent" }}
          />
        </main>
      }
    >
      <ExploreInner />
    </Suspense>
  );
}
```

### §1-4. `src/components/graph/explore-view.tsx`

**これが最も複雑なファイル。以下を正確に実装すること。**

```tsx
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
          id: expandedId, summary: idea.summary, keywords: idea.keywords,
          created_at: idea.created_at, r: expandedId === centerNodeId ? 42 : calcNodeRadius(connCount),
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
            id: neighborId, summary: neighborIdea.summary, keywords: neighborIdea.keywords,
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
            id: kId, summary: c.external_knowledge_title ?? "", keywords: [],
            created_at: c.created_at, r: 14, x: pos.x, y: pos.y,
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
        if (d.id === centerNodeId) return d.summary.length > 7 ? d.summary.slice(0, 7) + "…" : d.summary;
        if (d.isKnowledge) { const t = d.knowledgeTitle ?? ""; return t.length > 4 ? t.slice(0, 4) + "…" : t; }
        return d.summary.length > 5 ? d.summary.slice(0, 5) + "…" : d.summary;
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
```

commit: `FIX: §1 拡張グラフビュー`

---

## §2. 詳細パネル + combineパネル

### §2-1. `src/components/graph/detail-panel.tsx`

```tsx
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
          <p className="text-[13px] font-medium" style={{ color: "var(--text-primary)" }}>{node.summary}</p>
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
```

### §2-2. `src/components/graph/combine-panel.tsx`

```tsx
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
```

commit: `FIX: §2 詳細パネル+combine`

---

## §3. 深掘りチャット — コンテキストヘッダー

### §3-1. `src/components/chat/context-header.tsx`

```tsx
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { Idea, Connection } from "@/lib/types";

interface ContextHeaderProps {
  ideaFrom: Idea | null;
  ideaTo: Idea | null;
  connection: Connection | null;
}

export function ContextHeader({ ideaFrom, ideaTo, connection }: ContextHeaderProps) {
  const router = useRouter();
  const [expanded, setExpanded] = useState(false);

  if (!connection || !ideaFrom) return null;

  const reason = connection.reason || connection.external_knowledge_summary || "";

  return (
    <div className="mx-4 mb-2 rounded-lg overflow-hidden"
      style={{ background: "var(--bg-secondary)", position: "sticky", top: 0, zIndex: 10 }}>
      <button onClick={() => setExpanded(!expanded)} className="w-full text-left p-3">
        <div className="flex items-center gap-2">
          <button onClick={(e) => { e.stopPropagation(); router.push(`/memo/${ideaFrom.id}`); }}
            className="flex items-center gap-1.5 min-w-0">
            <div className="flex-shrink-0 rounded-full flex items-center justify-center"
              style={{ width: 22, height: 22, border: "0.5px solid var(--border)" }}>
              <span style={{ fontSize: 8, color: "var(--text-muted)" }}>○</span>
            </div>
            <span className="text-[13px] font-medium truncate" style={{ color: "var(--text-primary)" }}>
              {ideaFrom.summary.slice(0, 10)}
            </span>
          </button>
          <span className="text-[11px] flex-shrink-0" style={{ color: "var(--text-muted)" }}>←→</span>
          <span className="text-[13px] font-medium truncate" style={{ color: "var(--text-primary)" }}>
            {ideaTo ? ideaTo.summary.slice(0, 10) : connection.external_knowledge_title?.slice(0, 10) ?? ""}
          </span>
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none" className="flex-shrink-0 ml-auto">
            {expanded
              ? <path d="M3 9L7 5L11 9" stroke="var(--text-muted)" strokeWidth="0.7" strokeLinecap="round" strokeLinejoin="round" />
              : <path d="M3 5L7 9L11 5" stroke="var(--text-muted)" strokeWidth="0.7" strokeLinecap="round" strokeLinejoin="round" />
            }
          </svg>
        </div>
        {reason && (
          <p className={`text-[11px] mt-1.5 ${expanded ? "" : "line-clamp-1"}`}
            style={{ color: "var(--text-muted)", lineHeight: 1.6 }}>{reason}</p>
        )}
      </button>
    </div>
  );
}
```

### §3-2. `src/app/chat/page.tsx` への組み込み

**追加するimport:**
```tsx
import { ContextHeader } from "@/components/chat/context-header";
import type { Idea, Connection } from "@/lib/types";
```

**削除する state と JSX:**
- `const [contextExpanded, setContextExpanded] = useState(false);` — 削除
- `const [contextSummary, setContextSummary] = useState<string | null>(null);` — 削除
- `contextSummary` をセットしている全箇所 — 削除
- `{contextSummary && (...)}` のJSXブロック全体 — 削除

**追加する state:**
```tsx
const [contextIdeas, setContextIdeas] = useState<{
  from: Idea | null; to: Idea | null; connection: Connection | null;
}>({ from: null, to: null, connection: null });
```

**追加する useEffect（既存の初期化useEffectの後に追加）:**
```tsx
useEffect(() => {
  const cid = connectionId ?? (() => {
    if (!currentSessionId) return null;
    const session = mockDb.chatSessions.get(currentSessionId);
    return session?.connection_id ?? null;
  })();
  if (!cid) return;
  const conn = mockDb.connections.list().find((c) => c.id === cid) ?? null;
  const from = conn ? mockDb.ideas.get(conn.idea_from_id) ?? null : null;
  const to = conn?.idea_to_id ? mockDb.ideas.get(conn.idea_to_id) ?? null : null;
  setContextIdeas({ from, to, connection: conn });
}, [currentSessionId, connectionId]);
```

**JSX置き換え（メッセージ一覧scrollRefの直前）:**
```tsx
<ContextHeader ideaFrom={contextIdeas.from} ideaTo={contextIdeas.to} connection={contextIdeas.connection} />
```

commit: `FIX: §3 チャットコンテキストヘッダー`

---

## §4. 深掘りチャット — サジェスト質問ボタン

### §4-1. `src/components/chat/suggest-buttons.tsx`

```tsx
"use client";

interface SuggestButtonsProps {
  onSelect: (text: string) => void;
  type: "initial" | "followUp";
}

const SUGGEST_TEMPLATES = {
  initial: [
    { label: "構造", text: "この2つが繋がる根本の仕組みは何だろう？" },
    { label: "越境", text: "同じ構造が全く違う分野で起きてるとしたら、それは何？" },
    { label: "反転", text: "この関係性が逆転するケースってある？" },
  ],
  followUp: [
    { label: "深化", text: "今の話をもう一段掘り下げると、何が見える？" },
    { label: "応用", text: "これを自分の仕事や生活にどう活かせる？" },
  ],
} as const;

export function SuggestButtons({ onSelect, type }: SuggestButtonsProps) {
  const templates = SUGGEST_TEMPLATES[type];
  return (
    <div className="space-y-2 animate-page-enter">
      {templates.map((t) => (
        <button key={t.label} onClick={() => onSelect(t.text)}
          className="w-full text-left rounded-2xl px-4 py-2.5" style={{ background: "var(--bg-tertiary)" }}>
          <span className="text-[11px] font-medium" style={{ color: "var(--text-secondary)" }}>{t.label}</span>
          <span className="text-[11px]" style={{ color: "var(--text-secondary)" }}> </span>
          <span className="text-[13px]" style={{ color: "var(--text-body)" }}>{t.text}</span>
        </button>
      ))}
    </div>
  );
}
```

### §4-2. `src/app/chat/page.tsx` への組み込み

**追加するimport:**
```tsx
import { SuggestButtons } from "@/components/chat/suggest-buttons";
```

**追加するstate:**
```tsx
const [suggestDismissed, setSuggestDismissed] = useState(false);
const [followUpShown, setFollowUpShown] = useState(false);
const [followUpDismissed, setFollowUpDismissed] = useState(false);
```

**handleSend のリファクタ — sendMessage に分離:**

既存の `handleSend` の送信ロジックを `sendMessage` に抽出する。`handleSend` は `sendMessage` を呼ぶだけにする。

```tsx
const sendMessage = useCallback(async (text: string) => {
  if (!text.trim() || sending) return;
  setSending(true);
  setStreamingContent("");
  setMessages((prev) => [...prev, {
    id: crypto.randomUUID(), session_id: currentSessionId ?? "",
    role: "user" as const, content: text, created_at: new Date().toISOString(),
  }]);
  try {
    const response = await fetch("/api/chat", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sessionId: currentSessionId, message: text,
        context: connectionId ? { connectionId } : undefined }),
    });
    if (!response.body) return;
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const events = buffer.split("\n\n");
      buffer = events.pop() || "";
      for (const raw of events) {
        const eventMatch = raw.match(/event: (\w+)/);
        const dataMatch = raw.match(/data: ([\s\S]+)/);
        if (!eventMatch || !dataMatch) continue;
        const event = eventMatch[1];
        const data = JSON.parse(dataMatch[1]);
        if (event === "session") { setCurrentSessionId(data.sessionId); }
        else if (event === "delta") { setStreamingContent(data.content); }
        else if (event === "done") {
          setMessages((prev) => {
            const lastStreamed = mockDb.chatMessages
              .listBySession(currentSessionId ?? "").filter((m) => m.role === "assistant").pop();
            if (lastStreamed) {
              return [...prev, { id: lastStreamed.id, session_id: currentSessionId ?? "",
                role: "assistant" as const, content: lastStreamed.content, created_at: lastStreamed.created_at }];
            }
            return prev;
          });
          setStreamingContent("");
        }
      }
    }
  } catch (err) { console.error("Chat send error:", err); }
  finally { setSending(false); }
}, [sending, currentSessionId, connectionId]);

const handleSend = useCallback(() => {
  if (!input.trim()) return;
  const text = input.trim();
  setInput("");
  sendMessage(text);
}, [input, sendMessage]);

const handleSuggestSelect = useCallback((text: string) => {
  setSuggestDismissed(true);
  sendMessage(text);
}, [sendMessage]);

const handleFollowUpSelect = useCallback((text: string) => {
  setFollowUpDismissed(true);
  setFollowUpShown(false);
  sendMessage(text);
}, [sendMessage]);
```

**フォローアップ表示 useEffect:**
```tsx
useEffect(() => {
  const assistantCount = messages.filter((m) => m.role === "assistant").length;
  if (assistantCount >= 3 && !followUpShown && !followUpDismissed) {
    setFollowUpShown(true);
  }
}, [messages, followUpShown, followUpDismissed]);
```

**JSX配置（scrollRef内、メッセージリストの後ろ）:**

```tsx
{messages.map((msg) => (/* 既存のメッセージ表示 */))}
{streamingContent && (/* 既存のストリーミング表示 */)}
{sending && !streamingContent && (/* 既存のインジケーター */)}

{/* 初期サジェスト */}
{messages.length === 0 && connectionId && !suggestDismissed && (
  <SuggestButtons type="initial" onSelect={handleSuggestSelect} />
)}

{/* フォローアップサジェスト */}
{followUpShown && !followUpDismissed && !sending && (
  <SuggestButtons type="followUp" onSelect={handleFollowUpSelect} />
)}
```

commit: `FIX: §4 サジェスト質問ボタン`

---

## §5. ホーム画面 — 遷移先変更

**対象:** `src/app/page.tsx`

`src/app/page.tsx` 内で `/memo/` を検索し、**ノードプレビューのタップ**に使われている `router.push` を変更する:

**変更前:**
```tsx
router.push(`/memo/${pickedIdea.id}`);
```

**変更後:**
```tsx
router.push(`/graph/explore?root=${pickedIdea.id}`);
```

**注意:** メモ詳細への遷移が他にもある場合（接続カードの detail 等）はそちらは変更しない。ノードプレビュー（NodePreview SVGコンポーネント）のタップ部分のみ変更。

commit: `FIX: §5 ホーム→拡張グラフ遷移`

---

## §6. CLAUDE.md 更新

**対象:** `CLAUDE.md`

ビルド順序セクションの末尾に以下を追加:

```markdown
## ビルド順序（v5）

REVISION_SPEC_v5.md で以下を実行:
- §0: グラフ — カードリスト画面（graph/page.tsx 全面書き換え）
- §1: 拡張グラフビュー（graph/explore/page.tsx + explore-view.tsx + layout.ts + types.ts 新規）
- §2: 詳細パネル + combine（detail-panel.tsx + combine-panel.tsx 新規）
- §3: チャットコンテキストヘッダー（context-header.tsx 新規 + chat/page.tsx 変更）
- §4: サジェスト質問ボタン（suggest-buttons.tsx 新規 + chat/page.tsx 変更）
- §5: ホーム→拡張グラフ遷移（page.tsx 変更）
```

タスク仕様書セクションに追加:

```markdown
- `REVISION_SPEC_v5.md` (docs/) — 実行仕様書（v5: 拡張グラフ+チャット改善）
```

commit: `FIX: §6 CLAUDE.md更新`

---

## 品質チェックリスト（全§完了後）

### カードリスト（§0）
- [ ] グラフタブ → カードリストが表示
- [ ] 接続数多い順ソート（デフォルト）
- [ ] ソートトグル動作（connectivity→newest→oldest）
- [ ] 接続数ドット正しく表示（最大6個）
- [ ] カードタップ → `/graph/explore?root={id}`
- [ ] メモ0件 → エンプティステート
- [ ] d3 force simulationコードが完全削除

### 拡張グラフ（§1）
- [ ] rootノードが画面中央（r=42、太枠）
- [ ] 直接接続ideaが放射状配置
- [ ] external_knowledgeが破線円で表示
- [ ] 衛星タップ → 中央移動（600ms）
- [ ] タップ先の接続が追加展開
- [ ] **既存ノードが消えない**
- [ ] 複数ノード連続タップでグラフ拡大
- [ ] パン操作で画面移動
- [ ] ピンチ拡大縮小（0.3x〜3x）
- [ ] ←でカードリストに戻る
- [ ] タップとパン非競合（5px閾値）

### 詳細パネル+combine（§2）
- [ ] ideaタップ → パネル（summary+keywords+ボタン3つ）
- [ ] 外部知識タップ → 外部知識パネル
- [ ] 背景タップ → パネル閉じ
- [ ] detail → /memo/{id}
- [ ] deep dive → /chat?connection={connId}（接続ある場合のみ表示）
- [ ] combine → バナー+点滅インジケータ
- [ ] 2つ目タップ → API実行 → 結果パネル
- [ ] キャンセル: バナー/背景タップ

### チャットヘッダー（§3）
- [ ] 接続起点チャット → 上部にカード表示
- [ ] 元メモ+接続先summary表示
- [ ] ←→矢印
- [ ] 接続理由1行+▼展開
- [ ] 元メモタップ → /memo/{id}

### サジェスト（§4）
- [ ] 新規チャット（messages=0 + connectionId）→ 3ボタン
- [ ] タップ → 送信 → ボタン消える
- [ ] assistant 3回後 → フォローアップ2つ
- [ ] フォローアップタップ → 送信 → 消える
- [ ] 既存セッション復元時は非表示
- [ ] handleSendがsendMessageに分割済み

### ホーム（§5）
- [ ] ノードプレビュータップ → /graph/explore?root={id}

---

## 変更ファイル一覧

| ファイル | 操作 |
|---------|------|
| `src/lib/graph/types.ts` | **新規** |
| `src/lib/graph/layout.ts` | **新規** |
| `src/app/graph/page.tsx` | **全面書き換え** |
| `src/app/graph/explore/page.tsx` | **新規** |
| `src/components/graph/explore-view.tsx` | **新規** |
| `src/components/graph/detail-panel.tsx` | **新規** |
| `src/components/graph/combine-panel.tsx` | **新規** |
| `src/components/chat/context-header.tsx` | **新規** |
| `src/components/chat/suggest-buttons.tsx` | **新規** |
| `src/app/chat/page.tsx` | **変更** |
| `src/app/page.tsx` | **変更** |
| `CLAUDE.md` | **変更** |
