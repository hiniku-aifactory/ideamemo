# REVISION SPEC v5 — 全面改修（タグクラスタグラフ + チャット改善 + 録音結果刷新）

> **実行者:** Claude Code (Sonnet)
> **前提:** 実装前に `CLAUDE.md` → `docs/DESIGN_v2.md` → 本ファイルの順に読むこと
> **コンポーネントは指示通りのファイルに分割すること。1ファイルに全部書かない**

---

## 全体方針

- 各§完了ごとに `FIX: §N [内容]` プレフィックスでコミット
- 各§完了時に `npx tsc --noEmit` でエラーなしを確認してから次へ
- MOCK_MODE=true のまま。外部API呼び出しゼロ
- CSS custom properties（`var(--xxx)`）のみ使う。ハードコードした色コードは禁止
- アニメーション: `ease-out` 基本。bounce/spring/overshoot 禁止
- テキストトーン: 命令しない。提案しない。事実を端的に

---

## ファイル構成（最終状態）

```
src/lib/types.ts                          ← §0 変更
src/lib/mock/seed.ts                      ← §0 変更
src/lib/graph/types.ts                    ← §0 新規
src/lib/graph/layout.ts                   ← §1 新規
src/app/graph/page.tsx                    ← §1-§4 全面書き換え（タグクラスタ→展開→拡張すべて同一画面）
src/components/graph/tag-cluster.tsx      ← §1 新規
src/components/graph/explore-view.tsx     ← §2-§3 新規
src/components/graph/detail-panel.tsx     ← §4 新規
src/components/graph/combine-panel.tsx    ← §4 新規
src/components/graph/breadcrumb.tsx       ← §5 新規
src/components/chat/context-header.tsx    ← §6 新規
src/components/chat/suggest-buttons.tsx   ← §7 新規
src/components/knowledge-card.tsx         ← §8 変更
src/app/memo/[id]/page.tsx               ← §8 変更
src/app/record/page.tsx                  ← §9 変更
src/lib/quotes.ts                        ← §9 参照のみ
src/app/page.tsx                         ← §10 変更
CLAUDE.md                                ← §11 変更
```

---

## §0. types.ts + seed data 拡張

### §0-1. `src/lib/types.ts` 変更

`Idea` interface に2フィールド追加:

```typescript
export interface Idea {
  // ...既存フィールドすべて維持...
  source: IdeaSource;
  parent_session_id: string | null;
  graph_label: string;    // NEW: 抽象ラベル（7文字以内）。グラフノード表示用
  tags: string[];          // NEW: カテゴリタグ配列。先頭がメインタグ。AIが自動付与
}
```

### §0-2. `src/lib/graph/types.ts` 新規

```typescript
import type { ConnectionType } from "@/lib/types";

export interface GraphNode {
  id: string;
  summary: string;
  graphLabel: string;
  keywords: string[];
  tags: string[];
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

export interface TagCluster {
  tag: string;
  nodeCount: number;
  ideaIds: string[];
  x: number;
  y: number;
  r: number;
}
```

### §0-3. `src/lib/mock/seed.ts` 変更

全 SEED_IDEAS に `graph_label` と `tags` を追加。以下の値を使うこと:

```typescript
// idea-001: 通勤ラッシュ
graph_label: "合理性の罠",
tags: ["行動設計", "集団心理"],

// idea-002: 混雑空間
graph_label: "密度の逆説",
tags: ["空間設計", "行動設計"],

// idea-003: 会議の沈黙
graph_label: "最初の一歩",
tags: ["集団心理", "行動設計"],

// idea-004: 説明のギャップ
graph_label: "理解と伝達",
tags: ["認知構造", "コミュニケーション"],

// idea-005: 制約と創造性
graph_label: "制約の触媒",
tags: ["創造プロセス"],

// idea-006: 視点変換
graph_label: "角度の力",
tags: ["認知構造", "創造プロセス"],

// idea-007: パーソナライズの罠
graph_label: "最適化の罠",
tags: ["情報設計", "行動設計"],

// idea-008: コンビニ動線
graph_label: "配置の支配",
tags: ["空間設計", "行動設計"],

// idea-009: データとストーリー
graph_label: "物語の力",
tags: ["コミュニケーション"],

// idea-010: 情報遮断
graph_label: "引き算の知覚",
tags: ["認知構造"],

// idea-011: 教えることで学ぶ
graph_label: "説明の鏡",
tags: ["認知構造", "コミュニケーション"],

// idea-012: アクセスの悪さ
graph_label: "障壁の価値",
tags: ["情報設計"],

// idea-013: 計画なしの創作
graph_label: "偶然の設計",
tags: ["創造プロセス"],
```

タグ一覧（5種）:
- 行動設計（4件）
- 集団心理（2件）
- 認知構造（4件）
- 空間設計（2件）
- 創造プロセス（3件）
- コミュニケーション（3件）
- 情報設計（2件）

※ 1つのメモが複数タグに属する（多属性）

commit: `FIX: §0 types拡張+seed data（graph_label/tags追加）`

---

## §1. グラフ画面 — タグクラスタ（Level 1）+ 配置ロジック

### §1-1. `src/lib/graph/layout.ts` 新規

```typescript
import type { GraphNode, TagCluster } from "./types";

const IDEA_DISTANCE = 140;
const KNOWLEDGE_DISTANCE = 100;
const BASE_R = 22;
const TAG_CLUSTER_DISTANCE = 160;

export function layoutTagClusters(
  tags: TagCluster[],
  centerX: number,
  centerY: number,
): TagCluster[] {
  if (tags.length === 0) return [];
  return tags.map((tag, i) => {
    const angleDeg = -90 + (360 / tags.length) * i;
    const rad = (angleDeg * Math.PI) / 180;
    const dist = tags.length <= 3 ? TAG_CLUSTER_DISTANCE * 0.8 : TAG_CLUSTER_DISTANCE;
    return {
      ...tag,
      x: centerX + dist * Math.cos(rad),
      y: centerY + dist * Math.sin(rad),
      r: Math.max(40, 30 + tag.nodeCount * 6),
    };
  });
}

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
    const positions = layoutSatellites(centerX, centerY, count, distance + extraDist, startAngle);
    const hasCollision = positions.some((pos) =>
      existingNodes.some((existing) => Math.hypot(pos.x - existing.x, pos.y - existing.y) < minSeparation)
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

### §1-2. グラフ画面の構造

**重要:** グラフ画面はカードリストではない。1つのSVGキャンバスに Level 1 → Level 2 → Level 3 がすべて展開される。

`src/app/graph/page.tsx` を全面書き換え。以下の3段階がすべて1画面で起きる:

- **Level 1（初期表示）:** タグクラスタ（大きい円にタグ名+ノード数）。中のノードがうっすら点で透けて見える
- **Level 2（タグタップ）:** そのタグのノードが放射状に展開。ノード内テキスト=graph_label。他タグへの薄い線（cross-tag）
- **Level 3（ノードタップ）:** そのノードが中央化。接続先+外部知識が枝で広がる

### §1-3. `src/app/graph/page.tsx` 全面書き換え

```tsx
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

    // クロスタグの線: このタグ内ノード同士の接続 + 他タグへの接続（薄い線）
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
    // バイブ
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
      // タグに戻る
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
        // 探索起点は二重線
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
    // scale < 0.7 → ラベル非表示。scale >= 0.7 → 表示
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

      // 外部知識ラベル（フォーカス中のみテキスト、それ以外は点のみ）
      nodeGroup.filter((d) => d.isKnowledge).append("text")
        .attr("text-anchor", "middle").attr("dominant-baseline", "central")
        .attr("font-size", "9px").attr("fill", "#BBBBBB").attr("pointer-events", "none")
        .text((d) => {
          // 選択中ノードに紐づく外部知識のみテキスト表示
          if (d.parentIdeaId === centerNodeId) {
            const t = d.knowledgeTitle ?? "";
            return t.length > 4 ? t.slice(0, 4) + "…" : t;
          }
          return ""; // フォーカス外は空（点だけ見える）
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
```

commit: `FIX: §1-§4 グラフ全面書き換え（タグクラスタ→展開→拡張+詳細パネル+combine）`

---

## §5. パンくず + 実装ガイドライン

### §5-1. `src/components/graph/breadcrumb.tsx` 新規

```tsx
"use client";

interface BreadcrumbProps {
  items: string[];
  onTap: (index: number) => void;
}

export function Breadcrumb({ items, onTap }: BreadcrumbProps) {
  return (
    <div className="flex-none flex items-center gap-1.5 px-5 pb-2 overflow-x-auto scrollbar-hide">
      {items.map((item, i) => (
        <span key={i} className="flex items-center gap-1.5 flex-shrink-0">
          {i > 0 && <span className="text-[10px]" style={{ color: "var(--text-hint)" }}>›</span>}
          <button
            onClick={() => onTap(i)}
            className="text-[11px]"
            style={{
              color: i === items.length - 1 ? "var(--text-primary)" : "var(--text-muted)",
              fontWeight: i === items.length - 1 ? 500 : 400,
            }}
          >
            {item}
          </button>
        </span>
      ))}
    </div>
  );
}
```

### §5-2. detail-panel.tsx, combine-panel.tsx

前回のspec（§2のコード）をそのまま使用。`GraphNode` の `graphLabel` フィールドを参照するように summary 表示を調整:

detail-panel.tsx のsummary表示行を変更:
```tsx
// 変更前: {node.summary}
// 変更後:
{node.graphLabel || node.summary}
```

subtitle として summary を表示（graph_labelと異なる場合のみ）:
```tsx
{node.graphLabel && node.graphLabel !== node.summary && (
  <p className="text-[11px] mt-0.5" style={{ color: "var(--text-muted)" }}>
    {node.summary.slice(0, 30)}{node.summary.length > 30 ? "…" : ""}
  </p>
)}
```

### §5-3. 実装ガイドライン（graph/page.tsx内で適用済み、確認用）

以下はコード内に既に反映されているが、レビュー時のチェックポイント:

**空間恒常性:** 展開済みノードの位置は再計算しない（`existingPositions` で保持）。Level間遷移は600ms ease-outアニメーション。「reset」ボタンでタグクラスタに戻れる

**インタラクション閾値:** 5px閾値。ヒットエリアは見た目のr+12pxの透明circle。`navigator.vibrate(10)` をタップ時に実行

**意味的ズーム:** scale < 0.7 でラベル非表示。フォーカス外の外部知識は点のみ（`parentIdeaId === centerNodeId` で判定）

**コンテキスト維持:** 探索起点ノードはstroke-width: 2で強調。パンくずで現在パス表示。タップで前の階層に戻れる

commit: `FIX: §5 パンくず+ガイドライン適用`

---

## §6. 深掘りチャット — コンテキストヘッダー

`src/components/chat/context-header.tsx` 新規。前回specのコードをそのまま使用。

`src/app/chat/page.tsx` の変更:
- `contextExpanded`, `contextSummary` state を削除
- `contextIdeas` state を追加
- useEffect でconnection/ideaデータを取得
- JSXの既存contextSummaryブロックを `<ContextHeader>` に置き換え

**変更の詳細は前回specの§3をそのまま実行すること。**

commit: `FIX: §6 チャットコンテキストヘッダー`

---

## §7. 深掘りチャット — サジェスト質問ボタン

`src/components/chat/suggest-buttons.tsx` 新規。前回specのコードをそのまま使用。

`src/app/chat/page.tsx` の変更:
- `handleSend` を `sendMessage` に分離
- `suggestDismissed`, `followUpShown`, `followUpDismissed` state追加
- 初期サジェスト（messages.length === 0 かつ connectionId あり）
- フォローアップ（assistant 3回後）

**変更の詳細は前回specの§4をそのまま実行すること。**

commit: `FIX: §7 サジェスト質問ボタン`

---

## §8. メモ詳細 — 全接続カードから深掘り可能

### §8-1. `src/components/knowledge-card.tsx` 変更

propsに `onDeepDive` を追加:

```typescript
interface Props {
  title: string;
  description: string;
  sourceUrl?: string | null;
  sourceTitle?: string | null;
  bookmarked?: boolean;
  onBookmark?: () => void;
  connectionId?: string;       // NEW
  onDeepDive?: (connId: string) => void;  // NEW
}
```

ブックマークボタンの隣に「深掘り」リンクを追加:

```tsx
<div className="flex items-center justify-between mt-2">
  <div className="flex items-center gap-3">
    {sourceUrl ? (
      <a href={sourceUrl} target="_blank" rel="noopener noreferrer"
        className="text-[10px]" style={{ color: "var(--accent)" }}>
        {sourceTitle || sourceUrl} ↗
      </a>
    ) : sourceTitle ? (
      <span className="text-[10px]" style={{ color: "var(--text-muted)" }}>{sourceTitle}</span>
    ) : <span />}

    {/* NEW: 深掘りリンク */}
    {connectionId && onDeepDive && (
      <button onClick={() => onDeepDive(connectionId)}
        className="text-[10px]" style={{ color: "var(--accent)" }}>
        深掘り →
      </button>
    )}
  </div>

  <button onClick={handleBookmark}
    className="flex-shrink-0 transition-transform active:scale-[1.15]"
    style={{ transition: "transform 200ms ease-out" }}>
    <BookmarkHeart filled={isBookmarked} />
  </button>
</div>
```

### §8-2. `src/app/memo/[id]/page.tsx` 変更

KnowledgeCard に connectionId と onDeepDive を渡す:

```tsx
// 変更前
<KnowledgeCard key={conn.id} title={conn.external_knowledge_title ?? ""} ... />

// 変更後
<KnowledgeCard key={conn.id}
  title={conn.external_knowledge_title ?? ""}
  description={conn.external_knowledge_summary ?? ""}
  sourceUrl={conn.external_knowledge_url}
  sourceTitle={conn.external_knowledge_title}
  bookmarked={conn.bookmarked ?? false}
  onBookmark={() => { fetch(`/api/connections/${conn.id}/bookmark`, { method: "POST" }); }}
  connectionId={conn.id}
  onDeepDive={(connId) => router.push(`/chat?connection=${connId}`)}
/>
```

commit: `FIX: §8 メモ詳細 — 全接続カードに深掘りボタン追加`

---

## §9. 録音結果画面の刷新

**対象:** `src/app/record/page.tsx` の結果表示部分を書き換え

### 変更概要

現状: 文字起こし→構造化→カードが順に `animate-page-enter` で出る。名言なし。

変更後:
1. 録音停止 → 文字起こしがフェードイン
2. その下に「↓」矢印（具体→抽象の変換を示す）
3. 構造化結果（summary + abstract_principle）がフェードイン
4. その下に名言+「同じ構造を探しています」+3ドットpulse
5. 3件揃ったら名言フェードアウト → カード①②③が上から順にフェードイン（各400ms間隔）

### 結果表示JSXの書き換え

`{isProcessing && (...)}` 内のJSXを以下に置き換え:

```tsx
{isProcessing && (
  <div className="flex-1 overflow-y-auto px-5 pb-4 space-y-5">
    {/* Phase 1: 文字起こし */}
    {result.transcript && (
      <section className="animate-page-enter">
        <p className="text-[13px] leading-relaxed"
          style={{ color: "var(--text-primary)", lineHeight: 1.8 }}>
          {result.transcript}
        </p>
      </section>
    )}

    {/* ↓矢印（具体→抽象の変換表示） */}
    {result.transcript && result.structured && (
      <div className="flex justify-center animate-page-enter">
        <svg width="20" height="32" viewBox="0 0 20 32" fill="none">
          <path d="M10 2 L10 24 M4 18 L10 24 L16 18"
            stroke="var(--text-hint)" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </div>
    )}

    {/* Phase 2: 構造化（抽象原則を強調） */}
    {result.structured && (
      <section className="animate-page-enter">
        <p className="text-[15px] font-semibold"
          style={{ color: "var(--text-primary)" }}>
          {result.structured.summary}
        </p>
        <div className="flex flex-wrap gap-1.5 mt-2">
          {result.structured.keywords.map((kw) => (
            <span key={kw} className="text-[10px] px-2 py-0.5 rounded"
              style={{ border: "0.5px solid var(--border)", color: "var(--text-muted)" }}>
              {kw}
            </span>
          ))}
        </div>
        {result.structured.abstract_principle && (
          <p className="mt-3 text-[14px] font-medium"
            style={{ color: "var(--text-primary)" }}>
            {result.structured.abstract_principle}
          </p>
        )}
      </section>
    )}

    {/* Phase 3: 名言ローディング（接続検索中） */}
    {result.structured && phase !== "done" && phase !== "error" && showConnectionCount === 0 && (
      <section className="animate-page-enter text-center py-6">
        <p className="text-[13px] italic"
          style={{ color: "var(--text-secondary)", lineHeight: 1.8 }}>
          "{randomQuote.ja || randomQuote.text}"
        </p>
        <p className="text-[10px] mt-1" style={{ color: "var(--text-muted)" }}>
          — {randomQuote.author}
        </p>
        <div className="flex justify-center gap-1 mt-4">
          <span className="w-1.5 h-1.5 rounded-full animate-pulse"
            style={{ background: "var(--text-muted)" }} />
          <span className="w-1.5 h-1.5 rounded-full animate-pulse"
            style={{ background: "var(--text-muted)", animationDelay: "0.2s" }} />
          <span className="w-1.5 h-1.5 rounded-full animate-pulse"
            style={{ background: "var(--text-muted)", animationDelay: "0.4s" }} />
        </div>
        <p className="text-[10px] mt-2"
          style={{ color: "var(--text-hint)", fontFamily: "var(--font-mono)" }}>
          同じ構造を探しています
        </p>
      </section>
    )}

    {/* Phase 4: 接続カード（順次フェードイン） */}
    {showConnectionCount > 0 && (
      <section>
        {result.structured?.latent_question && (
          <LatentQuestionHeader question={result.structured.latent_question} />
        )}
        {connections.slice(0, showConnectionCount).map((conn, i) => (
          <div key={i} className="animate-page-enter"
            style={{ animationDelay: `${i * 400}ms`, animationFillMode: "backwards" }}>
            <KnowledgeCard
              title={conn.title}
              description={conn.description}
              sourceUrl={conn.source_url}
              sourceTitle={conn.source_title}
              bookmarked={conn.bookmarked ?? false}
              onBookmark={() => { if (conn.id) fetch(`/api/connections/${conn.id}/bookmark`, { method: "POST" }); }}
            />
          </div>
        ))}
      </section>
    )}

    {/* 完了 */}
    {phase === "done" && (
      <div className="text-center pt-2">
        <span className="text-[10px]"
          style={{ color: "var(--text-hint)", fontFamily: "var(--font-mono)" }}>done</span>
      </div>
    )}

    {/* エラー（既存と同じ） */}
    {phase === "error" && (
      <div className="text-center space-y-3">
        <p className="text-[13px]" style={{ color: "var(--error)" }}>
          {result.error || "通信エラー"}
        </p>
        <button onClick={() => { setPhase("idle"); setResult({}); startRecording(); }}
          className="px-4 py-2 rounded-lg text-[13px]"
          style={{ background: "var(--bg-tertiary)", color: "var(--text-primary)" }}>
          再試行
        </button>
      </div>
    )}
  </div>
)}
```

### 追加するstate

```tsx
import { quotes } from "@/lib/quotes";

// コンポーネント内に追加
const [randomQuote] = useState(() => quotes[Math.floor(Math.random() * quotes.length)]);
```

### アニメーション追加

`src/app/globals.css` に追加（既存の `@keyframes page-enter` を変更なし）:

`animationDelay` と `animationFillMode: "backwards"` を使って順次表示を実現。globals.cssの変更は不要。

commit: `FIX: §9 録音結果画面刷新（具体→抽象可視化+名言ローディング+順次フェードイン）`

---

## §10. ホーム — ノードプレビュー修正

**対象:** `src/app/page.tsx`

### 変更1: タップ先

```tsx
// 変更前
router.push(`/memo/${pickedIdea.id}`);
// 変更後
router.push(`/graph/explore?root=${pickedIdea.id}`);
```

**注意:** 拡張グラフが直接表示される `/graph/explore` ルートは不要になった（全部 graph/page.tsx 内で動くため）。代わりに以下のようにする:

```tsx
// 変更後（グラフタブに遷移、ノードは自動選択される仕組みを§1で入れる場合）
router.push(`/graph`);
```

**もしくは**、graph/page.tsx に `?root=xxx` パラメータを受け取る機能を追加:
- URLパラメータ `root` があれば、Level 1を飛ばしてそのノードのタグを自動展開 → そのノードを中心にLevel 3表示

### 変更2: ノードプレビューの見た目

現在の `node-preview.tsx` はメインノード+衛星3つの静的SVG。

変更: **ピックアップしたノードが属するタグクラスタの一部を表示する**

```tsx
// NodePreview内で:
// 1. pickedIdea.tags[0] を取得
// 2. そのタグに属するノードを3-4件取得
// 3. 中央にメインノード（graph_label）、周囲にタグ仲間のノード（graph_label小さく）、線で接続
// 4. 左上にタグ名を小さく表示
```

具体的なSVG:

```tsx
<svg viewBox="0 0 360 280" className="w-full" style={{ maxWidth: 360 }}>
  {/* タグ名 */}
  <text x="20" y="24" fontSize="11" fill="var(--text-hint)" fontFamily="var(--font-mono)">
    {mainTag}
  </text>

  {/* 接続線 */}
  {satellites.map((sat, i) => (
    <line key={`l-${i}`} x1="180" y1="140" x2={sat.x} y2={sat.y}
      stroke="var(--border)" strokeWidth="0.5" />
  ))}

  {/* メインノード */}
  <circle cx="180" cy="140" r="50" fill="var(--bg-secondary)" stroke="var(--border)" strokeWidth="1" />
  <text x="180" y="138" textAnchor="middle" dominantBaseline="central"
    fontSize="13" fontWeight="500" fill="var(--text-primary)">
    {pickedIdea.graph_label}
  </text>

  {/* 衛星ノード */}
  {satellites.map((sat, i) => (
    <g key={`s-${i}`}>
      <circle cx={sat.x} cy={sat.y} r="16" fill="var(--bg-secondary)"
        stroke="var(--border-light)" strokeWidth="0.5" />
      <text x={sat.x} y={sat.y} textAnchor="middle" dominantBaseline="central"
        fontSize="9" fill="var(--text-muted)">
        {sat.label}
      </text>
    </g>
  ))}
</svg>
```

commit: `FIX: §10 ホーム — タグクラスタ切り取りプレビュー+グラフ遷移`

---

## §11. CLAUDE.md 更新

ビルド順序セクション追加:

```markdown
## ビルド順序（v5）

REVISION_SPEC_v5.md で以下を実行:
- §0: types拡張（graph_label, tags）+ seed data
- §1-§4: グラフ全面書き換え（タグクラスタ→ノード展開→拡張グラフ+詳細パネル+combine）
- §5: パンくず+ガイドライン適用
- §6: チャットコンテキストヘッダー
- §7: サジェスト質問ボタン
- §8: メモ詳細 — 全接続カードに深掘りボタン
- §9: 録音結果画面刷新（具体→抽象可視化）
- §10: ホーム — タグクラスタプレビュー
```

commit: `FIX: §11 CLAUDE.md更新`

---

## 品質チェックリスト

### types + seed（§0）
- [ ] Idea に graph_label: string と tags: string[] が追加されている
- [ ] 全13件の seed data に graph_label と tags が設定されている
- [ ] tags は配列で、先頭がメインタグ

### タグクラスタ Level 1（§1）
- [ ] グラフタブ → タグクラスタが放射状に表示
- [ ] 各クラスタにタグ名+ノード数
- [ ] クラスタ内にうっすらノードの点が見える
- [ ] 多属性ノードが属するタグ間に薄い破線
- [ ] タグタップでLevel 2に遷移

### ノード展開 Level 2（§2）
- [ ] タグタップ → そのタグのノードが放射状展開
- [ ] ノード内テキスト = graph_label（抽象）
- [ ] ノードサイズ = 接続数で変動
- [ ] パンくずにタグ名が表示

### 拡張グラフ Level 3（§3）
- [ ] ノードタップ → 中央化+接続先+外部知識が枝で広がる
- [ ] 既存ノードが消えない
- [ ] 外部知識: フォーカス中はテキスト、それ以外は点のみ
- [ ] パン/ピンチ動作
- [ ] タップとパンが競合しない（5px閾値）
- [ ] ヒットエリア拡張（r+12px）
- [ ] navigator.vibrate(10)がタップ時に発火
- [ ] scale < 0.7 でラベル非表示（意味的ズーム）
- [ ] 探索起点ノードがstroke-width: 2で強調
- [ ] パンくずに探索パス表示

### 詳細パネル+combine（§4）
- [ ] ideaタップ → パネル（graph_label+summary+keywords+ボタン）
- [ ] 外部知識タップ → 外部知識パネル
- [ ] combine → バナー+点滅+2つ目タップ→API→結果
- [ ] キャンセル3通り

### resetボタン（§5）
- [ ] ヘッダー右上の「reset」タップ → タグクラスタに戻る
- [ ] パンくずのタグ名タップ → Level 2に戻る

### チャットヘッダー（§6）
- [ ] 接続起点チャット → 上部にカード表示
- [ ] 元メモ+接続先summary + 接続理由

### サジェスト（§7）
- [ ] 新規チャット → 3ボタン → タップ送信 → 消える
- [ ] 3往復後 → フォローアップ2つ

### メモ詳細深掘り（§8）
- [ ] 各外部知識カードに「深掘り →」ボタン
- [ ] タップで /chat?connection={connId} に遷移

### 録音結果（§9）
- [ ] 文字起こし → ↓矢印 → 構造化（抽象原則強調）
- [ ] 接続検索中: 名言+ローディング
- [ ] 3件揃ったら名言消える → カード順次フェードイン
- [ ] 各カード400ms間隔

### ホーム（§10）
- [ ] ノードプレビューにタグ名+graph_label表示
- [ ] タップでグラフに遷移

---

## 変更ファイル一覧

| ファイル | 操作 |
|---------|------|
| `src/lib/types.ts` | 変更（graph_label, tags追加） |
| `src/lib/mock/seed.ts` | 変更（全13件にgraph_label, tags追加） |
| `src/lib/graph/types.ts` | 新規 |
| `src/lib/graph/layout.ts` | 新規 |
| `src/app/graph/page.tsx` | **全面書き換え** |
| `src/components/graph/detail-panel.tsx` | 新規 |
| `src/components/graph/combine-panel.tsx` | 新規 |
| `src/components/graph/breadcrumb.tsx` | 新規 |
| `src/components/chat/context-header.tsx` | 新規 |
| `src/components/chat/suggest-buttons.tsx` | 新規 |
| `src/components/knowledge-card.tsx` | 変更（深掘りボタン追加） |
| `src/app/memo/[id]/page.tsx` | 変更（deep diveリンク追加） |
| `src/app/record/page.tsx` | 変更（結果表示刷新） |
| `src/app/page.tsx` | 変更（プレビュー+遷移先） |
| `src/components/node-preview.tsx` | 変更（タグクラスタ切り取り） |
| `CLAUDE.md` | 変更 |
